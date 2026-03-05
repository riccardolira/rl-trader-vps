import httpx
from src.domain.interfaces import INotificationProvider
from src.infrastructure.config import settings
from src.infrastructure.logger import log

class NtfyProvider(INotificationProvider):
    def __init__(self):
        self.base_url = settings.NTFY_BASE_URL
        self.topic = settings.NTFY_TOPIC
        
    async def send(self, title: str, message: str, priority: str = "default") -> bool:
        """
        Sends a push notification via ntfy.sh
        Priority mapping:
        - DEBUG -> 1 (min)
        - INFO -> 3 (default)
        - WARNING -> 3 (default)
        - ERROR -> 4 (high)
        - CRITICAL -> 5 (urgent)
        """
        
        priority_map = {
            "DEBUG": 1,
            "INFO": 3,
            "WARNING": 3,
            "ERROR": 4,
            "CRITICAL": 5
        }
        
        headers = {
            "Title": title,
            "Priority": str(priority_map.get(priority, 3)),
            "Tags": "warning" if priority in ["ERROR", "CRITICAL"] else "information_source"
        }
        
        url = f"{self.base_url}/{self.topic}"
        
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.post(url, data=message, headers=headers)
                if resp.status_code == 200:
                    log.debug(f"Ntfy sent: {title}")
                    return True
                else:
                    log.error(f"Ntfy failed: {resp.status_code} - {resp.text}")
                    return False
        except Exception as e:
            log.error(f"Ntfy connection error: {e}")
            return False

# Global Instance
ntfy_provider = NtfyProvider()
