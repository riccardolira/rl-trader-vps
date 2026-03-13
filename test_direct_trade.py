import MetaTrader5 as mt5
from src.infrastructure.config import settings

def test_trade():
    if not mt5.initialize(login=settings.MT5_LOGIN, password=settings.MT5_PASSWORD, server=settings.MT5_SERVER):
        print("Init failed")
        return
        
    symbol = "EURUSD-T"
    tick = mt5.symbol_info_tick(symbol)
    if not tick:
        print("No tick for", symbol)
        mt5.shutdown()
        return
        
    price = tick.ask
    
    request = {
        "action": mt5.TRADE_ACTION_DEAL,
        "symbol": symbol,
        "volume": 0.01,
        "type": mt5.ORDER_TYPE_BUY,
        "price": price,
        "sl": 0.0,
        "tp": 0.0,
        "deviation": 20,
        "magic": 9999,
        "comment": "TestDirect",
        "type_time": mt5.ORDER_TIME_GTC,
        "type_filling": mt5.ORDER_FILLING_IOC,
    }
    
    res = mt5.order_send(request)
    if res:
        print(f"Result: retcode={res.retcode}, comment={res.comment}")
        if res.retcode == mt5.TRADE_RETCODE_DONE:
            print("Trade Success!")
            # Close it immediately
            pos = mt5.positions_get(ticket=res.order)
            if pos:
                tick = mt5.symbol_info_tick(symbol)
                close_req = {
                    "action": mt5.TRADE_ACTION_DEAL,
                    "symbol": symbol,
                    "volume": 0.01,
                    "type": mt5.ORDER_TYPE_SELL,
                    "position": res.order,
                    "price": tick.bid,
                    "deviation": 20,
                    "magic": 9999,
                    "comment": "TestDirectClose",
                    "type_time": mt5.ORDER_TIME_GTC,
                    "type_filling": mt5.ORDER_FILLING_IOC,
                }
                mt5.order_send(close_req)
                print("Position closed.")
    else:
        print("MetaTrader5 error dict:", mt5.last_error())
        
    mt5.shutdown()

if __name__ == "__main__":
    test_trade()
