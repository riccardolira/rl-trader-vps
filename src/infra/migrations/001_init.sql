-- 001_init.sql

-- Audit Log (Immutable Events)
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

-- Trades Projection (For quick access)
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
    status TEXT NOT NULL,
    magic INTEGER,
    comment TEXT
);
CREATE INDEX IF NOT EXISTS idx_trades_status ON trades(status);

-- Universe (Assets)
CREATE TABLE IF NOT EXISTS universe_assets (
    symbol TEXT PRIMARY KEY,
    instrument_type TEXT,
    active INTEGER DEFAULT 1,
    min_volume REAL,
    tick_size REAL,
    description TEXT,
    last_updated DATETIME
);
