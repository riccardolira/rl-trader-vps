import { eventStore } from '../telemetry/eventStore';
import { guardWsEnvelope } from '../contracts/contracts';
import { WS_URL } from '../../services/config';

export type WsStatus = 'connecting' | 'open' | 'closed' | 'error';

class WsClient {
    private ws: WebSocket | null = null;
    private url: string;

    public status: WsStatus = 'closed';
    public lastMessageAt: number = 0;
    public msgCount: number = 0;
    public isStale: boolean = false;

    // For react hooks (connection status)
    private listeners: Set<() => void> = new Set();

    // For payload data
    private dataListeners: Set<(data: any) => void> = new Set();

    private staleTimer: ReturnType<typeof setTimeout> | null = null;
    private readonly STALE_THRESHOLD_MS = 15000;
    private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    constructor() {
        // Assume default WS_URL from config or hardcode the v3 default
        // In this project it seems to be ws://localhost:8001/ws as per services/config.ts
        this.url = typeof WS_URL !== 'undefined' ? WS_URL : 'ws://localhost:8001/ws';
    }

    public connect() {
        if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
            return; // Already connecting or open
        }

        this.updateStatus('connecting');
        this.ws = new WebSocket(this.url);

        this.ws.onopen = () => {
            this.updateStatus('open');
            eventStore.emit('INFO', 'WS', 'WS_OPEN', `Conectado ao WebSocket em ${this.url}`);
            this.resetStaleTimer();
        };

        this.ws.onclose = () => {
            this.updateStatus('closed');
            this.clearStaleTimer();
            eventStore.emit('WARN', 'WS', 'WS_CLOSE', 'Conexão WebSocket fechada');
            this.scheduleReconnect();
        };

        this.ws.onerror = (err) => {
            this.updateStatus('error');
            eventStore.emit('ERROR', 'WS', 'WS_ERROR', 'Erro na conexão WebSocket', err);
        };

        this.ws.onmessage = (event) => {
            this.handleMessage(event.data);
        };
    }

    public disconnect() {
        if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
        this.clearStaleTimer();
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
    }

    private handleMessage(rawData: string) {
        this.lastMessageAt = Date.now();
        this.msgCount++;
        this.resetStaleTimer();

        let data;
        try {
            data = JSON.parse(rawData);
        } catch (e) {
            eventStore.emit('ERROR', 'WS', 'CONTRACT_ERROR', 'Falha no parse JSON via WS', rawData.substring(0, 100));
            this.notify();
            return;
        }

        // Optionally emit every message to eventStore
        // Be careful not to flood it with too many tick events
        if (data && data.type !== 'ping') {
            eventStore.emit('INFO', 'WS', 'WS_MESSAGE', `Mensagem WS: ${data.type || 'unknown'}`, data.type);
        }

        // Guard Contract!
        if (guardWsEnvelope(data)) {
            this.notifyData(data);
        }

        this.notify();
    }

    private resetStaleTimer() {
        this.clearStaleTimer();
        if (this.isStale) {
            this.isStale = false;
            eventStore.emit('INFO', 'WS', 'WS_STALE', 'Conexão WS se recuperou (não mais estagnada)');
            this.notify();
        }

        this.staleTimer = setTimeout(() => {
            this.isStale = true;
            eventStore.emit('WARN', 'WS', 'WS_STALE', `WebSocket sem mensagens há mais de ${this.STALE_THRESHOLD_MS}ms`);
            this.notify();
        }, this.STALE_THRESHOLD_MS);
    }

    private clearStaleTimer() {
        if (this.staleTimer) {
            clearTimeout(this.staleTimer);
            this.staleTimer = null;
        }
    }

    private scheduleReconnect() {
        if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
        this.reconnectTimer = setTimeout(() => {
            eventStore.emit('INFO', 'WS', 'WS_OPEN', 'Tentando reconectar WS...');
            this.connect();
        }, 5000); // 5s backoff
    }

    private updateStatus(newStatus: WsStatus) {
        this.status = newStatus;
        this.notify();
    }

    public subscribe(listener: () => void) {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    private notify() {
        this.listeners.forEach(l => l());
    }

    public subscribeData(listener: (data: any) => void) {
        this.dataListeners.add(listener);
        return () => this.dataListeners.delete(listener);
    }

    private notifyData(data: any) {
        this.dataListeners.forEach(l => l(data));
    }
}

export const wsClient = new WsClient();
