import type { AuditEvent, EventLevel, EventCode, EventComponent } from './eventTypes';

// Generate a simple unique ID
const generateId = () => Math.random().toString(36).substring(2, 15);

class EventStore {
    private events: AuditEvent[] = [];
    private config = { capacity: 1000 };
    private listeners: Set<(events: AuditEvent[]) => void> = new Set();

    public emit(
        level: EventLevel,
        component: EventComponent,
        code: EventCode,
        message: string,
        meta?: any,
        symbol?: string
    ) {
        const event: AuditEvent = {
            id: generateId(),
            ts: Date.now(),
            level,
            component,
            code,
            message,
            meta,
            symbol
        };

        this.events.unshift(event);

        if (this.events.length > this.config.capacity) {
            this.events.pop();
        }

        // Print to console based on level
        const logMsg = `[${component}] ${code}: ${message}`;
        if (level === 'ERROR') {
            console.error(logMsg, meta || '');
        } else if (level === 'WARN') {
            console.warn(logMsg, meta || '');
        } else {
            console.log(logMsg, meta || '');
        }

        this.notify();
    }

    public list(): AuditEvent[] {
        return [...this.events];
    }

    public clear() {
        this.events = [];
        this.notify();
    }

    public subscribe(listener: (events: AuditEvent[]) => void): () => void {
        this.listeners.add(listener);
        // Invoke immediately with current state
        listener(this.list());
        return () => this.listeners.delete(listener);
    }

    private notify() {
        const currentEvents = this.list();
        this.listeners.forEach(listener => listener(currentEvents));
    }
}

export const eventStore = new EventStore();
