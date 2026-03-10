from typing import Dict, Any, Optional
from src.domain.strategy import IStrategy, MarketContext, StrategyCandidate, AnalysisSide, ExitStyle, RegimeType

class TrendStrategy(IStrategy):
    """
    Trend Following Strategy (MVP).
    Logic: Price vs SMA(20).
    Favors: TREND, STRONG_TREND regimes.
    Penalized in: RANGE.
    """

    @property
    def name(self) -> str:
        return "TrendFollowing"

    async def analyze(self, context: MarketContext) -> StrategyCandidate:
        sma_20 = context.indicators.get('sma_20')
        
        import pandas as pd
        # Guard Clause: Missing Data or NaN
        if sma_20 is None or pd.isna(sma_20):
            return StrategyCandidate(
                symbol=context.symbol,
                strategy_name=self.name,
                side=AnalysisSide.NEUTRAL,
                reason_code="MISSING_SMA20"
            )

        current_price = context.price_close
        side = AnalysisSide.NEUTRAL
        score_signal = 0.0
        reason = "OK"
        
        # 1. Basic Signal Logic: Price vs SMA20
        adx = context.adx_value
        rsi = context.indicators.get('rsi_14', 50.0)
        
        # Hard Gate: Require actual trend strength to reduce noise
        if pd.isna(adx) or adx < 25.0:
            return StrategyCandidate(
                symbol=context.symbol,
                strategy_name=self.name,
                side=AnalysisSide.NEUTRAL,
                reason_code="WEAK_TREND_ADX_UNDER_25"
            )
            
        # Dynamic Scaling based on ADX (from 25 up to ~50+)
        base_score = 60.0 + min((adx - 25.0) * 1.5, 30.0) # Caps around 90 base score
            
        # Extract OHLC for precise price action measurement
        lows = context.metadata.get('lows', [])
        highs = context.metadata.get('highs', [])
        current_low = lows[-1] if len(lows) > 0 else current_price
        current_high = highs[-1] if len(highs) > 0 else current_price

        # We need to ensure we don't buy the top (Exhaustion Filter).
        # Check distance to SMA20 using Z-Score approximation (Distance / ATR).
        price_distance = abs(current_price - sma_20)
        atr = context.atr_value if hasattr(context, 'atr_value') and context.atr_value > 0 else 0.0001
        distance_ratio = price_distance / atr
        
        # 1. Physics Rule: Rubber Band Effect. If we are > 2 ATRs from the mean, we DO NOT enter. Top is too risky.
        if distance_ratio > 2.0: 
             return StrategyCandidate(
                symbol=context.symbol,
                strategy_name=self.name,
                side=AnalysisSide.NEUTRAL,
                reason_code="EXHAUSTED_TREND_ELASTIC_BAND"
            )
        
        # 2. Pullback Discovery: Price must have retraced to the Mean (SMA) to reload ammunition.
        # Buy: price > sma, but the lowest point of the period touched or got very close to the SMA.
        is_pullback_buy = current_price > sma_20 and abs(current_low - sma_20) / atr < 0.5
        
        # Sell: price < sma, but the highest point of the period touched or got very close to the SMA.
        is_pullback_sell = current_price < sma_20 and abs(current_high - sma_20) / atr < 0.5
        
        if is_pullback_buy:
             side = AnalysisSide.BUY
             score_signal = base_score + 15.0 # Premium for sniper entry
        elif is_pullback_sell:
             side = AnalysisSide.SELL
             score_signal = base_score + 15.0 # Premium for sniper entry
        else:
             # Missing a pullback. It's just riding a wave.
             return StrategyCandidate(
                 symbol=context.symbol,
                 strategy_name=self.name,
                 side=AnalysisSide.NEUTRAL,
                 reason_code="WAITING_FOR_PULLBACK"
             )

        # 2. Regime Fit Calculation
        score_regime_fit = 0.0
        reason = "OK"

        if context.regime == RegimeType.STRONG_TREND:
            score_regime_fit = 100.0
        elif context.regime == RegimeType.TREND:
            score_regime_fit = 90.0
        elif context.regime == RegimeType.NEUTRAL:
             score_regime_fit = 70.0 # Softened from 50.0 to allow trending moves in neutral
        elif context.regime == RegimeType.RANGE:
             score_regime_fit = 30.0 # Softened from 20.0
             reason = "REGIME_MISMATCH_RANGE"

        # 3. Microstructure Penalty (Spread)
        # Using simple logic from plan: if spread > 10% of ATR, penalize.
        penalty_micro = 0.0
        if context.atr_value > 0:
            spread_cost = context.spread * context.point_value
            spread_ratio = spread_cost / context.atr_value
            if spread_ratio > 0.15: # Softened from 0.10
                penalty_micro = 15.0 # Less severe penalty
            
        # 4. Final Score Calculation (MVP Formula)
        # Weights: Signal 0.6, Regime 0.4 (Give slightly more weight to the signal)
        raw_score = (0.6 * score_signal) + (0.4 * score_regime_fit)
        final_score = max(0.0, raw_score - penalty_micro)
        
        # 5. Exit Proposal (Tighter limits for smaller capital)
        # Previous: Stop 1.5x, Take 3.0x 
        stop_mult = 2.5 # Adjusted from 1.5
        take_mult = 4.0 # Adjusted from 3.0
        
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
                "sma_20": sma_20, 
                "price": current_price
            }
        )
