import asyncio
from src.infrastructure.logger import log

async def check_symbols():
    from src.infrastructure.config import settings
    log.info(f"Loaded Settings. MT5_LOGIN: {settings.MT5_LOGIN}")
    
    from src.infrastructure.mt5_adapter import mt5_adapter
    connected = await mt5_adapter.connect()
    if connected:
        log.success("SUCCESS! MT5 IS CONNECTED AND AUTHORIZED.")
        
        symbols = await mt5_adapter.get_symbols()
        log.info(f"Symbols found in Market Watch (First 20): {symbols[:20]}")
        
        await mt5_adapter.disconnect()
    else:
        log.error("MT5 CONNECTION FAILED.")

if __name__ == "__main__":
    asyncio.run(check_symbols())
