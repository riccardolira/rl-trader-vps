import asyncio
from src.infrastructure.logger import log
from src.main import load_configs

async def test_motor():
    # 1. Boot up services
    await load_configs()
    log.info("Configs loaded.")
    
    from src.application.services.guardian_service import guardian_service
    from src.infrastructure.mt5_adapter import mt5_adapter
    
    # 2. Start MT5 Adapter
    connected = await mt5_adapter.connect()
    if not connected:
        log.error("MT5 Worker didn't connect. Fix MT5 credentials first!")
        return
        
    log.info("MT5 Connected. Generating synthetic signal...")
    
    # 3. Create a fake Strategy Candidate
    from src.domain.models import StrategyCandidate
    candidate = StrategyCandidate(
         symbol="EURUSD",
         strategy_name="SmartMoney",
         side="BUY",
         confidence_score=90.0,
         stop_loss=1.04000,
         take_profit=1.06000,
         reason="TEST_MOTOR",
         metadata={"risk_class": "FOREX"}
    )
    
    # 4. Pass straight to Arbiter
    from src.application.services.arbiter_service import arbiter_service
    log.info("Sending candidate to Arbiter...")
    await arbiter_service.on_strategy_signal(candidate)
    
    log.info("Test finished. Check logs above to see if Execution Service placed the DraftOrder.")
    await mt5_adapter.disconnect()

if __name__ == "__main__":
    asyncio.run(test_motor())
