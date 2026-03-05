import shutil
import asyncio
from typing import Tuple
from src.infrastructure.config import settings
from src.infrastructure.logger import log
from src.infrastructure.event_bus import event_bus
from src.domain.events import DiskLow
from src.services.notification.notification_service import notification_service

class DiskGuard:
    def __init__(self):
        self.min_free_gb = getattr(settings, "DISK_MIN_FREE_GB", 1.0)
        self.running = False
        self.last_free_gb = 0.0

    async def start(self):
        self.running = True
        asyncio.create_task(self._loop())
        log.info("DiskGuard Started.")

    async def _loop(self):
        while self.running:
            await self.check()
            await asyncio.sleep(60) # Check every minute

    async def check(self):
        path = getattr(settings, "BASE_DIR", ".")
        try:
            total, used, free = shutil.disk_usage(path)
            free_gb = free / (1024 ** 3)
            self.last_free_gb = free_gb
            
            if free_gb < self.min_free_gb:
                msg = f"LOW DISK SPACE: {free_gb:.2f} GB free (Threshold: {self.min_free_gb} GB)"
                log.critical(msg)
                
                event = DiskLow(free_gb=free_gb, path=path, component="DiskGuard")
                await event_bus.publish(event)
                await notification_service.send_alert("CRITICAL: DISK LOW", msg, severity="CRITICAL")
                return False
            
            return True
            
        except Exception as e:
            log.error(f"Disk check failed: {e}")
            return True

disk_guard = DiskGuard()
