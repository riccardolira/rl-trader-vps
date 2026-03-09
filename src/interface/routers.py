from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from typing import List, Dict, Any, Optional
from datetime import datetime
import asyncio
from collections import deque
from src.infrastructure.event_bus import event_bus
from src.infrastructure.event_store import event_store
from src.infrastructure.config import settings
from src.infrastructure.logger import log
from src.infra.mt5.mt5_worker_client import mt5_worker_client
from dotenv import set_key
import os

router = APIRouter()

# --- Connection Manager for WebSockets ---
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def broadcast(self, message: str):
        for connection in self.active_connections:
            try:
                await connection.send_text(message)
            except:
                pass

manager = ConnectionManager()

# --- REST Endpoints ---

@router.get("/health")
async def health_check():
    return {"status": "ok", "project": settings.PROJECT_NAME, "env": settings.ENV}

@router.get("/api/state")
async def get_state():
    """Returns aggregated system state."""
    from src.application.services.strategy_engine import strategy_engine
    from src.application.services.arbiter_service import arbiter_service
    from src.services.execution.execution_service import execution_service
    from src.services.health.guardian_service import guardian_service
    
    return {
        "engine": "RUNNING",
        "mt5": "CONNECTED", # Health check does this better, keeping for legacy
        "strategy_engine": strategy_engine.get_state(),
        "arbiter": arbiter_service.get_state(),
        "execution": execution_service.get_state(),
        "guardian": guardian_service.get_state()
    }

@router.get("/api/logs")
async def get_logs(limit: int = 100):
    # This would read from the DB or Log file
    return {"logs": []}

@router.get("/api/analytics/dashboard")
async def get_analytics_dashboard(start_dt: Optional[datetime] = None, end_dt: Optional[datetime] = None):
    """Returns historical metrics and ledger for the Analytics UI."""
    from src.services.stats.stats_service import stats_service
    return await stats_service.get_dashboard_data(start_dt=start_dt, end_dt=end_dt)

@router.get("/api/analytics/insights")
async def get_analytics_insights(start_dt: Optional[datetime] = None, end_dt: Optional[datetime] = None):
    """Returns AI generated insights about the trading history."""
    from src.services.stats.recommendation_engine import recommendation_engine
    from src.services.stats.stats_service import stats_service
    
    # Fetch current metrics to feed the engine
    dashboard_data = await stats_service.get_dashboard_data(start_dt=start_dt, end_dt=end_dt)
    metrics = dashboard_data.get("metrics", {})
    
    return recommendation_engine.generate_insights(metrics)

@router.get("/api/analytics/transparency")
async def get_analytics_transparency():
    """Returns funnel, rejection reasons, and live feed from the event store."""
    from src.services.stats.stats_service import stats_service
    return await stats_service.get_transparency_metrics()

@router.get("/api/trades/active")
async def get_active_trades():
    trades = await event_store.get_active_trades()
    return {"count": len(trades), "trades": [t.dict() for t in trades]}

@router.get("/api/trades/history")
async def get_trades_history(limit: int = 100):
    trades = await event_store.get_closed_trades(limit=limit)
    if not trades:
        return {"count": 0, "total_pnl": 0.0, "win_rate": 0.0, "trades": []}
    
    total_pnl = sum([t.profit for t in trades if t.profit is not None])
    wins = len([t for t in trades if t.profit and t.profit > 0])
    win_rate = (wins / len(trades)) * 100.0 if len(trades) > 0 else 0.0
    
    return {
        "count": len(trades), 
        "total_pnl": round(total_pnl, 2), 
        "win_rate": round(win_rate, 2), 
        "trades": [t.dict() for t in trades]
    }

@router.delete("/api/trades/history/{ticket}")
async def delete_history_trade(ticket: int):
    """Deletes a closed trade from the local ledger (Event Store)."""
    success = await event_store.delete_closed_trade(ticket)
    if success:
        from src.infrastructure.logger import log
        log.warning(f"Trade #{ticket} was manually deleted from History Ledger.")
        return {"status": "success", "message": f"Trade {ticket} deleted."}
    return {"status": "error", "message": "Trade not found or could not be deleted."}



@router.post("/api/trades/{ticket}/close")
async def close_trade_manual(ticket: int):
    from src.infrastructure.mt5_adapter import mt5_adapter
    success = await mt5_adapter.close_position(ticket)
    if success:
        return {"status": "ok", "message": f"Position {ticket} close requested."}
    else:
        return {"status": "error", "message": f"Failed to close position {ticket} or it is already closed."}

@router.get("/api/account")
async def get_account_info():
    """Returns the current MT5 account performance."""
    from src.infrastructure.mt5_adapter import mt5_adapter
    info = await mt5_adapter.get_account_info()
    if info:
        return info.dict()
    return {"error": "Account info not available"}

# --- Admin / Config Endpoints ---

from src.interface.schemas.admin import MT5ConfigUpdate, MT5ConfigResponse

@router.get("/api/config/mt5", response_model=MT5ConfigResponse)
async def get_mt5_config():
    """Returns the current active MT5 configuration (without password)."""
    return {
        "login": settings.MT5_LOGIN,
        "server": settings.MT5_SERVER
    }

@router.post("/api/config/mt5")
async def update_mt5_config(config: MT5ConfigUpdate):
    """Updates the MT5 credentials in .env, memory and restarts the worker."""
    env_path = os.path.join(settings.BASE_DIR, ".env")
    
    updated = False
    if config.login is not None:
        set_key(env_path, "MT5_LOGIN", str(config.login))
        settings.MT5_LOGIN = config.login
        updated = True
        
    if config.password is not None and config.password.strip() != "":
        set_key(env_path, "MT5_PASSWORD", config.password)
        settings.MT5_PASSWORD = config.password
        updated = True
        
    if config.server is not None:
        set_key(env_path, "MT5_SERVER", config.server)
        settings.MT5_SERVER = config.server
        updated = True
        
    if updated:
        log.warning(f"MT5 Configuration updated via API. Restarting Worker... (Login: {settings.MT5_LOGIN})")
        # Trigger worker restart asynchronously or in a thread if needed
        # We can just call it, it will stop and start the process
        mt5_worker_client.restart()
        return {"status": "success", "message": "Credentials updated and MT5 Worker restarting."}
    
    return {"status": "ignored", "message": "No changes provided."}

# --- Engine Control Endpoints ---

@router.post("/api/engine/start")
async def start_engine():
    from src.application.services.strategy_engine import strategy_engine
    await strategy_engine.start()
    return {"status": "running", "message": "Strategy Engine started."}

@router.post("/api/engine/stop")
async def stop_engine():
    from src.application.services.strategy_engine import strategy_engine
    await strategy_engine.stop()
    return {"status": "stopped", "message": "Strategy Engine stopped."}

# --- Risk Endpoints ---

@router.get("/api/risk/config")
async def get_risk_config():
    from src.application.services.guardian_service import guardian_service
    return guardian_service.config.dict()

@router.post("/api/risk/config")
async def update_risk_config(updates: dict):
    from src.application.services.guardian_service import guardian_service
    guardian_service.update_config(updates)
    return {"status": "ok", "config": guardian_service.config.dict()}

# --- Recent Events Cache (In-Memory) ---
recent_signals = deque(maxlen=50)
recent_drafts = deque(maxlen=50)

@router.get("/api/events/recent")
async def get_recent_events():
    """Returns the most recent 50 signals and drafts from memory for UI continuity."""
    return {
        "signals": list(recent_signals),
        "drafts": list(recent_drafts)
    }

# --- WebSocket ---

@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            # Keep alive / simplified Echo or Command handling
            data = await websocket.receive_text()
            # await manager.broadcast(f"Received: {data}")
    except WebSocketDisconnect:
        manager.disconnect(websocket)

# --- Event Bus Hook ---
# We want to broadcast events to WS clients
import json

def datetime_handler(x):
    if hasattr(x, 'isoformat'):
        return x.isoformat()
    elif hasattr(x, 'value'): # Handle enums like Severity
        return x.value
    raise TypeError(f"Object of type {type(x)} is not JSON serializable")

async def broadcast_event_to_ws(event):
    try:
        if hasattr(event, "model_dump_json"):
            msg = event.model_dump_json()
        elif hasattr(event, "json") and callable(event.json):
            msg = event.json()
        elif hasattr(event, "dict") and callable(event.dict):
            # Fallback for old pydantic or custom dict
            msg = json.dumps(event.dict(), default=datetime_handler)
        else:
            msg = json.dumps(event.__dict__, default=datetime_handler)
            
        # Cache for UI polling
        parsed_payload = getattr(event, "payload", {})
        if getattr(event, "type", "") == "SIGNAL_GENERATED":
             recent_signals.appendleft({**parsed_payload, "recv_time": getattr(event, "timestamp", "")})
        elif getattr(event, "type", "") == "ORDER_DRAFTED":
             recent_drafts.appendleft({**parsed_payload, "recv_time": getattr(event, "timestamp", "")})
             
        await manager.broadcast(msg)
    except Exception as e:
        log.error(f"WS Broadcast error: {e}")

# Subscribe WS broadcaster to EventBus
event_bus.subscribe("*", broadcast_event_to_ws)
