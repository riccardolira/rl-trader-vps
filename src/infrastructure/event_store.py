import json
from typing import List, Any
from datetime import date
from sqlalchemy import select, func, text
from sqlalchemy.dialects.mysql import insert as mysql_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert

from src.infrastructure.database.connection import db_pool
from src.domain.interfaces import IPersistence
from src.domain.models import Trade, TradeStatus
from src.infrastructure.config import settings
from src.infrastructure.logger import log
from src.infrastructure.database.models import TradeModel, AuditEventModel
from src.infrastructure.cache import async_ttl_cache

class EventStore(IPersistence):
    
    async def save_event(self, event: Any):
        """Persist an event to the audit log."""
        if getattr(event, "type", "") == "UNIVERSE_SNAPSHOT":
            return # Skip saving massive payloads to DB
        
        try:
            payload_str = json.dumps(event.payload, default=str)
            values = dict(
                id=event.event_id,
                timestamp=event.timestamp,
                type=event.type,
                component=event.component,
                severity=event.severity,
                correlation_id=event.correlation_id,
                payload_json=payload_str
            )
            
            if db_pool.is_mysql:
                stmt = mysql_insert(AuditEventModel).values(**values).prefix_with('IGNORE')
            else:
                stmt = sqlite_insert(AuditEventModel).values(**values).on_conflict_do_nothing()
                
            await db_pool.execute(stmt)
        except Exception as e:
            if "1142" in str(e) and "audit_events" in str(e):
                pass # Suppress logging for known permission issue to avoid console flood
            else:
                log.error(f"Failed to persist event {event}: {e}")

    @async_ttl_cache(ttl_seconds=2)
    async def get_active_trades(self) -> List[Trade]:
        """Retrieve trades with OPEN status."""
        trades = []
        try:
            stmt = select(TradeModel).where(TradeModel.status == 'OPEN')
            rows = await db_pool.execute(stmt, fetch="all", dictionary=True)
            for row in rows:
                trades.append(self._row_to_trade(row))
        except Exception as e:
            log.error(f"Failed to fetch active trades: {e}")
        return trades

    @async_ttl_cache(ttl_seconds=3)
    async def get_closed_trades(self, limit: int = 100) -> List[Trade]:
        """Retrieve trades with CLOSED status, ordered by most recent first."""
        trades = []
        try:
            stmt = select(TradeModel).where(TradeModel.status == 'CLOSED').order_by(TradeModel.close_time.desc()).limit(limit)
            rows = await db_pool.execute(stmt, fetch="all", dictionary=True)
            for row in rows:
                trades.append(self._row_to_trade(row))
        except Exception as e:
            log.error(f"Failed to fetch closed trades: {e}")
        return trades

    @async_ttl_cache(ttl_seconds=5)
    async def get_todays_realized_pnl(self) -> float:
        """Calculate the sum of profit for trades closed today."""
        try:
            stmt = select(func.coalesce(func.sum(TradeModel.profit), 0)).where(
                TradeModel.status == 'CLOSED',
                func.date(TradeModel.close_time) == date.today()
            )
            row = await db_pool.execute(stmt, fetch="one")
            if row:
                return float(row[0])
        except Exception as e:
            log.error(f"EventStore: Failed to calculate daily PnL: {e}")
        return 0.0

    @async_ttl_cache(ttl_seconds=60)
    async def get_performance_metrics(self, days: int = 60) -> dict:
        """B3: Calcula Sharpe, Sortino e Calmar Ratio dos últimos N dias.
        Usa os trades fechados no banco — zero impacto de memória."""
        import math
        from datetime import timedelta
        try:
            trades = await self.get_closed_trades(limit=500)
            if len(trades) < 5:
                return {"sharpe": 0.0, "sortino": 0.0, "calmar": 0.0, "win_rate": 0.0, "avg_rr": 0.0, "trades_count": len(trades)}

            # Agrupa lucro/perda por dia
            from collections import defaultdict
            daily_pnl: dict = defaultdict(float)
            for t in trades:
                day_key = t.close_time.date() if t.close_time else date.today()
                daily_pnl[day_key] += t.profit

            returns = list(daily_pnl.values())
            if len(returns) < 3:
                return {"sharpe": 0.0, "sortino": 0.0, "calmar": 0.0, "win_rate": 0.0, "avg_rr": 0.0, "trades_count": len(trades)}

            avg_return = sum(returns) / len(returns)
            std_dev = (sum((r - avg_return) ** 2 for r in returns) / len(returns)) ** 0.5
            # Sharpe (risk-free = 0 para simplificar)
            sharpe = (avg_return / std_dev) * (252 ** 0.5) if std_dev > 0 else 0.0

            # Sortino (só desvio negativo)
            neg_returns = [r for r in returns if r < 0]
            downside_std = (sum(r ** 2 for r in neg_returns) / len(neg_returns)) ** 0.5 if neg_returns else 0.001
            sortino = (avg_return / downside_std) * (252 ** 0.5)

            # Calmar (retorno total / max drawdown)
            cumulative = 0.0
            peak = 0.0
            max_dd = 0.0
            for r in returns:
                cumulative += r
                peak = max(peak, cumulative)
                dd = peak - cumulative
                max_dd = max(max_dd, dd)
            total_return = sum(returns)
            calmar = total_return / max_dd if max_dd > 0 else 0.0

            # Win Rate e R/R médio
            wins = [t for t in trades if t.profit > 0]
            losses = [t for t in trades if t.profit <= 0]
            win_rate = len(wins) / len(trades)
            avg_win = sum(t.profit for t in wins) / len(wins) if wins else 0
            avg_loss = abs(sum(t.profit for t in losses) / len(losses)) if losses else 1
            avg_rr = avg_win / avg_loss if avg_loss > 0 else 0.0

            return {
                "sharpe": round(sharpe, 3),
                "sortino": round(sortino, 3),
                "calmar": round(calmar, 3),
                "win_rate": round(win_rate, 3),
                "avg_rr": round(avg_rr, 2),
                "max_drawdown": round(max_dd, 2),
                "total_pnl": round(total_return, 2),
                "trades_count": len(trades)
            }
        except Exception as e:
            log.error(f"EventStore: get_performance_metrics failed: {e}")
            return {"sharpe": 0.0, "sortino": 0.0, "calmar": 0.0, "win_rate": 0.0, "avg_rr": 0.0, "trades_count": 0}

    @async_ttl_cache(ttl_seconds=300)
    async def get_daily_var(self, confidence: float = 0.95) -> dict:
        """B2: VaR histórico — perda máxima esperada no dia com N% de confiança.
        Baseado nos retornos diários dos últimos 60 dias."""
        try:
            trades = await self.get_closed_trades(limit=500)
            from collections import defaultdict
            daily_pnl: dict = defaultdict(float)
            for t in trades:
                day_key = t.close_time.date() if t.close_time else date.today()
                daily_pnl[day_key] += t.profit
            returns = sorted(daily_pnl.values())
            if len(returns) < 10:
                return {"var_usd": 0.0, "confidence": confidence, "days_sample": len(returns)}
            idx = int((1 - confidence) * len(returns))
            var_usd = abs(returns[idx])
            return {"var_usd": round(var_usd, 2), "confidence": confidence, "days_sample": len(returns)}
        except Exception as e:
            log.error(f"EventStore: get_daily_var failed: {e}")
            return {"var_usd": 0.0, "confidence": confidence, "days_sample": 0}


    async def upsert_trade(self, trade: Trade):
        """Insert or Update a trade record."""
        try:
            values = dict(
                ticket=trade.ticket,
                symbol=trade.symbol,
                side=trade.side,
                volume=trade.volume,
                open_price=trade.open_price,
                open_time=trade.open_time,
                sl=trade.sl,
                tp=trade.tp,
                close_price=trade.close_price,
                close_time=trade.close_time,
                profit=trade.profit,
                status=trade.status,
                magic=trade.magic,
                comment=trade.comment,
                strategy_name=trade.strategy_name,
                market_context=json.dumps(trade.market_context) if trade.market_context else None,
                # === Analytics Fields ===
                commission=getattr(trade, 'commission', 0.0) or 0.0,
                swap=getattr(trade, 'swap', 0.0) or 0.0,
                asset_class=getattr(trade, 'asset_class', None),
                reason_code=getattr(trade, 'reason_code', None),
                score_signal=getattr(trade, 'score_signal', None),
                break_even_activated=getattr(trade, 'break_even_activated', False),
                trailing_stop_activated=getattr(trade, 'trailing_stop_activated', False),
            )

            upsert_dict = {
                'close_price': values['close_price'],
                'close_time': values['close_time'],
                'profit': values['profit'],
                'status': values['status'],
                'strategy_name': values['strategy_name'],
                'market_context': values['market_context'],
                # Analytics atualizados no fechamento
                'commission': values['commission'],
                'swap': values['swap'],
                'break_even_activated': values['break_even_activated'],
                'trailing_stop_activated': values['trailing_stop_activated'],
            }

            if db_pool.is_mysql:
                stmt = mysql_insert(TradeModel).values(**values).on_duplicate_key_update(**upsert_dict)
            else:
                stmt = sqlite_insert(TradeModel).values(**values).on_conflict_do_update(
                    index_elements=['ticket'],
                    set_=upsert_dict
                )
            
            await db_pool.execute(stmt)
            log.debug(f"Upserted trade {trade.ticket}")
                
        except Exception as e:
            log.error(f"Failed to upsert trade {trade.ticket}: {e}")

    def _row_to_trade(self, row) -> Trade:
        from src.domain.models import get_strategy_for_magic
        
        magic = row.get("magic")
        strategy_name = get_strategy_for_magic(magic) if magic else "Unknown"
        
        if strategy_name == "Unknown":
            if row.get("strategy_name") and row.get("strategy_name") != "Unknown":
                strategy_name = row.get("strategy_name")
            
        market_ctx = {}
        if row.get("market_context"):
            try:
                market_ctx = json.loads(row.get("market_context"))
            except:
                pass
                
        return Trade(
            ticket=row.get("ticket"),
            symbol=row.get("symbol"),
            side=row.get("side"),
            volume=row.get("volume"),
            open_price=row.get("open_price"),
            open_time=row.get("open_time"), 
            sl=row.get("sl"),
            tp=row.get("tp"),
            close_price=row.get("close_price"),
            close_time=row.get("close_time"),
            profit=row.get("profit"),
            status=row.get("status"),
            magic=magic,
            comment=row.get("comment", ""),
            strategy_name=strategy_name,
            market_context=market_ctx,
            # === Analytics Fields ===
            commission=row.get("commission") or 0.0,
            swap=row.get("swap") or 0.0,
            asset_class=row.get("asset_class") or "UNKNOWN",
            reason_code=row.get("reason_code"),
            score_signal=row.get("score_signal"),
            break_even_activated=bool(row.get("break_even_activated", False)),
            trailing_stop_activated=bool(row.get("trailing_stop_activated", False)),
        )

    async def delete_closed_trade(self, ticket: int) -> bool:
        """Deletes a specific trade from the database by ticket ID."""
        try:
            from sqlalchemy import delete
            stmt = delete(TradeModel).where(TradeModel.ticket == ticket)
            count = await db_pool.execute(stmt)
            return count > 0
        except Exception as e:
            log.error(f"EventStore: Failed to delete trade {ticket} - {e}")
            return False

# Global Instance
event_store = EventStore()

# Delay import to avoid circular dependency
from src.infrastructure.event_bus import event_bus
event_bus.subscribe("*", event_store.save_event)
