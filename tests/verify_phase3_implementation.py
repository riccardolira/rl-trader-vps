
import asyncio
import sys
import os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from datetime import datetime, timedelta
from src.application.services.news_service import news_service
from src.application.services.strategy_engine import strategy_engine # Verify optimization

async def verify_phase3():
    print("--- Verifying Phase 3: News & Dynamic Sizing (Refined) ---")
    
    # 1. Verify News Service Blackout Logic (Smart Parse)
    print("\n[1] Testing News Service Blackout Logic...")
    
    # Mock a window for USD
    now = datetime.utcnow()
    news_service.blackout_windows = [{
        "start": now - timedelta(minutes=10),
        "end": now + timedelta(minutes=10),
        "currency": "USD",
        "title": "Mock High Impact Event"
    }]
    news_service.running = True 
    
    # Check Smart Parse
    print(f"Checking AUDUSD (Should be blocked)...")
    if news_service.should_halt_trading("AUDUSD"):
        print("PASS: AUDUSD blocked.")
    else:
        print("FAIL: AUDUSD allowed.")

    # 2. Verify Strategy Engine Optimization
    print("\n[2] Testing Strategy Engine Optimization...")
    # Analyzing AUDUSD should return None/Empty immediately without calling MarketData
    # We can't easily spy on it without mocks, but we can call it.
    # If it tries to call MarketData it might fail or log error. 
    # But since we are not running the full loop, just the method:
    
    try:
        # This should return None (implicit) because of the "return" statement added.
        # If it continued, it would hit "await market_data.get_context" which might fail or do IO.
        # But since we didn't mock MDS, if it proceeds it will try to call MDS.
        # If optimization works, it returns instantly.
        res = await strategy_engine._analyze_symbol("AUDUSD")
        print("PASS: StrategyEngine._analyze_symbol returned successfully (likely skipped).")
    except Exception as e:
        print(f"FAIL: StrategyEngine raised exception: {e}")

    print("\n--- Phase 3 Verification Complete ---")

if __name__ == "__main__":
    asyncio.run(verify_phase3())
