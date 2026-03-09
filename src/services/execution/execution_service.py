from src.domain.events import OrderApproved
from src.infrastructure.event_bus import event_bus
from src.infrastructure.logger import log
from src.services.execution.reconcile import Reconciler

from src.infrastructure.mt5_adapter import mt5_adapter

class ExecutionService:
    def __init__(self):
        self.reconciler = Reconciler()
        self.running = False
        self._last_position_count = -1
        self._sync_ticks = 0
        self._session_check_ticks = 0
        log.info("ExecutionService initialized.")

    async def start(self):
        self.running = True
        event_bus.subscribe("ORDER_APPROVED", self.on_order_approved)
        log.info("ExecutionService listening for Approved Orders.")
        
        import asyncio
        asyncio.create_task(self._telemetry_loop())

    async def stop(self):
        self.running = False

    async def _telemetry_loop(self):
        from src.domain.events import LiveAccountUpdate, LivePositionUpdate
        while self.running:
            try:
                import asyncio
                # 1. Account Info
                account = await mt5_adapter.get_account_info()
                if account:
                    await event_bus.publish(LiveAccountUpdate(
                        equity=account.equity,
                        balance=account.balance,
                        profit=account.profit,
                        margin=account.margin
                    ))
                
                # 2. Active Positions
                positions = await mt5_adapter.get_positions()
                if positions is not None:
                    db_trades = None
                    db_map = {}
                    if len(positions) > 0:
                        from src.infrastructure.event_store import event_store
                        db_trades = await event_store.get_active_trades()
                        db_map = {t.ticket: t for t in db_trades}
                        for p in positions:
                            if p.ticket in db_map:
                                p.strategy_name = db_map[p.ticket].strategy_name

                    # Convert trades to dicts for the frontend
                    trades_list = []
                    from src.application.services.asset_selection_service import asset_selection_service
                    for p in positions:
                        p_dict = p.dict()
                        
                        # Fix: Strategy Name is now natively stored in the Magic Number!
                        from src.domain.models import get_strategy_for_magic
                        strategy_name = get_strategy_for_magic(p.magic)
                        
                        # Fallback just in case it's an old trade or manual trade that happens to be in DB
                        if strategy_name == "Unknown" and p.ticket in db_map:
                            strategy_name = db_map[p.ticket].strategy_name
                            
                        p_dict["strategy_name"] = strategy_name
                        
                        # Fix: Determine true asset_class from MT5 Adapter's heuristic instead of db_map which lacks it
                        asset_class = p.asset_class if hasattr(p, 'asset_class') and p.asset_class != "UNKNOWN" else "FOREX"
                        
                        mins_past = asset_selection_service.minutes_since_schedule_end(p.symbol, asset_class)
                        mins_until = asset_selection_service.minutes_until_schedule_end(p.symbol, asset_class)
                        
                        p_dict["is_market_closed"] = (mins_past >= 0)
                        p_dict["minutes_until_close"] = mins_until if mins_until >= 0 else None
                        trades_list.append(p_dict)

                    await event_bus.publish(LivePositionUpdate(
                        count=len(trades_list),
                        trades=trades_list
                    ))

                    # 3. Handle Desyncs (Ghosts/Orphans)
                    if self._last_position_count != -1 and len(positions) != self._last_position_count:
                        log.warning(f"Position count changed from {self._last_position_count} to {len(positions)}. Reconciling state...")
                        await self.reconcile_state()
                    self._last_position_count = len(positions)

                    # 4. Periodically save floating profit to DB for historical accuracy if closed by SL/TP
                    self._sync_ticks += 1
                    if self._sync_ticks >= 12: # Every 3 seconds approx
                        self._sync_ticks = 0
                        from src.infrastructure.event_store import event_store
                        # Optimistic update, ignoring DB transaction locks if possible, or awaiting safely
                        for p in positions:
                            if db_trades is None:
                                db_trades = await event_store.get_active_trades()
                                db_map = {t.ticket: t for t in db_trades}
                            if p.ticket in db_map:
                                db_p = db_map[p.ticket]
                                db_p.profit = p.profit
                                db_p.close_price = p.close_price
                                await event_store.upsert_trade(db_p)
                                
                    # 4.b Dynamic Trailing Stop / Break-Even Logic
                    try:
                        for p in positions:
                             if p.tp > 0 and p.sl > 0:
                                 # Calculate total distance to TP
                                 total_distance = abs(p.tp - p.open_price)
                                 # Calculate current distance covered
                                 current_distance = abs(p.close_price - p.open_price)
                                 
                                 if total_distance > 0:
                                     progress_pct = current_distance / total_distance
                                     
                                     is_buy = p.side == "BUY" or getattr(p, "type", 1) == 0 # Handle enum or MT5 raw
                                     
                                     # Let's say we activate Break-Even at 50%
                                     if progress_pct >= 0.50 and p.profit > 0:
                                          # Partial Take Profit (TP1) at exactly 1x Risk/Reward distance
                                          original_sl_distance = abs(p.open_price - p.sl)
                                          if original_sl_distance > 0 and current_distance >= original_sl_distance:
                                              # Check if we still have the full volume (approximate to avoid float issues)
                                              # Need original volume from DB or roughly check if it's large enough.
                                              # For safety, we only partial close if volume > 0.01 and we haven't done it yet
                                              # A simple flag or just checking if volume hasn't been halved:
                                              if p.ticket in db_map:
                                                  db_origin_vol = db_map[p.ticket].volume
                                                  if p.volume >= db_origin_vol * 0.99 and p.volume > 0.01:
                                                      partial_vol = round(p.volume / 2.0, 2)
                                                      # MT5 minimum volume check
                                                      if partial_vol >= 0.01:
                                                          log.info(f"ExecutionService: PARTIAL TAKE-PROFIT (1:1 R/R) for {p.symbol}. Closing {partial_vol} lots.")
                                                          success = await mt5_adapter.close_position(p.ticket, volume=partial_vol)
                                                          if success:
                                                              from src.services.notification.notification_service import notification_service
                                                              await notification_service.send_alert("PARCIAL EXECUTADA", f"{p.symbol} andou 1:1 do risco. Lucro parcial garantido no bolso!", "SUCCESS")

                                          # Determine if SL is already at or past open_price
                                          sl_needs_move = False
                                          if is_buy and p.sl < p.open_price:
                                              sl_needs_move = True
                                          elif not is_buy and p.sl > p.open_price:
                                              sl_needs_move = True
                                              
                                          if sl_needs_move:
                                              # Move to Open Price (Break Even) + small margin to cover spread if desired
                                              # For MVP: Move exactly to open price
                                              new_sl = p.open_price
                                              log.info(f"ExecutionService: BREAK-EVEN triggered for {p.symbol}. Moving SL to {new_sl}")
                                              success = await mt5_adapter.modify_position(p.ticket, new_sl=new_sl)
                                              if success:
                                                  from src.services.notification.notification_service import notification_service
                                                  await notification_service.send_alert("BREAK-EVEN ATIVADO", f"O trade {p.symbol} andou a favor. Operação protegida no zero-a-zero.", "INFO")
                                              
                                     # Trailing Stop: If progress >= 75%, keep trailing it 25% behind
                                     if progress_pct >= 0.75 and p.profit > 0:
                                         trail_distance = total_distance * 0.25
                                         if is_buy:
                                              new_sl = p.close_price - trail_distance
                                              if new_sl > p.sl: # Only move UP
                                                   log.info(f"ExecutionService: TRAILING STOP for {p.symbol}. SL advanced to {new_sl}")
                                                   success = await mt5_adapter.modify_position(p.ticket, new_sl=new_sl)
                                                   if success:
                                                       from src.services.notification.notification_service import notification_service
                                                       await notification_service.send_alert("TRAILING STOP", f"Acompanhando tendência em {p.symbol}. Novo Stop: {new_sl:.5f}", "SUCCESS")
                                         else:
                                              new_sl = p.close_price + trail_distance
                                              if new_sl < p.sl: # Only move DOWN
                                                   log.info(f"ExecutionService: TRAILING STOP for {p.symbol}. SL advanced to {new_sl}")
                                                   success = await mt5_adapter.modify_position(p.ticket, new_sl=new_sl)
                                                   if success:
                                                       from src.services.notification.notification_service import notification_service
                                                       await notification_service.send_alert("TRAILING STOP", f"Acompanhando tendência em {p.symbol}. Novo Stop: {new_sl:.5f}", "SUCCESS")
                                                   
                    except Exception as ts_e:
                         log.error(f"ExecutionService: Trailing Stop Logic Error: {ts_e}")

                    # 5. Smart End-Of-Session Closures
                    self._session_check_ticks += 1
                    if self._session_check_ticks >= 240: # Every ~60 seconds
                        self._session_check_ticks = 0
                        await self._monitor_session_closures(positions)

                    # 6. Global Daily Circuit Breaker
                    if not getattr(self, "circuit_breaker_tripped", False):
                        await self._check_circuit_breaker(positions)
                    else:
                        # If tripped, ensure no positions are open at all
                        if len(positions) > 0:
                            log.critical("Circuit Breaker is ACTIVE but trades are open! Forcing closure.")
                            for p in positions:
                                await mt5_adapter.close_position(p.ticket, p.volume)

            except Exception as e:
                log.debug(f"Telemetry Loop Error (expected if not connected): {e}")

            import asyncio
            await asyncio.sleep(0.25)

    async def _check_circuit_breaker(self, current_positions):
        """Checks if the daily drawdown limit has been breached."""
        from src.infrastructure.config import settings
        from src.infrastructure.event_store import event_store
        from src.services.notification.notification_service import notification_service
        from src.application.services.guardian_service import guardian_service
        
        max_loss = getattr(guardian_service.config, "global_max_daily_loss_currency", -50.0) 
        
        realized_pnl = await event_store.get_todays_realized_pnl()
        floating_pnl = sum([p.profit for p in current_positions]) if current_positions else 0.0
        
        total_daily_pnl = realized_pnl + floating_pnl
        
        if total_daily_pnl <= max_loss:
            log.critical(f"CIRCUIT BREAKER: Daily PnL ({total_daily_pnl:.2f}) surpassed maximum loss limit ({max_loss}). Halt initiated.")
            self.circuit_breaker_tripped = True
            
            await notification_service.send_alert(
                 "🚨 CIRCUIT BREAKER 🚨", 
                 f"Perda máxima diária atingida ({total_daily_pnl:.2f}). Robô bloqueado pelo resto do dia. Posições sendo liquidadas.", 
                 "ERROR"
            )
            
            # Close everything immediately
            from src.infrastructure.mt5_adapter import mt5_adapter
            if current_positions:
                for p in current_positions:
                    log.warning(f"Circuit Breaker Liquidating: {p.symbol} [Ticket {p.ticket}]")
                    await mt5_adapter.close_position(p.ticket, p.volume)

    async def _monitor_session_closures(self, positions):
        """Monitors and closes trades based on End-Of-Session smart logic."""
        from src.application.services.asset_selection_service import asset_selection_service
        from src.infrastructure.config import settings
        from src.services.notification.notification_service import notification_service
        
        for p in positions:
            symbol = p.symbol
            # We must map MT5 position to its internal asset class.
            # Using simple heuristic or fetching from open trades DB
            from src.infrastructure.event_store import event_store
            db_trades = await event_store.get_active_trades()
            db_map = {t.ticket: t for t in db_trades}
            
            asset_class = p.asset_class if hasattr(p, 'asset_class') and p.asset_class != "UNKNOWN" else "FOREX"
            if p.ticket in db_map and hasattr(db_map[p.ticket], 'asset_class') and db_map[p.ticket].asset_class != "UNKNOWN":
                 asset_class = db_map[p.ticket].asset_class
                 
            minutes_past = asset_selection_service.minutes_since_schedule_end(symbol, asset_class)
            
            try:
                if minutes_past >= 0:
                    # Session is Over!
                    if p.profit > 0:
                        if settings.SESSION_CLOSE_WINNERS_IMMEDIATELY:
                            log.info(f"End-Of-Session: Closing WINNER {symbol} [Ticket {p.ticket}] with profit {p.profit}")
                            await mt5_adapter.close_position(p.ticket, p.volume)
                            await notification_service.send_alert("EOS WIN CLOSE", f"Closed {symbol} at {p.profit} profit", "INFO")
                    else:
                        # Losing trade - Hysteresis Window
                        if minutes_past >= settings.SESSION_LOSER_REVERSAL_WINDOW_MINUTES:
                            log.warning(f"End-Of-Session: Closing LOSER {symbol} [Ticket {p.ticket}] - Reversal Window Expired ({minutes_past:.1f}m past).")
                            await mt5_adapter.close_position(p.ticket, p.volume)
                            await notification_service.send_alert("EOS FORCE CLOSE", f"Closed {symbol} at {p.profit} loss (Window expired)", "WARNING")
                        elif minutes_past > 0 and p.profit >= 0.0:
                             # Reversal rescue! It's past the deadline but it recovered to Zero or better during the window!
                             log.success(f"End-Of-Session: RESCUE CLOSING {symbol} [Ticket {p.ticket}] - Recovered to {p.profit} during Reversal Window!")
                             await mt5_adapter.close_position(p.ticket, p.volume)
                             await notification_service.send_alert("EOS RESCUE CLOSE", f"Escaped {symbol} at {p.profit} during extra window!", "SUCCESS")
            except Exception as e:
                log.error(f"End-Of-Session: Failed to process closure for {symbol} [Ticket {p.ticket}]: {e}")
                continue

    def get_state(self) -> dict:
        return {
            "status": "RUNNING",
            "circuit_breaker_tripped": getattr(self, "circuit_breaker_tripped", False)
        }

    async def reconcile_state(self):
        return await self.reconciler.reconcile()

    async def on_order_approved(self, event):
        # 0. Circuit Breaker Protection
        if getattr(self, "circuit_breaker_tripped", False):
            log.warning("ExecutionService: Order received but Circuit Breaker is ACTIVE. Order CANCELED.")
            return

        order_data = event.payload
        # order = Order(**order_data) # Safe unpacking
        if isinstance(order_data, dict):
             # Need to handle nested RiskSnapshot if dict
             # Pydantic usually handles this if we init the model
             # But let's assume event payload is Dict for now.
             # Order model import needed? Yes, but let's avoid if not modifying.
             # Just pass to adapter? Adapter expects Order object.
             from src.domain.models import Order
             order = Order(**order_data)
        else:
             order = order_data

        log.info(f"ExecutionService: Received Order for {order.symbol}. Executing...")
        
        # Call MT5 Adapter
        try:
            # 1. Spread Protection
            import asyncio
            tick_dict = await asyncio.to_thread(mt5_adapter.mt5_worker_client.send_command, "symbol_info_tick", args=[order.symbol])
            if tick_dict:
                ask_price = tick_dict.get("ask", 0.0)
                bid_price = tick_dict.get("bid", 0.0)
                point = await asyncio.to_thread(mt5_adapter.mt5_worker_client.send_command, "get_symbol_info", args=[order.symbol])
                if ask_price > 0 and bid_price > 0 and point:
                    spread_raw = ask_price - bid_price
                    # Get point value to convert spread to points/pips
                    point_val = point.get("point", 0.00001)
                    spread_points = spread_raw / point_val if point_val > 0 else 0
                    
                    from src.application.services.guardian_service import guardian_service
                    from src.domain.models import get_asset_class
                    
                    asset_class = get_asset_class(order.symbol)
                    profile = guardian_service.config.profiles.get(asset_class.value)
                    
                    if profile and profile.spread_max_points > 0:
                        max_spread = profile.spread_max_points
                    else:
                        max_spread = getattr(guardian_service.config, "global_max_spread_points", 500)
                    
                    if spread_points > max_spread:
                        log.warning(f"ExecutionService: SPREAD PROTECTION triggered for {order.symbol}. Spread: {spread_points:.1f} pts > {max_spread}. Order Canceled.")
                        from src.domain.events import OrderFailed
                        await event_bus.publish(OrderFailed(order=order, reason=f"Spread Protection: {spread_points:.1f} pts"))
                        return
                    else:
                        log.debug(f"ExecutionService: Spread check OK for {order.symbol} ({spread_points:.1f} pts).")

            ticket = await mt5_adapter.execute_order(order)
            
            if ticket and ticket > 0:
                log.success(f"ExecutionService: Order EXECUTED. Ticket: {ticket}")
                from src.domain.events import OrderFilled
                from src.domain.models import Trade, TradeStatus
                from datetime import datetime
                from src.infrastructure.event_store import event_store
                
                # Persist Trade locally before Reconcile loop catches it (optimistic UI)
                trade = Trade(
                    ticket=ticket,
                    symbol=order.symbol,
                    side=order.side,
                    volume=order.volume,
                    open_price=0.0, # Will be updated by reconcile immediately
                    open_time=datetime.utcnow(),
                    sl=order.sl,
                    tp=order.tp,
                    status=TradeStatus.OPEN,
                    magic=order.magic_number,
                    comment=order.comment,
                    strategy_name=order.strategy_name
                )
                await event_store.upsert_trade(trade)
                await event_bus.publish(OrderFilled(order=order, ticket=ticket, price=0.0))
            else:
                log.error(f"ExecutionService: Order FAILED for {order.symbol}. Ticket: {ticket}")
                from src.domain.events import OrderFailed
                await event_bus.publish(OrderFailed(order=order, reason="Broker rejected or timed out"))
                
        except Exception as e:
            log.error(f"ExecutionService: Execution Exception: {e}", exc_info=True)
            from src.domain.events import OrderFailed
            await event_bus.publish(OrderFailed(order=order, reason=f"Exception: {str(e)}"))

execution_service = ExecutionService()
