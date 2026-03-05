from typing import Dict, Any
from src.domain.models import Trade, TradeStatus
from src.domain.events import PositionAdopted, PositionDesyncClosed, StateReconciled
from src.infrastructure.event_bus import event_bus
from src.infrastructure.event_store import event_store
from src.infrastructure.mt5_adapter import mt5_adapter
from src.infrastructure.logger import log
from src.services.notification.notification_service import notification_service

class Reconciler:
    async def reconcile(self) -> Dict[str, int]:
        """
        Synchronizes DB state with MT5 State.
        Returns stats dict.
        """
        log.info("Starting State Reconciliation...")
        
        # 1. Get Truth (MT5)
        mt5_positions = await mt5_adapter.get_positions()
        if mt5_positions is None:
             log.critical("Reconciliation Aborted: MT5 connection failed.")
             await notification_service.send_alert("CRITICAL: RECONCILE FAILED", "MT5 Unreachable during reconcile", "CRITICAL")
             return {"status": "failed"}

        mt5_map = {p.ticket: p for p in mt5_positions}
        
        # 2. Get Memory (DB)
        db_trades = await event_store.get_active_trades()
        db_map = {t.ticket: t for t in db_trades}
        
        stats = {"adopted": 0, "closed": 0, "verified": 0}

        # 3. Adopt Orphans (In MT5, not in DB)
        from datetime import datetime
        from src.domain.models import get_strategy_for_magic
        
        for ticket, trade in mt5_map.items():
            if ticket not in db_map:
                # To prevent race conditions where MT5 executed but ExecutionService hasn't upserted yet:
                # Skip adopting if the trade was opened in the last 15 seconds.
                age_seconds = (datetime.utcnow() - trade.open_time).total_seconds() if trade.open_time else 0
                if age_seconds < 15:
                    log.debug(f"Reconcile: Skipping recent ORPHAN {ticket} {trade.symbol} (Age: {age_seconds:.1f}s) to allow ExecutionService to persist it.")
                    continue
                    
                # Decode the natively stored strategy directly from the MT5 broker
                trade.strategy_name = get_strategy_for_magic(trade.magic)

                log.warning(f"Reconcile: Adopting ORPHAN {ticket} {trade.symbol} [Strat: {trade.strategy_name}]")
                await event_store.upsert_trade(trade)
                await event_bus.publish(PositionAdopted(trade=trade))
                stats["adopted"] += 1
            else:
                stats["verified"] += 1

        # 4. Close Ghosts (In DB, not in MT5)
        from datetime import datetime
        for ticket, trade in db_map.items():
            if ticket not in mt5_map:
                log.warning(f"Reconcile: Closing GHOST {ticket} {trade.symbol}")
                trade.status = TradeStatus.CLOSED
                trade.comment = "Closed by Reconciliation (Desync)"
                trade.close_time = trade.close_time or datetime.utcnow()
                
                await event_store.upsert_trade(trade)
                await event_bus.publish(PositionDesyncClosed(ticket=ticket, symbol=trade.symbol))
                stats["closed"] += 1

        # 5. Sync Historical Closed Deals (Missed execution closures)
        # Fetch deals from the last 7 days to recover trades that were closed while the bot was offline
        from datetime import timedelta
        to_date = datetime.utcnow() + timedelta(days=1)
        from_date = datetime.utcnow() - timedelta(days=7)
        
        deals = await mt5_adapter.get_history_deals(from_date, to_date)
        if deals:
            closed_position_ids = set()
            for d in deals:
                if d.get("entry") in [1, 2]: # OUT or INOUT
                    pos_id = d.get("position_id")
                    if pos_id:
                        closed_position_ids.add(pos_id)
            
            if closed_position_ids:
                local_closed = await event_store.get_closed_trades(limit=1000)
                local_closed_ids = {t.ticket for t in local_closed}
                missing_closed_ids = closed_position_ids - local_closed_ids
                
                # Also exclude any trades currently OPEN in DB
                missing_closed_ids = missing_closed_ids - set(db_map.keys())
                
                if missing_closed_ids:
                    from src.domain.models import OrderSide
                    for pos_id in missing_closed_ids:
                        pos_deals = [d for d in deals if d.get("position_id") == pos_id]
                        if not pos_deals:
                            continue
                        
                        in_deals = [d for d in pos_deals if d.get("entry") == 0]
                        out_deals = [d for d in pos_deals if d.get("entry") in [1, 2]]
                        
                        if in_deals and out_deals:
                            in_d = in_deals[0]
                            out_d = sorted(out_deals, key=lambda x: x.get("time", 0))[-1]
                            
                            total_profit = sum(d.get("profit", 0.0) + d.get("commission", 0.0) + d.get("swap", 0.0) for d in out_deals)
                            side = OrderSide.BUY if in_d.get("type") == 0 else OrderSide.SELL
                            
                            sym_upper = in_d.get("symbol", "").upper()
                            asset_class = "UNKNOWN"
                            if "BTC" in sym_upper or "ETH" in sym_upper or "SOL" in sym_upper:
                                asset_class = "CRYPTO"
                            elif any(k in sym_upper for k in ["US30", "USA30", "US100", "NAS", "GER40", "UK100", "SPX", "WIN", "US500", "USTEC", "DE30", "FRA40", "HK50"]):
                                asset_class = "INDICES"
                            elif any(k in sym_upper for k in ["XAU", "XAG", "GOLD", "SILVER", "PLAT", "PALL"]):
                                asset_class = "METALS"
                            elif any(k in sym_upper for k in ["OIL", "WTI", "BRENT", "NATGAS", "GAS", "CORN", "SOY", "SUGAR", "WHEAT"]):
                                asset_class = "COMMODITIES"
                            elif any(char.isdigit() for char in sym_upper) and len(sym_upper) >= 5:
                                asset_class = "STOCKS_BR"
                            elif len(sym_upper.replace("-T", "").replace(".T", "")) <= 4:
                                asset_class = "STOCKS_US"
                            else:
                                asset_class = "FOREX"
                                
                            strategy_name = get_strategy_for_magic(in_d.get("magic", 0))
                            
                            trade = Trade(
                                ticket=pos_id,
                                symbol=in_d.get("symbol"),
                                side=side,
                                volume=in_d.get("volume"),
                                open_price=in_d.get("price", 0.0),
                                open_time=datetime.fromtimestamp(in_d.get("time", 0)),
                                sl=0.0,
                                tp=0.0,
                                close_price=out_d.get("price", 0.0),
                                close_time=datetime.fromtimestamp(out_d.get("time", 0)),
                                profit=total_profit,
                                status=TradeStatus.CLOSED,
                                magic=in_d.get("magic", 0),
                                comment=(in_d.get("comment", "") + " [Recovered]").strip(),
                                asset_class=asset_class,
                                strategy_name=strategy_name
                            )
                            
                            log.warning(f"Reconcile: Recovered MISSING CLOSED {pos_id} {trade.symbol} from MT5 History ({total_profit})")
                            await event_store.upsert_trade(trade)
                            stats["adopted"] += 1

        log.success(f"Reconciliation Result: {stats}")
        await event_bus.publish(StateReconciled(stats=stats))
        
        if stats["adopted"] > 0 or stats["closed"] > 0:
            await notification_service.send_alert(
                "RECONCILE ACTION", 
                f"Adopted: {stats['adopted']}, Closed: {stats['closed']}", 
                "WARNING"
            )
            
        return stats
