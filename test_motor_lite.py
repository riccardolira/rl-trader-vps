import asyncio
from src.infrastructure.logger import log

async def check_credentials():
    from src.infrastructure.config import settings
    log.info(f"Loaded Settings. MT5_LOGIN: {settings.MT5_LOGIN}")
    
    from src.application.services.guardian_service import guardian_service
    await guardian_service.start()
    log.info("Guardian Started.")
    
    from src.infrastructure.mt5_adapter import mt5_adapter
    connected = await mt5_adapter.connect()
    if connected:
        log.success("SUCCESS! MT5 IS CONNECTED AND AUTHORIZED.")
        
        from src.domain.models import StrategyCandidate
        candidate = StrategyCandidate(
             symbol="EURUSD",
             strategy_name="TrendFollowing",
             side="BUY",
             confidence_score=85.0,
             stop_loss=1.04000,
             take_profit=1.06000,
             reason="TEST_MOTOR",
             metadata={"risk_class": "FOREX"}
        )
        from src.application.services.arbiter_service import arbiter_service
        from src.services.execution.execution_service import execution_service
        await execution_service.start()
        
        log.info("Sending candidate to Arbiter...")
        await arbiter_service.on_strategy_signal(candidate)
        await asyncio.sleep(2) # Wait for execution
        
        await execution_service.stop()
        await mt5_adapter.disconnect()
    else:
        log.error("MT5 CONNECTION FAILED.")

if __name__ == "__main__":
    asyncio.run(check_credentials())
