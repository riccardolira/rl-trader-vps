from src.domain.models import Signal, DraftOrder, OrderSide, get_asset_class, InstrumentType
from src.domain.events import SignalGenerated, OrderDrafted
from src.infrastructure.event_bus import event_bus
from src.infrastructure.logger import log
import uuid

from src.application.services.asset_selection_service import asset_selection_service
from src.application.services.guardian_service import guardian_service
from src.domain.universe import GateStatus
from src.infrastructure.mt5_adapter import mt5_adapter
from src.infrastructure.config import settings

class ArbiterService:
    def __init__(self):
        log.info("ArbiterService initialized.")
        self.min_score = 60.0
        self.processed_count = 0
        self._pending_drafts = {} # symbol -> list of float timestamps

    async def start(self):
        event_bus.subscribe("SIGNAL_GENERATED", self.on_signal)
        log.info("ArbiterService listening for Signals.")

    def get_state(self) -> dict:
        """Expose internal state for UI."""
        return {
            "min_score": self.min_score,
            "processed_count": self.processed_count
        }

    async def on_signal(self, event):
        self.processed_count += 1
        signal_data = event.payload
        # Fix: event system might pass dict, better to be safe
        if isinstance(signal_data, dict):
             signal = Signal(**signal_data)
        else:
             signal = signal_data
        
        log.debug(f"Arbiter analyzing signal for {signal.symbol} (Score: {signal.score})")

        # 0. Universe Gate Check (V3 Feature)
        snap = asset_selection_service.get_snapshot()
        if snap.gate_status != GateStatus.OPEN:
            log.warning(f"Arbiter: TRADE_BLOCKED_NO_ACTIVE_SET ({signal.symbol}) - Gate Reason: {snap.gate_reason}")
            event_bus.publish("universe.trade_blocked", {"symbol": signal.symbol, "reason": snap.gate_reason})
            return

        # 0.5 Anti-Stacking Check (Max X Open Trades per Symbol)
        from src.infrastructure.event_store import event_store
        from src.application.services.guardian_service import guardian_service
        import time
        active_trades = await event_store.get_active_trades()
        symbol_trades_count = sum(1 for t in active_trades if t.symbol == signal.symbol)
        
        # Clean up old pending drafts (older than 15 seconds)
        now = time.time()
        if signal.symbol in self._pending_drafts:
            self._pending_drafts[signal.symbol] = [ts for ts in self._pending_drafts[signal.symbol] if now - ts < 15.0]
        else:
            self._pending_drafts[signal.symbol] = []
            
        pending_count = len(self._pending_drafts[signal.symbol])
        total_count = symbol_trades_count + pending_count

        max_allowed = guardian_service.config.max_trades_per_asset
        
        if total_count >= max_allowed:
            log.warning(f"Arbiter: REJECTED {signal.symbol} - Symbol reached limit of {max_allowed} open positions (Active: {symbol_trades_count}, Pending: {pending_count}).")
            event_bus.publish("arbiter.trade_rejected", {"symbol": signal.symbol, "reason": f"Max {max_allowed} Positions Reached"})
            return

        # Record this draft as pending to prevent concurrent signals from bypassing the limit
        self._pending_drafts[signal.symbol].append(now)

        # 1. Score Filter
        if signal.score < self.min_score:
            log.debug(f"Signal ignored: Score {signal.score} < {self.min_score}")
            # Remove from pending since it was rejected
            if self._pending_drafts[signal.symbol]:
                self._pending_drafts[signal.symbol].pop()
            return

        # 2. Dynamic SL/TP Calculation (Execution Layer)
        # Fetch current price from MarketData needed? 
        # Strategy provided Entry (usually close price) in Metadata? No, strategy provides Signal.
        # We need current ask/bid. 
        # For MVP: Re-fetch or rely on Signal metadata "price"?
        # Signal metadata has "point_value" (no, context had it).
        # We need point_value and price to calc stops.
        
        # We'll trust the price in metadata for now, or fetch latest. 
        # Let's use metadata "price" (Close) as approx Entry.
        # TODO: Real Arbitrage should check current spread again.
        
        entry_price = signal.metadata.get("price", 0.0)
        atr = signal.metadata.get("atr_value", 0.0)
        point = signal.metadata.get("point_value", 0.00001)
        
        stop_mult = signal.metadata.get("stop_atr_mult", 1.5)
        take_mult = signal.metadata.get("take_atr_mult", 2.0)
        
        if entry_price <= 0 or atr <= 0:
            log.warning(f"Arbiter: Invalid price/ATR for {signal.symbol}. Skipping.")
            return

        # Calc Stops
        # SL Dist = ATR * Mult
        sl_dist = atr * stop_mult
        tp_dist = atr * take_mult
        
        # Round logic (Basic)
        if signal.direction == OrderSide.BUY:
            sl_price = entry_price - sl_dist
            tp_price = entry_price + tp_dist
        else: # SELL
            sl_price = entry_price + sl_dist
            tp_price = entry_price - tp_dist
            

        # 3. Position Sizing (Dynamic Risk-Based)
        # Formula: RiskMoney = Equity * RiskPct
        #          Volume = RiskMoney / (SL_Dist_Points * TickValue)
        # However, SL_Dist here is in Price (Dist = sl_dist). 
        # TickValue is usually 'value of 1 lot for 1 point' approx?
        # Standard: Money = Volume * DistPoints * PointValue? No.
        # Forex: Money = Volume * (DistPrice / PointSize) * TickValue? 
        # Easier: Money = Volume * 100000 * DistPrice (if base currency matches).
        
        # Let's use the simplest robust approximation if we lack full ContractSpecs:
        # RiskMoney = Volume * DistPrice * (ContractSize??)
        # We need ContractSize. Usually 100,000 for FX, 100 for indices.
        # MT5 'point_value' often combines this? Not reliably.
        
        # For Phase 4, let's use a robust "risk per lot" approach if possible, or fetch equity.
        # Assumption: 1 Lot = 100,000 units.
        # Risk = Volume * (SL_Distance)
        # Wait, if `point_value` is "Value of one point for 1 lot", then:
        # RiskMoney = Volume * (SL_Dist_Points) * PointValue
        
        try:
            account_info = await mt5_adapter.get_account_info()
            if account_info and account_info.equity > 0:
                equity = account_info.equity
            else:
                equity = 10000.0
            
            # Fetch specific risk_pct from Guardian's profile for this asset class
            asset_class_str = get_asset_class(signal.symbol)
                
            profile = guardian_service.config.profiles.get(asset_class_str.value)
            
            if profile and profile.max_risk_per_trade_pct > 0:
                risk_pct = profile.max_risk_per_trade_pct / 100.0 # It's usually saved as 1 for 1%
                log.debug(f"Arbiter: Using Risk {profile.max_risk_per_trade_pct}% for {asset_class_str.value}")
            else:
                risk_pct = settings.EXECUTION_RISK_PER_TRADE  # Fallback
                log.debug(f"Arbiter: Using Fallback Risk {risk_pct*100}%")
                
            risk_money = equity * risk_pct
            
            sl_dist_points = sl_dist / point # Convert price dist back to points
            
            tick_value = signal.metadata.get("tick_value", 0.0)
            
            if sl_dist_points > 0 and tick_value > 0:
                # Formula: RiskMoney = Volume * SL_Points * TickValue
                # => Volume = RiskMoney / (SL_Points * TickValue)
                
                # Example: Risk=100, SL=50pts, Tick=1.0 (USD) -> Vol = 100 / 50 = 2.0 Lots
                # Example: Risk=100, SL=500pts, Tick=1.0 -> Vol = 0.2 Lots
                
                raw_vol = risk_money / (sl_dist_points * tick_value)
                volume = round(raw_vol, 2) # Standard step 0.01
                log.info(f"Arbiter: Dynamic Sizing: Risk={risk_money:.2f}, SL={sl_dist_points:.1f}pts, TickVal={tick_value} -> Vol={volume}")
                
                if volume < settings.EXECUTION_MIN_LOT:
                    loss_with_min_lot = settings.EXECUTION_MIN_LOT * sl_dist_points * tick_value
                    log.warning(f"Arbiter: Rejeitado. Lote minimo ({settings.EXECUTION_MIN_LOT}) causaria perda de ${loss_with_min_lot:.2f} (Max permitido: ${risk_money:.2f}).")
                    event_bus.publish("arbiter.trade_rejected", {"symbol": signal.symbol, "reason": f"Risco Excessivo: SL muito longo para o lote mínimo."})
                    # Remove from pending since it was rejected
                    if self._pending_drafts[signal.symbol]:
                        self._pending_drafts[signal.symbol].pop()
                    return
                
            else:
                volume = settings.EXECUTION_MIN_LOT
                log.warning(f"Arbiter: Missing TickValue ({tick_value}) or SL ({sl_dist_points}). Using Min Lot.")

        except Exception as e:
            log.error(f"Arbiter: Sizing Error: {e}")
            volume = settings.EXECUTION_MIN_LOT

        # Cap Volume
        if volume > settings.EXECUTION_MAX_LOT:
            volume = settings.EXECUTION_MAX_LOT
        if volume < settings.EXECUTION_MIN_LOT:
            volume = settings.EXECUTION_MIN_LOT
        
        draft = DraftOrder(
            signal_id=signal.id,
            symbol=signal.symbol,
            side=signal.direction,
            proposed_entry=entry_price,
            proposed_sl=sl_price,
            proposed_tp=tp_price,
            raw_volume=volume,
            intent_id=str(uuid.uuid4()),
            strategy_name=signal.strategy_name,
            market_context=signal.metadata
        )

        await event_bus.publish(OrderDrafted(draft=draft, component="ArbiterService"))
        log.info(f"Arbiter PROPOSED trade for {signal.symbol}: {signal.direction} @ {entry_price:.5f} [SL: {sl_price:.5f} | TP: {tp_price:.5f}]")

arbiter_service = ArbiterService()
