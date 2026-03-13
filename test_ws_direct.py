import asyncio
import websockets

async def test_ws():
    uri = "wss://api.clickandoffers.com/ws"
    print(f"Connecting to {uri}...")
    try:
        async with websockets.connect(uri) as websocket:
            print("Connected! Waiting for 3 seconds of messages...")
            for _ in range(5):
                try:
                    msg = await asyncio.wait_for(websocket.recv(), timeout=3.0)
                    print(f"Received: {msg[:100]}...")
                except asyncio.TimeoutError:
                    print("Timeout waiting for message.")
                    break
    except Exception as e:
        print(f"Connection failed: {e}")

if __name__ == "__main__":
    asyncio.run(test_ws())
