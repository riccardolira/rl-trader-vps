import sqlite3
import json

def migrate():
    sqlite_db_path = '../rl_trader_v3.db'
    output_sql_path = 'migracao_mysql.sql'
    
    conn = sqlite3.connect(sqlite_db_path)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    with open(output_sql_path, 'w', encoding='utf-8') as f:
        f.write("-- Gerado automaticamente para migração do RL Trader V3 para V4\n\n")
        
        # EXPORTING TRADES
        cursor.execute("SELECT * FROM trades")
        trades = cursor.fetchall()
        if trades:
            f.write("INSERT IGNORE INTO trades (ticket, symbol, side, volume, open_price, open_time, sl, tp, close_price, close_time, profit, status, magic, comment, strategy_name, market_context) VALUES\n")
            values = []
            for t in trades:
                ctx = t['market_context'] if t['market_context'] else '{}'
                v = f"({t['ticket']}, '{t['symbol']}', '{t['side']}', {t['volume']}, {t['open_price']}, '{t['open_time']}', {t['sl']}, {t['tp']}, {t['close_price']}, '{t['close_time']}', {t['profit']}, '{t['status']}', {t['magic']}, '{str(t['comment']).replace(\"'\", \"''\")}', '{t['strategy_name']}', '{ctx}')"
                # Handle None values (in sqlite represented as string 'None' or actual None)
                v = v.replace("'None'", "NULL")
                values.append(v)
            f.write(",\n".join(values) + ";\n\n")

        # EXPORTING AUDIT EVENTS
        cursor.execute("SELECT * FROM audit_events")
        audits = cursor.fetchall()
        if audits:
            f.write("INSERT IGNORE INTO audit_events (id, timestamp, type, component, severity, correlation_id, payload_json) VALUES\n")
            values = []
            for a in audits:
                payload = str(a['payload_json']).replace("'", "''")
                v = f"('{a['id']}', '{a['timestamp']}', '{a['type']}', '{a['component']}', '{a['severity']}', '{a['correlation_id']}', '{payload}')"
                v = v.replace("'None'", "NULL")
                values.append(v)
            f.write(",\n".join(values) + ";\n\n")
            
    print(f"✅ Migração concluída! Arquivo {output_sql_path} gerado com sucesso.")

if __name__ == '__main__':
    try:
        migrate()
    except Exception as e:
        print(f"Erro ao exportar banco: {e}")
