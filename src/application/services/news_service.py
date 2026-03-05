import asyncio
from datetime import datetime, timedelta
from typing import List, Dict, Optional, Any
from src.infrastructure.logger import log
from src.infrastructure.config import settings
from src.infrastructure.mt5_adapter import mt5_adapter
from src.infrastructure.event_bus import event_bus

class NewsService:
    """
    Subsystem: News Service (Phase 3)
    Responsibility: 
    1. Fetch Economic Calendar from MT5.
    2. Identify High Impact events for mapped currencies.
    3. Maintain 'Blackout Windows' where trading is halted.
    """
    
    def __init__(self):
        self.running = False
        self.events_cache: List[Dict] = []
        self.last_fetch: datetime  = datetime.min
        self.blackout_windows: List[Dict] = [] # {start, end, currency, title}
        
        # impact_level: 0 (Low), 1 (Medium), 2 (High). Some brokers use 1-3. 
        # MT5 usually uses enum: CALENDAR_IMPORTANCE_HIGH = 3.
        # Let's start with assumption 3 is High. 
        # Or better yet, we can filter by 'importance' field if available.
        # MT5 Calendar event struct: {id, type, time, currency, importance...}
        self.min_importance = 3 # High Impact only for now
        
        # Mapping: Symbol -> Base/Quote currencies
        # TODO: Move this to a proper SymbolInfo service or Config
        self.currency_map = {
            "EURUSD": ["EUR", "USD"],
            "GBPUSD": ["GBP", "USD"],
            "USDJPY": ["USD", "JPY"],
            "XAUUSD": ["USD"], # Gold logic often tied to USD
            "BTCUSD": ["USD"],
            "US30":   ["USD"],
            "US500":  ["USD"]
        }
        
        self.points_before = 15 # Minutes
        self.points_after = 15  # Minutes

    async def start(self):
        self.running = True
        log.info("NewsService started (Phase 3).")
        asyncio.create_task(self._maintenance_loop())

    async def stop(self):
        self.running = False
        log.info("NewsService stopped.")

    def should_halt_trading(self, symbol: str) -> Optional[str]:
        """
        Checks if symbol is currently in a blackout window.
        Returns Reason string if halted, None if safe.
        """
        if not self.running:
            return None # Fail-open if service is dead? Safe-fail would be block? 
                        # Fail-open is better for uptime, but risky. 
                        # Let's Assume Open if not running to avoid stuck system.
        
        now = datetime.utcnow() # MT5 events are usually UTC or Server Time.
        # Need to align timezones! 
        # MT5 'get_server_time' usage is best.
        # For MVP, let's assume we sync'd via `mt5_adapter.get_server_time()` recently?
        # Actually, let's just use UTC and hope broker is UTC or we handle offset.
        # TODO: Sync Timezone in Phase 3.1. 
        # For now, we assume standard UTC events.
        
        affected_currencies = self.currency_map.get(symbol, [])
        
        # Smart Parse if not in map (Standard Forex 6 chars)
        if not affected_currencies and len(symbol) == 6:
            base = symbol[:3]
            quote = symbol[3:]
            affected_currencies = [base, quote]
            
        # If still empty, maybe it's an index or crypto not in map. 
        # Safe default: Empty (Don't block unless we know)
        # Or: ["USD"] if we are paranoid. 
        # Decision: Default to Empty to avoid False Positives on arbitrary symbols.

        
        for window in self.blackout_windows:
            if window['currency'] in affected_currencies:
                if window['start'] <= now <= window['end']:
                    return f"NEWS_BLACKOUT: {window['title']} ({window['currency']})"
                    
        return None

    async def _maintenance_loop(self):
        while self.running:
            try:
                # Fetch calendar once per hour? Or per 30 mins.
                if (datetime.utcnow() - self.last_fetch).total_seconds() > 1800: # 30 mins
                    await self.refresh_calendar()
                
                # Prune old windows
                self._prune_windows()
                
            except Exception as e:
                log.error(f"NewsService: Loop Error: {e}")
                
            await asyncio.sleep(60) # Check every minute

    async def refresh_calendar(self):
        """Fetches events for Today."""
        now = datetime.utcnow()
        start = now - timedelta(hours=1)
        end = now + timedelta(hours=24)
        
        try:
            # We need timestamp for MT5
            # Assuming mt5_adapter adds logic or we pass ints
            # Wrapper modified in step 92 takes timestamps? No, wait. 
            # `datetime.fromtimestamp(start_ts)` is inside worker. 
            # So client must send timestamps (floats/ints).
            
            res_data = mt5_adapter.mt5_worker_client.send_command(
                "get_calendar_events", 
                args=[start.timestamp(), end.timestamp()]
            )
            
            if res_data:
                self.events_cache = res_data
                self.last_fetch = now
                self._build_windows()
                log.info(f"NewsService: Refreshed Calendar. Found {len(self.events_cache)} events.")
            else:
                 log.warning("NewsService: Failed to fetch calendar (Empty or Error).")
                 
        except Exception as e:
            log.error(f"NewsService: Refresh Failed: {e}")

    def _build_windows(self):
        """Converts raw events into blackout windows."""
        self.blackout_windows = []
        now = datetime.utcnow()
        
        for event in self.events_cache:
            # Struct: {time: int(ts), importance: int, currency: str, ...}
            importance = event.get('importance', 0)
            
            if importance >= self.min_importance:
                evt_time = datetime.utcfromtimestamp(event.get('time'))
                
                # Check if event is relevant (not in past beyond buffer)
                # If event was 2 hours ago, we don't care.
                
                start_window = evt_time - timedelta(minutes=self.points_before)
                end_window = evt_time + timedelta(minutes=self.points_after)
                
                if end_window > now: # Only future/current windows
                    self.blackout_windows.append({
                        "start": start_window,
                        "end": end_window,
                        "currency": event.get('currency'),
                        "title": event.get('event', 'Unknown Event') # 'event' or 'name'? Check MT5 dict
                    })
        
        if self.blackout_windows:
            log.info(f"NewsService: Built {len(self.blackout_windows)} Blackout Windows.")

    def _prune_windows(self):
        now = datetime.utcnow()
        self.blackout_windows = [w for w in self.blackout_windows if w['end'] > now]

    def get_state(self) -> Dict:
        return {
            "running": self.running,
            "cache_size": len(self.events_cache),
            "active_windows": len(self.blackout_windows),
            "next_window": self.blackout_windows[0] if self.blackout_windows else None
        }

# Singleton
news_service = NewsService()
