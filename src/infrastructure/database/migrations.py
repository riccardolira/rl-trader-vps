import aiosqlite
import os
from pathlib import Path
from src.infrastructure.config import settings
from src.infrastructure.logger import log

MIGRATIONS_DIR = Path(__file__).parent / "sql"

class MigrationService:
    @staticmethod
    async def run():
        """Runs pending migrations on the SQLite database."""
        db_path = settings.DB_PATH
        log.info(f"Checking migrations for DB: {db_path}...")

        async with aiosqlite.connect(db_path) as db:
            # 1. Get current version
            async with db.execute("PRAGMA user_version") as cursor:
                row = await cursor.fetchone()
                current_version = row[0] if row else 0

            log.info(f"Current DB Version: {current_version}")

            # 2. List migration files
            migration_files = sorted(
                [f for f in os.listdir(MIGRATIONS_DIR) if f.endswith(".sql")]
            )

            # 3. Apply pending migrations
            for filename in migration_files:
                try:
                    version = int(filename.split("_")[0])
                    if version > current_version:
                        log.info(f"Applying migration: {filename}")
                        
                        file_path = MIGRATIONS_DIR / filename
                        with open(file_path, "r", encoding="utf-8") as f:
                            script = f.read()

                        await db.executescript(script)
                        
                        # Update version
                        await db.execute(f"PRAGMA user_version = {version}")
                        await db.commit()
                        
                        current_version = version
                        log.success(f"Successfully applied {filename}. New DB Version: {current_version}")

                except ValueError:
                    log.warning(f"Skipping invalid migration file: {filename}")
                except Exception as e:
                    log.critical(f"Migration Failed for {filename}: {e}")
                    raise e
                    
        log.info("Migration Check Complete.")
