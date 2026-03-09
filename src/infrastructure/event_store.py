import aiomysql
from src.infrastructure.database.connection import db_pool
import json
from typing import List, Any
from src.domain.interfaces import IPersistence
from src.domain.models import Trade, TradeStatus
from src.infrastructure.config import settings
from src.infrastructure.logger import log

class EventStore(IPersistence):
    
    async def save_event(self, event: Any):
        """Persist an event to the audit log."""
        try:
            sql = """
                INSERT IGNORE INTO audit_events (id, timestamp, type, component, severity, correlation_id, payload_json)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """
            
            payload_str = json.dumps(event.payload, default=str)
            
            pool = await db_pool.get_pool()
            async with pool.acquire() as db:
                async with db.cursor() as cursor:
                    await cursor.execute(sql.replace('?', '%s'), (
                        event.event_id,
                        event.timestamp,
                        event.type,
                        event.component,
                        event.severity,
                        event.correlation_id,
                        payload_str
                    ))
                await db.commit()
                
        except Exception as e:
            log.error(f"Failed to persist event {event}: {e}")

    async def get_active_trades(self) -> List[Trade]:
        """Retrieve trades with OPEN status."""
        trades = []
        try:
            pool = await db_pool.get_pool()
            async with pool.acquire() as db:
                async with db.cursor(aiomysql.DictCursor) as cursor:
                    await cursor.execute("SELECT * FROM trades WHERE status = 'OPEN'")
                    async for row in cursor:
                        trades.append(self._row_to_trade(row))
        except Exception as e:
            log.error(f"Failed to fetch active trades: {e}")
        return trades

    async def get_closed_trades(self, limit: int = 100) -> List[Trade]:
        """Retrieve trades with CLOSED status, ordered by most recent first."""
        trades = []
        try:
            pool = await db_pool.get_pool()
            async with pool.acquire() as db:
                query = "SELECT * FROM trades WHERE status = 'CLOSED' ORDER BY close_time DESC LIMIT %s"
                async with db.cursor(aiomysql.DictCursor) as cursor:
                    await cursor.execute(query, (limit,))
                    async for row in cursor:
                        trades.append(self._row_to_trade(row))
        except Exception as e:
            log.error(f"Failed to fetch closed trades: {e}")
        return trades

    async def get_todays_realized_pnl(self) -> float:
        """Calculate the sum of profit for trades closed today."""
        try:
            pool = await db_pool.get_pool()
            async with pool.acquire() as db:
                # Assuming timezone is handled or UTC is used consistently
                query = "SELECT COALESCE(SUM(profit), 0) as total FROM trades WHERE status = 'CLOSED' AND DATE(close_time) = CURDATE()"
                async with db.cursor(aiomysql.DictCursor) as cursor:
                    await cursor.execute(query)
                    row = await cursor.fetchone()
                    if row and 'total' in row:
                        return float(row['total'])
        except Exception as e:
            from src.infrastructure.logger import log
            log.error(f"EventStore: Failed to calculate daily PnL: {e}")
        return 0.0

    async def upsert_trade(self, trade: Trade):
        """Insert or Update a trade record."""
        try:
            sql = """
                INSERT INTO trades (
                    ticket, symbol, side, volume, open_price, open_time, 
                    tp, close_price, close_time, profit, status, magic, comment, strategy_name, market_context
                ) 
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON DUPLICATE KEY UPDATE
                    close_price=VALUES(close_price),
                    close_time=VALUES(close_time),
                    profit=VALUES(profit),
                    status=VALUES(status),
                    strategy_name=VALUES(strategy_name),
                    market_context=VALUES(market_context)
            """
            
            pool = await db_pool.get_pool()
            async with pool.acquire() as db:
                async with db.cursor() as cursor:
                    await cursor.execute(sql, (
                    trade.ticket,
                    trade.symbol,
                    trade.side,
                    trade.volume,
                    trade.open_price,
                    trade.open_time,
                    trade.sl,
                    trade.tp,
                    trade.close_price,
                    trade.close_time,
                    trade.profit,
                    trade.status,
                    trade.magic,
                    trade.comment,
                    trade.strategy_name,
                    json.dumps(trade.market_context) if trade.market_context else None
                ))
                await db.commit()
                log.debug(f"Upserted trade {trade.ticket}")
                
        except Exception as e:
            log.error(f"Failed to upsert trade {trade.ticket}: {e}")

    def _row_to_trade(self, row) -> Trade:
        from src.domain.models import get_strategy_for_magic
        
        # Priority to Magic Number natively
        magic = row["magic"]
        strategy_name = get_strategy_for_magic(magic) if magic else "Unknown"
        
        # Fallback to DB string if Magic is unsupported or returns Unknown
        if strategy_name == "Unknown":
            if "strategy_name" in row.keys() and row["strategy_name"]:
                if row["strategy_name"] != "Unknown":
                    strategy_name = row["strategy_name"]
            
        market_ctx = {}
        if "market_context" in row.keys() and row["market_context"]:
            try:
                market_ctx = json.loads(row["market_context"])
            except:
                market_ctx = {}
                
        return Trade(
            ticket=row["ticket"],
            symbol=row["symbol"],
            side=row["side"],
            volume=row["volume"],
            open_price=row["open_price"],
            open_time=row["open_time"], # Needs datetime parsing if string
            sl=row["sl"],
            tp=row["tp"],
            close_price=row["close_price"],
            close_time=row["close_time"],
            profit=row["profit"],
            status=row["status"],
            magic=magic,
            comment=row["comment"] if "comment" in row.keys() else "",
            strategy_name=strategy_name,
            market_context=market_ctx
        )

    async def delete_closed_trade(self, ticket: int) -> bool:
        """Deletes a specific trade from the database by ticket ID."""
        try:
            pool = await db_pool.get_pool()
            async with pool.acquire() as db:
                async with db.cursor() as cursor:
                    await cursor.execute("DELETE FROM trades WHERE ticket = %s", (ticket,))
                    deleted = cursor.rowcount > 0
                await db.commit()
                return deleted
        except Exception as e:
            from src.infrastructure.logger import log
            log.error(f"EventStore: Failed to delete trade {ticket} - {e}")
            return False


    async def init_tables(self):
        """Initialize database tables if they don't exist."""
        sql_trades = """
            CREATE TABLE IF NOT EXISTS trades (
                ticket BIGINT PRIMARY KEY,
                symbol VARCHAR(50),
                side VARCHAR(20),
                volume FLOAT,
                open_price FLOAT,
                open_time TIMESTAMP NULL,
                sl FLOAT,
                tp FLOAT,
                close_price FLOAT,
                close_time TIMESTAMP NULL,
                profit FLOAT,
                status VARCHAR(20),
                magic BIGINT,
                comment TEXT,
                strategy_name VARCHAR(100),
                market_context JSON
            );
        """
        sql_audit = """
            CREATE TABLE IF NOT EXISTS audit_events (
                id VARCHAR(255) PRIMARY KEY,
                timestamp TIMESTAMP NULL,
                type VARCHAR(50),
                component VARCHAR(50),
                severity VARCHAR(20),
                correlation_id VARCHAR(255),
                payload_json JSON
            );
        """
        try:
            pool = await db_pool.get_pool()
            async with pool.acquire() as db:
                async with db.cursor() as cursor:
                    await cursor.execute(sql_trades)
                    await cursor.execute(sql_audit)
                await db.commit()
            log.info("Database tables initialized.")
        except Exception as e:
            log.error(f"Failed to initialize DB tables: {e}")

# Global Instance
event_store = EventStore()

# Delay import to avoid circular dependency
from src.infrastructure.event_bus import event_bus
event_bus.subscribe("*", event_store.save_event)
