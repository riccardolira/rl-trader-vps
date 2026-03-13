import asyncio
from src.infrastructure.logger import log

async def check_motor():
    from src.infrastructure.config import settings
    log.info(f"Loaded Settings. MT5_LOGIN: {settings.MT5_LOGIN}")
    
    from src.application.services.guardian_service import guardian_service
    await guardian_service.start()
    
    from src.infrastructure.mt5_adapter import mt5_adapter
    connected = await mt5_adapter.connect()
    if connected:
        log.success("SUCCESS! MT5 IS CONNECTED AND AUTHORIZED.")
        
        from src.domain.models import Order, OrderSide
        import uuid
        
        # Build a raw Order object
        order = Order(
            draft_id=str(uuid.uuid4()),
            intent_id=str(uuid.uuid4()),
            symbol="EURUSD",
            side=OrderSide.BUY,
            volume=0.01,
            strategy_name="SmartMoney",
            comment="TestOrder",
            sl=0.0,
            tp=0.0,
            magic_number=1000  # SmartMoney magic base
        )
        
        log.info(f"Sending raw order for {order.symbol} to Adapter...")
        try:
            ticket = await mt5_adapter.execute_order(order)
            log.success(f"TRADE EXECUTED! Ticket -> {ticket}")
        except Exception as e:
            log.error(f"TRADE FAILED: {e}")

        await mt5_adapter.disconnect()
    else:
        log.error("MT5 CONNECTION FAILED.")

if __name__ == "__main__":
    asyncio.run(check_motor())
