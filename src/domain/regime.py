from src.domain.strategy import RegimeType

class RegimeComputer:
    """
    Pure Domain Logic for Regime Transitions with Hysteresis (Stateful).
    Implements the 'Universe Gate' robustness rules (Section 14).
    """
    
    # Hysteresis Thresholds (Default)
    ADX_RANGE_ENTRY = 20.0  # Enter Range (< 20)
    ADX_RANGE_EXIT  = 22.0  # Exit Range (>= 22) -> Neutral
    
    ADX_TREND_ENTRY = 25.0  # Enter Trend (>= 25)
    ADX_TREND_EXIT  = 23.0  # Exit Trend (<= 23) -> Neutral

    ADX_STRONG_ENTRY = 30.0 # Enter Strong Trend (>= 30)
    ADX_STRONG_EXIT  = 28.0 # Exit Strong (<= 28) -> Trend

    @staticmethod
    def compute_regime(current_adx: float, previous_regime: RegimeType) -> RegimeType:
        """
        Determines the current regime based on ADX and Previous State.
        """
        
        # 1. State: STRONG_TREND
        if previous_regime == RegimeType.STRONG_TREND:
            if current_adx < RegimeComputer.ADX_STRONG_EXIT:
                # Downgrade to TREND (Hysteresis)
                # Check directly if it fell all the way to Neutral? 
                # Usually step-down logic is safer.
                if current_adx < RegimeComputer.ADX_TREND_EXIT:
                     return RegimeType.NEUTRAL
                return RegimeType.TREND
            return RegimeType.STRONG_TREND

        # 2. State: TREND
        elif previous_regime == RegimeType.TREND:
            if current_adx >= RegimeComputer.ADX_STRONG_ENTRY:
                return RegimeType.STRONG_TREND
            elif current_adx <= RegimeComputer.ADX_TREND_EXIT:
                return RegimeType.NEUTRAL
            return RegimeType.TREND

        # 3. State: RANGE
        elif previous_regime == RegimeType.RANGE:
            if current_adx >= RegimeComputer.ADX_RANGE_EXIT:
                return RegimeType.NEUTRAL
            return RegimeType.RANGE

        # 4. State: NEUTRAL (Buffer Zone)
        else: # NEUTRAL
            if current_adx >= RegimeComputer.ADX_TREND_ENTRY:
                return RegimeType.TREND
            elif current_adx < RegimeComputer.ADX_RANGE_ENTRY:
                return RegimeType.RANGE
            return RegimeType.NEUTRAL
