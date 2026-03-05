import { apiClient } from '../core/net/apiClient';

export class ApiError extends Error {
    public status: number;

    constructor(status: number, message: string) {
        super(message);
        this.status = status;
        this.name = 'ApiError';
    }
}

export const api = {
    get: <T>(endpoint: string) => apiClient.get<T>(endpoint),
    post: <T>(endpoint: string, body?: any) => apiClient.post<T>(endpoint, body),
    put: <T>(endpoint: string, body?: any) => apiClient.put<T>(endpoint, body),
    delete: <T>(endpoint: string) => apiClient.delete<T>(endpoint),
};

// Types corresponding to V3 concepts

export type UniverseStatus = 'RUNNING' | 'STOPPED' | 'ERROR' | 'IDLE';
export type GateStatus = 'OPEN' | 'CLOSED';
export type AssetClass = 'FOREX' | 'METALS' | 'CRYPTO' | 'INDICES_NY' | 'INDICES_B3' | 'INDICES_EU' | 'STOCKS_US' | 'STOCKS_BR' | 'STOCKS_EU' | 'COMMODITIES_AGRI' | 'COMMODITIES_ENERGY' | 'UNKNOWN';
export type AssetStatus = 'ELIGIBLE' | 'WARN' | 'HARD_REJECT';
export type SelectionMode = 'AUTO' | 'MANUAL';
export type TimeMode = 'AUTO' | 'MANUAL';
export type ActiveSetSource = 'AUTO' | 'MANUAL' | 'FROZEN';

export interface UniverseStageCounts {
    raw_count: number;
    after_class_filter: number;
    blocked_count: number;
    with_metrics: number;
    eligible_count: number;
    active_set_count: number;
}

export interface UniverseReasons {
    unclassified: number;
    no_rates: number;
    spread_too_high: number;
    blocked: number;
    out_of_hours: number;
    high_correlation: number;
}

export interface UniverseSnapshot {
    cycle_id: string;
    timestamp_utc: string;
    status: UniverseStatus;
    gate_status: GateStatus;
    gate_reason: string;

    selection_mode: SelectionMode;
    active_set_source: ActiveSetSource;

    ws_status?: string;
    rest_fallback_ms?: number;

    universe?: UniverseStageCounts;
    reasons?: UniverseReasons;
    sample?: any[];
    ranking?: RankingRow[];
    active_set?: string[];

    // Legacy fields (kept for backwards compatibility if needed during dev)
    active_set_size: number;
    frozen_active_set: string[];
    universe_raw_total: number;
    excluded_by_class_disabled: number;
    excluded_by_symbol_blocklist: number;
    universe_active_total: number;
    scanned_count: number;
    scan_progress_pct: number;
}

export interface ClassWeights {
    w_liquidity: number;
    w_volatility: number;
    w_cost: number;
    w_stability: number;
    max_spread_atr_ratio: number;
}

export interface ScheduleConfig {
    time_mode: TimeMode;
    time_start: string;
    time_end: string;
    timezone?: string;
    trading_days?: number[];
}

export interface UniverseConfig {
    scanner_enabled: boolean;
    selection_mode: SelectionMode;
    manual_basket: string[];

    classes_enabled: Record<string, boolean>;
    blocklist: string[];

    min_active_set_size: number;
    max_active_set_size: number;
    rebuild_interval_sec: number;

    swap_delta_score: number;
    hold_buffer: number;

    correlation_enabled: boolean;
    max_correlation_threshold: number;
    correlation_periods: number;

    weights: Record<string, ClassWeights>;
    schedules: Record<string, ScheduleConfig>;
    updated_at?: string;
}

export interface ScoreBreakdown {
    liquidity: number;
    volatility: number;
    cost: number;
    stability: number;
    total: number;
}

export interface AssetMetrics {
    spread_points: number;
    spread_atr_ratio: number;
    adx: number;
    atr: number;
    staleness_sec: number;
    price: number;
}

export interface RankingRow {
    symbol: string;
    asset_class: AssetClass;
    rank: number;
    score: number | null;
    status: AssetStatus;
    reason_code: string;
    specification: string;
    metrics: AssetMetrics;
    score_breakdown: ScoreBreakdown;
    weights_used?: Record<string, number>;
    computed_at?: string;
    cycle_id?: string;
    decision: string;
    decision_reason?: string;
    data?: any;
}

export interface EngineState {
    engine: string;
    mt5: string;
    strategy_engine?: {
        running: boolean;
        strategies: string[];
        scan_interval: number;
    };
    arbiter?: {
        min_score: number;
        processed_count: number;
    };
    execution?: {
        status: string;
    };
    guardian?: {
        internet_ok: boolean;
        mt5_running: boolean;
        hard_restarts: number;
    };
}
