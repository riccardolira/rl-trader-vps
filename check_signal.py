import sqlite3
import json

conn = sqlite3.connect('rl_trader_v3.db')
c = conn.cursor()
c.execute("SELECT payload_json FROM audit_events WHERE type='SIGNAL_GENERATED' ORDER BY timestamp DESC LIMIT 1;")
row = c.fetchone()
if row:
    print(json.dumps(json.loads(row[0]), indent=2))
else:
    print("No signals found.")
conn.close()
