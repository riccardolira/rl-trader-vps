-- 002_add_schema_version.sql

-- Usually SQLite uses user_version PRAGMA, but having a table for history is good for auditability
CREATE TABLE IF NOT EXISTS schema_history (
    version INTEGER PRIMARY KEY,
    applied_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    script_name TEXT NOT NULL
);
