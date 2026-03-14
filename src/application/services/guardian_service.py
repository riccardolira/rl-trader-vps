from src.domain.models import DraftOrder, Order, OrderStatus, RiskSnapshot, RiskConfig, InstrumentProfile, InstrumentType, get_asset_class
from src.domain.events import OrderApproved, OrderRejected
from src.infrastructure.event_bus import event_bus
from src.infrastructure.config import settings
from src.infrastructure.logger import log
from src.infrastructure.mt5_adapter import mt5_adapter
from datetime import datetime
import json
import os
import math

from src.infrastructure.news.news_worker import news_worker
from src.application.services.engine_config_service import engine_config_service

class GuardianService:
    def __init__(self):
        log.info("GuardianService initialized.")
        self.config_path = "risk_config.json"
        self.config = self._load_config()
        self._pending_orders = [] # list of floats (timestamps)
        self._kelly_cache: dict = {}  # {strategy_name: (volume, timestamp)}
        self._check_credentials()

    def _check_credentials(self):
        """Warn if using default dev credentials."""
        from src.infrastructure.config import settings
        if settings.MT5_LOGIN == 12345 or settings.MT5_LOGIN == 0:
             log.warning("!!! GUARDIAN WARNING: MT5 Login is set to DEFAULT/NULL. MT5 will fail to authorize. !!!")

    def _load_config(self) -> RiskConfig:
        config = RiskConfig()
        
        # Check if custom config exists, if not, copy default
        if not os.path.exists(self.config_path):
            log.info("GuardianService: No custom config found. Checking for default.")
            default_path = self.config_path.replace("risk_config.json", "risk_config.default.json")
            if os.path.exists(default_path):
                import shutil
                shutil.copy2(default_path, self.config_path)
                log.info(f"GuardianService: Copied {default_path} to {self.config_path}.")

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
                # Use native Pydantic .json() approach instead of dict() dumping to avoid Enum serialization errors.
                json_data = config.model_dump_json(indent=2) if hasattr(config, "model_dump_json") else config.json(indent=2)
                with open(self.config_path, "w") as f:
                    f.write(json_data)
            except Exception as e:
                log.error(f"Failed to save default risk config profiles: {e}")

        return config

    def update_config(self, updates: dict):
        current = self.config.dict()
        current.update(updates)
        self.config = RiskConfig(**current)
        try:
            json_data = self.config.model_dump_json(indent=2) if hasattr(self.config, "model_dump_json") else self.config.json(indent=2)
            with open(self.config_path, "w") as f:
                f.write(json_data)
        except Exception as e:
            log.error(f"Failed to save risk config: {e}")

    async def start(self):
        event_bus.subscribe("ORDER_DRAFTED", self.on_order_drafted)
        log.info("GuardianService listening for Drafts.")

    # =========================================================
    # A1 — PORTFOLIO HEAT: risco total de todas as posições abertas
    # =========================================================
    async def get_portfolio_heat(self) -> dict:
        """Calcula o risco $ total de todas as posições abertas somadas.
        Retorna dict com heat_usd, heat_pct_equity e positions_count."""
        try:
            positions = await mt5_adapter.get_positions()
            account = await mt5_adapter.get_account_info()
            equity = account.equity if account else 1.0
            total_heat = 0.0
            for p in (positions or []):
                sl = getattr(p, 'sl', 0.0) or 0.0
                price = getattr(p, 'open_price', getattr(p, 'price_open', 0.0)) or 0.0
                volume = getattr(p, 'volume', 0.01)
                pt_val = getattr(p, 'point_value', 1.0) or 1.0
                if sl > 0 and price > 0:
                    dist = abs(price - sl)
                    total_heat += dist * volume * pt_val
            return {
                "heat_usd": round(total_heat, 2),
                "heat_pct": round((total_heat / equity) * 100, 2) if equity > 0 else 0.0,
                "positions_count": len(positions or []),
                "equity": round(equity, 2)
            }
        except Exception as e:
            log.warning(f"GuardianService: Erro ao calcular portfolio heat: {e}")
            return {"heat_usd": 0.0, "heat_pct": 0.0, "positions_count": 0, "equity": 0.0}

    # =========================================================
    # A2 — KELLY CRITERION: volume dinâmico baseado no histórico
    # =========================================================
    async def get_kelly_volume(self, strategy_name: str, base_volume: float, equity: float) -> float:
        """Calcula o volume ideal pelo half-Kelly Criterion.
        f* = W - (1-W)/R   onde W=win_rate, R=avg_rr
        Volume = equity * half_f* * risk_pct / 100
        Retorna o volume calculado (com floor no base_volume mínimo)."""
        try:
            from src.infrastructure.event_store import event_store
            import time as _time
            ecfg = engine_config_service.get().kelly

            if not ecfg.enabled:
                return base_volume  # Kelly desativado pela UI

            cache_key = strategy_name
            cached = self._kelly_cache.get(cache_key)
            if cached and (_time.time() - cached[1]) < ecfg.cache_ttl_sec:
                return cached[0]

            trades = await event_store.get_closed_trades(limit=200)
            strat_trades = [t for t in trades if t.strategy_name == strategy_name]
            if len(strat_trades) < ecfg.min_trades_to_activate:
                return base_volume  # Dados insuficientes — usa volume base

            wins = [t for t in strat_trades if t.profit > 0]
            losses = [t for t in strat_trades if t.profit <= 0]
            win_rate = len(wins) / len(strat_trades)

            avg_win = sum(t.profit for t in wins) / len(wins) if wins else 0
            avg_loss = abs(sum(t.profit for t in losses) / len(losses)) if losses else 1
            avg_rr = avg_win / avg_loss if avg_loss > 0 else 1.0

            kelly_f = win_rate - (1 - win_rate) / avg_rr
            half_kelly = max(0.01, kelly_f * ecfg.half_kelly_fraction)
            half_kelly = min(half_kelly, ecfg.max_kelly_pct / 100.0)  # Cap configurável

            risk_pct = getattr(self.config, 'risk_per_trade_pct', 1.0) / 100.0
            kelly_volume = round(equity * half_kelly * risk_pct / 100, 2)
            kelly_volume = max(base_volume, min(kelly_volume, self.config.max_lot_size))

            log.info(f"Kelly [{strategy_name}]: WR={win_rate:.1%} R/R={avg_rr:.2f} f*={kelly_f:.3f} half={ecfg.half_kelly_fraction} cap={ecfg.max_kelly_pct}% → vol={kelly_volume}")
            self._kelly_cache[cache_key] = (kelly_volume, _time.time())
            return kelly_volume
        except Exception as e:
            log.warning(f"GuardianService: Kelly falhou para {strategy_name}: {e}")
            return base_volume


    def get_state(self) -> dict:
        """Expose internal state for UI."""
        # Calcula drawdown diário real a partir dos trades fechados hoje
        try:
            from src.infrastructure.event_store import event_store
            import asyncio
            # Tenta obter o PnL realizado de hoje de forma síncrona se já estiver em loop
            daily_dd = 0.0
            loop = asyncio.get_event_loop()
            if loop.is_running():
                # Cria uma task para buscar — resultado disponível no próximo ciclo
                # Por ora expõe via atributo atualizado pela execution_service
                daily_dd = getattr(self, '_cached_daily_dd', 0.0)
            else:
                daily_dd = 0.0
        except Exception:
            daily_dd = 0.0
            
        return {
            "config": self.config.dict(),
            "daily_drawdown": daily_dd,
            "orders_approved_today": getattr(self, '_orders_approved_today', 0)
        }

    async def on_order_drafted(self, event):
        draft_data = event.payload
        # draft = DraftOrder(**draft_data)
        if isinstance(draft_data, dict):
             draft = DraftOrder(**draft_data)
        else:
             draft = draft_data
             
        log.info(f"Guardian processing draft {draft.id} for {draft.symbol}")

        # --- GATE 0: News Check ---
        if self.config.news_filter_active:
            is_frozen, _, msg = news_worker.is_symbol_frozen(draft.symbol)
            if is_frozen:
                await event_bus.publish(OrderRejected(
                    reason=msg, draft=draft,
                    gate="GATE_NEWS_BLACKOUT", component="GuardianService"
                ))
                log.warning(f"Guardian REJECTED draft {draft.id}: {msg}")
                return

        # --- GATE 0.5: Portfolio Heat Check (A1) ---
        try:
            heat = await self.get_portfolio_heat()
            heat_limit = self.config.portfolio_heat_max_pct  # configurável via /api/risk/config
            if heat["heat_pct"] > heat_limit:
                await event_bus.publish(OrderRejected(
                    reason=f"Portfolio Heat {heat['heat_pct']:.1f}% > limit {heat_limit}%. Risco total muito alto.",
                    draft=draft, gate="GATE_PORTFOLIO_HEAT", component="GuardianService"
                ))
                log.warning(f"Guardian REJECTED draft {draft.id}: Portfolio Heat {heat['heat_pct']:.1f}% (max {heat_limit}%)")
                return
        except Exception as heat_err:
            log.warning(f"Guardian: Portfolio heat check failed: {heat_err}")

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
        if round(draft.raw_volume, 4) > self.config.max_lot_size:
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
            equity = account_info.equity if account_info else 1000.0
            balance = account_info.balance if account_info else 1000.0
            
            from src.domain.models import get_magic_for_strategy
            
            # Calculate True Money Risk based on raw volume and SL distance
            from src.infrastructure.config import settings
            money_risk = 0.0
            worst_case_loss = 0.0
            
            if draft.proposed_sl and draft.proposed_sl > 0:
                 open_price = draft.market_context.current_price if draft.market_context and hasattr(draft.market_context, 'current_price') else draft.proposed_entry
                 if open_price and open_price > 0:
                     # C14: Usa o point_value real do contexto de mercado (calculado pelo MarketDataService via MT5)
                     # settings.POINT_VALUE não existe — era sempre 1.0 (errado para XAUUSD, Índices, etc.)
                     pt_val = 1.0
                     if draft.market_context and hasattr(draft.market_context, 'point_value') and draft.market_context.point_value:
                         pt_val = draft.market_context.point_value
                     elif draft.market_context and isinstance(draft.market_context, dict):
                         pt_val = draft.market_context.get('point_value', 1.0) or 1.0
                     distance = abs(open_price - draft.proposed_sl)
                     money_risk = round(distance * draft.raw_volume * pt_val, 2)
                     worst_case_loss = money_risk * 1.05 # Add 5% for slippage projection
                     
            if money_risk == 0.0:
                 money_risk = 50.0 # Fallback conservative
                 worst_case_loss = 55.0
            
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
                    risk_pct=(money_risk / equity) * 100 if equity > 0 else 0.01,
                    money_risk=money_risk,
                    worst_case_loss=worst_case_loss,
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
