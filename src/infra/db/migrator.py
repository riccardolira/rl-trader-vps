import aiosqlite
import os
import asyncio
from typing import List
from pathlib import Path
from src.infrastructure.config import settings
from src.infrastructure.logger import log

# Path to migration scripts
MIGRATIONS_DIR = Path(__file__).parent / "migrations"

class Migrator:
    @staticmethod
    async def run():
        """Applies pending migrations using PRAGMA user_version."""
        db_path = settings.DB_PATH
        
        # Ensure migration directory exists
        if not MIGRATIONS_DIR.exists():
            log.warning(f"Migration directory not found: {MIGRATIONS_DIR}")
            return

        async with aiosqlite.connect(db_path) as db:
            # 1. Get Current Version
            async with db.execute("PRAGMA user_version") as cursor:
                row = await cursor.fetchone()
                current_ver = row[0]
            
            log.info(f"DB Current Version: {current_ver}")

            # 2. Get Scripts
            files = sorted([f for f in os.listdir(MIGRATIONS_DIR) if f.endswith(".sql")])
            
            applied_count = 0
            
            for file_name in files:
                try:
                    # Filename format: 001_name.sql
                    version_str = file_name.split("_")[0]
                    script_ver = int(version_str)
                    
                    if script_ver > current_ver:
                        log.info(f"Applying Migration {script_ver}: {file_name}")
                        
                        file_path = MIGRATIONS_DIR / file_name
                        with open(file_path, "r", encoding="utf-8") as f:
                            sql = f.read()
                            
                        # Apply Script
                        await db.executescript(sql)
                        
                        # Update Version
                        await db.execute(f"PRAGMA user_version = {script_ver}")
                        
                        # (Optional) Log to history table if it exists (from 002 onwards)
                        try:
                            await db.execute(
                                "INSERT INTO schema_history (version, script_name) VALUES (?, ?)",
                                (script_ver, file_name)
                            )
                        except aiosqlite.OperationalError:
                            pass # Table might not exist yet (e.g. during 001)

                        await db.commit()
                        current_ver = script_ver
                        applied_count += 1
                        
                except Exception as e:
                    log.critical(f"Migration Failed at {file_name}: {e}")
                    raise e
            
            if applied_count > 0:
                log.success(f"Migrations Complete. New Version: {current_ver}")
            else:
                log.info("Database is up to date.")
