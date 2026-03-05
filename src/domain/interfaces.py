from abc import ABC, abstractmethod
from typing import List, Optional, Any
from datetime import datetime
from .models import Order, Trade, AccountInfo

# --- Event Bus ---
class IEventBus(ABC):
    @abstractmethod
    async def publish(self, event: Any):
        pass

    @abstractmethod
    def subscribe(self, event_type: str, handler):
        pass

# --- Persistence ---
class IPersistence(ABC):
    @abstractmethod
    async def save_event(self, event: Any):
        pass
    
    @abstractmethod
    async def get_active_trades(self) -> List[Trade]:
        pass
    
    @abstractmethod
    async def upsert_trade(self, trade: Trade):
        pass

# --- Execution (MT5) ---
class IExecutionProvider(ABC):
    @abstractmethod
    async def connect(self) -> bool:
        pass
    
    @abstractmethod
    async def disconnect(self):
        pass
        
    @abstractmethod
    async def get_account_info(self) -> AccountInfo:
        pass
        
    @abstractmethod
    async def get_positions(self) -> List[Trade]:
        pass
    
    @abstractmethod
    async def execute_order(self, order: Order) -> int:
        pass
        
    @abstractmethod
    async def close_position(self, ticket: int, volume: Optional[float] = None) -> bool:
        pass
    
    @abstractmethod
    async def get_server_time(self) -> datetime:
        pass

# --- Notification ---
class INotificationProvider(ABC):
    @abstractmethod
    async def send(self, title: str, message: str, priority: str = "default") -> bool:
        pass
