from fastapi import APIRouter
from src.infrastructure.config import settings
from src.services.health.time_skew_guard import time_skew_guard
from src.services.health.disk_guard import disk_guard
from src.services.notification.notification_service import notification_service
from src.infrastructure.mt5_adapter import mt5_adapter
import asyncio
from datetime import datetime

router = APIRouter()

@router.get("/health")
async def health_check():
    """
    Comprehensive Health Check for Watchdog/Monitoring.
    """
    # 1. MT5 Status
    mt5_ok = False
    try:
        # Simple ping or check global connection status
        # Since adapter is async but library sync, we assume connection state or check ping
        # For now, just check if we can get account info or time
        time = await mt5_adapter.get_server_time()
        mt5_ok = True if time else False
    except:
        mt5_ok = False

    # 2. Disk
    disk_ok = disk_guard.last_free_gb >= getattr(settings, "DISK_MIN_FREE_GB", 1.0)
    
    # 3. Time Skew
    skew_status = time_skew_guard.status
    
    return {
        "status": "ok" if (mt5_ok and disk_ok and skew_status == "OK") else "warning",
        "timestamp_utc": datetime.utcnow(),
        "components": {
            "mt5": {"status": "connected" if mt5_ok else "disconnected"},
            "disk": {
                "status": "ok" if disk_ok else "critical", 
                "free_gb": float(f"{disk_guard.last_free_gb:.2f}")
            },
            "time_guard": {
                "status": skew_status,
                "last_skew_sec": float(f"{time_skew_guard.last_skew:.4f}")
            },
            "notifications": {
                "enabled": getattr(settings, "NOTIFICATIONS_ENABLED", True),
                "provider": "ntfy"
            }
        },
        "version": "0.4.0-hardened"
    }
