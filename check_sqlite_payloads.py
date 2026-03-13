import sqlite3

def check_db(db_path):
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    cursor.execute("SELECT sum(length(payload_json)) FROM audit_events")
    total_size = cursor.fetchone()[0]
    print(f"Total size of payload_json in bytes: {total_size}")
    
    cursor.execute("SELECT payload_json FROM audit_events LIMIT 1")
    sample = cursor.fetchone()[0]
    if sample:
        print(f"Sample payload length: {len(sample)}")
        print(f"Sample payload: {sample[:1000]}")
            
    conn.close()

if __name__ == '__main__':
    check_db('rl_trader_v3.db')
