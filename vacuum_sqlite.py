import sqlite3
import os

def clean_db(db_path):
    print(f"Size before: {os.path.getsize(db_path) / (1024*1024):.2f} MB")
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Delete large payloads
    print("Deleting UNIVERSE_SNAPSHOT events...")
    cursor.execute("DELETE FROM audit_events WHERE type='UNIVERSE_SNAPSHOT'")
    conn.commit()
    
    # Vacuum
    print("Vacuuming database to reclaim space...")
    conn.execute("VACUUM")
    conn.commit()
    
    conn.close()
    print(f"Size after: {os.path.getsize(db_path) / (1024*1024):.2f} MB")

if __name__ == '__main__':
    clean_db('rl_trader_v3.db')
