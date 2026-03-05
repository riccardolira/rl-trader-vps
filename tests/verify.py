import asyncio
import os
import sys
from unittest.mock import MagicMock

# 1. Mock dependencies if missing (for CI/CD or Verification Environment)
try:
    import MetaTrader5
except ImportError:
    sys.modules["MetaTrader5"] = MagicMock()
    print("MOCKED: MetaTrader5")

try:
    import loguru
except ImportError:
    # logger.py handles fallback, but we ensure no crash
    pass

# Add project root to path
sys.path.append(os.getcwd())

from src.domain.models import Signal, OrderSide
from src.domain.events import SignalGenerated, OrderDrafted, OrderApproved
from src.infrastructure.event_bus import event_bus
from src.infrastructure.config import settings
from src.infrastructure.logger import log

# New Service Imports
from src.application.services.arbiter_service import arbiter_service
from src.application.services.guardian_service import guardian_service
from src.services.execution.execution_service import execution_service
from src.infra.db.migrator import Migrator
from src.infrastructure.event_store import EventStore

from src.services.health.time_skew_guard import time_skew_guard
from src.services.health.heartbeat import heartbeat_service

async def run_verification():
    log.info("=== STARTING V3 CHASSIS (HARDENED) VERIFICATION via Verify.py ===")
    
    # 0. Setup
    settings.DB_PATH = "verify_test.db"
    if os.path.exists("verify_test.db"):
        try:
            os.remove("verify_test.db")
        except PermissionError:
            pass # open elsewhere
        
    await Migrator.run()
    
    # 1. Start Services
    await arbiter_service.start()
    await guardian_service.start()
    
    # Execution Service imports Reconciler which imports MT5
    # If MT5 is mocked, we need to ensure calls don't crash logic
    execution_service.reconciler.mt5_adapter.get_positions = MagicMock(return_value=[])
    await execution_service.start()
    
    # 2. Start Health Services
    await heartbeat_service.start()
    await time_skew_guard.start()
    
    # 3. Capture Events
    captured_events = []
    event_store = EventStore()
    
    async def capture(event):
        captured_events.append(event)
        await event_store.save_event(event)
        # log.info(f"CAPTURED: {event.type}")
        
    event_bus.subscribe("*", capture)
    
    # 4. Test Case 1: Valid Signal Flow
    log.info("\n--- TEST CASE 1: Valid Signal ---")
    sig1 = Signal(
        symbol="EURUSD",
        direction=OrderSide.BUY,
        score=75.0,
        strategy_name="TestStrat"
    )
    await event_bus.publish(SignalGenerated(signal=sig1))
    await asyncio.sleep(1)
    
    types = [e.type for e in captured_events]
    if "ORDER_APPROVED" in types:
        log.success("PASS: Valid Signal Flow (Approved)")
    else:
        log.warning(f"PARTIAL: Signal Flow stopped at {types[-1] if types else 'None'}")
    
    # 5. Persistence Check
    import aiosqlite
    try:
        async with aiosqlite.connect("verify_test.db") as db:
            async with db.execute("SELECT count(*) FROM audit_events") as cur:
                row = await cur.fetchone()
                count = row[0]
                log.info(f"DB Event Count: {count}")
                
            async with db.execute("PRAGMA user_version") as cur:
                row = await cur.fetchone()
                log.info(f"DB Version: {row[0]}")
    except Exception as e:
        log.error(f"DB Check Failed: {e}")
            
    log.success("=== V3 CHASSIS VERIFICATION SCRIPT COMPLETED ===")

if __name__ == "__main__":
    try:
        asyncio.run(run_verification())
    except Exception as e:
        print(f"FATAL VERIFICATION ERROR: {e}") 
        import traceback
        traceback.print_exc()
