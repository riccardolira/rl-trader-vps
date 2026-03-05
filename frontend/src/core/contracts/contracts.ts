import { eventStore } from '../telemetry/eventStore';

// === Contract Schemas Checkers ===

export function isUniverseSnapshot(data: any): boolean {
    if (!data || typeof data !== 'object') return false;
    // Expected keys: cycle_id, timestamp_utc, status, universe_active_total, ranking
    if (!('cycle_id' in data)) return false;
    if (!('timestamp_utc' in data)) return false;
    if (!('status' in data)) return false;
    if (!('universe_active_total' in data)) return false;
    if (!('ranking' in data) || !Array.isArray(data.ranking)) return false;

    return true;
}

export function explainUniverseSnapshot(data: any): string {
    if (!data || typeof data !== 'object') return 'Payload nulo ou não é objeto';
    const missing: string[] = [];
    if (!('cycle_id' in data)) missing.push('cycle_id');
    if (!('timestamp_utc' in data)) missing.push('timestamp_utc');
    if (!('status' in data)) missing.push('status');
    if (!('universe_active_total' in data)) missing.push('universe_active_total');
    if (!('ranking' in data)) missing.push('ranking (array)');
    else if (!Array.isArray(data.ranking)) missing.push('ranking não é array');

    return missing.length > 0
        ? `Propriedades ausentes/inválidas: ${missing.join(', ')}`
        : 'Válido';
}

export function isWsEnvelope(data: any): boolean {
    if (!data || typeof data !== 'object') return false;
    // Expected keys: type, (ts or timestamp), payload
    if (!('type' in data) || typeof data.type !== 'string') return false;
    if (!('ts' in data) && !('timestamp' in data)) return false;
    if (!('payload' in data)) return false;
    return true;
}

export function explainWsEnvelope(data: any): string {
    if (!data || typeof data !== 'object') return 'Envelope WS nulo ou não é objeto';
    const missing: string[] = [];
    if (!('type' in data)) missing.push('type');
    else if (typeof data.type !== 'string') missing.push('type (precisa ser string)');
    if (!('ts' in data) && !('timestamp' in data)) missing.push('ts/timestamp');
    if (!('payload' in data)) missing.push('payload');

    return missing.length > 0
        ? `Envelope ausentes/inválidos: ${missing.join(', ')}`
        : 'Válido';
}

// === Guard Functions ===

/**
 * Valida o envelope WS e emite erro se falhar
 */
export function guardWsEnvelope(data: any): boolean {
    if (!isWsEnvelope(data)) {
        const reason = explainWsEnvelope(data);
        eventStore.emit(
            'ERROR',
            'WS',
            'CONTRACT_ERROR',
            `Falha no contrato (envelope do websocket): ${reason}`,
            // Send truncated payload for debugging avoiding huge payloads
            JSON.parse(JSON.stringify(data, (_k, v) => (typeof v === 'string' && v.length > 100) ? v.substring(0, 50) + '...' : v))
        );
        return false;
    }
    return true;
}

/**
 * Valida o Universe Snapshot e emite erro se falhar
 */
export function guardUniverseSnapshot(data: any): boolean {
    if (!isUniverseSnapshot(data)) {
        const reason = explainUniverseSnapshot(data);
        eventStore.emit(
            'ERROR',
            'REST',
            'CONTRACT_ERROR',
            `Falha no contrato (snapshot do universo): ${reason}`,
            data // might be large, but useful
        );
        return false;
    }
    return true;
}
