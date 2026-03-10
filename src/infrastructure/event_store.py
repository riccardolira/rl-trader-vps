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
            
            await db_pool.execute(sql, (
                event.event_id,
                event.timestamp,
                event.type,
                event.component,
                event.severity,
                event.correlation_id,
                payload_str
            ))
                
        except Exception as e:
            log.error(f"Failed to persist event {event}: {e}")

    async def get_active_trades(self) -> List[Trade]:
        """Retrieve trades with OPEN status."""
        trades = []
        try:
            rows = await db_pool.execute("SELECT * FROM trades WHERE status = 'OPEN'", fetch="all", dictionary=True)
            for row in rows:
                trades.append(self._row_to_trade(row))
        except Exception as e:
            log.error(f"Failed to fetch active trades: {e}")
        return trades

    async def get_closed_trades(self, limit: int = 100) -> List[Trade]:
        """Retrieve trades with CLOSED status, ordered by most recent first."""
        trades = []
        try:
            query = "SELECT * FROM trades WHERE status = 'CLOSED' ORDER BY close_time DESC LIMIT %s"
            rows = await db_pool.execute(query, (limit,), fetch="all", dictionary=True)
            for row in rows:
                trades.append(self._row_to_trade(row))
        except Exception as e:
            log.error(f"Failed to fetch closed trades: {e}")
        return trades

    async def get_todays_realized_pnl(self) -> float:
        """Calculate the sum of profit for trades closed today."""
        try:
            # Note: CURDATE() is MySQL. SQLite needs DATE('now'). handled in connection.py or here.
            # Let's use a more portable approach if possible, or handle in connection.py
            if db_pool.is_mysql:
                query = "SELECT COALESCE(SUM(profit), 0) as total FROM trades WHERE status = 'CLOSED' AND DATE(close_time) = CURDATE()"
            else:
                query = "SELECT COALESCE(SUM(profit), 0) as total FROM trades WHERE status = 'CLOSED' AND DATE(close_time) = DATE('now')"
            
            row = await db_pool.execute(query, fetch="one", dictionary=True)
            if row and 'total' in row:
                return float(row['total'])
        except Exception as e:
            log.error(f"EventStore: Failed to calculate daily PnL: {e}")
        return 0.0

    async def upsert_trade(self, trade: Trade):
        """Insert or Update a trade record."""
        try:
            sql = """
                INSERT INTO trades (
                    ticket, symbol, side, volume, open_price, open_time, 
                    sl, tp, close_price, close_time, profit, status, magic, comment, strategy_name, market_context
                ) 
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON DUPLICATE KEY UPDATE
                    close_price=VALUES(close_price),
                    close_time=VALUES(close_time),
                    profit=VALUES(profit),
                    status=VALUES(status),
                    strategy_name=VALUES(strategy_name),
                    market_context=VALUES(market_context)
            """
            
            await db_pool.execute(sql, (
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
            log.debug(f"Upserted trade {trade.ticket}")
                
        except Exception as e:
            log.error(f"Failed to upsert trade {trade.ticket}: {e}")

    def _row_to_trade(self, row) -> Trade:
        from src.domain.models import get_strategy_for_magic
        
        # Priority to Magic Number natively
        magic = row["magic"]
        strategy_name = get_strategy_for_magic(magic) if magic else "Unknown"
        
        # Handling row access for both DictCursor and aiosqlite.Row
        try:
            row_keys = row.keys() if hasattr(row, "keys") else []
        except:
            row_keys = []

        # Fallback to DB string if Magic is unsupported or returns Unknown
        if strategy_name == "Unknown":
            if "strategy_name" in row_keys and row["strategy_name"]:
                if row["strategy_name"] != "Unknown":
                    strategy_name = row["strategy_name"]
            
        market_ctx = {}
        if "market_context" in row_keys and row["market_context"]:
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
            open_time=row["open_time"], 
            sl=row["sl"],
            tp=row["tp"],
            close_price=row["close_price"],
            close_time=row["close_time"],
            profit=row["profit"],
            status=row["status"],
            magic=magic,
            comment=row["comment"] if "comment" in row_keys else "",
            strategy_name=strategy_name,
            market_context=market_ctx
        )

    async def delete_closed_trade(self, ticket: int) -> bool:
        """Deletes a specific trade from the database by ticket ID."""
        try:
            count = await db_pool.execute("DELETE FROM trades WHERE ticket = %s", (ticket,))
            return count > 0
        except Exception as e:
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
                market_context TEXT
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
                payload_json TEXT
            );
        """
        # Note: SQLite doesn't have JSON type, using TEXT as fallback.
        # MySQL 5.7+ has JSON, but TEXT works for both.
        try:
            await db_pool.execute(sql_trades)
            await db_pool.execute(sql_audit)
            log.info("Database tables initialized.")
        except Exception as e:
            log.error(f"Failed to initialize DB tables: {e}")

# Global Instance
event_store = EventStore()

# Delay import to avoid circular dependency
from src.infrastructure.event_bus import event_bus
event_bus.subscribe("*", event_store.save_event)
