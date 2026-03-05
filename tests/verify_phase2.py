import asyncio
import pandas as pd
import numpy as np
from src.domain.regime import RegimeComputer
from src.domain.strategy import RegimeType, MarketContext, AnalysisSide
from src.application.strategies.breakout_strategy import BreakoutStrategy

# 1. Test Regime Logic (Hysteresis)
def test_regime_logic():
    print("\n--- Testing Regime Hysteresis ---")
    
    # Sequence: Neutral -> Trend -> Strong -> Trend -> Neutral -> Range
    sequence = [
        (22, RegimeType.NEUTRAL, RegimeType.NEUTRAL), # Start Neutral
        (25, RegimeType.NEUTRAL, RegimeType.TREND),   # Enter Trend (>=25)
        (28, RegimeType.TREND, RegimeType.TREND),     # Stay Trend (Buffer)
        (30, RegimeType.TREND, RegimeType.STRONG_TREND), # Enter Strong (>=30)
        (29, RegimeType.STRONG_TREND, RegimeType.STRONG_TREND), # Stay Strong (>28)
        (27, RegimeType.STRONG_TREND, RegimeType.TREND), # Exit Strong (<=28) -> Trend
        (24, RegimeType.TREND, RegimeType.TREND),     # Stay Trend (>23)
        (22, RegimeType.TREND, RegimeType.NEUTRAL),   # Exit Trend (<=23) -> Neutral
        (19, RegimeType.NEUTRAL, RegimeType.RANGE),   # Enter Range (<20)
        (21, RegimeType.RANGE, RegimeType.RANGE),     # Stay Range (<22)
        (22, RegimeType.RANGE, RegimeType.NEUTRAL)    # Exit Range (>=22) -> Neutral
    ]
    
    failed = False
    for adx, prev, expected in sequence:
        result = RegimeComputer.compute_regime(float(adx), prev)
        status = "PASS" if result == expected else "FAIL"
        print(f"ADX={adx}, Prev={prev.value} -> New={result.value} (Expected={expected.value}) [{status}]")
        if result != expected:
            failed = True
            
    if failed:
        print("Regime Logic FAILED")
    else:
        print("Regime Logic PASSED")

# 2. Test Breakout Strategy Logic
async def test_breakout_strategy():
    print("\n--- Testing Breakout Strategy ---")
    strategy = BreakoutStrategy()
    
    # Case A: Squeeze + Breakout Up
    ctx_squeeze_break = MarketContext(
        symbol="TEST", timeframe="H1", regime=RegimeType.TREND,
        adx_value=28.0, atr_value=0.0020, spread=20, point_value=0.00001, # Ratio 0.1 (Borderline)
        price_close=1.1050,
        indicators={
            "bb_upper": 1.1040, # Price > Upper
            "bb_lower": 1.0960,
            "squeeze_pct": 10.0 # < 20 (Squeeze)
        }
    )
    
    res = await strategy.analyze(ctx_squeeze_break)
    print(f"Case A (Squeeze+BreakUp): Score={res.final_score} Side={res.side} Reason={res.reason_code}")
    
    # Case B: No Squeeze
    ctx_no_squeeze = MarketContext(
        symbol="TEST", timeframe="H1", regime=RegimeType.TREND,
        adx_value=28.0, atr_value=0.0020, spread=10, point_value=0.00001,
        price_close=1.1050,
        indicators={
            "bb_upper": 1.1040, 
            "bb_lower": 1.0960,
            "squeeze_pct": 50.0 # No Squeeze
        }
    )
    res_b = await strategy.analyze(ctx_no_squeeze)
    print(f"Case B (No Squeeze): Score={res_b.final_score} Side={res_b.side} Reason={res_b.reason_code}")

if __name__ == "__main__":
    test_regime_logic()
    asyncio.run(test_breakout_strategy())
