import asyncio
from typing import List, Optional
from datetime import datetime

from src.infrastructure.logger import log
from src.infrastructure.event_bus import event_bus
from src.infrastructure.config import settings
from src.domain.events import SignalGenerated
from src.domain.models import Signal, OrderSide
from src.domain.strategy import StrategyCandidate, MarketContext

from src.application.services.asset_selection_service import asset_selection_service
from src.application.services.market_data_service import market_data_service
from src.infrastructure.news.news_worker import news_worker
from src.application.strategies.trend_strategy import TrendStrategy
from src.application.strategies.mean_reversion_strategy import MeanReversionStrategy
from src.application.strategies.breakout_strategy import BreakoutStrategy
from src.application.strategies.smc_strategy import SMCStrategy
from src.application.strategies.order_flow_strategy import OrderFlowStrategy
from src.domain.strategy import AnalysisSide, StrategyCandidate, RegimeType

from src.application.services.strategy_config_service import strategy_config_service
from src.application.services.engine_config_service import engine_config_service

class StrategyEngine:
    """
    Subsystem: Strategy Engine (SE)
    Responsibility: Score Candidates & Pick Winners for Active Set.
    Replaces Old Scanner Logic.
    """
    def __init__(self):
        self.running = False
        self.strategies = [
            TrendStrategy(),
            MeanReversionStrategy(),
            BreakoutStrategy(),
            SMCStrategy(),
            OrderFlowStrategy()
        ]
        # scan_interval é lido dinamicamente a cada ciclo do engine_config_service
        
    async def start(self):
        if self.running:
            log.warning("StrategyEngine is already running. Ignoring start request.")
            return
        self.running = True
        log.info("StrategyEngine started (Phase 2 Intelligence).")
        asyncio.create_task(self._analysis_loop())

    async def stop(self):
        self.running = False
        log.info("StrategyEngine stopped.")

    def get_state(self) -> dict:
        """Expose internal state for UI."""
        ecfg = engine_config_service.get()
        return {
            "running": self.running,
            "strategies": [s.name for s in self.strategies],
            "scan_interval": ecfg.scan.interval_sec
        }

    async def _analysis_loop(self):
        while self.running:
            try:
                # 0. Active Set (Universe Gate)
                active_symbols = asset_selection_service.get_active_set()
                if not active_symbols:
                    log.info("StrategyEngine: Active Set empty. Waiting...")
                    
                else:
                    log.info(f"StrategyEngine: Analyzing {len(active_symbols)} symbols...")
                    for symbol in active_symbols:
                        await self._analyze_symbol(symbol)
                    # Throttle to avoid flooding MT5
                        await asyncio.sleep(engine_config_service.get().scan.symbol_delay_sec)

            except Exception as e:
                log.error(f"StrategyEngine: Loop Error: {e}", exc_info=True)

            # Intervalo dinâmico: relê a cada ciclo para aplicar mudanças da UI sem restart
            await asyncio.sleep(engine_config_service.get().scan.interval_sec)

    async def _analyze_symbol(self, symbol: str):
        # 3. News / Blackout Check
        is_frozen, _, msg = news_worker.is_symbol_frozen(symbol)
        if is_frozen:
            log.debug(f"StrategyEngine: Skipping {symbol} due to News: {msg}")
            return

        # 1. Market Data (Context)
        context = await market_data_service.get_context(symbol)
        if not context:
            # Errors logged in service
            return

        candidates: List[StrategyCandidate] = []
        
        for strategy in self.strategies:
            try:
                # Dynamic Config Check & Injection
                cfg = strategy_config_service.get_strategy_config(strategy.name)
                if not cfg or not cfg.enabled:
                    continue
                    
                # Inject parameters specific to this strategy
                context.strategy_configs[strategy.name] = cfg.parameters

                candidate = await strategy.analyze(context)
                
                # Apply Dynamic Weight
                if cfg.weight_multiplier != 1.0:
                    candidate = candidate.copy(update={
                        "final_score": candidate.final_score * cfg.weight_multiplier
                    })
                
                # --- Step 4: MTF Confluency Check (Phase 2) ---
                ecfg = engine_config_service.get()
                if context.mtf_trend != AnalysisSide.NEUTRAL and candidate.side != AnalysisSide.NEUTRAL:
                     if context.mtf_trend != candidate.side:
                         new_score = max(0.0, candidate.final_score + ecfg.mtf.contra_penalty)
                         candidate = candidate.copy(update={
                             "final_score": new_score,
                             "score_mtf": ecfg.mtf.contra_penalty,
                             "reason_code": candidate.reason_code + f" | MTF_CONTRA({ecfg.mtf.contra_penalty:+.0f})"
                         })
                     else:
                         # Aligned
                         candidate = candidate.copy(update={
                             "final_score": candidate.final_score + ecfg.mtf.aligned_bonus,
                             "score_mtf": ecfg.mtf.aligned_bonus
                         })
                
                # --- Step 5: Strict Regime Locks (REMOVED: Delegated to individual strategy scores) ---
                
                # Keep only valid candidates (Score > 0 and Side != NEUTRAL)
                if candidate.final_score > 0 and candidate.side != AnalysisSide.NEUTRAL:
                    candidates.append(candidate)
            except Exception as e:
                log.error(f"StrategyEngine: Strategy {strategy.name} failed for {symbol}: {e}")

        # === A3: ENSEMBLE SCORE — Consenso multi-estratégia ===
        if candidates:
            ecfg = engine_config_service.get()
            top_side = candidates[0].side if candidates else None
            agree_count = sum(1 for c in candidates if c.side == top_side)
            total_voting = len(candidates)

            if total_voting >= ecfg.ensemble.min_voting and agree_count >= ecfg.ensemble.min_agree_count:
                bonus = ecfg.ensemble.strong_bonus
                candidates[0] = candidates[0].copy(update={
                    "final_score": candidates[0].final_score + bonus,
                    "reason_code": candidates[0].reason_code + f" | ENSEMBLE_STRONG({agree_count}/{total_voting})"
                })
                log.info(f"StrategyEngine: ENSEMBLE STRONG consensus {agree_count}/{total_voting} for {symbol} {top_side} → +{bonus} bonus")
            elif agree_count == 1 and total_voting >= ecfg.ensemble.min_voting:
                penalty = ecfg.ensemble.weak_penalty
                candidates[0] = candidates[0].copy(update={
                    "final_score": max(0, candidates[0].final_score + penalty),
                    "reason_code": candidates[0].reason_code + f" | ENSEMBLE_WEAK(1/{total_voting})"
                })
                log.debug(f"StrategyEngine: ENSEMBLE WEAK singular signal for {symbol} → {penalty} penalty")

        # 3. Winner Selection (Winner Takes All + Tie Break)
        if not candidates:
            return

        # Sort by Score Descending
        candidates.sort(key=lambda c: c.final_score, reverse=True)
        winner = candidates[0]
        
        # Tie-Break Logic (Section 7)
        if len(candidates) > 1:
            runner_up = candidates[1]
            diff = winner.final_score - runner_up.final_score
            tie_delta = engine_config_service.get().tie_break.delta_threshold
            if diff < tie_delta:
                advanced_strategies = ["SmartMoney", "VolatilityBreakout", "OrderFlowScalping"]
                basic_strategies = ["TrendFollowing", "MeanReversion"]
                
                # If runner_up is an advanced strategy and winner is a basic one,
                # the advanced strategy steals the win due to its high precision and rarity.
                if runner_up.strategy_name in advanced_strategies and winner.strategy_name in basic_strategies:
                     prev_winner_name = winner.strategy_name
                     winner = runner_up
                     log.info(f"StrategyEngine: Tie-Break! {symbol} -> {winner.strategy_name} steals win from {prev_winner_name} (Advanced Priority).")
                     
                # What if the WINNER is already an advanced strategy, and runner up is basic?
                # It naturally wins because its score was higher anyway.
                
                # If both are basic, or both are advanced, we keep the original regime-based tie-breaker
                elif (winner.strategy_name in basic_strategies and runner_up.strategy_name in basic_strategies) or \
                     (winner.strategy_name in advanced_strategies and runner_up.strategy_name in advanced_strategies):
                    
                    if context.regime in [RegimeType.TREND, RegimeType.STRONG_TREND]:
                        # Prefer Trend Strategy or Breakout
                        if runner_up.strategy_name in ["TrendFollowing", "VolatilityBreakout", "OrderFlowScalping"] and winner.strategy_name not in ["TrendFollowing", "VolatilityBreakout", "OrderFlowScalping"]:
                             winner = runner_up
                             log.info(f"StrategyEngine: Tie-Break! {symbol} -> {runner_up.strategy_name} wins in TREND regime.")
                    
                    elif context.regime in [RegimeType.RANGE, RegimeType.NEUTRAL]:
                        # Prefer Mean Reversion or SMC
                        if runner_up.strategy_name in ["MeanReversion", "SmartMoney"] and winner.strategy_name not in ["MeanReversion", "SmartMoney"]:
                             winner = runner_up
                             log.info(f"StrategyEngine: Tie-Break! {symbol} -> {runner_up.strategy_name} wins in RANGE regime.")

        # 4. Threshold Check (Dynamic per Strategy)
        # Use the strategy's specific threshold from dynamic config
        cfg = strategy_config_service.get_strategy_config(winner.strategy_name)
        THRESHOLD = cfg.min_score_threshold if cfg else settings.STRATEGY_THRESHOLD_BALANCED
        
        if winner.final_score >= THRESHOLD:
            direction = OrderSide.BUY if winner.side == "BUY" else OrderSide.SELL
            
            signal = Signal(
                symbol=symbol,
                direction=direction,
                score=winner.final_score,
                strategy_name=winner.strategy_name,
                metadata={
                    **winner.metadata,
                    "regime": context.regime,
                    "adx": context.adx_value,
                    "atr_value": context.atr_value,
                    "price": context.price_close,
                    "stop_atr_mult": winner.stop_atr_mult,
                    "take_atr_mult": winner.take_atr_mult,
                    "mtf_trend": context.mtf_trend,
                    "point_value": context.point_value,
                    "tick_value": context.tick_value
                }
            )
            
            await event_bus.publish(SignalGenerated(signal=signal))
            log.success(f"StrategyEngine: SIGNAL! {symbol} {direction} Score: {winner.final_score:.1f} ({winner.strategy_name})")
        else:
            log.debug(f"StrategyEngine: {symbol} Best: {winner.strategy_name} ({winner.final_score:.1f}) < Threshold ({THRESHOLD})")

strategy_engine = StrategyEngine()
