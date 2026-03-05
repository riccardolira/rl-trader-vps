import numpy as np
import pandas as pd
from typing import List, Dict, Tuple, Optional
from enum import Enum

class StructureType(str, Enum):
    BULLISH = "BULLISH"
    BEARISH = "BEARISH"
    NEUTRAL = "NEUTRAL"

class SmcMath:
    """
    Utility module for Smart Money Concepts mathematical detection.
    Operates on pandas DataFrames or numpy arrays of OHLC data.
    """

    @staticmethod
    def find_swing_points(highs: pd.Series, lows: pd.Series, length: int = 5) -> Tuple[List[Dict], List[Dict]]:
        """
        Detects Swing Highs and Swing Lows based on a lookback and lookforward length.
        A Swing High is the highest high within 'length' bars before and after.
        Returns two lists of dicts: [{'index': int, 'price': float}, ...]
        """
        swing_highs = []
        swing_lows = []
        
        n = len(highs)
        for i in range(length, n - length):
            is_swing_high = True
            is_swing_low = True
            
            # Check for swing high
            for j in range(1, length + 1):
                if highs.iloc[i] <= highs.iloc[i - j] or highs.iloc[i] <= highs.iloc[i + j]:
                    is_swing_high = False
                    break
                    
            if is_swing_high:
                swing_highs.append({'index': int(highs.index[i] if isinstance(highs.index[i], (int, np.integer)) else i), 'price': float(highs.iloc[i])})
                
            # Check for swing low
            for j in range(1, length + 1):
                if lows.iloc[i] >= lows.iloc[i - j] or lows.iloc[i] >= lows.iloc[i + j]:
                    is_swing_low = False
                    break
                    
            if is_swing_low:
                swing_lows.append({'index': int(lows.index[i] if isinstance(lows.index[i], (int, np.integer)) else i), 'price': float(lows.iloc[i])})
                
        return swing_highs, swing_lows

    @staticmethod
    def detect_structure(swing_highs: List[Dict], swing_lows: List[Dict], current_price: float) -> StructureType:
        """
        Determines market structure based on sequence of higher highs/lows or lower highs/lows.
        Very basic implementation: Looks at the last 2 highs and last 2 lows.
        """
        if len(swing_highs) < 2 or len(swing_lows) < 2:
            return StructureType.NEUTRAL

        last_high = swing_highs[-1]['price']
        prev_high = swing_highs[-2]['price']
        
        last_low = swing_lows[-1]['price']
        prev_low = swing_lows[-2]['price']
        
        # Bullish: Higher Highs and Higher Lows
        if last_high > prev_high and last_low > prev_low:
             return StructureType.BULLISH
             
        # Bearish: Lower Highs and Lower Lows
        if last_high < prev_high and last_low < prev_low:
             return StructureType.BEARISH
             
        return StructureType.NEUTRAL

    @staticmethod
    def find_fvgs(opens: pd.Series, highs: pd.Series, lows: pd.Series, closes: pd.Series) -> List[Dict]:
        """
        Detects Fair Value Gaps (FVG) or Imbalances.
        A Bullish FVG occurs when candles 1, 2, 3 have: High of 1 < Low of 3 (gap left by candle 2).
        A Bearish FVG occurs when: Low of 1 > High of 3 (gap left by candle 2).
        Returns a list of unmitigated FVGs.
        """
        fvgs = []
        n = len(opens)
        
        # Need at least 3 candles to form an FVG
        for i in range(2, n):
             # Bullish FVG
             if highs.iloc[i-2] < lows.iloc[i] and closes.iloc[i-1] > opens.iloc[i-1]: # Gap between 1st high and 3rd low, and strong bullish 2nd candle
                 gap_size = lows.iloc[i] - highs.iloc[i-2]
                 if gap_size > 0:
                     fvgs.append({
                         'type': 'BULLISH',
                         'top': float(lows.iloc[i]),
                         'bottom': float(highs.iloc[i-2]),
                         'index_formed': int(closes.index[i] if isinstance(closes.index[i], (int, np.integer)) else i),
                         'mitigated': False
                     })
                     
             # Bearish FVG
             if lows.iloc[i-2] > highs.iloc[i] and closes.iloc[i-1] < opens.iloc[i-1]: # Gap between 1st low and 3rd high, and strong bearish 2nd candle
                 gap_size = lows.iloc[i-2] - highs.iloc[i]
                 if gap_size > 0:
                     fvgs.append({
                         'type': 'BEARISH',
                         'top': float(lows.iloc[i-2]),
                         'bottom': float(highs.iloc[i]),
                         'index_formed': int(closes.index[i] if isinstance(closes.index[i], (int, np.integer)) else i),
                         'mitigated': False
                     })

        # Simple mitigation check (look at price action after the FVG formed)
        for fvg in fvgs:
             formed_idx_relative = fvg['index_formed']
             # Find actual position in array if index is not 0-based integer
             actual_pos = None
             if hasattr(closes, 'index'):
                 # Try to find positional index
                 try:
                     actual_pos = closes.index.get_loc(formed_idx_relative)
                 except: continue
             else:
                 actual_pos = formed_idx_relative

             if actual_pos is not None:
                 for j in range(actual_pos + 1, n):
                     if fvg['type'] == 'BULLISH':
                         if lows.iloc[j] < fvg['top']: # Partially or fully mitigated
                             if lows.iloc[j] <= fvg['bottom']:
                                  fvg['mitigated'] = True
                                  break
                     elif fvg['type'] == 'BEARISH':
                         if highs.iloc[j] > fvg['bottom']:
                             if highs.iloc[j] >= fvg['top']:
                                  fvg['mitigated'] = True
                                  break
                                  
        # Filter unmitigated FVGs
        unmitigated = [f for f in fvgs if not f['mitigated']]
        return unmitigated
