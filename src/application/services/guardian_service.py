from src.domain.models import DraftOrder, Order, OrderStatus, RiskSnapshot, RiskConfig, InstrumentProfile, InstrumentType, get_asset_class
from src.domain.events import OrderApproved, OrderRejected
from src.infrastructure.event_bus import event_bus
from src.infrastructure.config import settings
from src.infrastructure.logger import log
from src.infrastructure.mt5_adapter import mt5_adapter
from datetime import datetime
import json
import os

from src.infrastructure.news.news_worker import news_worker

class GuardianService:
    def __init__(self):
        log.info("GuardianService initialized.")
        self.config_path = "risk_config.json"
        self.config = self._load_config()
        self._pending_orders = [] # list of floats (timestamps)

    def _load_config(self) -> RiskConfig:
        config = RiskConfig()
        if os.path.exists(self.config_path):
            try:
                with open(self.config_path, "r") as f:
                    config = RiskConfig(**json.load(f))
            except Exception as e:
                log.error(f"Failed to load risk config: {e}")
                
        # Fill missing default profiles
        needs_save = False
        for itype in [InstrumentType.FOREX, InstrumentType.CRYPTO, InstrumentType.INDICES_NY, InstrumentType.INDICES_B3, InstrumentType.INDICES_EU, InstrumentType.METALS, InstrumentType.COMMODITIES_AGRI, InstrumentType.COMMODITIES_ENERGY, InstrumentType.STOCKS_US, InstrumentType.STOCKS_BR, InstrumentType.STOCKS_EU]:
            if itype.value not in config.profiles:
                # Set sane defaults based on asset class if needed, here we use the dataclass defaults
                profile = InstrumentProfile(type=itype)
                if itype == InstrumentType.CRYPTO:
                    profile.spread_max_points = 5000
                    profile.slippage_buffer_points = 1500
                    profile.max_risk_per_trade_pct = 0.05
                elif itype in [InstrumentType.INDICES_NY, InstrumentType.INDICES_EU]:
                    profile.spread_max_points = 400
                    profile.slippage_buffer_points = 200
                elif itype == InstrumentType.INDICES_B3:
                    profile.spread_max_points = 25
                    profile.slippage_buffer_points = 10
                elif itype in [InstrumentType.COMMODITIES_AGRI, InstrumentType.COMMODITIES_ENERGY]:
                    profile.spread_max_points = 5000
                    profile.slippage_buffer_points = 150
                elif itype == InstrumentType.METALS:
                    profile.spread_max_points = 500
                    profile.slippage_buffer_points = 150
                elif itype in [InstrumentType.STOCKS_US, InstrumentType.STOCKS_BR, InstrumentType.STOCKS_EU]:
                    profile.spread_max_points = 25
                    profile.slippage_buffer_points = 10
                config.profiles[itype.value] = profile
                needs_save = True
                
        if needs_save:
            try:
                with open(self.config_path, "w") as f:
                    json.dump(config.dict(), f, indent=2)
            except Exception as e:
                log.error(f"Failed to save default risk config profiles: {e}")

        return config

    def update_config(self, updates: dict):
        current = self.config.dict()
        current.update(updates)
        self.config = RiskConfig(**current)
        try:
            with open(self.config_path, "w") as f:
                json.dump(self.config.dict(), f, indent=2)
        except Exception as e:
            log.error(f"Failed to save risk config: {e}")

    async def start(self):
        event_bus.subscribe("ORDER_DRAFTED", self.on_order_drafted)
        log.info("GuardianService listening for Drafts.")

    def get_state(self) -> dict:
        """Expose internal state for UI."""
        return {
            "config": self.config.dict(),
            "daily_drawdown": 0.0,
            "orders_approved_today": 0
        }

    async def on_order_drafted(self, event):
        draft_data = event.payload
        # draft = DraftOrder(**draft_data)
        if isinstance(draft_data, dict):
             draft = DraftOrder(**draft_data)
        else:
             draft = draft_data
             
        log.info(f"Guardian processing draft {draft.id} for {draft.symbol}")

        # --- GATE 0: News Check (Phase 3) ---
        if self.config.news_filter_active:
            is_frozen, _, msg = news_worker.is_symbol_frozen(draft.symbol)
            if is_frozen:
                await event_bus.publish(OrderRejected(
                    reason=msg,
                    draft=draft,
                    gate="GATE_NEWS_BLACKOUT",
                    component="GuardianService"
                ))
                log.warning(f"Guardian REJECTED draft {draft.id}: {msg}")
                return

        # --- GATE 1: Max Open Trades Check ---
        try:
            import time
            now = time.time()
            # Clean up old pending orders (older than 15 seconds)
            self._pending_orders = [ts for ts in self._pending_orders if now - ts < 15.0]
            
            active_positions = await mt5_adapter.get_positions()
            active_count = len(active_positions) if active_positions is not None else 0
            pending_count = len(self._pending_orders)
            total_count = active_count + pending_count
            
            if total_count >= self.config.max_trades_open:
                await event_bus.publish(OrderRejected(
                    reason=f"Max Open Trades limit reached ({self.config.max_trades_open}). Active: {active_count}, Pending: {pending_count}",
                    draft=draft,
                    gate="GATE_MAX_TRADES_LIMIT",
                    component="GuardianService"
                ))
                log.warning(f"Guardian REJECTED draft {draft.id}: Max Open Trades limit reached.")
                return
                
            # Temporarily record this draft as pending to block concurrent drafts
            self._pending_orders.append(now)
            
        except Exception as e:
            log.error(f"Guardian: Failed to check active positions: {e}")

        # --- GATE 2: Hard Risk Cap Check ---
        # Calculation: (Entry - SL) * Volume * ContractSize = RiskMoney
        # Simplification: assuming we have pip_value or tick_value available.
        # For now, we mock the approved snapshot.

        is_approved = True
        rejection_reason = ""
        gate_failed = ""

        if not draft.proposed_sl:
            is_approved = False
            rejection_reason = "Missing Stop Loss"
            gate_failed = "GATE_SAFETY_PARAM"

        # Mock Risk Check
        if draft.raw_volume > self.config.max_lot_size:
            is_approved = False
            rejection_reason = f"Volume too high (Max {self.config.max_lot_size})"
            gate_failed = "GATE_FAT_FINGER"
            
        # --- GATE 2: Instrument Profile Checks ---
        asset_class = get_asset_class(draft.symbol)
            
        profile = self.config.profiles.get(asset_class.value)
        if profile and not profile.active:
            is_approved = False
            rejection_reason = f"Trading disabled for asset class: {asset_class.value}"
            gate_failed = "GATE_ASSET_CLASS_BLOCKED"

        if is_approved:
            # Fetch real account info for snapshot
            account_info = await mt5_adapter.get_account_info()
            equity = account_info.equity if account_info else 10000.0
            balance = account_info.balance if account_info else 10000.0
            
            from src.domain.models import get_magic_for_strategy
            
            # Create Approved Order
            order = Order(
                draft_id=draft.id,
                symbol=draft.symbol,
                side=draft.side,
                volume=draft.raw_volume,
                sl=draft.proposed_sl,
                tp=draft.proposed_tp,
                magic_number=get_magic_for_strategy(draft.strategy_name),
                comment=f"V3-{draft.intent_id[:8]}" if draft.intent_id else "V3-Auto",
                intent_id=draft.intent_id,
                strategy_name=draft.strategy_name,
                risk_snapshot=RiskSnapshot(
                    equity=equity,
                    balance=balance,
                    risk_pct=(50.0 / equity) * 100 if equity > 0 else 0.01,
                    money_risk=50.0,
                    worst_case_loss=55.0,
                    hard_cap_approved=True,
                    daily_dd_pct=0.0,
                    exposure_total=0.0
                ),
                market_context=draft.market_context
            )
            
            await event_bus.publish(OrderApproved(order=order, component="GuardianService"))
            log.success(f"Guardian APPROVED draft {draft.id}")
        else:
            # Remove from pending if rejected by later gates
            if self._pending_orders:
                self._pending_orders.pop()
                
            await event_bus.publish(OrderRejected(
                reason=rejection_reason,
                draft=draft,
                gate=gate_failed,
                component="GuardianService"
            ))
            log.warning(f"Guardian REJECTED draft {draft.id}: {rejection_reason}")

guardian_service = GuardianService()
