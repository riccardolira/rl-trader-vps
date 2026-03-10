import sys
from pathlib import Path

# Try to import loguru, fallback to standard logging
try:
    from loguru import logger
    
    # Configuration
    logger.remove()
    
    # Console
    logger.add(
        sys.stderr, 
        level="INFO", 
        format="<green>{time:YYYY-MM-DD HH:mm:ss}</green> | <level>{level: <8}</level> | <cyan>{name}</cyan> - <level>{message}</level>"
    )
    
    # File (Rotation 50MB, Retention 10 days)
    LOG_DIR = Path("logs")
    LOG_DIR.mkdir(exist_ok=True)
    
    logger.add(
        LOG_DIR / "rl_trader.log",
        rotation="50 MB",
        retention="10 days",
        level="DEBUG",
        compression="zip",
        enqueue=True
    )
    
    log = logger

except ImportError:
    # Fail-safe standard logging
    import logging
    
    LOG_DIR = Path("logs")
    LOG_DIR.mkdir(exist_ok=True)
    
    formatter = logging.Formatter("%(asctime)s | %(levelname)s | %(name)s - %(message)s", datefmt="%Y-%m-%d %H:%M:%S")
    
    # Console handler
    ch = logging.StreamHandler()
    ch.setFormatter(formatter)
    
    # File handler
    fh = logging.FileHandler(LOG_DIR / "rl_trader.log", encoding="utf-8")
    fh.setFormatter(formatter)
    
    log = logging.getLogger("RL_TRADER")
    log.setLevel(logging.DEBUG)
    log.addHandler(ch)
    log.addHandler(fh)
    
    log.warning("Loguru not found. Using standard logging fallback with FileHandler.")

    # Mocking success/error/warning methods to match loguru API if needed for basic compat
    def _log_proxy(level, msg):
        getattr(log, level.lower())(msg)
        
    # We just expose the standard logger, code must assume standard methods (info, error, warning)
    # Loguru supports .success(), standard doesn't.
    if not hasattr(log, "success"):
        log.success = log.info # Map success to info
