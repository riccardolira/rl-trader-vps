import asyncio

async def test_account():
    from src.infrastructure.mt5_adapter import mt5_adapter
    
    connected = await mt5_adapter.connect()
    if not connected:
        print("Failed to connect.")
        return
        
    print("MT5 Connected.")
    
    try:
        from src.infra.mt5.mt5_worker_client import mt5_worker_client
        raw_info = await asyncio.to_thread(mt5_worker_client.send_command, "get_account")
        print("Raw info keys:", list(raw_info.keys()) if raw_info else None)
        
        info = await mt5_adapter.get_account_info()
        print("Account Info parsed successfully:", info)
    except Exception as e:
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_account())
