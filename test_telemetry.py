import asyncio

async def test():
    try:
        from src.domain.models import Trade, OrderSide, TradeStatus
        from src.application.services.asset_selection_service import asset_selection_service
        from datetime import datetime
        
        # emulate the telemetry loop
        print("Checking mins past for FOREX EURUSD...")
        mins_past = asset_selection_service.minutes_since_schedule_end("EURUSD-T", "FOREX")
        mins_until = asset_selection_service.minutes_until_schedule_end("EURUSD-T", "FOREX")
        print(f"Mins past: {mins_past}, Mins until: {mins_until}")
        
    except Exception as e:
        print(f"ERROR: {e}")

if __name__ == "__main__":
    asyncio.run(test())
