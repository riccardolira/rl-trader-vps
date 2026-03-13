import pymysql
import os
import socket
from dotenv import load_dotenv

def main():
    load_dotenv()
    
    host = os.getenv('DB_HOST')
    try:
        ipv4_host = socket.gethostbyname(host)
        print(f"Resolved {host} to {ipv4_host}")
    except Exception as e:
        print(f"DNS Resolution failed: {e}")
        ipv4_host = host
    
    connection = pymysql.connect(
        host=ipv4_host,
        user=os.getenv('DB_USER'),
        password=os.getenv('DB_PASSWORD'),
        database=os.getenv('DB_NAME')
    )
    
    with connection.cursor() as cursor:
        cursor.execute("""
            SELECT 
                table_name AS 'Table',
                round(((data_length + index_length) / 1024 / 1024), 2) AS 'Size (MB)'
            FROM information_schema.TABLES
            WHERE table_schema = %s
            ORDER BY (data_length + index_length) DESC;
        """, (os.getenv('DB_NAME'),))
        
        total_size = 0
        print(f"{'Table Name':<30} | {'Size (MB)':>10}")
        print("-" * 45)
        for row in cursor.fetchall():
            size_mb = float(row[1])
            total_size += size_mb
            print(f"{row[0]:<30} | {size_mb:>10.2f}")
        print("-" * 45)
        print(f"{'Total':<30} | {total_size:>10.2f}")
            
if __name__ == '__main__':
    main()
