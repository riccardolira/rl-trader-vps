import aiomysql
import aiosqlite
import os
from src.infrastructure.config import settings
from src.infrastructure.logger import log

class DatabasePool:
    def __init__(self):
        self.pool = None

    async def get_pool(self):
        if not self.pool:
            try:
                self.pool = await aiomysql.create_pool(
                    host=settings.DB_HOST,
                    port=settings.DB_PORT,
                    user=settings.DB_USER,
                    password=settings.DB_PASSWORD,
                    db=settings.DB_NAME,
                    autocommit=True
                )
                log.info(f"Connected to MySQL on {settings.DB_HOST}:{settings.DB_PORT}")
                self.is_mysql = True
            except Exception as e:
                log.warning(f"Failed to connect to MySQL: {e}. Falling back to SQLite...")
                self.pool = await aiosqlite.connect("rl_trader_audit.db") # Single connection for SQLite
                await self.pool.execute("PRAGMA journal_mode=WAL;")
                await self.pool.execute("PRAGMA synchronous=NORMAL;")
                self.is_mysql = False
                log.info("Connected to local SQLite database: rl_trader_audit.db (WAL Mode Enabled)")
        return self.pool

    async def close(self):
        if self.pool:
            if self.is_mysql:
                self.pool.close()
                await self.pool.wait_closed()
            else:
                await self.pool.close()
            self.pool = None

    async def execute(self, sql: str, params: tuple = None, fetch: str = None, dictionary: bool = False):
        """Unified execute for both MySQL and SQLite."""
        pool = await self.get_pool()
        
        # 1. Prepare SQL Placeholders
        # Convert ? to %s for MySQL if needed, or vice-versa
        if self.is_mysql:
             final_sql = sql.replace('?', '%s')
        else:
             final_sql = sql.replace('%s', '?')
             # SQLite doesn't like INSERT IGNORE
             if "INSERT IGNORE" in final_sql:
                 final_sql = final_sql.replace("INSERT IGNORE", "INSERT OR IGNORE")
             if "ON DUPLICATE KEY UPDATE" in final_sql:
                 # Very basic conversion for simple upserts (trades)
                 # Expects: INSERT ... VALUES ... ON DUPLICATE KEY UPDATE col=VALUES(col)
                 # SQLite: INSERT ... VALUES ... ON CONFLICT(ticket) DO UPDATE SET col=excluded.col
                 final_sql = final_sql.split("ON DUPLICATE KEY UPDATE")[0]
                 # For now, let's keep it simple or use OR REPLACE
                 final_sql = final_sql.replace("INSERT INTO", "INSERT OR REPLACE INTO")

        try:
            if self.is_mysql:
                async with pool.acquire() as db:
                    cursor_type = aiomysql.DictCursor if dictionary else aiomysql.Cursor
                    async with db.cursor(cursor_type) as cursor:
                        await cursor.execute(final_sql, params)
                        if fetch == "one":
                            return await cursor.fetchone()
                        if fetch == "all":
                            return await cursor.fetchall()
                        return cursor.rowcount
            else:
                # SQLite
                pool.row_factory = aiosqlite.Row if dictionary else None
                async with pool.execute(final_sql, params) as cursor:
                    if fetch == "one":
                        return await cursor.fetchone()
                    if fetch == "all":
                        return await cursor.fetchall()
                    await pool.commit()
                    return cursor.rowcount
        except Exception as e:
            log.error(f"DatabasePool Error: {e} | SQL: {final_sql[:100]}...")
            raise e

db_pool = DatabasePool()
