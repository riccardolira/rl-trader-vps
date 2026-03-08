import asyncio
import aiomysql
from src.infrastructure.config import settings

async def check_db():
    conn = await aiomysql.connect(
        host=settings.DB_HOST,
        port=settings.DB_PORT,
        user=settings.DB_USER,
        password=settings.DB_PASSWORD,
        db=settings.DB_NAME
    )
    async with conn.cursor() as cur:
        await cur.execute("SHOW TABLES;")
        tables = await cur.fetchall()
        print("Tables in DB:", [t[0] for t in tables])
        
        for t in tables:
            t_name = t[0].lower()
            if 'setting' in t_name or 'config' in t_name or 'account' in t_name:
                await cur.execute(f"SELECT * FROM {t[0]};")
                rows = await cur.fetchall()
                print(f"Contents of {t[0]}:", rows)
    conn.close()

if __name__ == "__main__":
    asyncio.run(check_db())
