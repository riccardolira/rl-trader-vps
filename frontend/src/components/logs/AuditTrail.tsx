import React, { useEffect, useState } from 'react';
import { eventStore } from '../../core/telemetry/eventStore';
import type { AuditEvent } from '../../core/telemetry/eventTypes';
import { Terminal, Trash2, ShieldAlert, CheckCircle2, Info, AlertTriangle } from 'lucide-react';
import { cn } from '../../lib/utils';

export const AuditTrail: React.FC = () => {
    const [events, setEvents] = useState<AuditEvent[]>([]);

    useEffect(() => {
        const unsubscribe = eventStore.subscribe((newEvents) => {
            setEvents(newEvents);
        });
        return () => unsubscribe();
    }, []);

    const clearLog = () => {
        eventStore.clear();
    };

    const getIconInfo = (level: string) => {
        switch (level) {
            case 'ERROR': return <ShieldAlert size={14} className="text-red-500" />;
            case 'WARN': return <AlertTriangle size={14} className="text-yellow-500" />;
            case 'INFO': return <Info size={14} className="text-blue-500" />;
            default: return <CheckCircle2 size={14} className="text-green-500" />;
        }
    };

    return (
        <div className="h-full flex flex-col bg-card rounded-xl border border-border overflow-hidden shadow-sm">
            <div className="flex justify-between items-center px-4 py-3 border-b border-border bg-muted/20">
                <div className="flex items-center gap-2 font-medium text-sm text-foreground/90">
                    <Terminal size={16} className="text-muted-foreground" />
                    Frontend Audit Events <span className="bg-muted px-2 py-0.5 rounded-full text-[10px] font-bold text-muted-foreground ml-1">{events.length}</span>
                </div>
                <button
                    onClick={clearLog}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors border border-transparent hover:border-destructive/20"
                >
                    <Trash2 size={12} /> Clear
                </button>
            </div>

            <div className="flex-1 overflow-auto p-0 custom-scrollbar relative">
                {events.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
                        <Terminal size={48} className="mb-4 opacity-20" />
                        <p className="font-medium text-sm text-foreground/60">No audit events recorded yet.</p>
                        <p className="text-[10px] uppercase tracking-wide opacity-50 mt-2">Waiting for telemetry data...</p>
                    </div>
                ) : (
                    <table className="w-full text-sm text-left relative">
                        <thead className="text-[10px] uppercase tracking-wider text-muted-foreground bg-muted/80 sticky top-0 z-10 font-bold backdrop-blur-md shadow-sm">
                            <tr>
                                <th className="py-2.5 px-4 border-b border-border/50">Time</th>
                                <th className="py-2.5 px-4 border-b border-border/50">Lvl</th>
                                <th className="py-2.5 px-4 border-b border-border/50">Component</th>
                                <th className="py-2.5 px-4 border-b border-border/50">Code</th>
                                <th className="py-2.5 px-4 border-b border-border/50">Message</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border/30">
                            {events.map((event) => (
                                <tr key={event.id} className="hover:bg-muted/40 transition-colors even:bg-muted/10 group">
                                    <td className="py-2.5 px-4 whitespace-nowrap tabular-nums text-[10px] text-muted-foreground font-mono group-hover:text-foreground/80 transition-colors">
                                        {new Date(event.ts).toLocaleTimeString(undefined, { hour12: false, fractionalSecondDigits: 3 })}
                                    </td>
                                    <td className="py-2.5 px-4 whitespace-nowrap">
                                        <div className={cn("flex items-center justify-center w-5 h-5 rounded border",
                                            event.level === 'ERROR' ? "bg-red-500/10 text-red-500 border-red-500/20" :
                                                event.level === 'WARN' ? "bg-yellow-500/10 text-yellow-500 border-yellow-500/20" : "bg-blue-500/10 text-blue-500 border-blue-500/20"
                                        )}>
                                            {getIconInfo(event.level)}
                                        </div>
                                    </td>
                                    <td className="py-2.5 px-4 whitespace-nowrap">
                                        <span className="bg-muted px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase text-foreground/80 border border-border/50">
                                            {event.component}
                                        </span>
                                    </td>
                                    <td className="py-2.5 px-4 whitespace-nowrap font-mono text-[10px] text-muted-foreground group-hover:text-foreground/80 transition-colors">
                                        {event.code}
                                    </td>
                                    <td className="py-2.5 px-4 text-[11px] font-medium w-full text-foreground/80 group-hover:text-foreground transition-colors">
                                        <div className="line-clamp-2 leading-relaxed" title={event.message}>
                                            {event.message}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
};
