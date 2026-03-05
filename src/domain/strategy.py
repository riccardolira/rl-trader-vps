from typing import Protocol, List, Dict, Any, Optional
from datetime import datetime
from pydantic import BaseModel, Field
from enum import Enum

# --- Data Models for Strategy Layer ---

class AnalysisSide(str, Enum):
    BUY = "BUY"
    SELL = "SELL"
    NEUTRAL = "NEUTRAL"

class ExitStyle(str, Enum):
    FIXED = "FIXED"
    TRAILING = "TRAILING"
    TIME_BASED = "TIME_BASED"

class StrategyCandidate(BaseModel):
    """
    Output of a strategy analysis for a single symbol.
    Represents a POTENTIAL trade (Signal Candidate).
    """
    symbol: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    strategy_name: str
    side: AnalysisSide
    
    # Scoring Components (0-100)
    score_signal: float = 0.0
    score_regime_fit: float = 0.0
    score_mtf: float = 0.0
    
    # Penalties
    penalty_microstructure: float = 0.0
    penalty_risk: float = 0.0
    
    # Final Score
    final_score: float = 0.0
    
    # Exit Proposal
    stop_loss_price: Optional[float] = None
    take_profit_price: Optional[float] = None
    stop_atr_mult: float = 0.0
    take_atr_mult: float = 0.0
    exit_style: ExitStyle = ExitStyle.FIXED

    # Metadata / Debug
    metadata: Dict[str, Any] = {}
    reason_code: str = "" # e.g., "OK", "LOW_SCORE", "REGIME_MISMATCH"

    class Config:
        frozen = True

class RegimeType(str, Enum):
    RANGE = "RANGE"         # ADX < 20
    NEUTRAL = "NEUTRAL"     # 20 <= ADX < 25
    TREND = "TREND"         # 25 <= ADX < 30
    STRONG_TREND = "STRONG_TREND" # ADX >= 30

class MarketContext(BaseModel):
    """
    Context passed to strategies to inform decision.
    Pre-calculated by the Engine or Shared Services.
    """
    symbol: str
    timeframe: str
    regime: RegimeType
    adx_value: float
    atr_value: float
    spread: float
    point_value: float # NEW: For converting points to price
    tick_value: float = 0.0 # Phase 3: For Dynamic Sizing
    price_close: float
    indicators: Dict[str, float] = {}  # e.g., {'sma_20': 1.1234, 'rsi_14': 45.6}
    mtf_trend: AnalysisSide = AnalysisSide.NEUTRAL # D1 Trend Confirmation
    metadata: Dict[str, Any] = {}
    # Can allow raw data access if needed, but preferred pre-calculated

# --- Protocol Definition ---

class IStrategy(Protocol):
    """
    Contract for all Trading Strategies (Alpha Components).
    Must be stateless regarding execution (no open_order calls here).
    """

    @property
    def name(self) -> str:
        """Unique identifier for the strategy."""
        ...

    async def analyze(self, context: MarketContext) -> StrategyCandidate:
        """
        Analyzes the market for a specific symbol and returns a candidate.
        If no signal, returns a NEUTRAL candidate with score 0.
        """
        ...
