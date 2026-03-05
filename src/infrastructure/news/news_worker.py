import asyncio
import json
import logging
import aiohttp
from datetime import datetime, timedelta
from typing import Dict, List, Optional
import os

log = logging.getLogger("NewsWorker")

class NewsEvent:
    def __init__(self, title: str, currency: str, impact: str, start_time: datetime, date_str: str):
        self.title = title
        self.currency = currency
        self.impact = impact # "High", "Holiday"
        self.start_time = start_time
        self.date_str = date_str # "MM-DD-YYYY"
        
class NewsWorker:
    """
    Subsystem: News Action Shield
    Responsibility: Fetches ForexFactory JSON feed, catalogs High-Impact events and Bank Holidays. 
    Provides a quick lookup for AssetSelectionService to Freeze assets dynamically.
    """
    
    def __init__(self):
        self.is_running = False
        self.update_interval_sec = 3600 # 1 hour cache
        self.events_cache: List[NewsEvent] = []
        self.last_fetch: Optional[datetime] = None
        self.cache_file = "news_cache.json"

    async def start(self):
        self.is_running = True
        log.info("NewsWorker started.")
        self._load_local_cache()
        asyncio.create_task(self._worker_loop())

    async def stop(self):
        self.is_running = False
        log.info("NewsWorker stopped.")

    async def _worker_loop(self):
        while self.is_running:
            try:
                await self.fetch_calendar()
            except Exception as e:
                log.error(f"NewsWorker Error: {e}")
            await asyncio.sleep(self.update_interval_sec)

    async def fetch_calendar(self):
        """Fetches from ForexFactory's free weekly JSON feed."""
        url = "https://nfs.faireconomy.media/ff_calendar_thisweek.json"
        log.debug("Fetching ForexFactory Calendar...")
        
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(url, timeout=10) as response:
                    if response.status == 200:
                        data = await response.json()
                        self._parse_events(data)
                        self.last_fetch = datetime.utcnow()
                        self._save_local_cache(data)
                        log.info(f"NewsWorker: Cached {len(self.events_cache)} High-Impact/Holiday events.")
                    else:
                        log.warning(f"NewsWorker: Failed to fetch calendar HTTP {response.status}")
        except Exception as e:
            log.error(f"NewsWorker Exception fetching calendar: {e}")

    def _parse_events(self, data: List[dict]):
        self.events_cache = []
        
        for item in data:
            impact = item.get("impact", "")
            # We ONLY care about High impact (Red Folders) or Holidays
            if impact not in ["High", "Holiday"]:
                continue
                
            currency = item.get("country", "")
            title = item.get("title", "")
            date_str = item.get("date", "") # usually "2023-10-25T08:30:00-04:00"
            
            try:
                # ForexFactory JSON provides ISO format datetime with offset
                dt_obj = datetime.fromisoformat(date_str)
                # Convert to naive UTC
                utc_dt = dt_obj.astimezone(tz=None).replace(tzinfo=None)
                
                # Standard Python handles ISO 8601 with timezone correctly. 
                # Doing purely this guarantees a solid UTC time reference:
                from datetime import timezone
                utc_dt = dt_obj.astimezone(timezone.utc).replace(tzinfo=None)

                self.events_cache.append(NewsEvent(
                    title=title,
                    currency=currency,
                    impact=impact,
                    start_time=utc_dt,
                    date_str=utc_dt.strftime("%Y-%m-%d")
                ))
            except Exception as e:
                log.debug(f"Error parsing news date: {date_str} - {e}")
                
    def _save_local_cache(self, raw_data):
        try:
           with open(self.cache_file, "w") as f:
               json.dump(raw_data, f)
        except Exception as e:
           log.error(f"NewsWorker: Could not save cache: {e}")

    def _load_local_cache(self):
        if os.path.exists(self.cache_file):
            try:
                with open(self.cache_file, "r") as f:
                    data = json.load(f)
                    self._parse_events(data)
                    log.info(f"NewsWorker: Loaded {len(self.events_cache)} events from local cache.")
            except Exception:
                pass

    def get_todays_threats(self) -> List[dict]:
        """Provides a UI friendly list of today's threats."""
        now = datetime.utcnow()
        today_str = now.strftime("%Y-%m-%d")
        
        threats = []
        for ev in self.events_cache:
            if ev.date_str == today_str:
                threats.append({
                    "title": ev.title,
                    "currency": ev.currency,
                    "impact": ev.impact,
                    "time_utc": ev.start_time.isoformat() + "Z"
                })
        
        # Sort chronologically
        threats.sort(key=lambda x: x["time_utc"])
        return threats

    def is_symbol_frozen(self, symbol: str) -> tuple[bool, str, str]:
        """
        Called by AssetSelectionService continuously.
        Returns: (is_frozen, reason_code, message)
        """
        if not self.events_cache:
            return False, "OK", ""
            
        now = datetime.utcnow()
        
        sym_upper = symbol.upper()
        # Macro mapping for Indices and Commodities to their base currencies
        macro_map = {
            "US30": "USD", "NAS": "USD", "SPX": "USD",
            "WIN": "BRL", "WDO": "BRL", 
            "UK100": "GBP", "GER40": "EUR", "FRA40": "EUR",
            "XAU": "USD", "XAG": "USD", "GOLD": "USD", "SILVER": "USD",
            "BTC": "USD", "ETH": "USD" # Crypto also heavily influenced by USD macro
        }
        
        # Determine the effective currencies for the symbol
        effective_currencies = []
        for sym_fragment, base_currency in macro_map.items():
            if sym_fragment in sym_upper:
                effective_currencies.append(base_currency)
                
        for ev in self.events_cache:
            currency = ev.currency.upper()
            
            # Check if news currency is either in the symbol name directly, or matches a mapped macro currency
            affects_symbol = (currency in sym_upper) or (currency in effective_currencies)
            
            if not affects_symbol:
                continue
                
            # If it's a Bank Holiday today, the currency is dead all day.
            if ev.impact == "Holiday":
                if ev.date_str == now.strftime("%Y-%m-%d"):
                    return True, "HOLIDAY_STANDBY", f"{currency} Bank Holiday: {ev.title}"
                continue
                
            # For High Impact (Red Folders), we freeze it between [T-30 mins to T+60 mins]
            if ev.impact == "High":
                time_diff = (ev.start_time - now).total_seconds() / 60.0
                
                # Is it between 30 minutes before and 60 minutes after?
                if -60 <= time_diff <= 30:
                    return True, "FROZEN_BY_NEWS", f"{currency} High Impact Event: {ev.title} in {int(time_diff)} mins"
                    
        return False, "OK", ""

# Singleton
news_worker = NewsWorker()
