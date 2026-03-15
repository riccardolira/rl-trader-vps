"""
repair_sqlite.py — Cria e atualiza todas as tabelas SQLite necessárias.
Seguro para rodar em banco existente: usa IF NOT EXISTS e trata colunas novas.

Uso:
    python repair_sqlite.py
    python repair_sqlite.py --db rl_trader_v3.db    (banco customizado)
"""

import sqlite3
import sys
import os
from datetime import datetime

DB_FILE = "rl_trader_audit.db"  # Deve ser igual a SQLITE_FALLBACK_DB em connection.py

# Permite passar outro arquivo via argumento
if len(sys.argv) > 2 and sys.argv[1] == "--db":
    DB_FILE = sys.argv[2]

print(f"[repair_sqlite] Conectando em: {DB_FILE}")
conn = sqlite3.connect(DB_FILE)
cur = conn.cursor()

# ─────────────────────────────────────────────
# 1. TRADES — projeção das ordens executadas
# ─────────────────────────────────────────────
cur.executescript("""
CREATE TABLE IF NOT EXISTS trades (
    ticket           INTEGER PRIMARY KEY,
    symbol           TEXT    NOT NULL,
    side             TEXT    NOT NULL,
    volume           REAL    NOT NULL,
    open_price       REAL    NOT NULL,
    open_time        DATETIME NOT NULL,
    sl               REAL,
    tp               REAL,
    close_price      REAL,
    close_time       DATETIME,
    profit           REAL,
    status           TEXT    NOT NULL DEFAULT 'OPEN',
    magic            INTEGER,
    comment          TEXT,
    strategy_name    TEXT,
    commission       REAL    DEFAULT 0.0,
    swap             REAL    DEFAULT 0.0,
    reason_code      TEXT,
    score_signal     REAL,
    break_even_activated   INTEGER DEFAULT 0,
    trailing_stop_activated INTEGER DEFAULT 0,
    is_market_closed INTEGER DEFAULT 0,
    minutes_until_close REAL,
    asset_class      TEXT
);
CREATE INDEX IF NOT EXISTS idx_trades_status   ON trades(status);
CREATE INDEX IF NOT EXISTS idx_trades_symbol   ON trades(symbol);
CREATE INDEX IF NOT EXISTS idx_trades_strat    ON trades(strategy_name);
CREATE INDEX IF NOT EXISTS idx_trades_closetime ON trades(close_time);
""")

# Colunas adicionadas em versões posteriores — adiciona só se não existem
NEW_TRADE_COLUMNS = [
    ("strategy_name",             "TEXT"),
    ("commission",                "REAL DEFAULT 0.0"),
    ("swap",                      "REAL DEFAULT 0.0"),
    ("reason_code",               "TEXT"),
    ("score_signal",              "REAL"),
    ("break_even_activated",      "INTEGER DEFAULT 0"),
    ("trailing_stop_activated",   "INTEGER DEFAULT 0"),
    ("is_market_closed",          "INTEGER DEFAULT 0"),
    ("minutes_until_close",       "REAL"),
    ("asset_class",               "TEXT"),
]

existing_cols = {row[1] for row in cur.execute("PRAGMA table_info(trades)")}
for col, col_type in NEW_TRADE_COLUMNS:
    if col not in existing_cols:
        cur.execute(f"ALTER TABLE trades ADD COLUMN {col} {col_type}")
        print(f"  [+] trades.{col} adicionado")

# ─────────────────────────────────────────────
# 2. AUDIT_EVENTS — log imutável de eventos
# ─────────────────────────────────────────────
cur.executescript("""
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
""")

# ─────────────────────────────────────────────
# 3. UNIVERSE_ASSETS — cache do scanner
# ─────────────────────────────────────────────
cur.executescript("""
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
""")

# ─────────────────────────────────────────────
# 4. STRATEGY_PERFORMANCE — cache de métricas
# ─────────────────────────────────────────────
cur.executescript("""
CREATE TABLE IF NOT EXISTS strategy_performance (
    strategy_name TEXT PRIMARY KEY,
    total_trades  INTEGER DEFAULT 0,
    wins          INTEGER DEFAULT 0,
    losses        INTEGER DEFAULT 0,
    total_profit  REAL    DEFAULT 0.0,
    sharpe_ratio  REAL,
    weight_multiplier REAL DEFAULT 1.0,
    last_updated  DATETIME
);
""")

conn.commit()
conn.close()

print(f"\n✅ repair_sqlite concluído em: {DB_FILE}")
print(f"   Tabelas: trades, audit_events, universe_assets, strategy_performance")
print(f"   Timestamp: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
