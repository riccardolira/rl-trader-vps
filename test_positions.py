import asyncio
from src.infrastructure.logger import log

async def check_positions():
    from src.infrastructure.mt5_adapter import mt5_adapter
    
    connected = await mt5_adapter.connect()
    if not connected:
        print("Failed to connect to MT5.")
        return
        
    print("Connected to MT5 Adapter.")
    
    positions = await mt5_adapter.get_positions()
    
    if positions is None:
        print("MT5 returned None (Timeout or Error)")
    else:
        print(f"MT5 returned {len(positions)} positions.")
        for p in positions:
            print(f" - [{p.ticket}] {p.symbol} {p.side} Vol:{p.volume} Profit:{p.profit}")
            
    await mt5_adapter.disconnect()

if __name__ == "__main__":
    asyncio.run(check_positions())
