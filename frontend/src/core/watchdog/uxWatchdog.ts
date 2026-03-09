import { eventStore } from '../telemetry/eventStore';

interface WatchdogConfig {
    uiStuckTimeoutMs: number;
    snapshotStaleTimeoutMs: number;
}

const DEFAULT_CONFIG: WatchdogConfig = {
    uiStuckTimeoutMs: 30000,
    snapshotStaleTimeoutMs: 1200000, // 20 minutes (backend rebuilds every 15m)
};

class UxWatchdog {
    private config: WatchdogConfig = { ...DEFAULT_CONFIG };

    // State to observe
    private lastSnapshotAt: number = 0;
    private cycleId: string = '';
    private snapshotCount: number = 0;

    private snapshotStaleTimer: ReturnType<typeof setTimeout> | null = null;

    public isSnapshotStale: boolean = false;

    // For React
    private listeners: Set<() => void> = new Set();

    constructor() {
        // Try reading config overrides if present
        try {
            const saved = localStorage.getItem('uxWatchdogConfig');
            if (saved) {
                this.config = { ...this.config, ...JSON.parse(saved) };
            }
        } catch (e) { }
    }

    public notifySnapshotReceived(cycleId: string) {
        this.lastSnapshotAt = Date.now();
        this.snapshotCount++;

        if (this.cycleId !== cycleId) {
            this.cycleId = cycleId;
            // Cycle moved forward, all good
        }

        this.resetSnapshotStaleTimer();
        this.notify();
    }

    private resetSnapshotStaleTimer() {
        if (this.snapshotStaleTimer) clearTimeout(this.snapshotStaleTimer);

        if (this.isSnapshotStale) {
            this.isSnapshotStale = false;
            eventStore.emit('INFO', 'WATCHDOG', 'SNAPSHOT_STALE', 'Snapshot se recuperou da estagnação');
            this.notify();
        }

        this.snapshotStaleTimer = setTimeout(() => {
            this.isSnapshotStale = true;
            eventStore.emit('WARN', 'WATCHDOG', 'SNAPSHOT_STALE', `Snapshot não recebe atualizações ou não muda de ciclo há mais de ${this.config.snapshotStaleTimeoutMs}ms`);
            this.notify();
        }, this.config.snapshotStaleTimeoutMs);
    }

    public reportUiStuck(context: string) {
        eventStore.emit('WARN', 'UI', 'UI_STUCK', `UI reportada como travada/demorada: ${context}`);
    }

    public getStatus() {
        return {
            lastSnapshotAt: this.lastSnapshotAt,
            cycleId: this.cycleId,
            isSnapshotStale: this.isSnapshotStale,
            snapshotCount: this.snapshotCount
        };
    }

    public subscribe(listener: () => void) {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    private notify() {
        this.listeners.forEach(l => l());
    }
}

export const uxWatchdog = new UxWatchdog();
