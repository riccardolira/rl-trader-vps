import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { ScrollText, Cpu, ShieldAlert, Zap, Target, RefreshCw, Lightbulb, Clock } from 'lucide-react';
import { cn } from '../../lib/utils';

export const TransparencyFeed: React.FC = () => {
    const [feed, setFeed] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [timeFilter, setTimeFilter] = useState<'15m' | '1h' | 'today' | 'all'>('all');

    const fetchFeed = async () => {
        try {
            const res = await api.get<any>('/api/analytics/transparency');
            if (res && res.feed) {
                setFeed(res.feed);
            }
        } catch (e) {
            console.error("Failed to fetch transparency feed:", e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchFeed();
        const interval = setInterval(fetchFeed, 3000); // Poll every 3 seconds for transparency
        return () => clearInterval(interval);
    }, []);

    const getIcon = (component: string, type: string) => {
        if (type.includes('REJECTED') || type.includes('FAILED')) return <ShieldAlert size={14} className="text-rose-500" />;
        if (component === 'StrategyEngine') return <Lightbulb size={14} className="text-yellow-500" />;
        if (component === 'Scanner') return <Target size={14} className="text-blue-500" />;
        if (component === 'ExecutionService') return <Zap size={14} className="text-emerald-500" />;
        return <Cpu size={14} className="text-muted-foreground" />;
    };

    const getBorderColor = (type: string, component: string) => {
        if (type.includes('REJECTED') || type.includes('FAILED')) return "bg-rose-500";
        if (component === 'StrategyEngine') return "bg-yellow-500";
        if (component === 'Scanner') return "bg-blue-500";
        if (component === 'ExecutionService') return "bg-emerald-500";
        return "bg-muted-foreground/30";
    };

    // Helper to render payload dynamically depending on event type
    const renderPayload = (type: string, payload: any) => {
        if (type === 'UNIVERSE_RANKING_COMPUTED') {
            return (
                <div className="mt-1 text-xs opacity-80 space-y-1 bg-muted/30 p-2 rounded-md">
                    <p className="font-mono text-[10px]">Scanned: {payload.counts?.raw_count} | Eligible: {payload.counts?.eligible_count} | Active: {payload.counts?.active_set_count}</p>
                    <div className="flex flex-wrap gap-2 text-[10px] uppercase font-mono tracking-wider mt-1 opacity-60">
                        {payload.reasons && Object.entries(payload.reasons).filter(([_, v]) => (v as number) > 0).map(([k, v]) => (
                            <span key={k} className="bg-background px-1 rounded">{k}: {v as number}</span>
                        ))}
                    </div>
                </div>
            );
        }

        if (type === 'ORDER_REJECTED') {
            return (
                <div className="mt-1 text-xs text-rose-500 bg-rose-500/10 p-2 rounded-md font-medium border border-rose-500/20">
                    <span className="uppercase text-[10px] font-bold opacity-70">Rejeitado em {payload.gate}</span>
                    <div className="mt-1">{payload.reason} {payload.draft?.symbol && <span className="font-mono bg-rose-500/20 px-1 rounded">[{payload.draft.symbol}]</span>}</div>
                </div>
            );
        }

        if (type === 'SIGNAL_GENERATED') {
            return (
                <div className="mt-1 text-xs text-emerald-500/90 font-medium">
                    <span className="font-mono bg-emerald-500/10 px-1.5 py-0.5 rounded text-emerald-500 border border-emerald-500/20">{payload.symbol}</span>
                    <span className="ml-2 opacity-80">{payload.side} • {payload.strategy} • Score {payload.score?.toFixed(1)}</span>
                </div>
            );
        }

        if (type === 'ORDER_FILLED') {
            return (
                <div className="mt-1 text-xs text-blue-500/90 font-medium">
                    Ticket <span className="font-mono bg-blue-500/10 px-1 rounded">#{payload.ticket}</span> filled at <span className="font-bold">{payload.price}</span>
                </div>
            );
        }

        return null;
    };

    const getFilteredAndGroupedFeed = () => {
        const now = new Date();
        const filtered = feed.filter(event => {
            if (timeFilter === 'all') return true;
            const eventTime = new Date(event.timestamp);
            const diffMs = now.getTime() - eventTime.getTime();

            if (timeFilter === '15m') return diffMs <= 15 * 60 * 1000;
            if (timeFilter === '1h') return diffMs <= 60 * 60 * 1000;
            if (timeFilter === 'today') {
                return eventTime.getDate() === now.getDate() &&
                    eventTime.getMonth() === now.getMonth() &&
                    eventTime.getFullYear() === now.getFullYear();
            }
            return true;
        });

        const groups: { hourKey: string, events: any[] }[] = [];
        const seen = new Set();

        for (const event of filtered) {
            const d = new Date(event.timestamp);
            const rawHour = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }).substring(0, 2);
            const hourKey = `${d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace(' de ', ' ')} • ${rawHour}h`;

            if (!seen.has(hourKey)) {
                seen.add(hourKey);
                groups.push({ hourKey, events: [] });
            }
            groups.find(g => g.hourKey === hourKey)!.events.push(event);
        }

        return groups;
    };

    const groupedFeed = getFilteredAndGroupedFeed();

    return (
        <div className="h-full flex flex-col bg-card rounded-lg border border-border overflow-hidden relative">
            <div className="flex justify-between items-center p-3 border-b border-border bg-muted/30">
                <div className="flex items-center gap-2 font-medium text-sm">
                    <ScrollText size={16} />
                    Glass Box Stream (Backend)
                </div>
                <div className="flex items-center gap-2">
                    <div className="hidden md:flex items-center bg-background/50 rounded p-0.5 border border-border/40">
                        <button onClick={() => setTimeFilter('15m')} className={cn("px-2 py-1 text-[9px] font-bold rounded-sm uppercase tracking-wider", timeFilter === '15m' ? "bg-muted text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>15m</button>
                        <button onClick={() => setTimeFilter('1h')} className={cn("px-2 py-1 text-[9px] font-bold rounded-sm uppercase tracking-wider", timeFilter === '1h' ? "bg-muted text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>1h</button>
                        <button onClick={() => setTimeFilter('today')} className={cn("px-2 py-1 text-[9px] font-bold rounded-sm uppercase tracking-wider", timeFilter === 'today' ? "bg-muted text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>Hoje</button>
                        <button onClick={() => setTimeFilter('all')} className={cn("px-2 py-1 text-[9px] font-bold rounded-sm uppercase tracking-wider", timeFilter === 'all' ? "bg-muted text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>Tudo</button>
                    </div>
                    <button
                        onClick={() => { setLoading(true); fetchFeed(); }}
                        className="flex items-center gap-1.5 px-2 py-1.5 rounded text-xs font-medium text-muted-foreground hover:bg-muted/50 transition-colors border border-transparent hover:border-border/50"
                        title="Force Refresh"
                    >
                        <RefreshCw size={14} className={cn(loading && "animate-spin")} />
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-auto p-4 relative z-10 custom-scrollbar">
                {groupedFeed.length === 0 && !loading ? (
                    <div className="h-full flex flex-col items-center justify-center text-muted-foreground opacity-70">
                        <Clock size={32} className="mb-3 opacity-50" />
                        <span className="text-sm font-bold">Sem Eventos</span>
                        <span className="text-xs">Altere o filtro de tempo.</span>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {groupedFeed.map((group, gIdx) => (
                            <div key={gIdx} className="space-y-3 relative">
                                <div className="sticky top-0 z-10 flex items-center justify-between py-1 bg-card/90 backdrop-blur-sm -mx-2 px-2">
                                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest bg-muted/40 px-2 py-0.5 rounded border border-border/30 flex items-center gap-1.5">
                                        <Clock size={10} /> {group.hourKey}
                                    </span>
                                    <div className="h-px bg-border/40 flex-1 mx-3" />
                                    <span className="text-[9px] font-mono text-muted-foreground/60">{group.events.length}</span>
                                </div>
                                {group.events.map((event, idx) => (
                                    <div key={idx} className="bg-card border border-border/40 p-3 rounded-xl text-sm shadow-sm transition-all relative overflow-hidden flex flex-col gap-1.5 hover:border-border/80 group/card">
                                        <div className={cn("absolute left-0 top-0 bottom-0 w-1", getBorderColor(event.type, event.component))} />
                                        <div className="flex items-center justify-between opacity-80 mb-0.5 pl-2">
                                            <div className="flex items-center gap-1.5">
                                                {getIcon(event.component, event.type)}
                                                <span className="font-bold text-[10px] uppercase tracking-wider text-muted-foreground">{event.component}</span>
                                            </div>
                                            <span className="text-[10px] font-mono bg-muted/40 text-muted-foreground px-1.5 py-0.5 rounded border border-border/50">{new Date(event.timestamp).toLocaleTimeString('pt-BR')}</span>
                                        </div>
                                        <div className="font-bold text-foreground pl-2 text-xs uppercase tracking-wide">
                                            {event.type}
                                        </div>
                                        <div className="pl-2">
                                            {renderPayload(event.type, event.payload)}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Cool gradient overlay mapping from top to bottom*/}
            <div className="absolute left-0 right-0 bottom-0 h-10 bg-gradient-to-t from-card to-transparent z-20 pointer-events-none" />
        </div>
    );
};
