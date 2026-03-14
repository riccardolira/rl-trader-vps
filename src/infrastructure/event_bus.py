import asyncio
from typing import Dict, List, Callable, Any, Awaitable
from src.domain.interfaces import IEventBus
from src.infrastructure.logger import log

class EventBus(IEventBus):
    def __init__(self):
        self._subscribers: Dict[str, List[Callable[[Any], Awaitable[None]]]] = {}
        # Global subscribers listen to everything (like EventStore)
        self._global_subscribers: List[Callable[[Any], Awaitable[None]]] = []

    def subscribe(self, event_type: str, handler: Callable[[Any], Awaitable[None]]):
        """Subscribe a handler to a specific event type."""
        if event_type == "*":
            self._global_subscribers.append(handler)
            log.debug(f"Subscribed global handler: {handler.__name__}")
        else:
            if event_type not in self._subscribers:
                self._subscribers[event_type] = []
            self._subscribers[event_type].append(handler)
            log.debug(f"Subscribed {handler.__name__} to {event_type}")

    async def publish(self, event: Any):
        """Publish an event to all subscribers."""
        event_type = getattr(event, "type", None)
        if not event_type:
            log.warning(f"EventBus received event without type: {event}")
            return

        # 1. Notify specific subscribers — em paralelo para não bloquear WS
        if event_type in self._subscribers:
            for handler in self._subscribers[event_type]:
                asyncio.create_task(self._safe_call(handler, event, event_type))

        # 2. Notify global subscribers (Audit Log + WS) — também em paralelo
        for handler in self._global_subscribers:
            asyncio.create_task(self._safe_call(handler, event, event_type))

    async def _safe_call(self, handler: Callable, event: Any, event_type: str):
        """Chama um handler com tratamento de exceção isolado."""
        try:
            await handler(event)
        except Exception as e:
            log.error(f"EventBus handler error [{event_type}] {getattr(handler, '__name__', handler)}: {e}")

# Global instance
event_bus = EventBus()
