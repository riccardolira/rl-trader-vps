import signal
import asyncio
from typing import Callable, Awaitable, List
from src.infrastructure.logger import log
from src.infrastructure.event_bus import event_bus
from src.domain.events import EngineShutdown

class ShutdownHandler:
    def __init__(self):
        self._shutdown_tasks: List[Callable[[], Awaitable[None]]] = []
        self._shutting_down = False

    def add_shutdown_task(self, task: Callable[[], Awaitable[None]]):
        self._shutdown_tasks.append(task)

    def setup_handlers(self):
        """Register signal handlers for SIGINT and SIGTERM."""
        loop = asyncio.get_running_loop()
        
        for sig in (signal.SIGINT, signal.SIGTERM):
            try:
                loop.add_signal_handler(sig, lambda s=sig: asyncio.create_task(self._handle_shutdown(s)))
            except NotImplementedError:
                # Windows ProactorEventLoop does not support add_signal_handler
                log.warning(f"Signal {sig.name} handler not supported on this event loop (Windows). Skipping.")
            except Exception as e:
                log.error(f"Failed to add signal handler for {sig.name}: {e}")
            
        log.info("Shutdown handlers registered (or skipped on Windows).")

    async def _handle_shutdown(self, sig):
        if self._shutting_down:
            return
        self._shutting_down = True
        
        log.warning(f"Received shutdown signal: {sig.name}")
        
        # 1. Publish Event
        await event_bus.publish(EngineShutdown(reason=f"Signal {sig.name}", component="ShutdownHandler"))
        
        # 2. Execute Tasks (Reverse order)
        for task in reversed(self._shutdown_tasks):
            try:
                await task()
            except Exception as e:
                log.error(f"Error during shutdown task: {e}")
                
        # 3. Stop Loop (if running interactively this might kill it)
        log.info("Graceful shutdown complete. Bye.")
        # asyncio.get_running_loop().stop() # Usually main.py handles the stop logic based on a flag

shutdown_handler = ShutdownHandler()
