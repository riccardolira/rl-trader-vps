import sqlite3

def check_db(db_path):
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
    tables = cursor.fetchall()
    
    print(f"Stats for {db_path}:")
    for table_tuple in tables:
        table_name = table_tuple[0]
        try:
            cursor.execute(f"SELECT COUNT(*) FROM {table_name}")
            count = cursor.fetchone()[0]
            print(f"Table '{table_name}': {count} rows")
        except Exception as e:
            print(f"Error reading {table_name}: {e}")
            
    conn.close()

if __name__ == '__main__':
    check_db('rl_trader_v3.db')
