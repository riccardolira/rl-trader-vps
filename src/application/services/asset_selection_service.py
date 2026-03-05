import asyncio
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
import uuid

from src.infrastructure.config import settings
from src.infrastructure.logger import log
from src.domain.universe import (
    UniverseConfig, UniverseSnapshot, UniverseStatus, GateStatus, 
    RankingRow, AssetClass, AssetStatus, AssetMetrics, ScoreBreakdown,
    SelectionMode, ActiveSetSource, UniverseStageCounts, UniverseReasons
)
from src.infrastructure.universe_config_loader import UniverseConfigLoader
from src.infrastructure.event_bus import event_bus
from src.domain.events import BaseEvent
from src.infrastructure.mt5_adapter import mt5_adapter
from src.infrastructure.news.news_worker import news_worker
from .market_data_service import market_data_service
import numpy as np
from src.domain.events import BaseEvent
from src.infrastructure.mt5_adapter import mt5_adapter
from src.infrastructure.news.news_worker import news_worker
from .market_data_service import market_data_service

class AssetSelectionService:
    """
    Subsystem: Asset Selection (ASS) V3
    Responsibility: Manage the Active Set (Universe Gate), Scanner, and Config.
    """

    def __init__(self):
        self.loader = UniverseConfigLoader()
        self.config: UniverseConfig = self.loader.load()
        
        self._active_set: List[str] = self.config.manual_basket.copy() if self.config.selection_mode == SelectionMode.MANUAL else []
        self._frozen_set: List[str] = []
        self._active_set_source: ActiveSetSource = self.config.selection_mode if self.config.scanner_enabled else ActiveSetSource.FROZEN
        
        self._cycle_id: str = str(uuid.uuid4())
        self._last_update: datetime = datetime.utcnow()
        self._status: UniverseStatus = UniverseStatus.STOPPED
        
        self._counts = UniverseStageCounts()
        self._reasons = UniverseReasons()
        self._class_counts: Dict[str, int] = {}
        self._sample = []
        
        # Ranking & Active Data 
        self._last_ranking: List[RankingRow] = []
        
        # Internal Loop
        self.running = False
        
        # Churn Tracking: {symbol: entry_time}
        self._active_set_meta: Dict[str, datetime] = {}

    async def start(self):
        self.running = True
        log.info(f"AssetSelectionService V3 started. Scanner Enabled: {self.config.scanner_enabled}")
        
        if self.config.scanner_enabled:
             self._status = UniverseStatus.RUNNING
             # Trigger initial scan
             asyncio.create_task(self._scan_cycle())
        else:
             self._status = UniverseStatus.STOPPED
        
        asyncio.create_task(self._maintenance_loop())

    async def stop(self):
        self.running = False
        self._status = UniverseStatus.STOPPED
        log.info("AssetSelectionService stopped.")

    async def _maintenance_loop(self):
        while self.running:
            if self.config.scanner_enabled and self.config.selection_mode == SelectionMode.AUTO:
                await asyncio.sleep(self.config.rebuild_interval_sec)
                await self._scan_cycle()
            else:
                await asyncio.sleep(5) # Idle wait

    # --- Public API (Config & Modes) ---

    def get_config(self) -> UniverseConfig:
        return self.config

    def update_config(self, updates: Dict[str, Any]):
        """Updates config and persists."""
        # Manual Pydantic Update
        changed = False
        
        if "correlation_enabled" in updates:
            self.config.correlation_enabled = updates["correlation_enabled"]
            changed = True
            
        if "max_correlation_threshold" in updates:
            self.config.max_correlation_threshold = updates["max_correlation_threshold"]
            changed = True
            
        if "correlation_periods" in updates:
            self.config.correlation_periods = updates["correlation_periods"]
            changed = True
        
        if "rebuild_interval_sec" in updates:
            self.config.rebuild_interval_sec = updates["rebuild_interval_sec"]
            changed = True
            
        if "max_active_set_size" in updates:
            self.config.max_active_set_size = min(10, updates["max_active_set_size"])
            changed = True
            
        if "min_active_set_size" in updates:
            self.config.min_active_set_size = updates["min_active_set_size"]
            changed = True
            
        if "weights" in updates:
            for cls_key, w_dict in updates["weights"].items():
                if cls_key in self.config.weights:
                    for k, v in w_dict.items():
                        setattr(self.config.weights[cls_key], k, v)
            changed = True

        if "schedules" in updates:
            from src.domain.universe import TimeMode
            for region, s_dict in updates["schedules"].items():
                if region in self.config.schedules:
                    for k, v in s_dict.items():
                        if k == "time_mode" and isinstance(v, str):
                            setattr(self.config.schedules[region], k, TimeMode(v))
                        else:
                            setattr(self.config.schedules[region], k, v)
            changed = True
        
        if "scanner_enabled" in updates:
            new_val = updates["scanner_enabled"]
            if new_val != self.config.scanner_enabled:
                self.config.scanner_enabled = new_val
                changed = True
                if new_val:
                    self._status = UniverseStatus.RUNNING
                    asyncio.create_task(event_bus.publish(
                        BaseEvent(type="UNIVERSE_SCANNER_STARTED", component="Scanner", payload={"ts": datetime.utcnow().isoformat()})
                    ))
                    asyncio.create_task(self._scan_cycle())
                else:
                    self._status = UniverseStatus.STOPPED
                    self._frozen_set = self._active_set.copy()
                    self._active_set_source = ActiveSetSource.FROZEN
                    asyncio.create_task(event_bus.publish(
                        BaseEvent(type="UNIVERSE_SCANNER_STOPPED", component="Scanner", payload={"reason": "USER_STOPPED"})
                    ))
        
        if "classes_enabled" in updates:
            self.config.classes_enabled.update(updates["classes_enabled"])
            asyncio.create_task(event_bus.publish(
                BaseEvent(type="UNIVERSE_CLASS_TOGGLED", component="Scanner", payload={"classes": self.config.classes_enabled})
            ))
            changed = True
            
        if "blocklist" in updates:
            self.config.blocklist = updates["blocklist"]
            changed = True
            
        if changed:
            self.loader.save(self.config)
            # Only trigger a generic scan if it wasn't just toggled ON right now (avoid double triggers)
            if self.config.scanner_enabled and "scanner_enabled" not in updates:
                asyncio.create_task(self._scan_cycle())

    def set_mode(self, mode: SelectionMode):
        if mode != self.config.selection_mode:
            self.config.selection_mode = mode
            self.loader.save(self.config)
            
            if mode == SelectionMode.MANUAL:
                self._active_set_source = ActiveSetSource.MANUAL
                self._apply_manual_basket()
            else:
                self._active_set_source = ActiveSetSource.AUTO
                if self.config.scanner_enabled:
                    asyncio.create_task(self._scan_cycle())
                    
    def publish_manual_basket(self, symbols: List[str]):
        if self.config.selection_mode == SelectionMode.MANUAL:
            self.config.manual_basket = symbols[:10]  # Hard cap
            self.loader.save(self.config)
            self._apply_manual_basket()
            
    def _apply_manual_basket(self):
        self._active_set = self.config.manual_basket.copy()
        now = datetime.utcnow()
        self._active_set_meta = {sym: self._active_set_meta.get(sym, now) for sym in self._active_set}
        
        asyncio.create_task(event_bus.publish(
            BaseEvent(type="UNIVERSE_ACTIVE_SET_PUBLISHED", component="Scanner", payload={"source": "MANUAL", "symbols": self._active_set})
        ))
        self._broadcast_snapshot()

    def toggle_class(self, asset_class: str, enabled: bool):
        self.config.classes_enabled[asset_class] = enabled
        self.loader.save(self.config)
        asyncio.create_task(self._scan_cycle())

    def add_to_blocklist(self, symbol: str):
        if symbol not in self.config.blocklist:
            self.config.blocklist.append(symbol)
            self.loader.save(self.config)
            asyncio.create_task(self._scan_cycle())

    def remove_from_blocklist(self, symbol: str):
        if symbol in self.config.blocklist:
            self.config.blocklist.remove(symbol)
            self.loader.save(self.config)
            asyncio.create_task(self._scan_cycle())

    # --- Core Logic ---

    async def build_universe_raw(self) -> Dict[str, str]:
        """Sourcing raw symbols with fallback. Returns dict of {symbol: path}"""
        try:
            symbols = await mt5_adapter.get_symbols_with_path()
            if symbols and len(symbols) > 0:
                return symbols
        except Exception as e:
            log.warning(f"build_universe_raw: Error fetching from MT5 ({e}).")
            
        log.warning("build_universe_raw: MT5 symbols_get_with_path failed. Falling back to settings.")
        
        fallback = settings.SELECTION_UNIVERSE_SYMBOLS
        if not fallback or len(fallback) == 0:
            fallback = ["EURUSD", "GBPUSD", "USDJPY", "BTCUSD", "WIN$N", "WDO$N"]
            
        return {s: "" for s in fallback}

    async def _scan_cycle(self):
        """Main Scanner Logic V3"""
        if not self.config.scanner_enabled:
            return

        self._cycle_id = str(uuid.uuid4())
        asyncio.create_task(event_bus.publish(
            BaseEvent(type="UNIVERSE_SCAN_STARTED", component="Scanner", payload={"cycle_id": self._cycle_id})
        ))
        
        try:
            await self._run_scan_cycle_internal()
        except Exception as e:
            import traceback
            log.error(f"Scanner Cycle Unhandled Exception: {e}\n{traceback.format_exc()}")
        finally:
            self._last_update = datetime.utcnow()
            self._broadcast_snapshot()

    async def _run_scan_cycle_internal(self):
        current_cycle = self._cycle_id
        
        # Reset Counters
        self._counts = UniverseStageCounts()
        self._reasons = UniverseReasons()
        self._class_counts = {}
        self._sample = []
        
        raw_universe = await self.build_universe_raw()
        self._counts.raw_count = len(raw_universe)
        
        if self._counts.raw_count == 0:
            log.warning("UNIVERSE_EMPTY_STALL: raw_count is 0. MT5 unconnected and no seed?")
            self._last_update = datetime.utcnow()
            self._last_ranking = []
            self._active_set = []
            self._broadcast_snapshot()
            return
        
        # 1. Apply Filters & Classify
        active_universe = []
        ranking_candidates: List[RankingRow] = []
        
        from src.application.services.market_data_service import market_data_service
        
        for symbol in raw_universe:
            path = raw_universe[symbol]
            asset_class = self._classify_symbol(symbol, path)
            # Tally total raw symbols per class
            self._class_counts[asset_class] = self._class_counts.get(asset_class, 0) + 1
            if not self.config.classes_enabled.get(asset_class, True):
                continue
                
        self._counts.after_class_filter = len([s for s in raw_universe if self.config.classes_enabled.get(self._classify_symbol(s, raw_universe[s]), True)])
        self._reasons.unclassified = len(raw_universe) - self._counts.after_class_filter

        for symbol in raw_universe:
            if not self.config.scanner_enabled or self._cycle_id != current_cycle:
                log.warning(f"Scanner Cycle {current_cycle} preempted or stopped. Aborting inner loop.")
                break

            path = raw_universe[symbol]
            asset_class = self._classify_symbol(symbol, path)
            if not self.config.classes_enabled.get(asset_class, True):
                continue

            if symbol in self.config.blocklist:
                self._counts.blocked_count += 1
                self._reasons.blocked += 1
                continue
                
            # Symbol Timetable Check (Fast Fail)
            if not self._is_within_symbol_timetable(symbol, asset_class, path):
                 self._reasons.out_of_hours += 1
                 ranking_candidates.append(RankingRow(
                    symbol=symbol, asset_class=asset_class, rank=0, status=AssetStatus.HARD_REJECT,
                    reason_code="OUT_OF_HOURS", specification=f"Outside trading hours",
                    metrics=AssetMetrics(), score_breakdown=ScoreBreakdown(),
                    computed_at=datetime.utcnow(), cycle_id=self._cycle_id
                 ))
                 continue
                 
            # News & Holiday Shield Check (Fast Fail)
            is_frozen, frozen_code, frozen_msg = news_worker.is_symbol_frozen(symbol)
            if is_frozen:
                 
                 if frozen_code == "FROZEN_BY_NEWS":
                    self._reasons.frozen_by_news += 1
                 elif frozen_code == "HOLIDAY_STANDBY":
                    self._reasons.frozen_by_news += 1
                 
                 ranking_candidates.append(RankingRow(
                    symbol=symbol, asset_class=asset_class, rank=0, status=AssetStatus.HARD_REJECT,
                    reason_code=frozen_code, specification=frozen_msg,
                    metrics=AssetMetrics(), score_breakdown=ScoreBreakdown(),
                    computed_at=datetime.utcnow(), cycle_id=self._cycle_id
                 ))
                 continue
            
            active_universe.append(symbol)
            
            try:
                ctx = await market_data_service.get_context(symbol, minimal=True)
                if not ctx:
                    self._reasons.no_rates += 1
                    continue
            except Exception as e:
                log.error(f"Scanner error getting market context for {symbol}: {e}")
                self._reasons.no_rates += 1
                continue
                
            self._counts.with_metrics += 1
            
            # Yield to the event loop so WebSockets and Heartbeats don't die
            await asyncio.sleep(0.01)
            
            row = self._evaluate_asset(symbol, asset_class, ctx)
            if row.status == AssetStatus.HARD_REJECT:
                 self._reasons.spread_too_high += 1
            else:
                 self._counts.eligible_count += 1
                 
            ranking_candidates.append(row)

            if self._counts.with_metrics % 20 == 0:
                self._last_ranking = sorted(ranking_candidates, key=lambda x: x.score or 0.0, reverse=True)
                self._broadcast_snapshot()


            # Keep a small sample for diagnostics if eligible
            if len(self._sample) < 3 and row.status != AssetStatus.HARD_REJECT:
                 self._sample.append({"symbol": row.symbol, "class": row.asset_class, "score": row.score, "eligible": True, "reason": None})

        # 2. Sort Selection
        if self._cycle_id != current_cycle or not self.config.scanner_enabled:
            log.warning(f"Scanner Cycle {current_cycle} preempted. Skipping ranking and active set update.")
            return

        ranking_candidates.sort(key=lambda x: x.score or 0.0, reverse=True)
        
        # 2.5 Anti-Correlation Shield (Cloner Ban)
        accepted_for_correlation: List[RankingRow] = []
        correlation_cache: Dict[str, List[float]] = {}
        
        for r in ranking_candidates:
            if r.status == AssetStatus.HARD_REJECT:
                r.decision = "not_selected"
                continue
                
            # We only run the deep check if it's eligible and we already have accepted symbols to compare against
            is_clone = False
            if self.config.correlation_enabled and len(accepted_for_correlation) > 0:
                symbol = r.symbol
                
                # Lazy fetch prices
                if symbol not in correlation_cache:
                    prices = await market_data_service.get_close_prices(symbol, limit=self.config.correlation_periods)
                    if prices:
                        correlation_cache[symbol] = prices
                
                sym_prices = correlation_cache.get(symbol)
                
                if sym_prices:
                    for accepted in accepted_for_correlation:
                        acc_prices = correlation_cache.get(accepted.symbol)
                        if not acc_prices:
                            # Try to fetch accepted if it somehow wasn't cached (though it should be)
                            acc_prices = await market_data_service.get_close_prices(accepted.symbol, limit=self.config.correlation_periods)
                            if acc_prices:
                                correlation_cache[accepted.symbol] = acc_prices
                                
                        if acc_prices and len(acc_prices) > 0 and len(sym_prices) > 0:
                            # Align lengths by truncating the longer one to the minimum length
                            min_len = min(len(acc_prices), len(sym_prices))
                            if min_len < 5:
                                continue # Not enough data to confidently correlate
        
                            aligned_sym = sym_prices[-min_len:]
                            aligned_acc = acc_prices[-min_len:]
        
                            # Pearson Correlation Logic
                            import numpy as np
                            try:
                                # FIX: Use percentage returns instead of absolute prices to avoid spurious correlation
                                sym_arr = np.array(aligned_sym)
                                acc_arr = np.array(aligned_acc)
                                
                                # Prevent division by zero if price is 0
                                sym_returns = np.diff(sym_arr) / np.where(sym_arr[:-1] == 0, 1e-9, sym_arr[:-1])
                                acc_returns = np.diff(acc_arr) / np.where(acc_arr[:-1] == 0, 1e-9, acc_arr[:-1])
                                
                                corr_matrix = np.corrcoef(sym_returns, acc_returns)
                                corr_value = corr_matrix[0, 1]
                                
                                # Cloner Ban Threshold: Absolute value to catch negative highly correlated pairs too
                                if abs(corr_value) > self.config.max_correlation_threshold:
                                    is_clone = True
                                    log.info(f"Scanner Shield: BANNING {symbol}. High Correlation ({corr_value:.2f}) with top-ranked {accepted.symbol}")
                                    break
                            except Exception as e:
                                pass # Math error, ignore and don't ban
            
            if is_clone:
                r.status = AssetStatus.HARD_REJECT
                r.reason_code = "HIGH_CORRELATION"
                r.specification = "Correlated closely with higher ranked active set pair"
                r.decision = "not_selected"
                self._reasons.high_correlation += 1
                self._counts.eligible_count -= 1
            else:
                r.decision = "eligible"
                accepted_for_correlation.append(r)
        
        self._last_ranking = ranking_candidates
        asyncio.create_task(event_bus.publish(
            BaseEvent(
                type="UNIVERSE_RANKING_COMPUTED", 
                component="Scanner", 
                payload={
                    "cycle_id": self._cycle_id, 
                    "count": len(ranking_candidates),
                    "counts": self._counts.dict(),
                    "reasons": self._reasons.dict()
                }
            )
        ))
        
        # 3. Update Active Set
        if self.config.selection_mode == SelectionMode.AUTO:
            if self._counts.eligible_count >= self.config.min_active_set_size:
                 valid_candidates = [r for r in ranking_candidates if r.status != AssetStatus.HARD_REJECT]
                 await self._update_active_set_auto(valid_candidates)
            else:
                 log.warning(f"Scanner Cycle: Skipping Auto Update. Eligible ({self._counts.eligible_count}) < Minimum ({self.config.min_active_set_size})")
                 self._active_set = [] # Ensure it's cleared so GATE is closed
                 
        self._counts.active_set_count = len(self._active_set)
        
        log.info(f"Scanner Cycle {self._cycle_id[-4:]}: Raw={self._counts.raw_count}, Eligible={self._counts.eligible_count}, Active={self._counts.active_set_count}. Top reasons: NoRates={self._reasons.no_rates}, HighSpread={self._reasons.spread_too_high}")

    def _classify_symbol(self, symbol: str, path: str = "") -> str:
        s = symbol.upper()
        p = path.lower()
        
        # 1. MT5 Path-based Classification (Most Accurate)
        if "forex" in p:
            return "FOREX"
        if "metals" in p or "gold" in p or "silver" in p:
            return "METALS"
        if "crypto" in p:
            return "CRYPTO"
        if "indices" in p or "index" in p:
            if "b3" in p or "brazil" in p or "bovespa" in p:
                return "INDICES_B3"
            elif "european" in p or "eu" in p or "uk" in p:
                return "INDICES_EU"
            else:
                return "INDICES_NY"
        if "stock" in p or "shares" in p or "equities" in p:
            if "us " in p or "nasdaq" in p or "nyse" in p or "arca" in p or ".us" in p:
                return "STOCKS_US"
            elif "brazil" in p or "bovespa" in p or "b3" in p or ".sa" in s.lower():
                return "STOCKS_BR"
            else:
                return "STOCKS_EU"
        if "energies" in p or "commodities" in p:
            if "agri" in p or "grains" in p or "softs" in p:
                return "COMMODITIES_AGRI"
            else:
                return "COMMODITIES_ENERGY"
            
        # 2. Heuristic Regex-based Fallback (If Path is Empty)
        sym_upper = s
        if "BTC" in sym_upper or "ETH" in sym_upper or "SOL" in sym_upper:
            return "CRYPTO"
        if any(k in sym_upper for k in ["US30", "USA30", "US100", "NAS", "GER40", "UK100", "SPX", "WIN", "US500", "USTEC", "DE30", "FRA40", "HK50"]):
            # Specific check for NY vs EU vs B3
            if any(k in sym_upper for k in ["GER40", "DAX", "UK100", "DE30", "FRA40"]):
                return "INDICES_EU"
            if any(k in sym_upper for k in ["WIN", "WDO", "IND", "DOL"]):
                return "INDICES_B3"
            return "INDICES_NY"
            
        if any(k in sym_upper for k in ["XAU", "XAG", "GOLD", "SILVER", "PLAT", "PALL"]):
            return "METALS"
        if any(k in sym_upper for k in ["OIL", "WTI", "BRENT", "NATGAS", "GAS", "CORN", "SOY", "SUGAR", "WHEAT"]):
            if any(k in sym_upper for k in ["CORN", "SOY", "SUGAR", "WHEAT"]):
                return "COMMODITIES_AGRI"
            return "COMMODITIES_ENERGY"
            
        if any(char.isdigit() for char in sym_upper) and len(sym_upper.replace("-T", "").replace(".T", "")) >= 5:
            return "STOCKS_BR"
        if len(sym_upper.replace("-T", "").replace(".T", "")) <= 4:
            if any(etf in sym_upper for etf in ["QQQ", "SPY", "IVV", "VOO"]) or sym_upper.endswith("-T"):
                # If it's a forex pair ending in -T (like GBPJPY-T), we should NOT classify as stock
                # Check if it has 6 letters before the suffix
                base = sym_upper.split("-")[0].split(".")[0]
                if len(base) == 6:
                    return "FOREX"
                return "STOCKS_US"
        return "FOREX"

    def _is_within_symbol_timetable(self, symbol: str, asset_class: str, path: str = "") -> bool:
        from src.domain.universe import TimeMode
        import zoneinfo
        
        schedule = self.config.schedules.get(asset_class)
        if not schedule:
            return True

        # Use configured timezone or fallback to UTC
        tz_name = getattr(schedule, 'timezone', 'UTC')
        try:
            tz = zoneinfo.ZoneInfo(tz_name)
        except Exception:
            tz = zoneinfo.ZoneInfo('UTC')

        now = datetime.now(tz)
        current_time_str = now.strftime("%H:%M")
        current_day = now.weekday() # 0 = Monday, 6 = Sunday

        # Use the configured hours regardless of AUTO/MANUAL to respect user config
        start_t = schedule.time_start
        end_t = schedule.time_end
        
        # Enforce dynamic trading days block if in AUTO mode
        if schedule.time_mode == TimeMode.AUTO:
            trading_days = getattr(schedule, 'trading_days', [0, 1, 2, 3, 4])
            if current_day not in trading_days:
                return False

        if start_t <= end_t:
            return start_t <= current_time_str <= end_t
        else:
            return current_time_str >= start_t or current_time_str <= end_t
                
    def minutes_since_schedule_end(self, symbol: str, asset_class: str) -> float:
        """Returns minutes elapsed since the session ended. 
        Returns -1 if the session is currently active or 24/7.
        Returns 0+ if the session ended today."""
        if self._is_within_symbol_timetable(symbol, asset_class):
            return -1.0
            
        from src.domain.universe import TimeMode
        import zoneinfo
        
        schedule = self.config.schedules.get(asset_class)
        if not schedule: return -1.0 # No schedule -> always open
        
        # Use configured timezone
        tz_name = getattr(schedule, 'timezone', 'UTC')
        try:
            tz = zoneinfo.ZoneInfo(tz_name)
        except Exception:
            tz = zoneinfo.ZoneInfo('UTC')
            
        now = datetime.now(tz)
        
        end_time_str = schedule.time_end
        
        if not end_time_str: return -1.0
        
        try:
            h, m = map(int, end_time_str.split(":"))
            end_dt = now.replace(hour=h, minute=m, second=0, microsecond=0)
            
            diff = (now - end_dt).total_seconds() / 60.0
            
            # If the session ended yesterday, the difference might be deeply negative if we crossed midnight.
            # In a standard schedule (e.g., 09:00 to 17:00), if it is 08:00, the difference from 17:00 is -9 hours (-540 mins).
            # This actually means it's been 15 hours since yesterday's close (1440 - 540 = 900 mins).
            if diff < 0:
                 diff += 1440.0
                 
            return diff
        except Exception as e:
            from src.infrastructure.logger import log
            log.error(f"Error calculating minutes since schedule end for {symbol}: {e}")
            return -1.0

    def minutes_until_schedule_end(self, symbol: str, asset_class: str) -> float:
        """Returns minutes remaining until the session ends.
        Returns -1 if the session is currently closed or 24/7."""
        if not self._is_within_symbol_timetable(symbol, asset_class):
            return -1.0
            
        from src.domain.universe import TimeMode
        import zoneinfo
        
        schedule = self.config.schedules.get(asset_class)
        if not schedule: return -1.0 # No schedule -> always open
        
        tz_name = getattr(schedule, 'timezone', 'UTC')
        try:
            tz = zoneinfo.ZoneInfo(tz_name)
        except Exception:
            tz = zoneinfo.ZoneInfo('UTC')
            
        now = datetime.now(tz)
        
        end_time_str = schedule.time_end
        
        if not end_time_str: return -1.0
        
        try:
            h, m = map(int, end_time_str.split(":"))
            end_dt = now.replace(hour=h, minute=m, second=0, microsecond=0)
            
            # If current time is past end_dt but we are inside the timetable, 
            # it means the session spans midnight and ends tomorrow.
            diff = (end_dt - now).total_seconds() / 60.0
            
            if diff < 0:
                 diff += 1440.0
                 
            return diff
            
        except Exception as e:
            from src.infrastructure.logger import log
            log.error(f"Error calculating minutes until schedule end for {symbol}: {e}")
            return -1.0


    def _evaluate_asset(self, symbol: str, asset_class: str, ctx: Any) -> RankingRow:
        import math
        weights = self.config.weights.get(asset_class) or self.config.weights.get("FOREX")
        if not weights:
            from src.domain.universe import ClassWeights
            weights = ClassWeights()
            
        spread_point = ctx.spread
        atr = getattr(ctx, 'atr_value', 0.0)
        adx = getattr(ctx, 'adx_value', 0.0)
        price = getattr(ctx, 'price_close', 0.0)
        
        spread_atr_ratio = 0.0
        if atr > 0:
            spread_price = spread_point * getattr(ctx, 'point_value', 1.0)
            spread_atr_ratio = spread_price / atr
            
        metrics = AssetMetrics(
            spread_points=int(spread_point),
            spread_atr_ratio=spread_atr_ratio,
            adx=adx,
            atr=atr,
            staleness_sec=0,
            price=price
        )
        
        # 1. Spread/ATR Gate
        max_ratio = weights.max_spread_atr_ratio
        if spread_atr_ratio > max_ratio:
            return RankingRow(
                symbol=symbol, asset_class=asset_class, rank=0, status=AssetStatus.HARD_REJECT,
                reason_code="SPREAD_GATE", specification=f"Spread/ATR {spread_atr_ratio:.2f} > {max_ratio}",
                metrics=metrics, score_breakdown=ScoreBreakdown(),
                computed_at=datetime.utcnow(), cycle_id=self._cycle_id
            )
            
        safe_max_ratio = max_ratio if max_ratio > 0 else 1.0
        ratio_pct = spread_atr_ratio / safe_max_ratio
        
        # --- Advanced Mathematical Scoring ---
        
        # 1. Cost & Liquidity (Exponential Decay)
        # 100 * e^(-1.6 * ratio_pct). Drops to ~20 if ratio_pct is 1.0. 
        # A tiny spread relative to ATR yields 90-100.
        score_liquidity = 100.0 * math.exp(-1.6 * ratio_pct)
        score_cost = score_liquidity  # Mirroring liquidity in this model
        
        # 2. Volatility & Traction (Dual-Volatility System)
        # 2A. Trend Volatility (ADX-based)
        # S = 100 / (1 + e^(-0.15 * (ADX - 25)))
        try:
            score_trend = 100.0 / (1.0 + math.exp(-0.15 * (adx - 25.0)))
        except OverflowError:
            score_trend = 100.0 if adx > 25.0 else 0.0
            
        # 2B. Range Volatility (Squeeze-based)
        # If ADX is low, it might be ranging. We check if the range is wide and volatile.
        # squeeze_pct: 100 = Widest bands (high volatility), 0 = Tightest bands (low volatility squeeze)
        squeeze_pct = getattr(ctx, 'indicators', {}).get('squeeze_pct', 0.0)
        score_range = squeeze_pct
        
        # Best of Both Worlds
        score_volatility = max(score_trend, score_range)

        # 3. Stability & Relative Risk Penalty 
        # Penalizes assets where ATR is absurdly large relative to nominal price.
        score_stability = 0.0
        if atr > 0 and price > 0:
            relative_risk_pct = (atr / price) * 100.0
            # Base 100, subtracting (relative_risk * 10)
            # Ex: Penny stock moving 5% a day -> 100 - 50 = 50 score.
            # Ex: EURUSD moving 0.6% a day -> 100 - 6 = 94 score.
            raw_stab = 100.0 - (relative_risk_pct * 10.0)
            score_stability = max(0.0, min(100.0, raw_stab))
            
        # Round components to prevent tiny float noise
        score_liquidity = round(score_liquidity, 2)
        score_cost = round(score_cost, 2)
        score_volatility = round(score_volatility, 2)
        score_stability = round(score_stability, 2)
        
        # 4. Final Weighted Sum
        wl, wv, wc, ws = weights.w_liquidity, weights.w_volatility, weights.w_cost, weights.w_stability
        weight_sum = wl + wv + wc + ws
        
        if weight_sum > 0:
            total = (score_liquidity*wl + score_volatility*wv + score_cost*wc + score_stability*ws) / weight_sum
        else:
            total = 0.0
            
        is_eligible = total > 0.1
        return RankingRow(
            symbol=symbol,
            asset_class=asset_class,
            rank=0,
            score=total,
            status=AssetStatus.ELIGIBLE if is_eligible else AssetStatus.WARN,
            reason_code="OK",
            metrics=metrics,
            score_breakdown=ScoreBreakdown(
                liquidity=score_liquidity,
                volatility=score_volatility,
                cost=score_cost,
                stability=score_stability,
                total=total
            ),
            weights_used={"liq": wl, "vol": wv, "cost": wc, "stab": ws},
            computed_at=datetime.utcnow(),
            cycle_id=self._cycle_id
        )

    async def _update_active_set_auto(self, candidates: List[RankingRow]):
        k = self.config.max_active_set_size
        min_k = self.config.min_active_set_size
        
        if len(candidates) < min_k:
            if self._active_set:
                asyncio.create_task(event_bus.publish(
                    BaseEvent(type="UNIVERSE_GATE_CLOSED", component="Scanner", payload={"reason": "ELIGIBLE_BELOW_MIN"})
                ))
            self._active_set = []
            return
            
        # Initialize
        if not self._active_set:
            self._active_set = [c.symbol for c in candidates[:k]]
            asyncio.create_task(event_bus.publish(
                BaseEvent(type="UNIVERSE_ACTIVE_SET_PUBLISHED", component="Scanner", payload={"source": "AUTO_BOOTSTRAP", "symbols": self._active_set})
            ))
            return

        # Core Hysteresis Logic
        buffer = self.config.hold_buffer
        delta = self.config.swap_delta_score
        cand_map = {c.symbol: c for c in candidates}
        
        carried_over = []
        for old_sym in self._active_set:
            if old_sym in cand_map:
                # Rank check (0-indexed)
                c_rank = candidates.index(cand_map[old_sym])
                if c_rank < (k + buffer):
                    carried_over.append(old_sym)
            else:
                asyncio.create_task(event_bus.publish(
                    BaseEvent(type="UNIVERSE_ASSET_DROPPED", component="Scanner", payload={"symbol": old_sym, "reason": "NO_LONGER_ELIGIBLE"})
                ))
                
        draft_set = carried_over.copy()
        for idx, c in enumerate(candidates):
            if len(draft_set) >= k:
                break
            if c.symbol not in draft_set:
                # To swap in, must beat lowest kept by delta score? Or simply fill the gap?
                # For simplicity in V3 implementation: if there is room, just fill.
                # If we want strict swap vs existing, we'd compare scores.
                draft_set.append(c.symbol)
                asyncio.create_task(event_bus.publish(
                    BaseEvent(type="UNIVERSE_ASSET_SWAPPED_IN", component="Scanner", payload={"symbol": c.symbol, "rank": idx})
                ))
        
        self._active_set = draft_set
        self._active_set_source = ActiveSetSource.AUTO
        
        # Update Meta (Churn Tracking)
        now = datetime.utcnow()
        self._active_set_meta = {sym: self._active_set_meta.get(sym, now) for sym in draft_set}
        
        asyncio.create_task(event_bus.publish(
            BaseEvent(type="UNIVERSE_ACTIVE_SET_PUBLISHED", component="Scanner", payload={"source": "AUTO", "symbols": self._active_set})
        ))
    
    def get_snapshot(self) -> UniverseSnapshot:
        gate_status = GateStatus.CLOSED
        gate_reason = "UNIVERSE_DISABLED"
        
        if self.config.scanner_enabled:
            # Active
            if self.config.selection_mode == SelectionMode.AUTO and len(self._active_set) < self.config.min_active_set_size:
                gate_reason = "ELIGIBLE_BELOW_MIN"
            elif len(self._active_set) == 0:
                gate_reason = "NO_ACTIVE_SET"
            else:
                gate_status = GateStatus.OPEN
                gate_reason = "OK"
        else:
            # Frozen / Stopped
            gate_reason = "SCANNER_STOPPED"

        return UniverseSnapshot(
            cycle_id=self._cycle_id,
            timestamp_utc=self._last_update,
            status=self._status,
            gate_status=gate_status,
            gate_reason=gate_reason,
            selection_mode=self.config.selection_mode,
            active_set_source=self._active_set_source,
            active_set_size=len(self._active_set),
            frozen_active_set=self._frozen_set,
            
            ws_status="open",
            rest_fallback_ms=2000,
            universe=self._counts,
            reasons=self._reasons,
            class_counts=self._class_counts,
            sample=self._sample,
            ranking=self._last_ranking,
            active_set=self._active_set,
            
            # Legacy Fields
            universe_raw_total=self._counts.raw_count,
            excluded_by_class_disabled=self._counts.raw_count - self._counts.after_class_filter,
            excluded_by_symbol_blocklist=self._counts.blocked_count,
            universe_active_total=self._counts.eligible_count,
            scanned_count=self._counts.with_metrics,
            scan_progress_pct=(100.0 * self._counts.with_metrics / self._counts.after_class_filter) if self._counts.after_class_filter > 0 else 0.0
        )

    def get_active_set(self) -> List[str]:
        return self._active_set

    def get_ranking(self) -> List[RankingRow]:
        return self._last_ranking
        
    async def get_correlation_matrix(self) -> Dict[str, Any]:
        """Calculates and returns an N*N correlation matrix for the top eligible assets (Active Set + Candidates) for Heatmap."""
        # Top 15 Eligible symbols max to avoid overloading UI and MT5
        top_symbols = [r.symbol for r in self._last_ranking if r.status != AssetStatus.HARD_REJECT][:15]
        if not top_symbols:
             return {"symbols": [], "matrix": []}
             
        correlation_cache = {}
        for sym in top_symbols:
             prices = await market_data_service.get_close_prices(sym, limit=self.config.correlation_periods)
             if prices and len(prices) > 0:
                 correlation_cache[sym] = prices
                 
        valid_symbols = [s for s in top_symbols if s in correlation_cache]
        n = len(valid_symbols)
        if n < 2:
            return {"symbols": valid_symbols, "matrix": []}
            
        # Ensure identical array lengths by truncating to minimum
        min_len = min(len(correlation_cache[s]) for s in valid_symbols)
        for s in valid_symbols:
            correlation_cache[s] = correlation_cache[s][-min_len:]
            
        data_matrix = np.array([correlation_cache[s] for s in valid_symbols])
        
        try:
            # FIX: Use percentage returns instead of absolute prices
            returns_matrix = np.diff(data_matrix, axis=1) / np.where(data_matrix[:, :-1] == 0, 1e-9, data_matrix[:, :-1])
            corr_matrix = np.corrcoef(returns_matrix)
            # Convert NaN to 0 for JSON serialization
            corr_matrix = np.nan_to_num(corr_matrix, 0.0)
            return {
                "symbols": valid_symbols,
                "matrix": corr_matrix.tolist()
            }
        except Exception as e:
            log.error(f"Failed to calculate full correlation matrix: {e}")
            return {"symbols": valid_symbols, "matrix": []}

    def _broadcast_snapshot(self):
        try:
            snap = self.get_snapshot()
            asyncio.create_task(event_bus.publish(
                BaseEvent(type="UNIVERSE_SNAPSHOT", component="Scanner", payload=snap.dict())
            ))
        except Exception as e:
            log.error(f"Failed to broadcast snapshot: {e}")

# Singleton Instance
asset_selection_service = AssetSelectionService()
