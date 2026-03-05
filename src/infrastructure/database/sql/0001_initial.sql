-- 0001_initial.sql

-- 1. Audit Events Table (The Source of Truth)
CREATE TABLE IF NOT EXISTS audit_events (
    id TEXT PRIMARY KEY,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    type TEXT NOT NULL,
    component TEXT NOT NULL,
    severity TEXT NOT NULL,
    correlation_id TEXT,
    payload_json TEXT
);
CREATE INDEX IF NOT EXISTS idx_events_ts ON audit_events(timestamp);
CREATE INDEX IF NOT EXISTS idx_events_type ON audit_events(type);

-- 2. Trades Table (For active management and easy querying)
-- This is a projection of the events, not the primary source of truth,
-- but vital for performance.
CREATE TABLE IF NOT EXISTS trades (
    ticket INTEGER PRIMARY KEY,
    symbol TEXT NOT NULL,
    side TEXT NOT NULL,
    volume REAL NOT NULL,
    open_price REAL NOT NULL,
    open_time DATETIME NOT NULL,
    sl REAL,
    tp REAL,
    close_price REAL,
    close_time DATETIME,
    profit REAL,
    status TEXT NOT NULL, -- OPEN, CLOSED
    magic INTEGER,
    comment TEXT
);
CREATE INDEX IF NOT EXISTS idx_trades_status ON trades(status);

-- 3. Universe Assets (For Scanner)
CREATE TABLE IF NOT EXISTS universe_assets (
    symbol TEXT PRIMARY KEY,
    instrument_type TEXT,
    active INTEGER DEFAULT 1,
    min_volume REAL,
    step_volume REAL,
    tick_size REAL,
    tick_value REAL,
    contract_size REAL,
    last_updated DATETIME
);
