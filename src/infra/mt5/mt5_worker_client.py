import multiprocessing
import queue
import time
import uuid
from typing import Any, Dict, Optional
from src.infrastructure.config import settings
from src.infrastructure.logger import log
from src.infra.mt5.mt5_worker import mt5_worker_loop

class MT5WorkerClient:
    # Granular Timeouts (Seconds)
    TIMEOUTS = {
        "DEFAULT": 5.0,
        "get_history": 30.0, # Heavy data
        "order_send": 10.0,  # Network latency
        "get_positions": 5.0, 
        "get_account": 3.0,
        "get_server_time": 2.0,
        "get_calendar_events": 5.0
    }

    def __init__(self):
        self.process: Optional[multiprocessing.Process] = None
        self.cmd_queue: Optional[multiprocessing.Queue] = None
        self.res_queue: Optional[multiprocessing.Queue] = None
        self.lock = multiprocessing.Lock() # Ensure one request at a time client-side
        self.last_restart = 0.0
        self.restart_count = 0
        self.is_healthy = False

    def start(self):
        if self.process and self.process.is_alive():
            return

        log.info("MT5WorkerClient: Starting Worker Process...")
        self.cmd_queue = multiprocessing.Queue()
        self.res_queue = multiprocessing.Queue()
        
        login_config = {
            "login": settings.MT5_LOGIN,
            "password": settings.MT5_PASSWORD,
            "server": settings.MT5_SERVER,
            "path": settings.MT5_PATH
        }
        
        self.process = multiprocessing.Process(
            target=mt5_worker_loop,
            args=(self.cmd_queue, self.res_queue, login_config),
            daemon=True
        )
        self.process.start()
        self.last_restart = time.time()
        
        # Wait for Ready
        try:
            init_msg = self.res_queue.get(timeout=settings.MT5_TIMEOUT_SEC)
            if init_msg.get("type") == "READY":
                self.is_healthy = True
                log.success("MT5WorkerClient: Worker Ready.")
            else:
                log.critical(f"MT5WorkerClient: Worker Init Failed: {init_msg}")
                self.stop()
        except queue.Empty:
            log.critical(f"MT5WorkerClient: Worker Init Timeout ({settings.MT5_TIMEOUT_SEC}s). MT5 terminal is too slow to open.")
            self.stop()

    def stop(self):
        self.is_healthy = False
        if self.process:
            if self.process.is_alive():
                self.cmd_queue.put(None) # Sentinel
                self.process.join(timeout=2)
                if self.process.is_alive():
                    self.process.terminate()
            self.process = None

    def restart(self):
        log.warning("MT5WorkerClient: Restarting Worker...")
        self.stop()
        self.restart_count += 1
        time.sleep(1) # Cooldown
        self.start()

    def send_command(self, method: str, args: list = None, kwargs: dict = None, timeout: float = None, raise_on_error: bool = False) -> Any:
        # CIRCUIT BREAKER: If recently failed to restart, fast-fail to prevent 20-min lag
        if not self.process or not self.process.is_alive():
            if time.time() - self.last_restart < 60.0 and self.restart_count > 0:
                log.warning(f"MT5WorkerClient: Circuit Breaker OPEN. Fast-failing {method}.")
                
                # If we've failed twice in 1 minute, the terminal is completely zombied/crashed.
                # Call Guardian to brutally execute a TaskKill.
                if self.restart_count >= 2:
                    try:
                        from src.services.health.guardian_service import guardian_service
                        guardian_service.hard_reset_mt5()
                        # Reset the count so it doesn't loop infinitely, giving it time to breathe.
                        self.restart_count = 0 
                    except Exception as e:
                        log.error(f"Failed to invoke Guardian: {e}")
                        
                return None
            self.restart()

        # Determine timeout
        if timeout is None:
            timeout = self.TIMEOUTS.get(method, self.TIMEOUTS["DEFAULT"])

        req_id = str(uuid.uuid4())
        payload = {
            "id": req_id,
            "method": method,
            "args": args or [],
            "kwargs": kwargs or {}
        }
        
        with self.lock:
            # Purge old results?
            while not self.res_queue.empty():
                try: self.res_queue.get_nowait()
                except: pass

            self.cmd_queue.put(payload)
            
            try:
                response = self.res_queue.get(timeout=timeout)
                
                if response["id"] != req_id:
                     log.error("MT5WorkerClient: ID Mismatch in queue")
                     # Severe state, maybe restart?
                     return None
                     
                if response["status"] == "ok":
                    return response["data"]
                else:
                    err_msg = response.get('error', 'Unknown Error')
                    log.error(f"MT5Worker: Command {method} failed: {err_msg}")
                    if raise_on_error:
                         raise RuntimeError(err_msg)
                    return None
                    
            except queue.Empty:
                log.critical(f"MT5WorkerClient: TIMEOUT waiting for {method} ({timeout}s). Killing Worker.")
                self.restart()
                # Use event bus to notify? 
                if raise_on_error:
                     raise TimeoutError(f"Timeout waiting for MT5 worker on method {method}")
                # For now just return None, Caller must handle
                return None

    def measure_latency(self) -> float:
        if not self.is_healthy or not self.process or not self.process.is_alive():
            return -1.0
        start = time.perf_counter()
        res = self.send_command("ping", timeout=2.0)
        if res == "pong":
            return round((time.perf_counter() - start) * 1000.0, 2)
        return -1.0

mt5_worker_client = MT5WorkerClient()
