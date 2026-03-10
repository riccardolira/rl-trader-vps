import json
from typing import List, Any
from datetime import date
from sqlalchemy import select, func, text
from sqlalchemy.dialects.mysql import insert as mysql_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert

from src.infrastructure.database.connection import db_pool
from src.domain.interfaces import IPersistence
from src.domain.models import Trade, TradeStatus
from src.infrastructure.config import settings
from src.infrastructure.logger import log
from src.infrastructure.database.models import TradeModel, AuditEventModel
from src.infrastructure.cache import async_ttl_cache

class EventStore(IPersistence):
    
    async def save_event(self, event: Any):
        """Persist an event to the audit log."""
        try:
            payload_str = json.dumps(event.payload, default=str)
            values = dict(
                id=event.event_id,
                timestamp=event.timestamp,
                type=event.type,
                component=event.component,
                severity=event.severity,
                correlation_id=event.correlation_id,
                payload_json=payload_str
            )
            
            if db_pool.is_mysql:
                stmt = mysql_insert(AuditEventModel).values(**values).prefix_with('IGNORE')
            else:
                stmt = sqlite_insert(AuditEventModel).values(**values).on_conflict_do_nothing()
                
            await db_pool.execute(stmt)
        except Exception as e:
            log.error(f"Failed to persist event {event}: {e}")

    @async_ttl_cache(ttl_seconds=2)
    async def get_active_trades(self) -> List[Trade]:
        """Retrieve trades with OPEN status."""
        trades = []
        try:
            stmt = select(TradeModel).where(TradeModel.status == 'OPEN')
            rows = await db_pool.execute(stmt, fetch="all", dictionary=True)
            for row in rows:
                trades.append(self._row_to_trade(row))
        except Exception as e:
            log.error(f"Failed to fetch active trades: {e}")
        return trades

    @async_ttl_cache(ttl_seconds=3)
    async def get_closed_trades(self, limit: int = 100) -> List[Trade]:
        """Retrieve trades with CLOSED status, ordered by most recent first."""
        trades = []
        try:
            stmt = select(TradeModel).where(TradeModel.status == 'CLOSED').order_by(TradeModel.close_time.desc()).limit(limit)
            rows = await db_pool.execute(stmt, fetch="all", dictionary=True)
            for row in rows:
                trades.append(self._row_to_trade(row))
        except Exception as e:
            log.error(f"Failed to fetch closed trades: {e}")
        return trades

    @async_ttl_cache(ttl_seconds=5)
    async def get_todays_realized_pnl(self) -> float:
        """Calculate the sum of profit for trades closed today."""
        try:
            # Use SQLAlchemy func.date and inject python's date.today() for maximum compatibility
            stmt = select(func.coalesce(func.sum(TradeModel.profit), 0)).where(
                TradeModel.status == 'CLOSED',
                func.date(TradeModel.close_time) == date.today()
            )
            row = await db_pool.execute(stmt, fetch="one")
            if row:
                return float(row[0])
        except Exception as e:
            log.error(f"EventStore: Failed to calculate daily PnL: {e}")
        return 0.0

    async def upsert_trade(self, trade: Trade):
        """Insert or Update a trade record."""
        try:
            values = dict(
                ticket=trade.ticket,
                symbol=trade.symbol,
                side=trade.side,
                volume=trade.volume,
                open_price=trade.open_price,
                open_time=trade.open_time,
                sl=trade.sl,
                tp=trade.tp,
                close_price=trade.close_price,
                close_time=trade.close_time,
                profit=trade.profit,
                status=trade.status,
                magic=trade.magic,
                comment=trade.comment,
                strategy_name=trade.strategy_name,
                market_context=json.dumps(trade.market_context) if trade.market_context else None
            )

            upsert_dict = {
                'close_price': values['close_price'],
                'close_time': values['close_time'],
                'profit': values['profit'],
                'status': values['status'],
                'strategy_name': values['strategy_name'],
                'market_context': values['market_context']
            }

            if db_pool.is_mysql:
                stmt = mysql_insert(TradeModel).values(**values).on_duplicate_key_update(**upsert_dict)
            else:
                stmt = sqlite_insert(TradeModel).values(**values).on_conflict_do_update(
                    index_elements=['ticket'],
                    set_=upsert_dict
                )
            
            await db_pool.execute(stmt)
            log.debug(f"Upserted trade {trade.ticket}")
                
        except Exception as e:
            log.error(f"Failed to upsert trade {trade.ticket}: {e}")

    def _row_to_trade(self, row) -> Trade:
        from src.domain.models import get_strategy_for_magic
        
        magic = row.get("magic")
        strategy_name = get_strategy_for_magic(magic) if magic else "Unknown"
        
        if strategy_name == "Unknown":
            if row.get("strategy_name") and row.get("strategy_name") != "Unknown":
                strategy_name = row.get("strategy_name")
            
        market_ctx = {}
        if row.get("market_context"):
            try:
                market_ctx = json.loads(row.get("market_context"))
            except:
                pass
                
        return Trade(
            ticket=row.get("ticket"),
            symbol=row.get("symbol"),
            side=row.get("side"),
            volume=row.get("volume"),
            open_price=row.get("open_price"),
            open_time=row.get("open_time"), 
            sl=row.get("sl"),
            tp=row.get("tp"),
            close_price=row.get("close_price"),
            close_time=row.get("close_time"),
            profit=row.get("profit"),
            status=row.get("status"),
            magic=magic,
            comment=row.get("comment", ""),
            strategy_name=strategy_name,
            market_context=market_ctx
        )

    async def delete_closed_trade(self, ticket: int) -> bool:
        """Deletes a specific trade from the database by ticket ID."""
        try:
            from sqlalchemy import delete
            stmt = delete(TradeModel).where(TradeModel.ticket == ticket)
            count = await db_pool.execute(stmt)
            return count > 0
        except Exception as e:
            log.error(f"EventStore: Failed to delete trade {ticket} - {e}")
            return False

# Global Instance
event_store = EventStore()

# Delay import to avoid circular dependency
from src.infrastructure.event_bus import event_bus
event_bus.subscribe("*", event_store.save_event)
