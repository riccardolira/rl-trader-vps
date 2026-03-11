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
        
        # Get Dynamic Configs
        dyn_config = context.strategy_configs.get(self.name, {})
        MIN_VOL_SPIKE = dyn_config.get("min_volume_spike_ratio", 1.5)
        WINNER_CLOSE = dyn_config.get("winner_close_pct", 0.70)
        LOSER_CLOSE = 1.0 - WINNER_CLOSE

        # 1. Mathematical Trigger: Volume Infiltration 
        if vol_spike_ratio < MIN_VOL_SPIKE:
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
        
        # If closing in the top config% -> Buyers won the volume spike
        if close_pct >= WINNER_CLOSE:
             side = AnalysisSide.BUY
             score_signal = 80.0
        # If closing in the bottom config% -> Sellers won the volume spike
        elif close_pct <= LOSER_CLOSE:
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

        # 4. Microstructure Penalty
        penalty_micro = 0.0
        MAX_SPREAD = dyn_config.get("max_spread_ratio", 0.10)
        SPREAD_PENALTY = dyn_config.get("spread_penalty_score", 20.0)

        if context.atr_value > 0:
            spread_cost = context.spread * context.point_value
            spread_ratio = spread_cost / context.atr_value
            # Scalping is VERY sensitive to Spread. 
            # If spread is > MAX_SPREAD of ATR, penalize heavily.
            if spread_ratio > MAX_SPREAD: 
                penalty_micro = SPREAD_PENALTY
                reason = reason + "| HIGH_SPREAD"

        # 5. Final Score Calculation
        # Weights: Signal 0.6, Regime 0.4
        raw_score = (0.6 * score_signal) + (0.4 * score_regime_fit)
        final_score = max(0.0, raw_score - penalty_micro)
        
        # 6. Exit Proposal (Scalping: Tight and Fast)
        # Stop is tight, Take is asymmetric
        stop_mult = dyn_config.get("stop_atr_mult", 1.0)
        take_mult = dyn_config.get("take_atr_mult", 2.0)
        
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
