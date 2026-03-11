import asyncio
from typing import List, Optional
from datetime import datetime

from src.domain.interfaces import IExecutionProvider
from src.domain.models import AccountInfo, Trade, TradeStatus, Order, OrderSide, get_asset_class
from src.infrastructure.logger import log
# Import Worker Client
from src.infra.mt5.mt5_worker_client import mt5_worker_client

from src.infrastructure.config import settings

class MT5Adapter(IExecutionProvider):
    def __init__(self):
        # Local state if needed
        self.mt5_worker_client = mt5_worker_client
        self.suffix = "-T" # Adjust based on broker

    def _to_broker_symbol(self, symbol: str) -> str:
        if not symbol.endswith(self.suffix):
            return f"{symbol}{self.suffix}"
        return symbol

    def _from_broker_symbol(self, broker_symbol: str) -> str:
        if broker_symbol and broker_symbol.endswith(self.suffix):
            return broker_symbol[:-len(self.suffix)]
        return broker_symbol or ""

    async def connect(self) -> bool:
        # Start Worker in background thread/process
        try:
            mt5_worker_client.start()
            return mt5_worker_client.is_healthy
        except Exception as e:
            log.critical(f"MT5Adapter: Worker Start Failed: {e}")
            return False

    async def disconnect(self):
        mt5_worker_client.stop()

    async def get_account_info(self) -> Optional[AccountInfo]:
        info = await asyncio.to_thread(mt5_worker_client.send_command, "get_account")
        if not info:
             return None
             
        # Convert dict back to Pydantic/Dataclass
        return AccountInfo(**info)

    async def get_positions(self) -> Optional[List[Trade]]:
        raw_positions = await asyncio.to_thread(mt5_worker_client.send_command, "get_positions")
        if raw_positions is None:
            return None # Do not return [], to prevent UI from clearing trades on MT5 worker timeout

            
        result = []
        for p in raw_positions:
            # Map dict -> Trade
            # MT5 returns integers for order types: 0=BUY, 1=SELL
            side = OrderSide.BUY if p.get("type") == 0 else OrderSide.SELL
            
            clean_symbol = self._from_broker_symbol(p.get("symbol", ""))
            
            # Use Centralized Domain Utility
            asset_class_str = get_asset_class(clean_symbol).value
            
            result.append(Trade(
                ticket=p.get("ticket"),
                symbol=clean_symbol,
                side=side,
                volume=p.get("volume"),
                open_price=p.get("price_open"),
                open_time=datetime.fromtimestamp(p.get("time")),
                sl=p.get("sl"),
                tp=p.get("tp"),
                close_price=p.get("price_current", 0.0),
                profit=p.get("profit"),
                status=TradeStatus.OPEN,
                magic=p.get("magic"),
                comment=p.get("comment"),
                asset_class=asset_class_str
            ))
        return result

    async def execute_order(self, order: Order) -> int:
        # PRE-CHECK: Idempotency
        # Check if we already executed this order (by checking open positions for Magic/Comment match)
        # This prevents duplicate execution if the previous call timed out but actually succeeded on broker
        # NOTE: This depends on getting latest positions.
        
        # We need to construct the 'request' dict for order_send
        
        # We need tick first (to get price)
        broker_symbol = self._to_broker_symbol(order.symbol)
        tick = await asyncio.to_thread(mt5_worker_client.send_command, "symbol_info_tick", args=[broker_symbol])
        if not tick:
            raise RuntimeError(f"No tick for {broker_symbol}")
            
        price = tick["ask"] if order.side == OrderSide.BUY else tick["bid"]
        
        # CONSTANTS
        ORDER_TYPE_BUY = 0
        ORDER_TYPE_SELL = 1
        TRADE_ACTION_DEAL = 1
        ORDER_TIME_GTC = 0
        ORDER_FILLING_IOC = 1
        
        cmd = ORDER_TYPE_BUY if order.side == OrderSide.BUY else ORDER_TYPE_SELL
        
        # IDEMPOTENCY: Append intent_id to comment
        # MT5 comments are short (31 chars max visible usually).
        # We assume order.comment is short, and we append a short hash or the intent_id if fits.
        # Format: "StrategyTag [ID:xxxxx]"
        # If intent_id is UUID, take last 8 chars for compact check
        short_intent = order.intent_id[-8:] if order.intent_id else "0000"
        final_comment = f"{order.comment} [{short_intent}]"[:31] # Truncate to be safe

        request = {
            "action": TRADE_ACTION_DEAL,
            "symbol": broker_symbol,
            "volume": order.volume,
            "type": cmd,
            "price": price,
            "sl": order.sl or 0.0,
            "tp": order.tp or 0.0,
            "deviation": 20,
            "magic": order.magic_number,
            "comment": final_comment,
            "type_time": ORDER_TIME_GTC,
            "type_filling": ORDER_FILLING_IOC,
        }
        try:
            res = await asyncio.to_thread(mt5_worker_client.send_command, "order_send", kwargs={"request": request}, timeout=15.0, raise_on_error=True)
            return res.get("order", 0)
        except RuntimeError as e:
            raise RuntimeError(f"Broker rejected: {str(e)}")
        except TimeoutError:
            log.warning(f"MT5Adapter: Order Send Timeout for {order.symbol}. Verifying if it was executed...")
            # Fallback: check if the position was actually opened despite the timeout
            await asyncio.sleep(2) # Give it a moment
            positions = await self.get_positions()
            if positions:
                for p in positions:
                    if p.comment and short_intent in p.comment:
                        log.success(f"MT5Adapter: Recovered timed-out order {order.symbol} - Ticket {p.ticket} found via comment.")
                        return p.ticket
            raise RuntimeError("Order Send Timeout (Not found in active positions)")

    async def get_server_time(self) -> Optional[datetime]:
        broker_sync_symbol = self._to_broker_symbol(settings.MT5_TIME_SYNC_SYMBOL)
        ts = await asyncio.to_thread(mt5_worker_client.send_command, "get_server_time", args=[broker_sync_symbol])
        if ts:
            return datetime.fromtimestamp(ts)
        return None

    async def close_position(self, ticket: int, volume: Optional[float] = None) -> bool:
        res = await asyncio.to_thread(mt5_worker_client.send_command, "close_position", args=[ticket, volume])
        if res:
            if volume:
                 log.success(f"Position {ticket} partially closed ({volume} lots).")
            else:
                 log.success(f"Position {ticket} fully closed.")
            return True
        else:
            log.error(f"Failed to close position {ticket}.")
            return False

    async def modify_position(self, ticket: int, new_sl: Optional[float] = None, new_tp: Optional[float] = None) -> bool:
        """Modifies the Stop Loss or Take Profit of an existing position."""
        res = await asyncio.to_thread(mt5_worker_client.send_command, "modify_position", args=[ticket, new_sl, new_tp])
        if res:
            log.success(f"Position {ticket} modified successfully (SL={new_sl}, TP={new_tp}).")
            return True
        else:
            log.error(f"Failed to modify position {ticket}.")
            return False

    async def get_symbols(self) -> List[str]:
        symbols = await asyncio.to_thread(mt5_worker_client.send_command, "symbols_get")
        if symbols:
            return [self._from_broker_symbol(s) for s in symbols]
        return []

    async def get_history_deals(self, from_date: datetime, to_date: datetime) -> List[dict]:
        res = await asyncio.to_thread(mt5_worker_client.send_command, "get_history_deals", args=[from_date, to_date], timeout=15.0)
        return res if res else []

    async def get_symbols_with_path(self) -> dict[str, str]:
        """Returns a dict mapping symbol names to their MT5 path."""
        symbols = await asyncio.to_thread(mt5_worker_client.send_command, "symbols_get_with_path")
        if symbols:
            return symbols
        return {}

mt5_adapter = MT5Adapter()
