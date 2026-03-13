import MetaTrader5 as mt5
from src.infrastructure.config import settings
import time
import json

def test():
    print(f"Connecting to {settings.MT5_SERVER} as {settings.MT5_LOGIN}...")
    
    # Use empty init first to see if it grabs the active terminal
    ok = mt5.initialize()
    
    if not ok:
        print(f"Init Failed: {mt5.last_error()}")
        return
        
    print("Init OK!")
    
    symbols = mt5.symbols_get()
    if symbols is None:
         print(f"symbols_get FAILED: {mt5.last_error()}")
    else:
         visible = [s for s in symbols if s.visible]
         print(f"Total Symbols: {len(symbols)}")
         print(f"Visible Symbols: {len(visible)}")
         
         # Now test the path extraction that failed in mt5_worker
         try:
             res = {s.name: getattr(s, 'path', '') for s in visible}
             print("Path extraction OK. First 3:", list(res.items())[:3])
         except Exception as e:
             print(f"Path extraction EXCEPTION: {e}")
             
    mt5.shutdown()

if __name__ == '__main__':
    test()
