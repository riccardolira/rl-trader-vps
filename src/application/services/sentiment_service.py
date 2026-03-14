"""
SentimentService — Consulta Finnhub News Sentiment por símbolo.

- Cache de 15 minutos por símbolo (free tier: 60 req/min)
- Retorna score bullish/bearish, buzz e headlines recentes
- Graceful degradation: retorna None se API KEY não configurada ou falhar
"""

import asyncio
import aiohttp
from datetime import datetime, timedelta
from typing import Optional, Dict, List, Any
from src.infrastructure.config import settings
from src.infrastructure.logger import log


CACHE_TTL_MINUTES = 15


class SentimentService:
    def __init__(self):
        self._cache: Dict[str, Dict] = {}       # {symbol: {data, fetched_at}}
        self._session: Optional[aiohttp.ClientSession] = None
        self._enabled = bool(getattr(settings, "FINNHUB_API_KEY", ""))

    async def _get_session(self) -> aiohttp.ClientSession:
        if self._session is None or self._session.closed:
            self._session = aiohttp.ClientSession(
                timeout=aiohttp.ClientTimeout(total=8)
            )
        return self._session

    async def stop(self):
        if self._session and not self._session.closed:
            await self._session.close()

    def _is_cached(self, symbol: str) -> bool:
        entry = self._cache.get(symbol)
        if not entry:
            return False
        age = (datetime.utcnow() - entry["fetched_at"]).total_seconds()
        return age < CACHE_TTL_MINUTES * 60

    # ──────────────────────────────────────────────────────────────
    # Normaliza símbolo para o formato Finnhub (remove sufixos .X etc)
    # ──────────────────────────────────────────────────────────────
    @staticmethod
    def _normalize(symbol: str) -> str:
        """EURUSD → não suportado (FX usa OANDA:EUR_USD).
           XAUUSD → OANDA:XAU_USD
           BTCUSD → BINANCE:BTCUSDT
           US30/US500 → ^DJI / ^GSPC (índices)
           Forex padrão 6 chars → OANDA:XXX_YYY
        """
        fx_map = {
            "EURUSD": "OANDA:EUR_USD", "GBPUSD": "OANDA:GBP_USD",
            "USDJPY": "OANDA:USD_JPY", "USDCHF": "OANDA:USD_CHF",
            "AUDUSD": "OANDA:AUD_USD", "NZDUSD": "OANDA:NZD_USD",
            "USDCAD": "OANDA:USD_CAD", "EURGBP": "OANDA:EUR_GBP",
            "XAUUSD": "OANDA:XAU_USD", "XAGUSD": "OANDA:XAG_USD",
            "BTCUSD": "BINANCE:BTCUSDT", "ETHUSD": "BINANCE:ETHUSDT",
            "US30":   "^DJI",  "US500": "^GSPC", "USTEC": "^IXIC",
        }
        if symbol in fx_map:
            return fx_map[symbol]
        # Forex genérico 6 chars
        if len(symbol) == 6 and symbol.isalpha():
            return f"OANDA:{symbol[:3]}_{symbol[3:]}"
        return symbol

    # ──────────────────────────────────────────────────────────────
    # Busca Sentiment Score
    # GET https://finnhub.io/api/v1/news-sentiment?symbol=AAPL&token=...
    # ──────────────────────────────────────────────────────────────
    async def get_sentiment(self, symbol: str) -> Optional[Dict]:
        if not self._enabled:
            return None

        if self._is_cached(symbol):
            return self._cache[symbol]["data"]

        finnhub_symbol = self._normalize(symbol)
        api_key = settings.FINNHUB_API_KEY
        url = f"https://finnhub.io/api/v1/news-sentiment?symbol={finnhub_symbol}&token={api_key}"

        try:
            session = await self._get_session()
            async with session.get(url) as resp:
                if resp.status != 200:
                    log.warning(f"SentimentService: {symbol} → HTTP {resp.status}")
                    return None

                raw = await resp.json()

                # Finnhub pode retornar objeto vazio {} se símbolo não suportado
                if not raw or "buzz" not in raw:
                    return None

                data = {
                    "symbol":           symbol,
                    "finnhub_symbol":   finnhub_symbol,
                    "bullish_pct":      round(raw.get("sentiment", {}).get("bullishPercent", 0) * 100, 1),
                    "bearish_pct":      round(raw.get("sentiment", {}).get("bearishPercent", 0) * 100, 1),
                    "buzz_score":       round(raw.get("buzz", {}).get("buzz", 0), 3),
                    "articles_total":   raw.get("buzz", {}).get("articlesInLastWeek", 0),
                    "sector_avg_buzz":  round(raw.get("buzz", {}).get("weeklyAverage", 0), 3),
                    "score":            round(raw.get("companyNewsScore", 0), 3),
                    "sector_bullish":   round(raw.get("sectorAverageBullishPercent", 0) * 100, 1),
                    "label":            self._label(raw),
                    "fetched_at":       datetime.utcnow().isoformat(),
                }

                self._cache[symbol] = {"data": data, "fetched_at": datetime.utcnow()}
                log.info(f"SentimentService: {symbol} → {data['label']} (bull:{data['bullish_pct']}%)")
                return data

        except asyncio.TimeoutError:
            log.warning(f"SentimentService: Timeout para {symbol}")
            return None
        except Exception as e:
            log.error(f"SentimentService: Erro para {symbol}: {e}")
            return None

    @staticmethod
    def _label(raw: Dict) -> str:
        bull = raw.get("sentiment", {}).get("bullishPercent", 0.5)
        if bull >= 0.65:
            return "BULLISH"
        elif bull <= 0.35:
            return "BEARISH"
        return "NEUTRAL"

    # ──────────────────────────────────────────────────────────────
    # Batch: busca múltiplos símbolos com delay para não estourar rate
    # ──────────────────────────────────────────────────────────────
    async def get_batch(self, symbols: List[str], delay_ms: int = 300) -> Dict[str, Any]:
        results = {}
        for sym in symbols:
            result = await self.get_sentiment(sym)
            if result:
                results[sym] = result
            await asyncio.sleep(delay_ms / 1000)
        return results

    def get_cached(self) -> Dict[str, Any]:
        """Retorna todo o cache atual (para o dashboard)."""
        return {sym: v["data"] for sym, v in self._cache.items() if self._is_cached(sym)}


# Singleton
sentiment_service = SentimentService()
