import pandas as pd
import numpy as np
from typing import Dict, Any, List, Optional
import asyncio
from datetime import datetime

from src.infrastructure.logger import log
from src.infrastructure.mt5_adapter import mt5_adapter
from src.domain.strategy import MarketContext, RegimeType, AnalysisSide

from src.domain.regime import RegimeComputer

class MarketDataService:
    """
    Subsystem: Market Data Service (MDS)
    Responsibility: Fetch OHLC from MT5, Compute Indicators, Maintain Regime State.
    """

    def __init__(self):
        self.timeframe = "H1" # Default MVP timeframe
        self.MT5_TF_H1 = 16385 
        # State: Symbol -> RegimeType
        self._regime_state: Dict[str, RegimeType] = {}
        self._point_cache: Dict[str, float] = {}
        self._close_cache: Dict[str, tuple[datetime, List[float]]] = {}

    async def get_context(self, symbol: str, minimal: bool = False) -> Optional[MarketContext]:
        """
        Fetches data and builds MarketContext for a symbol.
        """
        try:
            # 0. Get Point Value (Cached)
            point = self._point_cache.get(symbol)
            if point is None:
                info = await asyncio.to_thread(mt5_adapter.mt5_worker_client.send_command, "get_symbol_info", args=[symbol])
                if info:
                    point = info.get("point")
                    tick_value = info.get("trade_tick_value")
                    self._point_cache[symbol] = (point, tick_value)
                else:
                    log.warning(f"MarketDataService: Could not fetch symbol info for {symbol}. Defaulting point=0.00001")
                    point = 0.00001
                    tick_value = 0.0
            else:
                 point, tick_value = point # Unpack tuple
            
            # 1. Fetch History (Last 200 bars, min 100 for Squeeze calculation)
            rates = await asyncio.to_thread(
                mt5_adapter.mt5_worker_client.send_command,
                "get_history", 
                args=[symbol, self.MT5_TF_H1, 0, 100 if minimal else 200] 
            )
            
            if not rates:
                log.error(f"MarketDataService: Failed to fetch history for {symbol}")
                return None
                
            if len(rates) < 50:
                 log.warning(f"MarketDataService: Not enough data for {symbol} ({len(rates)} bars)")
                 return None

            # 2. Build DataFrame and Cache Closes
            closes = [r[4] for r in rates]
            self._close_cache[symbol] = (datetime.utcnow(), closes)
            
            df = pd.DataFrame(rates, columns=['time', 'open', 'high', 'low', 'close', 'tick_volume', 'spread', 'real_volume'])
            df['time'] = pd.to_datetime(df['time'], unit='s')
            
            # 3. Calculate Indicators
            indicators = self._calculate_indicators(df)
            
            # --- New: MTF (D1) ---
            mtf_trend = AnalysisSide.NEUTRAL
            if not minimal:
                try:
                    # MT5 D1 = 16408
                    rates_d1 = await asyncio.to_thread(
                        mt5_adapter.mt5_worker_client.send_command,
                        "get_history", 
                        args=[symbol, 16408, 0, 250] 
                    )
                    if rates_d1:
                        if len(rates_d1) > 200:
                            df_d1 = pd.DataFrame(rates_d1, columns=['time', 'open', 'high', 'low', 'close', 'tick_volume', 'spread', 'real_volume'])
                            # EMA 200
                            ema_200_d1 = df_d1['close'].ewm(span=200, adjust=False).mean().iloc[-1]
                            last_close_d1 = df_d1['close'].iloc[-1]
                            
                            if last_close_d1 > ema_200_d1:
                                mtf_trend = AnalysisSide.BUY
                            else:
                                mtf_trend = AnalysisSide.SELL
                            
                            indicators['d1_ema_200'] = float(ema_200_d1)
                except Exception as e:
                    log.warning(f"MarketDataService: Failed to fetch D1 for {symbol}: {e}")

            # 4. Determine Regime (Stateful Hysteresis)
            adx = indicators.get('adx_14', 0.0)
            
            # Get previous state (Default to NEUTRAL if first run)
            prev_regime = self._regime_state.get(symbol, RegimeType.NEUTRAL)
            
            # Compute new state
            current_regime = RegimeComputer.compute_regime(adx, prev_regime)
            
            # Update State
            if current_regime != prev_regime:
                log.info(f"MarketDataService: Regime Change for {symbol}: {prev_regime} -> {current_regime} (ADX={adx:.1f})")
                self._regime_state[symbol] = current_regime
            
            # 5. Extract Context Values
            last_close = df['close'].iloc[-1]
            last_spread_points = df['spread'].iloc[-1] 
            atr = indicators.get('atr_14', 0.0)

            return MarketContext(
                symbol=symbol,
                timeframe=self.timeframe,
                regime=current_regime,
                adx_value=adx,
                atr_value=atr,
                spread=float(last_spread_points),
                point_value=float(point),
                tick_value=float(tick_value) if tick_value else 0.0,
                price_close=last_close,
                indicators=indicators,
                mtf_trend=mtf_trend,
                metadata={
                    "opens": df['open'].to_numpy(),
                    "highs": df['high'].to_numpy(),
                    "lows": df['low'].to_numpy(),
                    "closes": df['close'].to_numpy(),
                }
            )

        except Exception as e:
            log.error(f"MarketDataService: Error processing {symbol}: {e}")
            return None

    async def get_close_prices(self, symbol: str, limit: int = 50) -> Optional[List[float]]:
        """
        Fast fetch of recent close prices for correlation matrix building (Anti-Cloner Shield).
        Caches results briefly to avoid double-fetching if called right after get_context.
        """
        # Check cache first
        if symbol in self._close_cache:
            cache_time, cached_closes = self._close_cache[symbol]
            if (datetime.utcnow() - cache_time).total_seconds() < 10:
                if len(cached_closes) >= limit:
                    return cached_closes[-limit:]
                
        try:
            rates = await asyncio.to_thread(
                mt5_adapter.mt5_worker_client.send_command,
                "get_history", 
                args=[symbol, self.MT5_TF_H1, 0, limit] 
            )
            if not rates or len(rates) < (limit // 2):
                return None
            
            # rate is tuple/dict depending on mt5. copy close prices
            # MQL5 tuple generally: (time, open, high, low, close, tick_vol, spread, real_vol)
            closes = [r[4] for r in rates]
            return closes
        except Exception as e:
            log.warning(f"MarketDataService: Failed to get close prices for {symbol}: {e}")
            return None

    def _calculate_indicators(self, df: pd.DataFrame) -> Dict[str, float]:
        """Calculates SMA20, RSI14, ATR14, ADX14 manually."""
        closes = df['close']
        highs = df['high']
        lows = df['low']
        
        # SMA 20
        sma_20 = closes.rolling(window=20).mean().iloc[-1]
        
        # RSI 14
        delta = closes.diff()
        gain = (delta.where(delta > 0, 0)).rolling(window=14).mean()
        loss = (-delta.where(delta < 0, 0)).rolling(window=14).mean()
        rs = gain / loss
        rsi_14 = 100 - (100 / (1 + rs)).iloc[-1]
        
        # ATR 14
        tr1 = highs - lows
        tr2 = (highs - closes.shift()).abs()
        tr3 = (lows - closes.shift()).abs()
        tr = pd.concat([tr1, tr2, tr3], axis=1).max(axis=1)
        atr_14 = tr.rolling(window=14).mean().iloc[-1]
        
        # ADX 14 (Simplified Wilder's)
        up = highs - highs.shift()
        down = lows.shift() - lows
        plus_dm = np.where((up > down) & (up > 0), up, 0.0)
        minus_dm = np.where((down > up) & (down > 0), down, 0.0)
        
        tr_smooth = tr.ewm(alpha=1/14, adjust=False).mean()
        plus_di = 100 * (pd.Series(plus_dm).ewm(alpha=1/14, adjust=False).mean() / tr_smooth)
        minus_di = 100 * (pd.Series(minus_dm).ewm(alpha=1/14, adjust=False).mean() / tr_smooth)
        
        dx = 100 * (abs(plus_di - minus_di) / (plus_di + minus_di))
        adx_14 = dx.ewm(alpha=1/14, adjust=False).mean().iloc[-1]
        
        # Bollinger Bands (20, 2)
        std_20 = closes.rolling(window=20).std().iloc[-1]
        bb_upper = sma_20 + (2 * std_20)
        bb_lower = sma_20 - (2 * std_20)
        bb_width = bb_upper - bb_lower
        bb_pct_b = (closes.iloc[-1] - bb_lower) / (bb_upper - bb_lower) if (bb_upper - bb_lower) != 0 else 0.5
        
        # Squeeze Metric: Bandwidth Percentile (Last 100 bars)
        # Compute historical bandwidths for percentile
        rolling_std = closes.rolling(window=20).std()
        rolling_width = (4 * rolling_std) # Upper - Lower = (MA+2std) - (MA-2std) = 4std
        # Current bandwidth percentile (0-100) compared to last 50 bars
        recent_widths = rolling_width.iloc[-50:]
        current_width = rolling_width.iloc[-1]
        # Percentile Rank
        squeeze_pct = (recent_widths < current_width).mean() * 100.0
        # If current_width is the lowest, it's 0%. If highest, 100%.
        
        # Volume Flow Metrics (For Order Flow Strategy)
        tick_vol = df['tick_volume']
        # Use simple moving average of volume over 20 periods
        vma_20 = tick_vol.rolling(window=20).mean().iloc[-1]
        current_vol = tick_vol.iloc[-1]
        # Ratio: How many times greater is current volume vs average
        vol_spike_ratio = (current_vol / vma_20) if vma_20 > 0 else 0.0
        
        return {
            "sma_20": float(sma_20),
            "rsi_14": float(rsi_14),
            "atr_14": float(atr_14),
            "adx_14": float(adx_14),
            "bb_upper": float(bb_upper),
            "bb_lower": float(bb_lower),
            "bb_width": float(bb_width),
            "bb_pct_b": float(bb_pct_b),
            "squeeze_pct": float(squeeze_pct), # Low value implies Squeeze
            "tick_volume": float(current_vol),
            "vma_20": float(vma_20),
            "vol_spike_ratio": float(vol_spike_ratio)
        }

market_data_service = MarketDataService()
