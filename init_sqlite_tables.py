import asyncio
from src.infrastructure.database.models import Base
from src.infrastructure.database.connection import db_pool
from sqlalchemy.ext.asyncio import create_async_engine

async def init_sqlite():
    # Force sqlite url
    url = "sqlite+aiosqlite:///rl_trader_audit.db"
    engine = create_async_engine(url, echo=True)
    
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        
    print("Tables created in rl_trader_audit.db")

if __name__ == '__main__':
    asyncio.run(init_sqlite())
