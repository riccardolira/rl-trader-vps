from typing import Dict, Optional
from src.domain.strategy import IStrategy, MarketContext, StrategyCandidate, AnalysisSide, ExitStyle, RegimeType

class BreakoutStrategy(IStrategy):
    """
    Volatility Breakout Strategy (Phase 2).
    Logic: Bollinger Band Squeeze + Breakout.
    Favors: STRONG_TREND (Explosion), RANGE (Preparation).
    """

    @property
    def name(self) -> str:
        return "VolatilityBreakout"

    async def analyze(self, context: MarketContext) -> StrategyCandidate:
        bb_upper = context.indicators.get('bb_upper')
        bb_lower = context.indicators.get('bb_lower')
        squeeze_pct = context.indicators.get('squeeze_pct')
        
        # Guard: Missing Data
        if bb_upper is None or squeeze_pct is None:
            return StrategyCandidate(
                symbol=context.symbol,
                strategy_name=self.name,
                side=AnalysisSide.NEUTRAL,
                reason_code="MISSING_BB_DATA"
            )

        current_price = context.price_close
        side = AnalysisSide.NEUTRAL
        score_signal = 0.0
        reason = "OK"
        
        # 1. Squeeze Condition (Context)
        # Squeeze percentile must indicate compression (e.g. bottom 30%)
        is_squeeze = squeeze_pct < 30.0
        
        # 2. Institutional Volume Check
        # Breakouts are fake unless volume is higher than the moving average (VMA_20)
        vol_spike_ratio = context.indicators.get('vol_spike_ratio', 1.0)
        is_volume_backed = vol_spike_ratio > 1.25 # Require 25% more volume than average
        
        # 3. Breakout Trigger
        # Close OUTSIDE Bands AND Accompanied by true Volume
        is_break_up = current_price > bb_upper and is_volume_backed
        is_break_down = current_price < bb_lower and is_volume_backed
        
        if is_break_up:
            side = AnalysisSide.BUY
            score_signal = 80.0
        elif is_break_down:
            side = AnalysisSide.SELL
            score_signal = 80.0
        elif (current_price > bb_upper or current_price < bb_lower) and not is_volume_backed:
            return StrategyCandidate(
                symbol=context.symbol,
                strategy_name=self.name,
                side=AnalysisSide.NEUTRAL,
                reason_code="FAKEOUT_NO_VOLUME"
            )
        
        # Boost signal if it comes from a Squeeze (The Explosion)
        if side != AnalysisSide.NEUTRAL and is_squeeze:
            score_signal += 15.0 # Boost to 95
            
        # 3. Regime Fit
        score_regime_fit = 0.0
        
        if context.regime == RegimeType.STRONG_TREND:
            score_regime_fit = 100.0 # Breakouts create Strong Trends
        elif context.regime == RegimeType.TREND:
            score_regime_fit = 80.0
        elif context.regime == RegimeType.RANGE:
            # Plan says: "Permitido c/ Squeeze" in Range
            if is_squeeze:
                score_regime_fit = 90.0 # Valid breakout setup
            else:
                score_regime_fit = 40.0 # Random breakout without squeeze in range = fakeout likely
                reason = "RANGE_NO_SQUEEZE"
        elif context.regime == RegimeType.NEUTRAL:
            score_regime_fit = 60.0

        # 4. Microstructure Penalty
        penalty_micro = 0.0
        if context.atr_value > 0:
            spread_cost = context.spread * context.point_value
            spread_ratio = spread_cost / context.atr_value
            if spread_ratio > 0.15: # Standardized across strategies
                penalty_micro = 15.0

        # 5. Final Score
        # Weights: Signal 0.5, Regime 0.5 (Standard)
        # But Breakout relies heavily on the specific trigger
        raw_score = (0.5 * score_signal) + (0.5 * score_regime_fit)
        final_score = max(0.0, raw_score - penalty_micro)
        
        # 5. Exit (Volatile Breakout tends to reverse fast if false, so tighter stop)
        stop_mult = 2.0 # Adjusted from 1.0
        take_mult = 4.0
        
        return StrategyCandidate(
            symbol=context.symbol,
            strategy_name=self.name,
            side=side,
            score_signal=score_signal,
            score_regime_fit=score_regime_fit,
            penalty_microstructure=penalty_micro,
            final_score=final_score,
            stop_atr_mult=stop_mult,
            take_atr_mult=take_mult,
            exit_style=ExitStyle.FIXED,
            reason_code=reason,
            metadata={
                "squeeze_pct": squeeze_pct,
                "is_squeeze": is_squeeze,
                "bb_upper": bb_upper,
                "bb_lower": bb_lower,
                "price": current_price
            }
        )
