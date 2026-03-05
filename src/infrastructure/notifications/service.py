from src.infrastructure.event_bus import event_bus
from src.infrastructure.notifications.ntfy_provider import ntfy_provider
from src.infrastructure.config import settings
from src.infrastructure.logger import log
from src.domain.events import BaseEvent, Severity

class NotificationService:
    def __init__(self):
        self.provider = ntfy_provider
        self.min_severity_level = self._parse_severity(settings.NOTIFY_MIN_SEVERITY)

    async def start(self):
        if not settings.NOTIFICATIONS_ENABLED:
            log.info("Notifications disabled in config.")
            return

        # Subscribe globally to all events
        event_bus.subscribe("*", self._handle_event)
        log.info(f"NotificationService started. Min Severity: {settings.NOTIFY_MIN_SEVERITY}")

    async def _handle_event(self, event: BaseEvent):
        # Ignore high frequency / massive payload telemetry events
        ignored_events = {
            "UNIVERSE_SNAPSHOT", 
            "UNIVERSE_SCANNER_PROGRESS", 
            "UNIVERSE_RANKING_COMPUTED",
            "NOTIFICATION_SENT",
            "STATE_RECONCILED",
            "POSITION_ADOPTED"
        }
        if event.type in ignored_events:
            return

        # Check severity
        event_severity_level = self._parse_severity(event.severity)
        
        if event_severity_level >= self.min_severity_level:
            title = f"[{event.severity}] {event.type}"
            message = f"Component: {event.component}\nPayload: {event.payload}"
            
            await self.provider.send(title, message, priority=event.severity)

    def _parse_severity(self, severity_str: str) -> int:
        mapping = {
            "DEBUG": 1,
            "INFO": 2,
            "WARNING": 3,
            "ERROR": 4,
            "CRITICAL": 5
        }
        # Handle Enum or String
        s = str(severity_str).split(".")[-1] # Handle Severity.ERROR
        return mapping.get(s, 2)

notification_service = NotificationService()
