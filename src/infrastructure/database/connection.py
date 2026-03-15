import os
from src.infrastructure.config import settings
from src.infrastructure.logger import log
from sqlalchemy.ext.asyncio import create_async_engine, AsyncEngine
from sqlalchemy import text

# Canonical SQLite fallback DB filename — must stay in sync with repair_sqlite.py
SQLITE_FALLBACK_DB = "rl_trader_audit.db"

SQLITE_DDL = """
CREATE TABLE IF NOT EXISTS audit_events (
    id             TEXT     PRIMARY KEY,
    timestamp      DATETIME DEFAULT CURRENT_TIMESTAMP,
    type           TEXT     NOT NULL,
    component      TEXT     NOT NULL,
    severity       TEXT     NOT NULL,
    correlation_id TEXT,
    payload_json   TEXT
);
CREATE INDEX IF NOT EXISTS idx_events_ts   ON audit_events(timestamp);
CREATE INDEX IF NOT EXISTS idx_events_type ON audit_events(type);

CREATE TABLE IF NOT EXISTS trades (
    ticket                   INTEGER PRIMARY KEY,
    symbol                   TEXT    NOT NULL,
    side                     TEXT    NOT NULL,
    volume                   REAL    NOT NULL,
    open_price               REAL    NOT NULL,
    open_time                DATETIME NOT NULL,
    sl                       REAL,
    tp                       REAL,
    close_price              REAL,
    close_time               DATETIME,
    profit                   REAL,
    status                   TEXT    NOT NULL DEFAULT 'OPEN',
    magic                    INTEGER,
    comment                  TEXT,
    strategy_name            TEXT,
    commission               REAL    DEFAULT 0.0,
    swap                     REAL    DEFAULT 0.0,
    reason_code              TEXT,
    score_signal             REAL,
    break_even_activated     INTEGER DEFAULT 0,
    trailing_stop_activated  INTEGER DEFAULT 0,
    is_market_closed         INTEGER DEFAULT 0,
    minutes_until_close      REAL,
    asset_class              TEXT,
    market_context           TEXT
);
CREATE INDEX IF NOT EXISTS idx_trades_status   ON trades(status);
CREATE INDEX IF NOT EXISTS idx_trades_symbol   ON trades(symbol);
CREATE INDEX IF NOT EXISTS idx_trades_strat    ON trades(strategy_name);
CREATE INDEX IF NOT EXISTS idx_trades_closetime ON trades(close_time);

CREATE TABLE IF NOT EXISTS universe_assets (
    symbol          TEXT PRIMARY KEY,
    instrument_type TEXT,
    active          INTEGER DEFAULT 1,
    min_volume      REAL,
    step_volume     REAL,
    tick_size       REAL,
    tick_value      REAL,
    contract_size   REAL,
    last_updated    DATETIME
);

CREATE TABLE IF NOT EXISTS strategy_performance (
    strategy_name     TEXT PRIMARY KEY,
    total_trades      INTEGER DEFAULT 0,
    wins              INTEGER DEFAULT 0,
    losses            INTEGER DEFAULT 0,
    total_profit      REAL    DEFAULT 0.0,
    sharpe_ratio      REAL,
    weight_multiplier REAL    DEFAULT 1.0,
    last_updated      DATETIME
);
"""

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
                url = f"sqlite+aiosqlite:///{SQLITE_FALLBACK_DB}"
                self.engine = create_async_engine(url, echo=False)
                async with self.engine.begin() as conn:
                    await conn.execute(text("PRAGMA journal_mode=WAL;"))
                    await conn.execute(text("PRAGMA synchronous=NORMAL;"))
                # Auto-create all tables via aiosqlite executescript (safe multi-statement DDL)
                # Done outside SQLAlchemy engine because executescript requires sqlite3 native
                import aiosqlite
                async with aiosqlite.connect(SQLITE_FALLBACK_DB) as _db:
                    # 1. Create tables if they don't exist
                    await _db.executescript(SQLITE_DDL)
                    # 2. Add any missing columns to existing tables (ALTER TABLE migration)
                    _migrations = [
                        ("trades", "strategy_name",           "TEXT"),
                        ("trades", "commission",              "REAL DEFAULT 0.0"),
                        ("trades", "swap",                    "REAL DEFAULT 0.0"),
                        ("trades", "reason_code",             "TEXT"),
                        ("trades", "score_signal",            "REAL"),
                        ("trades", "break_even_activated",    "INTEGER DEFAULT 0"),
                        ("trades", "trailing_stop_activated", "INTEGER DEFAULT 0"),
                        ("trades", "is_market_closed",        "INTEGER DEFAULT 0"),
                        ("trades", "minutes_until_close",     "REAL"),
                        ("trades", "asset_class",             "TEXT"),
                        ("trades", "market_context",          "TEXT"),
                    ]
                    for table, col, col_type in _migrations:
                        cur = await _db.execute(f"PRAGMA table_info({table})")
                        existing = {row[1] async for row in cur}
                        if col not in existing:
                            await _db.execute(f"ALTER TABLE {table} ADD COLUMN {col} {col_type}")
                            log.info(f"[SQLite migration] {table}.{col} adicionado")
                    await _db.commit()
                self.is_mysql = False
                log.info(f"Connected to SQLite: {SQLITE_FALLBACK_DB} (WAL + DDL + migrations auto-applied)")
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
            if "1142" not in str(e) or "audit_events" not in msg:
                log.error(f"DatabasePool Error: {e} | SQL: {msg}")
            raise e

db_pool = DatabasePool()
