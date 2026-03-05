import os
from typing import Optional

try:
    from pydantic_settings import BaseSettings
except ImportError:
    try:
        from pydantic import BaseSettings
    except ImportError:
        from pydantic.v1 import BaseSettings

class Settings(BaseSettings):
    # --- Environment ---
    ENV: str = "DEV" # DEV, PROD, SHADOW
    PROJECT_NAME: str = "RL TRADER V3"
    
    # --- Paths ---
    BASE_DIR: str = os.getcwd()
    
    # --- Database (Hostinger MySQL) ---
    DB_HOST: str = "127.0.0.1" # Change to Hostinger IP in .env
    DB_PORT: int = 3306
    DB_USER: str = "root"
    DB_PASSWORD: str = ""
    DB_NAME: str = "rl_trader_db"
    
    # --- MT5 ---
    MT5_LOGIN: int = 0
    MT5_PASSWORD: str = ""
    MT5_SERVER: str = ""
    MT5_PATH: Optional[str] = None # Path to terminal64.exe
    MT5_TIMEOUT_SEC: int = 30
    MT5_TIME_SYNC_SYMBOL: str = "EURUSD-T" # Symbol to check for server time/connectivity
    
    # --- Resilience ---
    LOG_LEVEL: str = "INFO"
    DISK_MIN_FREE_GB: float = 1.0
    TIME_SKEW_MAX_SEC: float = 30.0
    HEARTBEAT_INTERVAL_SEC: int = 5
    
    # --- Notifications ---
    NOTIFICATIONS_ENABLED: bool = True
    NTFY_TOPIC: str = "rl_trader_v3_alerts"
    NTFY_BASE_URL: str = "https://ntfy.sh"
    NOTIFY_MIN_SEVERITY: str = "ERROR"
    
    # --- API ---
    API_PORT: int = 8001
    API_KEY: str = "secret-key-change-me"
    
    # --- Asset Selection Subsystem (ASS) ---
    SELECTION_MODE: str = "manual"  # manual, auto, hybrid
    SELECTION_UNIVERSE_SYMBOLS: list = ["EURUSD", "GBPUSD", "XAUUSD", "BTCUSD", "WIN$N", "WDO$N"] # Expanded Whitelist
    SELECTION_MAX_ACTIVE: int = 5
    SELECTION_MIN_SCORE: float = 20.0
    SELECTION_REBALANCE_MINUTES: int = 60 # 1 hour
    
    # --- Strategy Engine (SE) ---
    STRATEGY_ENABLE_TREND: bool = True
    STRATEGY_ENABLE_REVERSION: bool = True
    STRATEGY_ENABLE_BREAKOUT: bool = False # Still False for now as per plan confirmation request
    
    # Thresholds (JSON/Dict as string or explicit fields? Explicit is safer for Env)
    # Using simple prefixes for now.
    STRATEGY_THRESHOLD_CONSERVATIVE: float = 60.0
    STRATEGY_THRESHOLD_BALANCED: float = 40.0
    STRATEGY_THRESHOLD_AGGRESSIVE: float = 30.0
    
    # --- Execution Engine (EE) ---
    EXECUTION_RISK_PER_TRADE: float = 0.01 # 1% of Equity
    EXECUTION_MAX_LOT: float = 1.0
    EXECUTION_MIN_LOT: float = 0.01
    
    # --- Risk Caps ---
    RISK_MAX_DRAWDOWN_PCT: float = 0.15 # 15% Max DD
    RISK_MAX_EXPOSURE_TOTAL: float = 5.0 # Max 5 lots total open? Or leverage? Let's say Lots for now.
    # --- Session Closure ---
    SESSION_CLOSE_WINNERS_IMMEDIATELY: bool = True
    SESSION_LOSER_REVERSAL_WINDOW_MINUTES: int = 30
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"

# Global Settings Instance
settings = Settings()
