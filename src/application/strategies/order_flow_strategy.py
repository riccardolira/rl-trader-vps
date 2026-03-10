from typing import Dict, Any, Optional
from src.domain.strategy import IStrategy, MarketContext, StrategyCandidate, AnalysisSide, ExitStyle, RegimeType
from src.infrastructure.news.news_worker import news_worker
from datetime import datetime

class OrderFlowStrategy(IStrategy):
    """
    Order Flow & Algorithmic Sentiment Scalping.
    Logic: Tick Volume Spike (> 2.5x VMA) + MTF Logic Alignment.
    Favors: TREND, STRONG_TREND regimes. Avoids RANGE unless News is active.
    Exit: Scalping (Tight SL 1.0x, TP 1.5x-2.0x).
    """

    @property
    def name(self) -> str:
        return "OrderFlowScalping"

    async def analyze(self, context: MarketContext) -> StrategyCandidate:
        vol_spike_ratio = context.indicators.get('vol_spike_ratio')
        current_price = context.price_close
        
        # Guard: Missing Volume Data
        if vol_spike_ratio is None:
            return StrategyCandidate(
                symbol=context.symbol,
                strategy_name=self.name,
                side=AnalysisSide.NEUTRAL,
                reason_code="MISSING_VOL_DATA"
            )

        side = AnalysisSide.NEUTRAL
        score_signal = 0.0
        reason = "OK"
        
        # 1. Mathematical Trigger: Volume Infiltration (1.5x the average)
        # Instead of 2.5x which only happens on NFP, 1.5x indicates heavy institutional stepping.
        if vol_spike_ratio < 1.5:
             # Regular market noise, ignore.
             return StrategyCandidate(
                symbol=context.symbol,
                strategy_name=self.name,
                side=AnalysisSide.NEUTRAL,
                reason_code="VOL_BELOW_SPIKE_THRESH"
             )
             
        # Extract OHLC from current bar to determine direction of the spike
        # We look at where the close is relative to the candle's range
        # (Close - Low) / (High - Low)
        opens = context.metadata.get('opens', [])
        highs = context.metadata.get('highs', [])
        lows  = context.metadata.get('lows', [])
        
        if len(opens) == 0:
            return StrategyCandidate(symbol=context.symbol, strategy_name=self.name, side=AnalysisSide.NEUTRAL, reason_code="MISSING_OHLC")
            
        cur_open = opens[-1]
        cur_high = highs[-1]
        cur_low = lows[-1]
        cur_close = current_price
        
        candle_range = cur_high - cur_low
        if candle_range == 0:
            return StrategyCandidate(symbol=context.symbol, strategy_name=self.name, side=AnalysisSide.NEUTRAL, reason_code="ZERO_RANGE")
            
        close_pct = (cur_close - cur_low) / candle_range
        
        # If closing in the top 30% -> Buyers won the volume spike
        if close_pct >= 0.70:
             side = AnalysisSide.BUY
             score_signal = 80.0
        # If closing in the bottom 30% -> Sellers won the volume spike
        elif close_pct <= 0.30:
             side = AnalysisSide.SELL
             score_signal = 80.0
        else:
             # Massive volume but closed in the middle (indecision/doji) -> Dangerous for Scalping
             return StrategyCandidate(symbol=context.symbol, strategy_name=self.name, side=AnalysisSide.NEUTRAL, reason_code="DOJI_SPIKE_REJECTED")
             

        # 2. Algorithmic Sentiment Filter (Macro + News)
        # Check MTF Trend Filter (Macro Bias)
        if side != AnalysisSide.NEUTRAL:
             if context.mtf_trend != AnalysisSide.NEUTRAL and context.mtf_trend != side:
                 # The spike is against the daily trend (Likely a Trap / Shakeout to hunt stops)
                 return StrategyCandidate(
                     symbol=context.symbol,
                     strategy_name=self.name,
                     side=AnalysisSide.NEUTRAL,
                     reason_code="MTF_MACRO_MISMATCH"
                 )
             else:
                 # MTF agrees or is neutral. Excellent.
                 score_signal += 10.0 # Boost to 90
                 
        # 3. Regime Fit (Momentum/Scalping is best in Trends)
        score_regime_fit = 0.0
        
        # Check News Context
        now = datetime.utcnow()
        today_str = now.strftime("%Y-%m-%d")
        news_threat = False
        
        # If we have any High-Impact news today matching the symbol, we allow RANGE spikes.
        for ev in news_worker.events_cache:
            if ev.date_str == today_str and ev.impact == "High":
                 # Not a perfect currency match, but overall volatility wrapper
                 news_threat = True
                 break

        if context.regime == RegimeType.STRONG_TREND:
            score_regime_fit = 100.0 # Flow in strong trend = Continuation explosion
        elif context.regime == RegimeType.TREND:
            score_regime_fit = 90.0
        elif context.regime == RegimeType.NEUTRAL:
            score_regime_fit = 60.0 # A spike in neutral usually starts a trend
        elif context.regime == RegimeType.RANGE:
             # Spikes in Range are usually sweeps (fakeouts), unless there's heavy news driving it
             if news_threat:
                  score_regime_fit = 80.0 # News-driven breakout out of range
             else:
                  score_regime_fit = 30.0 # Softened from 0.0. 
                  reason = "RANGE_NO_NEWS_TRAP"
                  # Softened penalty so it doesn't automatically block if signal is 90
                  score_signal -= 20.0 

        # 4. Microstructure Penalty (Spread Limit for Scalping)
        penalty_micro = 0.0
        if context.atr_value > 0:
            spread_cost = context.spread * context.point_value
            spread_ratio = spread_cost / context.atr_value
            # Scalping is VERY sensitive to Spread. 
            # If spread is > 10% of ATR, penalize heavily.
            if spread_ratio > 0.10: 
                penalty_micro = 40.0 # We don't want to scalp wide spreads
                reason = reason + "| HIGH_SPREAD"

        # 5. Final Score Calculation
        # Weights: Signal 0.6, Regime 0.4
        raw_score = (0.6 * score_signal) + (0.4 * score_regime_fit)
        final_score = max(0.0, raw_score - penalty_micro)
        
        # 6. Exit Proposal (Scalping: Tight and Fast)
        # Scalping requires high Win Rate. Stop goes right below the entry candle.
        stop_mult = 1.0 
        take_mult = 2.0 
        
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
                "vol_spike_ratio": vol_spike_ratio,
                "close_pct": close_pct,
                "news_threat": news_threat,
                "price": current_price
            }
        )
