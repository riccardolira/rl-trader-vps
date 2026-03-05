from typing import List, Dict, Optional, Any
from pydantic import BaseModel, Field
from datetime import datetime
from enum import Enum

class UniverseStatus(str, Enum):
    RUNNING = "RUNNING"
    STOPPED = "STOPPED"
    ERROR = "ERROR"
    IDLE = "IDLE"

class GateStatus(str, Enum):
    OPEN = "OPEN"
    CLOSED = "CLOSED"

class SelectionMode(str, Enum):
    AUTO = "AUTO"
    MANUAL = "MANUAL"

class TimeMode(str, Enum):
    AUTO = "AUTO"
    MANUAL = "MANUAL"

class ActiveSetSource(str, Enum):
    AUTO = "AUTO"
    MANUAL = "MANUAL"
    FROZEN = "FROZEN"

class AssetClass(str, Enum):
    FOREX = "FOREX"
    METALS = "METALS"
    CRYPTO = "CRYPTO"
    INDICES_NY = "INDICES_NY"
    INDICES_B3 = "INDICES_B3"
    INDICES_EU = "INDICES_EU"
    STOCKS_US = "STOCKS_US"
    STOCKS_BR = "STOCKS_BR"
    STOCKS_EU = "STOCKS_EU"
    COMMODITIES_AGRI = "COMMODITIES_AGRI"
    COMMODITIES_ENERGY = "COMMODITIES_ENERGY"
    UNKNOWN = "UNKNOWN"

class AssetStatus(str, Enum):
    ELIGIBLE = "ELIGIBLE"
    WARN = "WARN"
    HARD_REJECT = "HARD_REJECT"

class ScoreBreakdown(BaseModel):
    liquidity: float = 0.0
    volatility: float = 0.0
    cost: float = 0.0
    stability: float = 0.0
    total: float = 0.0

class AssetMetrics(BaseModel):
    spread_points: int = 0
    spread_atr_ratio: float = 0.0
    adx: float = 0.0
    atr: float = 0.0
    staleness_sec: int = 0
    price: float = 0.0

class RankingRow(BaseModel):
    symbol: str
    asset_class: AssetClass
    rank: int
    score: Optional[float] = None
    status: AssetStatus
    reason_code: str
    specification: str = "" # "Spread 2.5 > 2.0"
    metrics: AssetMetrics
    score_breakdown: ScoreBreakdown
    weights_used: Optional[Dict[str, float]] = None
    computed_at: Optional[datetime] = None
    cycle_id: Optional[str] = None
    decision: str = "not_selected"
    decision_reason: str = ""
    data: Optional[Dict[str, Any]] = {}

class ChurnRules(BaseModel):
    min_hold_minutes: int = 60
    delta_score: float = 8.0
    max_replacements: int = 2

class ClassWeights(BaseModel):
    w_liquidity: float = 1.0
    w_volatility: float = 1.0
    w_cost: float = 1.0
    w_stability: float = 1.0
    max_spread_atr_ratio: float = 0.10

class ScheduleConfig(BaseModel):
    time_mode: TimeMode = TimeMode.AUTO
    time_start: str = "00:00"
    time_end: str = "23:59"
    timezone: str = "UTC"
    trading_days: List[int] = Field(default_factory=lambda: [0, 1, 2, 3, 4]) # 0=Monday, 6=Sunday

class UniverseConfig(BaseModel):
    scanner_enabled: bool = False
    selection_mode: SelectionMode = SelectionMode.AUTO
    manual_basket: List[str] = []
    
    classes_enabled: Dict[str, bool] = {
        "FOREX": True, 
        "METALS": True, 
        "CRYPTO": False, 
        "INDICES_NY": True,
        "INDICES_B3": False,
        "INDICES_EU": False,
        "STOCKS_US": False,
        "STOCKS_BR": False,
        "STOCKS_EU": False,
        "COMMODITIES_AGRI": False,
        "COMMODITIES_ENERGY": False
    }
    blocklist: List[str] = []
    
    # Tuning - Core
    min_active_set_size: int = 3
    max_active_set_size: int = 10
    rebuild_interval_sec: int = 900
    
    # Tuning - Hysteresis
    swap_delta_score: float = 5.0
    hold_buffer: int = 2
    
    # Tuning - Anti-Correlation Shield
    correlation_enabled: bool = True
    max_correlation_threshold: float = 0.85
    correlation_periods: int = 24
    
    # Weights and thresholds per class
    weights: Dict[str, ClassWeights] = {
        "FOREX": ClassWeights(),
        "METALS": ClassWeights(),
        "CRYPTO": ClassWeights(),
        "INDICES_NY": ClassWeights(),
        "INDICES_B3": ClassWeights(),
        "INDICES_EU": ClassWeights(),
        "STOCKS_US": ClassWeights(),
        "STOCKS_BR": ClassWeights(),
        "STOCKS_EU": ClassWeights(),
        "COMMODITIES_AGRI": ClassWeights(),
        "COMMODITIES_ENERGY": ClassWeights(),
    }
    
    # Regional Timetables
    schedules: Dict[str, ScheduleConfig] = {
        "FOREX": ScheduleConfig(timezone="UTC", trading_days=[0, 1, 2, 3, 4]),
        "METALS": ScheduleConfig(timezone="UTC", trading_days=[0, 1, 2, 3, 4]),
        "CRYPTO": ScheduleConfig(timezone="UTC", trading_days=[0, 1, 2, 3, 4, 5, 6]),
        "INDICES_B3": ScheduleConfig(time_start="09:05", time_end="17:50", timezone="America/Sao_Paulo", trading_days=[0, 1, 2, 3, 4]),
        "INDICES_NY": ScheduleConfig(time_start="09:30", time_end="17:00", timezone="America/New_York", trading_days=[0, 1, 2, 3, 4]),
        "INDICES_EU": ScheduleConfig(time_start="07:00", time_end="16:30", timezone="Europe/Berlin", trading_days=[0, 1, 2, 3, 4]),
        "STOCKS_US": ScheduleConfig(time_start="09:30", time_end="16:00", timezone="America/New_York", trading_days=[0, 1, 2, 3, 4]),
        "STOCKS_BR": ScheduleConfig(time_start="10:00", time_end="17:50", timezone="America/Sao_Paulo", trading_days=[0, 1, 2, 3, 4]),
        "STOCKS_EU": ScheduleConfig(time_start="07:00", time_end="16:30", timezone="Europe/Berlin", trading_days=[0, 1, 2, 3, 4]),
        "COMMODITIES_AGRI": ScheduleConfig(time_start="09:30", time_end="14:20", timezone="America/Chicago", trading_days=[0, 1, 2, 3, 4]),
        "COMMODITIES_ENERGY": ScheduleConfig(timezone="America/New_York", trading_days=[0, 1, 2, 3, 4]),
    }
    
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class UniverseStageCounts(BaseModel):
    raw_count: int = 0
    after_class_filter: int = 0
    blocked_count: int = 0
    with_metrics: int = 0
    eligible_count: int = 0
    active_set_count: int = 0

class UniverseReasons(BaseModel):
    unclassified: int = 0
    no_rates: int = 0
    spread_too_high: int = 0
    blocked: int = 0
    out_of_hours: int = 0
    high_correlation: int = 0
    frozen_by_news: int = 0

class UniverseSnapshot(BaseModel):
    cycle_id: str
    timestamp_utc: datetime
    status: UniverseStatus
    gate_status: GateStatus
    gate_reason: str
    
    selection_mode: SelectionMode = SelectionMode.AUTO
    active_set_source: ActiveSetSource = ActiveSetSource.AUTO
    
    ws_status: str = "open"
    rest_fallback_ms: int = 2000
    
    universe: UniverseStageCounts = Field(default_factory=UniverseStageCounts)
    reasons: UniverseReasons = Field(default_factory=UniverseReasons)
    class_counts: Dict[str, int] = Field(default_factory=dict)
    sample: List[Dict[str, Any]] = Field(default_factory=list)
    
    ranking: List[RankingRow] = Field(default_factory=list)
    active_set: List[str] = Field(default_factory=list)
    
    # Keeping old fields temporarily if frontend breaks, but ideally migrate fully
    active_set_size: int = 0
    frozen_active_set: List[str] = Field(default_factory=list)
    universe_raw_total: int = 0
    excluded_by_class_disabled: int = 0
    excluded_by_symbol_blocklist: int = 0
    universe_active_total: int = 0
    scanned_count: int = 0
    scan_progress_pct: float = 0.0
