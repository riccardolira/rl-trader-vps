import asyncio
from datetime import datetime
from src.infrastructure.mt5_adapter import mt5_adapter
from src.infrastructure.config import settings
from src.infrastructure.event_bus import event_bus
from src.domain.events import TimeSkewDetected
from src.infrastructure.logger import log
from src.services.notification.notification_service import notification_service

class TimeSkewGuard:
    def __init__(self):
        self.max_skew_sec = getattr(settings, "TIME_SKEW_MAX_SEC", 30)
        self.running = False
        self.last_skew = 0.0
        self.status = "OK" # OK, ALERT

    async def start(self):
        self.running = True
        asyncio.create_task(self._loop())
        log.info("TimeSkewGuard Started.")

    async def _loop(self):
        while self.running:
            try:
                server_time = await mt5_adapter.get_server_time()
                local_time = datetime.utcnow()
                
                # If offline, skip check
                if not server_time:
                    await asyncio.sleep(10)
                    continue

                diff = (server_time - local_time).total_seconds()
                self.last_skew = diff

                if abs(diff) > self.max_skew_sec:
                    if self.status == "OK":
                        self.status = "ALERT"
                        msg = f"Time Skew Detected! Server: {server_time}, Local: {local_time}, Diff: {diff:.2f}s"
                        log.critical(msg)
                        
                        event = TimeSkewDetected(server_time=str(server_time), local_time=str(local_time), diff_seconds=diff, component="TimeSkewGuard")
                        await event_bus.publish(event)
                        await notification_service.send_alert("CRITICAL: TIME SKEW", msg, severity="CRITICAL")
                else:
                    if self.status == "ALERT":
                        self.status = "OK"
                        log.info("Time Skew Recovered.")

            except Exception as e:
                log.error(f"TimeSkewGuard Error: {e}")

            await asyncio.sleep(10) # Check every 10s

time_skew_guard = TimeSkewGuard()
