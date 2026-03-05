import asyncio
import time
from typing import List
from src.infrastructure.logger import log
from src.services.notification.notification_service import notification_service
from src.infra.mt5.mt5_worker_client import mt5_worker_client
from src.infrastructure.event_bus import event_bus
from src.domain.events import BrokerStallDetected

class MT5HealthGuard:
    def __init__(self):
        self.running = False
        self.check_interval = 10
        
        # Circuit Breaker Config
        self.max_restarts = 5
        self.window_seconds = 300 # 5 minutes
        self.restarts: List[float] = [] # Timestamps
        self.circuit_open = False

    async def start(self):
        self.running = True
        log.info("MT5HealthGuard Started.")
        asyncio.create_task(self._loop())

    async def _loop(self):
        while self.running:
            try:
                # 1. Check Process Liveness
                if not mt5_worker_client.is_healthy:
                    await self._handle_unhealthy()

                # 2. Sync restart count
                current_count = mt5_worker_client.restart_count
                if len(self.restarts) < current_count:
                    # New restarts detected
                    diff = current_count - len(self.restarts)
                    now = time.time()
                    for _ in range(diff):
                        self.restarts.append(now)
                    
                    await self._check_circuit_breaker()

            except Exception as e:
                log.error(f"MT5Guard Error: {e}")
            
            await asyncio.sleep(self.check_interval)

    async def _handle_unhealthy(self):
        if self.circuit_open:
            log.critical("MT5Guard: Circuit OPEN. Skipping restart.")
            return

        log.warning("MT5HealthGuard: Worker marked unhealthy. Attempting recovery...")
        mt5_worker_client.restart()
        await self._alert_restart()

    async def _check_circuit_breaker(self):
        now = time.time()
        # Keep only timestamps within window
        self.restarts = [t for t in self.restarts if t > now - self.window_seconds]
        
        if len(self.restarts) >= self.max_restarts:
            if not self.circuit_open:
                self.circuit_open = True
                msg = f"MT5 CIRCUIT BREAKER TRIPPED! {len(self.restarts)} restarts in {self.window_seconds}s."
                log.critical(msg)
                
                # Disable Trading Global Flag (Hypothetical)
                # settings.TRADING_ENABLED = False 
                
                await notification_service.send_alert("CRITICAL: MT5 BREAKER", msg, "CRITICAL")
                await event_bus.publish(BrokerStallDetected(reason="Too many restarts"))

    async def _alert_restart(self):
        await notification_service.send_alert(
            "MT5 WORKER RESTART",
            "The isolated MT5 process was restarted due to health check failure.",
            "WARNING"
        )

mt5_health_guard = MT5HealthGuard()
