import MetaTrader5 as mt5
import json
from src.infrastructure.config import settings

def main():
    if not mt5.initialize(login=settings.MT5_LOGIN, password=settings.MT5_PASSWORD, server=settings.MT5_SERVER):
        print("Init failed")
        return
        
    term_info = mt5.terminal_info()
    acc_info = mt5.account_info()
    
    data = {
        "terminal": term_info._asdict() if term_info else None,
        "account": acc_info._asdict() if acc_info else None
    }
    
    with open("mt5_dump.json", "w") as f:
        json.dump(data, f, indent=2)
        
    mt5.shutdown()

if __name__ == "__main__":
    main()
