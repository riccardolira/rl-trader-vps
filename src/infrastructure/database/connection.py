import os
from src.infrastructure.config import settings
from src.infrastructure.logger import log
from sqlalchemy.ext.asyncio import create_async_engine, AsyncEngine
from sqlalchemy import text

class DatabasePool:
    def __init__(self):
        self.engine: AsyncEngine = None
        self.is_mysql = True

    async def get_pool(self):
        if not self.engine:
            try:
                # Use SQLAlchemy AsyncEngine with pool_pre_ping and pool_recycle for ultimate resilience
                url = f"mysql+aiomysql://{settings.DB_USER}:{settings.DB_PASSWORD}@{settings.DB_HOST}:{settings.DB_PORT}/{settings.DB_NAME}"
                self.engine = create_async_engine(
                    url,
                    pool_pre_ping=True,      # Tests connection before using (Prevents "MySQL server has gone away")
                    pool_recycle=3600,       # Recycles connections every hour
                    echo=False
                )
                
                # Test connection
                async with self.engine.connect() as conn:
                    pass
                log.info(f"Connected to MySQL on {settings.DB_HOST}:{settings.DB_PORT} via SQLAlchemy")
                self.is_mysql = True
            except Exception as e:
                log.warning(f"Failed to connect to MySQL: {e}. Falling back to SQLite...")
                url = "sqlite+aiosqlite:///rl_trader_audit.db"
                self.engine = create_async_engine(
                    url,
                    echo=False
                )
                async with self.engine.begin() as conn:
                    await conn.execute(text("PRAGMA journal_mode=WAL;"))
                    await conn.execute(text("PRAGMA synchronous=NORMAL;"))
                self.is_mysql = False
                log.info("Connected to local SQLite database: rl_trader_audit.db (WAL Mode Enabled) via SQLAlchemy")
        return self.engine

    async def close(self):
        if self.engine:
            await self.engine.dispose()
            self.engine = None

    async def execute(self, sql_or_stmt, params = None, fetch: str = None, dictionary: bool = False):
        """Unified execute for both MySQL and SQLite via SQLAlchemy."""
        engine = await self.get_pool()
        
        # Backwards compatibility parser for old raw SQL strings using %s or ?
        if isinstance(sql_or_stmt, str):
            actual_params = {}
            if params and isinstance(params, (tuple, list)):
                target_char = "%s" if "%s" in sql_or_stmt else "?" if "?" in sql_or_stmt else None
                if target_char:
                    parts = sql_or_stmt.split(target_char)
                    new_sql = ""
                    for i in range(len(parts) - 1):
                        new_sql += parts[i] + f":p{i}"
                        actual_params[f"p{i}"] = params[i]
                    new_sql += parts[-1]
                    stmt = text(new_sql)
                else:
                    stmt = text(sql_or_stmt)
            else:
                stmt = text(sql_or_stmt)
                if isinstance(params, dict):
                    actual_params = params
        else:
            stmt = sql_or_stmt
            if isinstance(params, dict):
                actual_params = params
            elif params is None:
                actual_params = {}
            else: # list of dictionaries for executemany
                actual_params = params

        try:
            async with engine.begin() as conn:
                # If executemany (params is a list of dicts)
                if isinstance(actual_params, list):
                    result = await conn.execute(stmt, actual_params)
                else:
                    result = await conn.execute(stmt, actual_params)
                
                if fetch == "one":
                    row = result.fetchone()
                    return row._asdict() if (row and dictionary) else row
                if fetch == "all":
                    rows = result.fetchall()
                    return [r._asdict() for r in rows] if dictionary else rows
                
                return result.rowcount
        except Exception as e:
            msg = str(sql_or_stmt)[:100] + "..."
            log.error(f"DatabasePool Error: {e} | SQL: {msg}")
            raise e

db_pool = DatabasePool()
