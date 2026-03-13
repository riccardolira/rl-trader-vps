import MetaTrader5 as mt5
import json
from src.infrastructure.config import settings

def check_terminal():
    print(f"Initializing MT5 with login {settings.MT5_LOGIN}")
    if not mt5.initialize(login=settings.MT5_LOGIN, password=settings.MT5_PASSWORD, server=settings.MT5_SERVER):
        print("initialize() failed, error code =", mt5.last_error())
        return
        
    term_info = mt5.terminal_info()
    if term_info is None:
        print("Failed to get terminal info")
    else:
        print("Terminal Info:")
        for k, v in term_info._asdict().items():
            print(f"  {k}: {v}")
            
    account_info = mt5.account_info()
    if account_info is None:
        print("Failed to get account info")
    else:
        print("\nAccount Info:")
        for k, v in account_info._asdict().items():
            print(f"  {k}: {v}")
            
    mt5.shutdown()

if __name__ == "__main__":
    check_terminal()
