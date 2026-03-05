import React, { useEffect, useState } from 'react';
import { eventStore } from '../core/telemetry/eventStore';
import { wsClient } from '../core/net/wsClient';
import { uxWatchdog } from '../core/watchdog/uxWatchdog';
import { Activity, X, AlertTriangle, AlertCircle, CheckCircle2 } from 'lucide-react';
import { cn } from '../lib/utils';
import type { AuditEvent } from '../core/telemetry/eventTypes';

export const EngineeringOverlay: React.FC = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [wsState, setWsState] = useState({ status: wsClient.status, isStale: wsClient.isStale, msgCount: wsClient.msgCount, lastMsg: wsClient.lastMessageAt });
    const [wdState, setWdState] = useState(uxWatchdog.getStatus());

    const [now, setNow] = useState(() => Date.now());
    useEffect(() => {
        const interval = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(interval);
    }, []);

    // Simplificado para pegar os últimos eventos de API chamadas
    const [lastApiEvent, setLastApiEvent] = useState<AuditEvent | null>(null);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.ctrlKey && e.shiftKey && (e.key === 'D' || e.key === 'd')) {
                e.preventDefault();
                setIsOpen(prev => !prev);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    useEffect(() => {
        if (!isOpen) return;

        const unsubWs = wsClient.subscribe(() => {
            setWsState({
                status: wsClient.status,
                isStale: wsClient.isStale,
                msgCount: wsClient.msgCount,
                lastMsg: wsClient.lastMessageAt,
            });
        });

        const unsubWd = uxWatchdog.subscribe(() => {
            setWdState(uxWatchdog.getStatus());
        });

        const unsubEvents = eventStore.subscribe((events) => {
            const lastApi = events.find(e => e.component === 'REST' && (e.code === 'API_OK' || e.code === 'API_FAIL'));
            if (lastApi) setLastApiEvent(lastApi);
        });

        // Conectar o websocket para observabilidade em tempo real caso não esteja sendo usado no App.tsx diretamente 
        // (Isso assegura que o Singleton abre conexão)
        wsClient.connect();

        return () => {
            unsubWs();
            unsubWd();
            unsubEvents();
        };
    }, [isOpen]);

    if (!isOpen) {
        return (
            <button
                onClick={() => setIsOpen(true)}
                className="fixed bottom-4 right-4 bg-background border border-border text-muted-foreground p-2 rounded-full shadow-lg hover:text-foreground opacity-50 hover:opacity-100 transition-all z-50 group"
                title="Engineering Overlay (Ctrl+Shift+D)"
            >
                <Activity size={18} />
                <span className="absolute right-full mr-2 bg-popover text-popover-foreground text-xs px-2 py-1 rounded hidden group-hover:block whitespace-nowrap">
                    Eng. Overlay
                </span>
            </button>
        );
    }

    const { status: wsStatus, isStale: wsIsStale, msgCount: wsMsgCount, lastMsg: wsLastMsg } = wsState;
    const { isSnapshotStale, cycleId, lastSnapshotAt, snapshotCount } = wdState;

    const formatAgo = (timestamp: number) => {
        if (!timestamp) return 'Nunca';
        const diff = Math.round((now - timestamp) / 1000);
        return `${diff}s atrás`;
    };

    return (
        <div className="fixed bottom-4 right-4 w-80 bg-card/80 backdrop-blur-2xl shadow-[0_0_30px_rgba(0,0,0,0.1)] border border-border/50 rounded-2xl z-50 overflow-hidden text-xs">
            <div className="bg-muted/30 p-3 flex justify-between items-center border-b border-border/50">
                <div className="flex items-center gap-2 font-bold tracking-tight text-foreground/90">
                    <Activity size={14} className="text-primary" />
                    Telemetria / Watchdog
                </div>
                <button onClick={() => setIsOpen(false)} className="text-muted-foreground/70 hover:text-foreground">
                    <X size={14} />
                </button>
            </div>

            <div className="p-3 flex flex-col gap-3">
                {/* REST Status */}
                <div className="space-y-1">
                    <div className="font-semibold text-muted-foreground uppercase text-[10px] tracking-wider">REST / API</div>
                    {lastApiEvent ? (
                        <div className={cn("p-2 rounded border", lastApiEvent.code === 'API_OK' ? "bg-green-500/10 border-green-500/20 text-green-600 dark:text-green-400" : "bg-red-500/10 border-red-500/20 text-red-600 dark:text-red-400")}>
                            <div className="flex items-center justify-between mb-1">
                                <span className="font-medium">{lastApiEvent.code}</span>
                                <span className="text-[10px] opacity-70">{formatAgo(lastApiEvent.ts)}</span>
                            </div>
                            <div className="truncate">{lastApiEvent.message}</div>
                        </div>
                    ) : (
                        <div className="text-muted-foreground italic">Nenhuma chamada detectada ainda</div>
                    )}
                </div>

                {/* WS Status */}
                <div className="space-y-1">
                    <div className="font-semibold text-muted-foreground uppercase text-[10px] tracking-wider">WebSocket Stream</div>
                    <div className={cn("p-2 rounded border flex flex-col gap-1",
                        wsStatus === 'open' && !wsIsStale ? "bg-green-500/10 border-green-500/20" :
                            wsStatus === 'connecting' ? "bg-yellow-500/10 border-yellow-500/20" :
                                "bg-red-500/10 border-red-500/20"
                    )}>
                        <div className="flex justify-between items-center">
                            <span className="flex items-center gap-1 font-medium capitalize">
                                {wsStatus === 'open' ? <CheckCircle2 size={12} className="text-green-500" /> :
                                    wsStatus === 'closed' || wsStatus === 'error' ? <AlertCircle size={12} className="text-red-500" /> :
                                        <Activity size={12} className="animate-pulse text-yellow-500" />}
                                {wsStatus}
                            </span>
                            {wsIsStale && <span className="bg-red-500 text-white px-1.5 py-0.5 rounded text-[9px] font-bold">STALE</span>}
                        </div>
                        <div className="flex justify-between text-[10px] opacity-80">
                            <span>Msgs: {wsMsgCount}</span>
                            <span>Última: {formatAgo(wsLastMsg)}</span>
                        </div>
                    </div>
                </div>

                {/* Snapshot Watchdog */}
                <div className="space-y-1">
                    <div className="font-semibold text-muted-foreground uppercase text-[10px] tracking-wider">Universe Snapshot</div>
                    <div className={cn("p-2 rounded border flex flex-col gap-1",
                        isSnapshotStale ? "bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400" :
                            snapshotCount > 0 ? "bg-green-500/10 border-green-500/20" : "bg-muted text-muted-foreground"
                    )}>
                        {snapshotCount === 0 ? (
                            <div className="italic">Aguardando snapshot inicial...</div>
                        ) : (
                            <>
                                <div className="flex justify-between items-center">
                                    <span className="font-medium font-mono text-[10px]">Ciclo: {cycleId}</span>
                                    {isSnapshotStale && <span className="bg-amber-500 text-white px-1.5 py-0.5 rounded text-[9px] font-bold flex items-center gap-1"><AlertTriangle size={10} /> ESTAGNADO</span>}
                                </div>
                                <div className="flex justify-between text-[10px] opacity-80">
                                    <span>Count: {snapshotCount}</span>
                                    <span>Visto: {formatAgo(lastSnapshotAt)}</span>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
