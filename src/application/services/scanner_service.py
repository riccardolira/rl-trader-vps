import asyncio
import random
from src.domain.models import Signal, OrderSide
from src.domain.events import SignalGenerated
from src.infrastructure.event_bus import event_bus
from src.infrastructure.logger import log
# Imported Guard
from src.services.health.time_skew_guard import time_skew_guard

class ScannerService:
    def __init__(self):
        self.running = False
        self.scan_interval = 10 
        self.symbols = ["EURUSD", "GBPUSD", "XAUUSD", "BTCUSD"]

    async def start(self):
        self.running = True
        log.info("ScannerService started.")
        # Ensure TimeSkewGuard is running (Engine starts it, but we check status)
        asyncio.create_task(self._scan_loop())

    async def stop(self):
        self.running = False
        log.info("ScannerService stopped.")

    async def _scan_loop(self):
        while self.running:
            try:
                # 1. Time Sync Guard Check
                if time_skew_guard.status == "ALERT":
                    log.warning("Scanner: Pausing scan due to Time Skew Alert.")
                    await asyncio.sleep(5)
                    continue

                # 2. Mock Scan Logic
                log.debug("Scanner: Scanning universe...")
                
                if random.random() < 0.3: 
                    symbol = random.choice(self.symbols)
                    direction = random.choice([OrderSide.BUY, OrderSide.SELL])
                    score = random.uniform(50.0, 95.0)
                    
                    signal = Signal(
                        symbol=symbol,
                        direction=direction,
                        score=round(score, 2),
                        strategy_name="TrendFollowing_V3_Mock"
                    )
                    
                    await event_bus.publish(SignalGenerated(signal=signal))
                    log.info(f"Scanner found opportunity: {symbol} {direction} (Score: {score:.1f})")

            except Exception as e:
                log.error(f"Error in Scanner Loop: {e}")

            await asyncio.sleep(self.scan_interval)

scanner_service = ScannerService()
