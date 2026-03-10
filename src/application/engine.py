import asyncio
from src.infrastructure.logger import log
from src.infrastructure.config import settings
from src.infrastructure.mt5_adapter import mt5_adapter
from src.infrastructure.system.shutdown_handler import shutdown_handler

# Refactored Imports
from src.services.notification.notification_service import notification_service
from src.services.health.disk_guard import disk_guard
from src.services.health.time_skew_guard import time_skew_guard
from src.services.health.heartbeat import heartbeat_service
from src.services.execution.execution_service import execution_service

# Original locations (didn't move yet)
from src.application.services.strategy_engine import strategy_engine
from src.application.services.asset_selection_service import asset_selection_service

# Original locations (didn't move yet)
# from src.application.services.scanner_service import scanner_service
from src.application.services.arbiter_service import arbiter_service
from src.application.services.arbiter_service import arbiter_service
from src.application.services.guardian_service import guardian_service
# from src.application.services.news_service import news_service # Deprecated Phase 3
from src.infrastructure.news.news_worker import news_worker

class Engine:
    async def boot(self):
        log.info(f"Booting {settings.PROJECT_NAME} Engine (Hardened)...")
        
        # 1. System & Safety
        shutdown_handler.setup_handlers()
        
        # 2. Database Migrations & Init
        log.info("Running database migrations (Alembic)...")
        proc = await asyncio.create_subprocess_shell("alembic upgrade head")
        await proc.communicate()
        if proc.returncode != 0:
            log.critical("Database migrations failed. Aborting boot.")
            return
        
        # 3. Connectivity & Infra
        if not await mt5_adapter.connect():
            log.critical("Failed to connect to MT5. Aborting boot.")
            return

        # 4. Start Health Services
        await notification_service.start()
        await disk_guard.start()
        await time_skew_guard.start()
        await heartbeat_service.start()
        
        # 4.1 Database Archival Task
        from src.application.services.archive_service import archive_service
        await archive_service.start()

        # 5. Start Core Services (Passive)
        # await news_service.start() # Handled by news_worker now
        await guardian_service.start()
        await arbiter_service.start()
        await execution_service.start()
        
        # 6. Reconcile State (Crash Recovery)
        await execution_service.reconcile_state()

        # 7. Start Active Loops (Strategy Engine V3)
        # First: News/Holiday Background task to shield the scanner
        await news_worker.start()
        
        # Second: Asset Selection (Universe Gate)
        await asset_selection_service.start()
        # Third: Strategy Engine
        await strategy_engine.start()
        
        log.success("Engine Boot Complete. Running...")
        
        # Keep alive
        try:
            while True:
                await asyncio.sleep(1)
        except asyncio.CancelledError:
            log.info("Engine Main Loop Cancelled.")
            await self.shutdown()

    async def shutdown(self):
        log.info("Engine shutting down services...")
        from src.application.services.archive_service import archive_service
        await archive_service.stop()
        await strategy_engine.stop()
        await asset_selection_service.stop()
        await mt5_adapter.disconnect()
        log.info("Services stopped.")

if __name__ == "__main__":
    trio = Engine()
    try:
        asyncio.run(trio.boot())
    except KeyboardInterrupt:
        pass
