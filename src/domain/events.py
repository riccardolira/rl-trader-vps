from datetime import datetime
from typing import Optional, Dict, Any, List
from pydantic import BaseModel, Field
from .models import Signal, DraftOrder, Order, Trade, AccountInfo, Severity

class BaseEvent(BaseModel):
    """Base class for all system events."""
    event_id: str = Field(default_factory=lambda: "evt_" + str(datetime.utcnow().timestamp()))
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    type: str
    component: str
    severity: Severity = Severity.INFO
    correlation_id: Optional[str] = None
    payload: Dict[str, Any] = {}

# --- Business Events ---

class SignalGenerated(BaseEvent):
    type: str = "SIGNAL_GENERATED"
    severity: Severity = Severity.INFO
    def __init__(self, signal: Signal, **data):
        if "component" not in data:
            data["component"] = "StrategyEngine"
        super().__init__(payload=signal.dict(), correlation_id=signal.id, **data)

class OrderDrafted(BaseEvent):
    type: str = "ORDER_DRAFTED"
    severity: Severity = Severity.INFO
    def __init__(self, draft: DraftOrder, **data):
        if "component" not in data:
            data["component"] = "ArbiterService"
        super().__init__(payload=draft.dict(), correlation_id=draft.intent_id, **data)

class OrderApproved(BaseEvent):
    type: str = "ORDER_APPROVED"
    severity: Severity = Severity.INFO
    def __init__(self, order: Order, **data):
        if "component" not in data:
            data["component"] = "GuardianService"
        super().__init__(payload=order.dict(), correlation_id=order.intent_id, **data)

class OrderRejected(BaseEvent):
    type: str = "ORDER_REJECTED"
    severity: Severity = Severity.WARNING
    def __init__(self, reason: str, draft: DraftOrder, gate: str, **data):
        payload = {"reason": reason, "gate": gate, "draft": draft.dict()}
        if "component" not in data:
            data["component"] = "GuardianService"
        super().__init__(payload=payload, correlation_id=draft.intent_id, **data)

class OrderFilled(BaseEvent):
    type: str = "ORDER_FILLED"
    severity: Severity = Severity.INFO
    def __init__(self, order: Order, ticket: int, price: float, **data):
        payload = {"order_id": order.id, "ticket": ticket, "price": price, "symbol": order.symbol}
        if "component" not in data:
            data["component"] = "ExecutionService"
        super().__init__(payload=payload, correlation_id=order.intent_id, **data)

class OrderFailed(BaseEvent):
    type: str = "ORDER_FAILED"
    severity: Severity = Severity.ERROR
    def __init__(self, order: Order, reason: str, **data):
        payload = {"order_id": order.id, "symbol": order.symbol, "reason": reason}
        if "component" not in data:
            data["component"] = "ExecutionService"
        super().__init__(payload=payload, correlation_id=order.intent_id, **data)

class PositionClosed(BaseEvent):
    type: str = "POSITION_CLOSED"
    severity: Severity = Severity.INFO
    def __init__(self, trade: Trade, reason: str, pnl: float, **data):
        payload = {"ticket": trade.ticket, "symbol": trade.symbol, "pnl": pnl, "reason": reason}
        if "component" not in data:
            data["component"] = "ExecutionService"
        super().__init__(payload=payload, correlation_id=str(trade.ticket), **data)

class LiveAccountUpdate(BaseEvent):
    type: str = "LIVE_ACCOUNT_UPDATE"
    severity: Severity = Severity.INFO
    def __init__(self, equity: float, balance: float, profit: float, margin: float, **data):
        payload = {"equity": equity, "balance": balance, "profit": profit, "margin": margin}
        if "component" not in data:
            data["component"] = "Telemetry"
        super().__init__(payload=payload, **data)

class LivePositionUpdate(BaseEvent):
    type: str = "LIVE_POSITION_UPDATE"
    severity: Severity = Severity.INFO
    def __init__(self, trades: List[Dict[str, Any]], count: int, **data):
        payload = {"count": count, "trades": trades}
        if "component" not in data:
            data["component"] = "Telemetry"
        super().__init__(payload=payload, **data)

# --- Resilience & System Events ---

class PositionAdopted(BaseEvent):
    type: str = "POSITION_ADOPTED"
    severity: Severity = Severity.WARNING
    def __init__(self, trade: Trade, **data):
        if "component" not in data:
            data["component"] = "ExecutionService"
        super().__init__(payload=trade.dict(), correlation_id=str(trade.ticket), **data)

class PositionDesyncClosed(BaseEvent):
    type: str = "POSITION_DESYNC_CLOSED"
    severity: Severity = Severity.WARNING
    def __init__(self, ticket: int, symbol: str, **data):
        if "component" not in data:
            data["component"] = "ExecutionService"
        super().__init__(payload={"ticket": ticket, "symbol": symbol, "reason": "MT5_SYNC_MISSING"}, correlation_id=str(ticket), **data)

class StateReconciled(BaseEvent):
    type: str = "STATE_RECONCILED"
    severity: Severity = Severity.INFO
    
    def __init__(self, stats: Dict[str, Any], **data):
        if "component" not in data:
            data["component"] = "Reconciler"
        super().__init__(payload=stats, **data)

class BrokerStallDetected(BaseEvent):
    type: str = "BROKER_STALL_DETECTED"
    severity: Severity = Severity.CRITICAL
    def __init__(self, symbol: str, lag_seconds: float, **data):
        super().__init__(payload={"symbol": symbol, "lag_seconds": lag_seconds}, **data)

class TimeSkewDetected(BaseEvent):
    type: str = "TIME_SKEW_DETECTED"
    severity: Severity = Severity.CRITICAL
    def __init__(self, server_time: str, local_time: str, diff_seconds: float, **data):
        super().__init__(payload={"server": server_time, "local": local_time, "diff_seconds": diff_seconds}, **data)

class DiskLow(BaseEvent):
    type: str = "DISK_LOW"
    severity: Severity = Severity.CRITICAL
    def __init__(self, free_gb: float, path: str, **data):
        super().__init__(payload={"free_gb": free_gb, "path": path}, **data)

class EngineShutdown(BaseEvent):
    type: str = "ENGINE_SHUTDOWN"
    severity: Severity = Severity.WARNING
    def __init__(self, reason: str, **data):
        super().__init__(payload={"reason": reason}, **data)

class MigrationApplied(BaseEvent):
    type: str = "MIGRATION_APPLIED"
    severity: Severity = Severity.INFO
    def __init__(self, version: int, script: str, success: bool, **data):
        super().__init__(payload={"version": version, "script": script, "success": success}, **data)

class NotificationSent(BaseEvent):
    type: str = "NOTIFICATION_SENT"
    severity: Severity = Severity.INFO
    def __init__(self, provider: str, topic: str, status: str, **data):
        super().__init__(payload={"provider": provider, "topic": topic, "status": status}, **data)
