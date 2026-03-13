import asyncio
import websockets
import json

async def listen():
    uri = "ws://localhost:8001/ws"
    print(f"Connecting to {uri}...")
    try:
        async with websockets.connect(uri) as websocket:
            print("Connected! Waiting for messages for 10 seconds...")
            
            # Listen for up to 10 seconds
            end_time = asyncio.get_event_loop().time() + 10.0
            
            while True:
                time_left = end_time - asyncio.get_event_loop().time()
                if time_left <= 0:
                    break
                    
                try:
                    msg = await asyncio.wait_for(websocket.recv(), timeout=time_left)
                    print(f"Received raw: {msg[:200]}...")
                    data = json.loads(msg)
                    print(f" -> Type: {data.get('type')}")
                except asyncio.TimeoutError:
                    break
                    
            print("Finished listening.")
    except Exception as e:
        print(f"Connection failed: {e}")

if __name__ == "__main__":
    asyncio.run(listen())
