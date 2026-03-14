import { eventStore } from '../telemetry/eventStore';
import { guardWsEnvelope } from '../contracts/contracts';
import { WS_URL } from '../../services/config';

export type WsStatus = 'connecting' | 'open' | 'closed' | 'error';

// Eventos de alta prioridade — nunca são throttled
const HIGH_PRIORITY_TYPES = new Set([
  'SIGNAL_GENERATED', 'ORDER_APPROVED', 'ORDER_REJECTED',
  'TRADE_OPENED', 'TRADE_CLOSED', 'PANIC_KILL', 'CIRCUIT_BREAKER_TRIGGERED',
  'ALERT', 'LIVE_POSITION_UPDATE'
]);

const THROTTLE_MS = 500; // Agrupa mensagens do mesmo tipo em janelas de 500ms

class WsClient {
    private ws: WebSocket | null = null;
    private url: string;

    public status: WsStatus = 'closed';
    public lastMessageAt: number = 0;
    public msgCount: number = 0;
    public isStale: boolean = false;

    private listeners: Set<() => void> = new Set();
    private dataListeners: Set<(data: any) => void> = new Set();

    private staleTimer: ReturnType<typeof setTimeout> | null = null;
    private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    private readonly STALE_THRESHOLD_MS = 15000;

    // Throttle: guarda última mensagem por tipo + timer pendente
    private throttleQueues: Map<string, { data: any; timer: ReturnType<typeof setTimeout> }> = new Map();

    constructor() {
        this.url = typeof WS_URL !== 'undefined' ? WS_URL : 'ws://localhost:8001/ws';
    }

    public connect() {
        if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
            return;
        }
        this.updateStatus('connecting');
        this.ws = new WebSocket(this.url);

        this.ws.onopen = () => {
            this.updateStatus('open');
            eventStore.emit('INFO', 'WS', 'WS_OPEN', `Conectado em ${this.url}`);
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
        // Limpa throttle queue pendente
        this.throttleQueues.forEach(q => clearTimeout(q.timer));
        this.throttleQueues.clear();
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
    }

    private handleMessage(rawData: string) {
        this.lastMessageAt = Date.now();
        this.msgCount++;
        this.resetStaleTimer();

        let data: any;
        try {
            data = JSON.parse(rawData);
        } catch (e) {
            eventStore.emit('ERROR', 'WS', 'CONTRACT_ERROR', 'Falha no parse JSON', rawData.substring(0, 100));
            this.notify();
            return;
        }

        if (!guardWsEnvelope(data)) {
            this.notify();
            return;
        }

        const msgType: string = data.type || 'unknown';

        // Alta prioridade: dispara imediatamente, sem throttle
        if (HIGH_PRIORITY_TYPES.has(msgType)) {
            if (msgType !== 'ping') {
                eventStore.emit('INFO', 'WS', 'WS_MESSAGE', `[PRIORITY] ${msgType}`, msgType);
            }
            this.notifyData(data);
            this.notify();
            return;
        }

        // Throttle: agrupa mensagens do mesmo tipo em janelas de 500ms
        const existing = this.throttleQueues.get(msgType);
        if (existing) {
            // Atualiza o dado mais recente mas mantém o timer
            existing.data = data;
        } else {
            const timer = setTimeout(() => {
                const queued = this.throttleQueues.get(msgType);
                if (queued) {
                    this.throttleQueues.delete(msgType);
                    this.notifyData(queued.data);
                    this.notify();
                }
            }, THROTTLE_MS);
            this.throttleQueues.set(msgType, { data, timer });
        }
    }

    private resetStaleTimer() {
        this.clearStaleTimer();
        if (this.isStale) {
            this.isStale = false;
            this.notify();
        }
        this.staleTimer = setTimeout(() => {
            this.isStale = true;
            eventStore.emit('WARN', 'WS', 'WS_STALE', `Sem mensagens há ${this.STALE_THRESHOLD_MS}ms`);
            this.notify();
        }, this.STALE_THRESHOLD_MS);
    }

    private clearStaleTimer() {
        if (this.staleTimer) { clearTimeout(this.staleTimer); this.staleTimer = null; }
    }

    private scheduleReconnect() {
        if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
        this.reconnectTimer = setTimeout(() => {
            eventStore.emit('INFO', 'WS', 'WS_OPEN', 'Reconectando WS...');
            this.connect();
        }, 5000);
    }

    private updateStatus(newStatus: WsStatus) {
        this.status = newStatus;
        this.notify();
    }

    public subscribe(listener: () => void) {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    private notify() { this.listeners.forEach(l => l()); }

    public subscribeData(listener: (data: any) => void) {
        this.dataListeners.add(listener);
        return () => this.dataListeners.delete(listener);
    }

    private notifyData(data: any) { this.dataListeners.forEach(l => l(data)); }
}

export const wsClient = new WsClient();
