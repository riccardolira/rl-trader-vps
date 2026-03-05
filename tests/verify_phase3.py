import asyncio
import uuid
from src.infrastructure.event_bus import event_bus
from src.domain.events import SignalGenerated, OrderDrafted, OrderApproved
from src.domain.models import Signal, OrderSide, Order
from src.application.services.arbiter_service import arbiter_service
from src.application.services.guardian_service import guardian_service
from src.services.execution.execution_service import execution_service
from src.infrastructure.mt5_adapter import mt5_adapter
from src.infrastructure.logger import log

# Mock MT5 Adapter
async def mock_execute_order(order: Order) -> int:
    print(f"\n[MOCK MT5] Executing Order: {order.side} {order.symbol} Vol={order.volume} SL={order.sl} TP={order.tp}")
    return 999999 # Fake Ticket

mt5_adapter.execute_order = mock_execute_order

async def verify_phase3():
    print("--- Starting Phase 3 Verification (Execution Loop) ---")
    
    # 1. Start Services
    await arbiter_service.start()
    await guardian_service.start()
    await execution_service.start()
    
    # 2. Simulate Signal
    test_signal = Signal(
        symbol="EURUSD",
        direction=OrderSide.BUY,
        score=85.0,
        strategy_name="TestStrategy",
        metadata={
            "price": 1.1000,
            "atr_value": 0.0020,
            "point_value": 0.00001,
            "stop_atr_mult": 1.5,
            "take_atr_mult": 2.0
        }
    )
    
    print(f"1. Publishing Signal: {test_signal.symbol} Score={test_signal.score}")
    await event_bus.publish(SignalGenerated(signal=test_signal, component="TestComponent"))
    
    # Wait for processing
    await asyncio.sleep(2)
    print("--- Verification Complete ---")

if __name__ == "__main__":
    # Configure Logging to Console for visibility
    # Assuming logger already configured or basic config
    asyncio.run(verify_phase3())
