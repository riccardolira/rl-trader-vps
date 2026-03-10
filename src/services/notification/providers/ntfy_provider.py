import httpx
from datetime import datetime
from src.domain.interfaces import INotificationProvider
from src.infrastructure.config import settings
from src.infrastructure.logger import log

class NtfyProvider(INotificationProvider):
    def __init__(self):
        self.base_url = getattr(settings, "NTFY_BASE_URL", "https://ntfy.sh")
        self.topic = getattr(settings, "NTFY_TOPIC", "rl_trader_v3_alerts")
        self.enabled = getattr(settings, "NOTIFICATIONS_ENABLED", True)

    async def send(self, title: str, message: str, priority: str = "default") -> bool:
        if not self.enabled:
            return True

        # Map priority to Ntfy levels (1-5)
        # Default/Info=3, Critical=5, Error=4, Warning=3
        prio_map = {
            "d": 1, "debug": 1,
            "i": 3, "info": 3,
            "w": 3, "warn": 3, "warning": 3,
            "e": 4, "error": 4,
            "c": 5, "critical": 5
        }
        prio_val = prio_map.get(str(priority).lower(), 3)
        
        url = f"{self.base_url}/{self.topic}"
        
        headers = {
            "Title": title,
            "Priority": str(prio_val),
            "Tags": "warning" if prio_val >= 4 else "information_source"
        }
        
        # Add timestamp to body
        ts = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC")
        full_body = f"{message}\n\nTime: {ts}"
        
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.post(url, data=full_body, headers=headers)
                if resp.status_code == 200:
                    log.debug(f"Ntfy sent: {title}")
                    return True
                elif resp.status_code == 429:
                    log.debug(f"Ntfy rate limited (429): Quota reached. Muted to prevent spam.")
                    return False
                else:
                    log.error(f"Ntfy failed ({resp.status_code}): {resp.text}")
                    return False
        except Exception as e:
            # Must not crash the bot
            log.debug(f"Ntfy connection error: {type(e).__name__} {e}")
            return False

# Export instance
ntfy_provider = NtfyProvider()
