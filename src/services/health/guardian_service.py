import asyncio
import psutil
import time
import subprocess
import os
import urllib.request
from typing import Dict, Any

from src.infrastructure.logger import log
from src.infrastructure.config import settings
from src.infrastructure.event_bus import event_bus

class GuardianService:
    """
    Subsystem: Health Guardian
    Responsibility: Monitor MT5 terminal process, check external network, and perform hard self-healing.
    """
    def __init__(self):
        self.internet_ok = True
        self.mt5_process_id = None
        self.is_monitoring = False
        self.last_ping_time = 0
        self.hard_restarts_count = 0
        
        self.mt5_exe_name = "terminal64.exe"
        self.mt5_path = settings.MT5_PATH

    async def start(self):
        if self.is_monitoring:
            return
        self.is_monitoring = True
        log.info("GuardianService: Starting Watchdog...")
        asyncio.create_task(self._monitor_loop())

    async def _monitor_loop(self):
        while self.is_monitoring:
            try:
                # 1. Check Internet (Ping 8.8.8.8 or 1.1.1.1)
                self.internet_ok = await self._check_internet()
                
                # 2. Check Process Health
                mt5_running = self._is_mt5_running()
                
                if not mt5_running and self.internet_ok:
                    # If it's dead but should be alive, we don't restart it implicitly here,
                    # because MT5WorkerClient orchestrates the "soft" start. 
                    # Guardian is mostly for "Hard" kills.
                    pass
                    
            except Exception as e:
                log.error(f"GuardianService monitor error: {e}")
                
            await asyncio.sleep(10) # Run every 10 seconds

    async def _check_internet(self) -> bool:
        """Ping a highly available external service to know if the VPS/Local internet is down."""
        loop = asyncio.get_event_loop()
        def _ping():
            try:
                # Use urllib to hit a highly available 204/small endpoint
                urllib.request.urlopen('http://captive.apple.com/hotspot-detect.html', timeout=3)
                return True
            except:
                return False
                
        is_online = await loop.run_in_executor(None, _ping)
        
        if not is_online and self.internet_ok:
            log.warning("GuardianService: EXTERNAL NETWORK DOWN! Shield Active.")
            from src.domain.events import BaseEvent, Severity
            await event_bus.publish(BaseEvent(type="GUARDIAN_NETWORK_DOWN", component="GuardianService", severity=Severity.CRITICAL))
        elif is_online and not self.internet_ok:
            log.success("GuardianService: EXTERNAL NETWORK RESTORED.")
            from src.domain.events import BaseEvent, Severity
            await event_bus.publish(BaseEvent(type="GUARDIAN_NETWORK_UP", component="GuardianService", severity=Severity.INFO))
            
        return is_online

    def _is_mt5_running(self) -> bool:
        for proc in psutil.process_iter(['pid', 'name']):
            if proc.info['name'] == self.mt5_exe_name:
                self.mt5_process_id = proc.info['pid']
                return True
        self.mt5_process_id = None
        return False

    def hard_reset_mt5(self):
        """
        Forcefully kills terminal64.exe using Windows TaskKill or psutil,
        then it sleeps to let resources free up.
        The MT5WorkerClient will naturally attempt a soft restart on its next cycle.
        """
        if not self.internet_ok:
            log.warning("GuardianService: Cannot Hard Reset MT5 - Network is DOWN. Waiting for network restoration.")
            return False

        log.critical("GuardianService: Initiating HARD RESET of MT5 Terminal...")
        self.hard_restarts_count += 1
        
        # Kill all instances
        killed_any = False
        for proc in psutil.process_iter(['pid', 'name']):
            if proc.info['name'] == self.mt5_exe_name:
                try:
                    log.warning(f"GuardianService: Killing {proc.info['name']} (PID: {proc.info['pid']})")
                    proc.kill()
                    killed_any = True
                except Exception as e:
                    log.error(f"GuardianService: Failed to kill process: {e}")
                    
        if killed_any:
            log.info("GuardianService: Terminal killed. Cooling down resources for 5 seconds...")
            time.sleep(5)
            
        # The actual reopen logic is handled by mt5_worker_client calling mt5.initialize(path=...)
        # We just clear the dead zombies from the OS.
        log.success("GuardianService: Hard Reset cleanup complete.")
        return True

    def get_state(self) -> Dict[str, Any]:
        return {
            "internet_ok": self.internet_ok,
            "mt5_running": self._is_mt5_running(),
            "hard_restarts": self.hard_restarts_count
        }

guardian_service = GuardianService()
