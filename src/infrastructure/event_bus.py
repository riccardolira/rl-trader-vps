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

        # 1. Notify specific subscribers
        if event_type in self._subscribers:
            for handler in self._subscribers[event_type]:
                try:
                    await handler(event)
                except Exception as e:
                    log.error(f"Error handling event {event_type}: {e}")

        # 2. Notify global subscribers (Audit Log)
        for handler in self._global_subscribers:
            try:
                await handler(event)
            except Exception as e:
                log.error(f"Error in global handler for {event_type}: {e}")

# Global instance
event_bus = EventBus()
