import asyncio
from datetime import datetime, timedelta
from sqlalchemy import delete
from src.infrastructure.logger import log
from src.infrastructure.database.connection import db_pool
from src.infrastructure.database.models import AuditEventModel

class ArchiveService:
    def __init__(self, retention_days: int = 7, interval_hours: int = 24):
        self.retention_days = retention_days
        self.interval_hours = interval_hours
        self._task = None

    async def start(self):
        log.info(f"ArchiveService started (Retention: {self.retention_days} days | Interval: {self.interval_hours}h)")
        self._task = asyncio.create_task(self._run_loop())

    async def stop(self):
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
            log.info("ArchiveService stopped.")

    async def _run_loop(self):
        while True:
            try:
                await self._purge_old_events()
            except asyncio.CancelledError:
                break
            except Exception as e:
                log.error(f"ArchiveService error: {e}")
            
            # Wait for next cycle
            await asyncio.sleep(self.interval_hours * 3600)

    async def _purge_old_events(self):
        cutoff_date = datetime.now() - timedelta(days=self.retention_days)
        log.info(f"ArchiveService: Purging audit_events older than {cutoff_date.strftime('%Y-%m-%d')}")
        
        stmt = delete(AuditEventModel).where(
            AuditEventModel.timestamp < cutoff_date,
            AuditEventModel.type != 'TRADE'
        )
        
        deleted_count = await db_pool.execute(stmt)
        if deleted_count > 0:
            log.success(f"ArchiveService: Purged {deleted_count} stale audit events to preserve performance.")
        else:
            log.debug("ArchiveService: No stale events found to purge.")

archive_service = ArchiveService()
