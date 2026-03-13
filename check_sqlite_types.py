import sqlite3

def check_db(db_path):
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    query = """
    SELECT type, round(avg(length(payload_json))), max(length(payload_json)), count(*) 
    FROM audit_events 
    GROUP BY type 
    ORDER BY sum(length(payload_json)) DESC;
    """
    cursor.execute(query)
    
    print(f"{'Type':<30} | {'Avg Len':<10} | {'Max Len':<10} | {'Count':<10}")
    print("-" * 70)
    for row in cursor.fetchall():
        print(f"{str(row[0]):<30} | {row[1]:<10} | {row[2]:<10} | {row[3]:<10}")
            
    conn.close()

if __name__ == '__main__':
    check_db('rl_trader_v3.db')
