import asyncio
import time
import json
from pathlib import Path
from src.infrastructure.config import settings
from src.infrastructure.logger import log

class HeartbeatService:
    def __init__(self):
        self.running = False
        self.interval = getattr(settings, "HEARTBEAT_INTERVAL_SEC", 5)
        self.file_path = Path("heartbeat.json")

    async def start(self):
        self.running = True
        asyncio.create_task(self._loop())
        log.info("Heartbeat Service Started.")

    async def _loop(self):
        while self.running:
            try:
                data = {
                    "timestamp": time.time(),
                    "status": "RUNNING",
                    "pid": 0 # os.getpid() usually
                }
                with open(self.file_path, "w") as f:
                    json.dump(data, f)
            except Exception as e:
                log.warning(f"Failed to write heartbeat: {e}")
            
            await asyncio.sleep(self.interval)

heartbeat_service = HeartbeatService()
