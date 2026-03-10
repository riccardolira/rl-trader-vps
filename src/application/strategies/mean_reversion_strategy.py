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
        
        # Get Dynamic Configs
        dyn_config = context.strategy_configs.get(self.name, {})
        RSI_BOTTOM_PCT = dyn_config.get("rsi_bottom_percentile", 10.0)
        RSI_TOP_PCT = dyn_config.get("rsi_top_percentile", 90.0)
        MAX_SQUEEZE = dyn_config.get("max_squeeze_allowed", 40.0)

        # Volatility Gate: Do not revert if bands are squeezing (breakout imminent)
        if squeeze_pct < MAX_SQUEEZE:
            return StrategyCandidate(
                symbol=context.symbol,
                strategy_name=self.name,
                side=AnalysisSide.NEUTRAL,
                reason_code=f"VOLATILITY_SQUEEZE_WARNING_<{MAX_SQUEEZE}"
            )

        # 1. Signal Logic: Historical Extremes (Percentiles)
        # Instead of static RSI < 25, we compute if current RSI is in the bottom/top X% of its own 100-bar history.
        closes = pd.Series(context.metadata.get('closes', []))
        if len(closes) < 50:
             return StrategyCandidate(symbol=context.symbol, strategy_name=self.name, side=AnalysisSide.NEUTRAL, reason_code="INSUFFICIENT_HISTORY_FOR_PERCENTILES")
             
        # Calculate recent RSI manually without importing heavy libraries if possible, or using pandas
        delta = closes.diff()
        gain = (delta.where(delta > 0, 0)).rolling(window=14).mean()
        loss = (-delta.where(delta < 0, 0)).rolling(window=14).mean()
        rs = gain / loss
        rsi_history = 100 - (100 / (1 + rs))
        recent_rsis = rsi_history.iloc[-100:].dropna()
        
        if len(recent_rsis) == 0:
             return StrategyCandidate(symbol=context.symbol, strategy_name=self.name, side=AnalysisSide.NEUTRAL, reason_code="RSI_HISTORY_FAIL")
             
        # Calculate Percentile (0.0 to 100.0)
        rsi_percentile = (recent_rsis < rsi_14).mean() * 100.0
        
        # A true oversold is in the bottom config% of History
        is_dynamic_oversold = rsi_percentile < RSI_BOTTOM_PCT and current_price <= bb_lower
        is_dynamic_overbought = rsi_percentile > RSI_TOP_PCT and current_price >= bb_upper

        if is_dynamic_oversold:
             side = AnalysisSide.BUY
             # Stronger signal closer to 0 percentile
             score_signal = 80.0 + (RSI_BOTTOM_PCT - rsi_percentile) * (20.0 / RSI_BOTTOM_PCT) if RSI_BOTTOM_PCT > 0 else 100.0
             score_signal = min(score_signal, 100.0)
        elif is_dynamic_overbought:
             side = AnalysisSide.SELL
             score_signal = 80.0 + (rsi_percentile - RSI_TOP_PCT) * (20.0 / (100.0 - RSI_TOP_PCT)) if RSI_TOP_PCT < 100 else 100.0
             score_signal = min(score_signal, 100.0)
        else:
             score_signal = 0.0 # No mathematical extreme

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
