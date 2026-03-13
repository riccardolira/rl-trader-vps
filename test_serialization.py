import asyncio
from datetime import datetime
from src.domain.events import LivePositionUpdate
from src.domain.models import Trade, OrderSide, TradeStatus

async def test():
    trades = []
    trade = Trade(
        ticket=123,
        symbol="EURUSD",
        side=OrderSide.BUY,
        volume=0.01,
        open_price=1.1000,
        open_time=datetime.utcnow(),
        sl=0.0,
        tp=0.0,
        close_price=1.1000,
        profit=0.0,
        status=TradeStatus.OPEN,
        magic=1000,
        comment="Test",
        asset_class="FOREX"
    )
    p_dict = trade.dict()
    trades_list = [p_dict]
    
    event = LivePositionUpdate(count=len(trades_list), trades=trades_list)
    print("Event created.")
    
    try:
        if hasattr(event, "model_dump_json"):
            msg = event.model_dump_json()
            print("model_dump_json SUCCESS: ", msg[:100])
        elif hasattr(event, "json") and callable(event.json):
            msg = event.json()
            print("json() SUCCESS: ", msg[:100])
    except Exception as e:
        print("SERIALIZATION ERROR:", e)

if __name__ == "__main__":
    asyncio.run(test())
