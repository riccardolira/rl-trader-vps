from typing import Dict, Any, Optional
from src.domain.strategy import IStrategy, MarketContext, StrategyCandidate, AnalysisSide, ExitStyle, RegimeType

class MeanReversionStrategy(IStrategy):
    """
    Mean Reversion Strategy (MVP).
    Logic: RSI(14) Overbought/Oversold.
    Favors: RANGE, NEUTRAL regimes.
    Penalized in: TREND, STRONG_TREND.
    """

    @property
    def name(self) -> str:
        return "MeanReversion"

    async def analyze(self, context: MarketContext) -> StrategyCandidate:
        rsi_14 = context.indicators.get('rsi_14')
        bb_upper = context.indicators.get('bb_upper')
        bb_lower = context.indicators.get('bb_lower')
        squeeze_pct = context.indicators.get('squeeze_pct', 50.0)
        
        import pandas as pd
        # Guard Clause: Missing Data or NaN
        if any(v is None for v in [rsi_14, bb_upper, bb_lower]) or any(pd.isna(v) for v in [rsi_14, bb_upper, bb_lower]):
            return StrategyCandidate(
                symbol=context.symbol,
                strategy_name=self.name,
                side=AnalysisSide.NEUTRAL,
                reason_code="MISSING_INDICATORS"
            )

        side = AnalysisSide.NEUTRAL
        score_signal = 0.0
        reason = "OK"
        current_price = context.price_close
        
        # Volatility Gate: Do not revert if bands are squeezing (breakout imminent)
        if squeeze_pct < 40.0:
            return StrategyCandidate(
                symbol=context.symbol,
                strategy_name=self.name,
                side=AnalysisSide.NEUTRAL,
                reason_code="VOLATILITY_SQUEEZE"
            )

        # 1. Signal Logic: Extreme RSI + BB
        if rsi_14 < 25 and current_price <= bb_lower:
             side = AnalysisSide.BUY
             # Lower RSI = Stronger Signal
             score_signal = 80.0 + (25 - rsi_14) * 1.5 
             score_signal = min(score_signal, 100.0)
        elif rsi_14 > 75 and current_price >= bb_upper:
             side = AnalysisSide.SELL
             # Higher RSI = Stronger Signal
             score_signal = 80.0 + (rsi_14 - 75) * 1.5
             score_signal = min(score_signal, 100.0)
        else:
             score_signal = 0.0 # No signal in neutral zone

        # 2. Regime Fit Calculation
        score_regime_fit = 0.0
        reason = "OK"

        if context.regime == RegimeType.RANGE:
            score_regime_fit = 100.0 # Reversion loves Range
        elif context.regime == RegimeType.NEUTRAL:
            score_regime_fit = 80.0
        elif context.regime == RegimeType.TREND:
             score_regime_fit = 40.0 # Risky (Counter-trend?)
        elif context.regime == RegimeType.STRONG_TREND:
             score_regime_fit = 0.0 # Suicide
             reason = "REGIME_MISMATCH_STRONG_TREND"

        # 3. Microstructure Penalty
        penalty_micro = 0.0
        if context.atr_value > 0:
            spread_cost = context.spread * context.point_value
            spread_ratio = spread_cost / context.atr_value
            if spread_ratio > 0.15: # Standardized across strategies
                penalty_micro = 15.0 
            
        # 4. Final Score (Weights: Signal 0.6, Regime 0.4)
        # Reversion depends more on the oscillator value
        raw_score = (0.6 * score_signal) + (0.4 * score_regime_fit)
        final_score = max(0.0, raw_score - penalty_micro)
        
        # 5. Exit Proposal (Tighter limits)
        stop_mult = 2.0 # Adjusted from 1.0
        take_mult = 2.5 # Adjusted from 1.5
        
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
                "rsi_14": rsi_14, 
                "price": context.price_close
            }
        )
