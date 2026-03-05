import pandas as pd
from typing import Dict, Any, Optional
from src.domain.strategy import IStrategy, MarketContext, StrategyCandidate, AnalysisSide, ExitStyle, RegimeType
from src.application.strategies.utils.smc_math import SmcMath, StructureType

class SMCStrategy(IStrategy):
    """
    Smart Money Concepts (SMC) Strategy.
    Logic: Detects Market Structure (BOS/ChoCh) and mitigates from unmitigated FVGs.
    Favors: TREND (Continuation), RANGE (Liquidity Sweeps).
    """

    @property
    def name(self) -> str:
        return "SmartMoney"

    async def analyze(self, context: MarketContext) -> StrategyCandidate:
        metadata = context.metadata
        
        # Guard: Missing OHLC data (required for SMC)
        if not metadata or 'opens' not in metadata or 'closes' not in metadata:
            return StrategyCandidate(
                symbol=context.symbol,
                strategy_name=self.name,
                side=AnalysisSide.NEUTRAL,
                reason_code="MISSING_OHLC_DATA"
            )
            
        if len(metadata['opens']) < 10:
             return StrategyCandidate(
                symbol=context.symbol,
                strategy_name=self.name,
                side=AnalysisSide.NEUTRAL,
                reason_code="INSUFFICIENT_DATA_FOR_SMC"
            )

        # Reconstruct series from numpy arrays
        opens = pd.Series(metadata['opens'])
        highs = pd.Series(metadata['highs'])
        lows = pd.Series(metadata['lows'])
        closes = pd.Series(metadata['closes'])
        
        # 1. Mathematical Analysis (SmcMath)
        swing_highs, swing_lows = SmcMath.find_swing_points(highs, lows, length=5)
        structure = SmcMath.detect_structure(swing_highs, swing_lows, context.price_close)
        fvgs = SmcMath.find_fvgs(opens, highs, lows, closes)
        
        current_price = context.price_close
        side = AnalysisSide.NEUTRAL
        score_signal = 0.0
        reason = "OK"
        
        # 2. Strategy Logic: FVG Mitigation
        # Filter for FVGs that align with the current structure
        valid_fvgs = []
        if structure == StructureType.BULLISH:
            valid_fvgs = [fvg for fvg in fvgs if fvg['type'] == 'BULLISH']
        elif structure == StructureType.BEARISH:
            valid_fvgs = [fvg for fvg in fvgs if fvg['type'] == 'BEARISH']
            
        # Check if current bar's high/low touches (mitigates) a valid FVG
        current_low = lows.iloc[-1]
        current_high = highs.iloc[-1]
        
        for fvg in valid_fvgs:
            if fvg['type'] == 'BULLISH':
                # Bullish FVG needs price to dip into it. We check if the Low pierced top.
                if current_low <= fvg['top'] and current_high >= fvg['bottom']:
                    side = AnalysisSide.BUY
                    score_signal = 85.0 # Strong institutional signal
                    reason = "FVG_MITIGATION_BULL"
                    break
            elif fvg['type'] == 'BEARISH':
                # Bearish FVG needs price to spike up into it. We check if the High pierced bottom.
                if current_high >= fvg['bottom'] and current_low <= fvg['top']:
                    side = AnalysisSide.SELL
                    score_signal = 85.0
                    reason = "FVG_MITIGATION_BEAR"
                    break
                    
        # 3. Regime Fit (Macro Alignment)
        score_regime_fit = 0.0
        if side != AnalysisSide.NEUTRAL:
            if context.regime == RegimeType.STRONG_TREND:
                score_regime_fit = 100.0 # Excellent for SMC continuation
            elif context.regime == RegimeType.TREND:
                score_regime_fit = 80.0
            elif context.regime == RegimeType.RANGE:
                 # FVGs are extremely unreliable in ranging markets without liquidity sweeps
                score_regime_fit = 0.0 
                score_signal -= 50.0 # Heavy Penalty for FVG in Range
                reason = "SMC_AVOID_RANGE"
            elif context.regime == RegimeType.NEUTRAL:
                score_regime_fit = 40.0 # Often precedes a strong move
                score_signal -= 20.0
                reason = "SMC_NEUTRAL"

        # 4. Microstructure Penalty
        penalty_micro = 0.0
        if context.atr_value > 0:
            spread_cost = context.spread * context.point_value
            spread_ratio = spread_cost / context.atr_value
            if spread_ratio > 0.15: # SMC needs tight spreads, matching general standard
                penalty_micro = 20.0 
                
        # 5. Final Score
        raw_score = (0.6 * score_signal) + (0.4 * score_regime_fit)
        final_score = max(0.0, raw_score - penalty_micro)
        
        # 6. Exit Proposal (SMC Exits)
        # Stop is tight (below FVG/OB), Target is asymmetric
        stop_mult = 1.5 # Adjusted from 0.8
        take_mult = 3.0 # Adjusted from 2.0
        
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
                "structure": structure.value,
                "fvg_count": len(valid_fvgs),
                "price": current_price
            }
        )
