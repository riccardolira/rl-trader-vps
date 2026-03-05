export type EventLevel = 'INFO' | 'WARN' | 'ERROR';
export type EventComponent = 'REST' | 'WS' | 'WATCHDOG' | 'UI' | 'SYSTEM';

export type EventCode =
    // API
    | 'API_CALL' | 'API_OK' | 'API_FAIL'
    // WS
    | 'WS_OPEN' | 'WS_CLOSE' | 'WS_ERROR' | 'WS_MESSAGE' | 'WS_STALE'
    // Snapshot
    | 'SNAPSHOT_OK' | 'SNAPSHOT_STALE'
    // Contract
    | 'CONTRACT_ERROR'
    // UX
    | 'UI_STUCK' | 'ACTION_REQUESTED' | 'ACTION_NO_EFFECT';

export interface AuditEvent {
    id: string;
    ts: number;
    level: EventLevel;
    component: EventComponent;
    code: EventCode;
    symbol?: string; // Optional: se o erro/evento for sobre um ativo específico
    message: string;
    meta?: any;      // Qualquer payload extra (resumido)
}
