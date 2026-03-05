import aiomysql
from src.infrastructure.config import settings
from src.infrastructure.logger import log

class DatabasePool:
    def __init__(self):
        self.pool = None

    async def get_pool(self):
        if not self.pool:
            try:
                self.pool = await aiomysql.create_pool(
                    host=settings.DB_HOST,
                    port=settings.DB_PORT,
                    user=settings.DB_USER,
                    password=settings.DB_PASSWORD,
                    db=settings.DB_NAME,
                    autocommit=True
                )
                log.info(f"Connected to MySQL on {settings.DB_HOST}:{settings.DB_PORT}")
            except Exception as e:
                log.error(f"Failed to connect to MySQL: {e}")
                raise e
        return self.pool

    async def close(self):
        if self.pool:
            self.pool.close()
            await self.pool.wait_closed()
            self.pool = None

db_pool = DatabasePool()
