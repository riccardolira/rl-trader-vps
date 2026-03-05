from typing import List
from src.domain.interfaces import INotificationProvider
from src.services.notification.providers.ntfy_provider import ntfy_provider
from src.infrastructure.event_bus import event_bus
from src.infrastructure.logger import log

class NotificationService:
    def __init__(self):
        self.providers: List[INotificationProvider] = [ntfy_provider]
        self.min_severity = "INFO" # Configurable?

    async def start(self):
        """Subscribe to system events."""
        event_bus.subscribe("*", self._handle_event)
        log.info("Notification Service Started.")

    async def send_alert(self, title: str, message: str, severity: str = "INFO"):
        """Direct send method for guards/heartbeats."""
        for p in self.providers:
             await p.send(title, message, priority=severity)

    async def _handle_event(self, event):
        # Filter logic
        sev_val = self._severity_value(event.severity)
        min_val = self._severity_value(self.min_severity)
        
        if sev_val >= min_val:
            title = f"[{event.severity}] {event.type}"
            body = f"Component: {event.component}\nPayload: {event.payload}"
            await self.send_alert(title, body, severity=event.severity)

    def _severity_value(self, severity: str) -> int:
        mapping = {"DEBUG": 1, "INFO": 2, "WARNING": 3, "ERROR": 4, "CRITICAL": 5}
        return mapping.get(str(severity).upper().split(".")[-1], 2)

notification_service = NotificationService()
