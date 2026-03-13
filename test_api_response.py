import asyncio
from src.api.routes_strategies import get_strategies_config

async def test():
    configs = await get_strategies_config()
    print("API Response Dump:", configs[0].dict())

asyncio.run(test())
