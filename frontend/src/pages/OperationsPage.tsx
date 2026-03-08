import { useState, useEffect, useCallback } from 'react';
import React from 'react';
import { Activity, TrendingUp, TrendingDown, Zap, ShieldCheck, Cpu, AlertTriangle, SlidersHorizontal } from 'lucide-react';
import { cn } from '../lib/utils';
import { api } from '../services/api';
import type { EngineState } from '../services/api';
import { wsClient } from '../core/net/wsClient';
import { StrategyControlPanel } from '../components/operations/StrategyControlPanel';

function formatPnlEstimate(diff: number, symbol: string, volume: number, assetClass?: string): string {
    const sym = (symbol || '').toUpperCase();
    const aCls = (assetClass || '').toUpperCase();

    // Classification (Manual fallback if assetClass is missing)
    const isCrypto = aCls === 'CRYPTO' || sym.includes('BTC') || sym.includes('ETH');
    const isMetal = aCls === 'METALS' || sym.includes('XAU') || sym.includes('GOLD') || sym.includes('XAG') || sym.includes('SILVER');
    const isIndices = aCls === 'INDICES' || sym.includes('US100') || sym.includes('NAS') || sym.includes('US30') || sym.includes('USA30') || sym.includes('GER40') || sym.includes('UK100') || sym.includes('SPX');
    const isCommodity = aCls === 'COMMODITIES' || sym.includes('XBR') || sym.includes('WTI') || sym.includes('OIL') || sym.includes('BRENT');
    const isStock = aCls === 'STOCKS_US' || aCls === 'STOCKS_BR' || sym.includes('#');
    const isForex = aCls === 'FOREX' || (!isCrypto && !isMetal && !isIndices && !isCommodity && !isStock);

    let tickSize = 0.00001;
    let tickValue = 1.0;
    let displayStr = "";
    let ticks = 0;

    if (isForex) {
        if (sym.includes('JPY') || sym.includes('HUF') || sym.includes('CZK')) {
            tickSize = 0.001;
            // 1 lot of X/JPY usually has tick value ~$0.66-1.0 depending on USDJPY
            tickValue = sym.includes('JPY') ? 0.66 : (sym.includes('HUF') ? 0.26 : 0.42);
            displayStr = `${(diff * 100).toFixed(1)} pips`;
        } else {
            tickSize = 0.00001;
            tickValue = sym.includes('ZAR') || sym.includes('MXN') ? 0.50 : 1.0;
            displayStr = `${(diff * 10000).toFixed(1)} pips`;
        }
        ticks = diff / tickSize;
    } else if (isMetal) {
        if (sym.includes('XAG') || sym.includes('SILVER')) {
            tickSize = 0.001;
            tickValue = 5.0; // 5000 units per lot for silver usually
            displayStr = `${(diff * 1000).toFixed(0)} pts`;
        } else {
            tickSize = 0.01;
            tickValue = 1.0;
            displayStr = `${(diff * 100).toFixed(0)} pts`;
        }
        ticks = diff / tickSize;
    } else if (isStock) {
        tickSize = 0.01;
        tickValue = 1.0;
        displayStr = `${diff.toFixed(2)} pts`;
        ticks = diff / tickSize;
    } else if (isCrypto) {
        tickSize = 0.01;
        tickValue = 0.01; // Assuming 1.0 lot = 1 unit
        displayStr = `${diff.toFixed(2)} pts`;
        ticks = diff / tickSize;
    } else if (isIndices) {
        tickSize = 1.0; // Standard 1 point = $1 per 1.0 lot
        tickValue = 1.0;
        displayStr = `${diff.toFixed(2)} pts`;
        ticks = diff / tickSize;
    } else if (isCommodity) {
        tickSize = 0.01;
        tickValue = 10.0; // Crude oil usually $10 per tick per lot
        displayStr = `${diff.toFixed(2)} pts`;
        ticks = diff / tickSize;
    } else {
        tickSize = 0.01;
        tickValue = 1.0;
        displayStr = `${diff.toFixed(2)} pts`;
        ticks = diff / tickSize;
    }

    const estMoney = (ticks * tickValue * (volume || 0.01)).toFixed(2);
    return `${displayStr} (~$${estMoney})`;
}

const SignalCard = React.memo(({ sig }: { sig: any }) => (
    <div className="bg-card border border-border/50 p-4 rounded-xl shadow-sm hover:shadow-md transition-all duration-200 hover:border-primary/30 flex items-center justify-between group">
        <div className="flex items-center gap-4">
            <div className={cn(
                "w-10 h-10 rounded-lg flex items-center justify-center shrink-0 border shadow-sm",
                sig.direction === 'BUY' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-rose-500/10 text-rose-500 border-rose-500/20'
            )}>
                {sig.direction === 'BUY' ? <TrendingUp size={18} /> : <TrendingDown size={18} />}
            </div>
            <div className="flex flex-col gap-0.5">
                <div className="flex items-center gap-2">
                    <span className="font-bold text-lg tracking-tight text-foreground/90">{sig.symbol}</span>
                    <span className={cn(
                        "px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase",
                        sig.direction === 'BUY' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-500 border border-rose-500/20'
                    )}>
                        {sig.direction}
                    </span>
                </div>
                <div className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold">
                    Estratégia: <span className="font-bold text-foreground/80">{sig.strategy_name}</span>
                </div>
            </div>
        </div>
        <div className="text-[10px] font-mono text-muted-foreground/50 opacity-0 group-hover:opacity-100 transition-opacity">
            {new Date(sig.recv_time || Date.now()).toLocaleTimeString()}
        </div>
    </div>
));

const DraftCard = React.memo(({ draft }: { draft: any }) => (
    <div className="bg-card border border-border/50 p-4 rounded-xl shadow-sm hover:shadow-md transition-all duration-200 hover:border-primary/30 flex items-center justify-between group">
        <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 border border-primary/20 bg-primary/10 text-primary shadow-sm">
                <ShieldCheck size={18} />
            </div>
            <div className="flex flex-col gap-0.5">
                <span className="font-bold text-lg tracking-tight text-foreground/90">{draft.symbol}</span>
                <span className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold">Risk Engine Draft</span>
            </div>
        </div>
        <div className="text-xs font-mono bg-muted/50 px-3 py-1.5 rounded-lg border border-border/50 font-medium">
            Lot: <span className="text-foreground">{draft.raw_volume?.toFixed(2)}</span>
        </div>
    </div>
));

const PositionCard = React.memo(({ pos, handleClosePosition }: { pos: any, handleClosePosition: (t: number) => void }) => {
    const rawCurrent = pos.price_current || pos.close_price;
    const current = rawCurrent && !isNaN(parseFloat(rawCurrent)) ? parseFloat(rawCurrent) : undefined;

    return (
        <div className="bg-card border border-border/50 p-5 rounded-2xl shadow-sm hover:shadow-md transition-shadow flex flex-col gap-5 relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-transparent to-transparent via-border/10 group-hover:via-primary/50 transition-colors" />
            <div className="flex justify-between items-start z-10 pl-2">
                <div className="flex flex-col gap-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-xl tracking-tight text-foreground/90">{pos.symbol}</span>
                        <span className={cn(
                            "px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider",
                            pos.side === 'BUY' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/30' : 'bg-rose-500/10 text-rose-500 border border-rose-500/30'
                        )}>
                            {pos.side}
                        </span>
                        <span className="text-[10px] font-mono bg-muted/80 px-2 py-0.5 rounded text-muted-foreground border border-border/50 font-bold">
                            {pos.volume} Lots
                        </span>
                        {pos.asset_class && (
                            <span className="text-[10px] font-bold uppercase bg-primary/10 text-primary px-2 py-0.5 rounded border border-primary/20 tracking-widest">
                                {pos.asset_class}
                            </span>
                        )}
                        {pos.is_market_closed ? (
                            <span className="text-[10px] font-bold uppercase bg-neutral-500/10 text-neutral-500 px-2 py-0.5 rounded border border-neutral-500/20 tracking-widest">
                                FECHADO
                            </span>
                        ) : (
                            <span className="text-[10px] font-bold uppercase bg-emerald-500/10 text-emerald-500 px-2 py-0.5 rounded border border-emerald-500/20 tracking-widest flex items-center gap-1">
                                ABERTO
                                {pos.minutes_until_close !== undefined && pos.minutes_until_close !== null && (
                                    <span className="text-[9px] bg-emerald-500/20 px-1.5 rounded ml-1 lowercase font-mono">
                                        {(() => {
                                            const min = Math.floor(pos.minutes_until_close);
                                            if (min < 60) return `${min}m left`;
                                            const h = Math.floor(min / 60);
                                            const m = min % 60;
                                            return `${h}h${m.toString().padStart(2, '0')}`;
                                        })()}
                                    </span>
                                )}
                            </span>
                        )}
                    </div>
                    <div className="text-[11px] text-muted-foreground/80 uppercase font-semibold tracking-wider">
                        Estratégia: <span className="font-bold text-foreground/80">{pos.strategy_name || 'Sincronizando...'}</span>
                    </div>
                </div>
                <div className="text-right flex flex-col items-end mt-[-4px]">
                    <span className={cn("font-bold text-2xl tracking-tighter", (pos.pnl ?? pos.profit) >= 0 ? "text-emerald-500" : "text-rose-500")}>
                        {(pos.pnl ?? pos.profit) >= 0 ? '+' : ''}{(pos.pnl ?? pos.profit)?.toFixed(2)}
                    </span>
                    <span className="text-[10px] font-mono text-muted-foreground/50 opacity-0 group-hover:opacity-100 transition-opacity">TICKET #{pos.ticket}</span>
                </div>
            </div>

            <div className="flex flex-col md:flex-row justify-between items-center z-10 pl-2 gap-4">
                <div className="flex flex-wrap items-center gap-4 text-xs font-mono w-full md:w-auto">
                    <div className="bg-muted/30 px-3 py-1.5 rounded-lg border border-border/50 flex flex-col">
                        <span className="text-muted-foreground/70 text-[10px] uppercase mb-0.5">Entry</span>
                        <span className="text-foreground/90 font-bold">{Number(pos.open_price || pos.price_open)?.toFixed(5) || 'N/A'}</span>
                    </div>

                    <div className="px-3 py-1.5 rounded-lg bg-muted/60 border border-border/50 flex flex-col">
                        <span className="text-muted-foreground/70 text-[10px] uppercase mb-0.5">Mark</span>
                        <span className={cn("font-bold text-sm", (pos.pnl ?? pos.profit) >= 0 ? "text-emerald-500" : "text-rose-500")}>
                            {current !== undefined ? current.toFixed(5) : '...'}
                        </span>
                    </div>

                    {pos.tp && pos.tp > 0 ? (
                        <div className="text-emerald-500 bg-emerald-500/5 px-3 py-1.5 rounded-lg border border-emerald-500/20 flex flex-col">
                            <span className="font-bold text-[10px] uppercase mb-0.5">Win</span>
                            <span className="text-[11px] font-semibold">{(() => {
                                const diff = Math.abs(Number(pos.open_price || pos.price_open) - Number(pos.tp));
                                return formatPnlEstimate(diff, pos.symbol, Number(pos.volume) || 0.01, pos.asset_class);
                            })()}</span>
                        </div>
                    ) : null}

                    {pos.sl && pos.sl > 0 ? (
                        <div className="text-rose-500 bg-rose-500/5 px-3 py-1.5 rounded-lg border border-rose-500/20 flex flex-col relative group/sl">
                            <span className="font-bold text-[10px] uppercase mb-0.5 flex items-center gap-1">
                                Loss
                                {(() => {
                                    // Visual cue for Break Even or Trailing Stop if SL moved beyond open price
                                    const isBuy = pos.side === 'BUY';
                                    const improved = isBuy ? Number(pos.sl) >= Number(pos.open_price || pos.price_open) : Number(pos.sl) <= Number(pos.open_price || pos.price_open);
                                    if (improved) return <ShieldCheck size={10} className="text-emerald-500 animate-pulse" />;
                                    return <TrendingUp size={10} className="opacity-0 group-hover/sl:opacity-100 group-hover/sl:animate-bounce transition-all duration-300" />;
                                })()}
                            </span>
                            <span className="text-[11px] font-semibold">{(() => {
                                const diff = Math.abs(Number(pos.open_price || pos.price_open) - Number(pos.sl));
                                return formatPnlEstimate(diff, pos.symbol, Number(pos.volume) || 0.01, pos.asset_class);
                            })()}</span>
                        </div>
                    ) : null}
                </div>

                <div className="w-full md:w-auto flex justify-center md:justify-end">
                    <button
                        onClick={() => handleClosePosition(Number(pos.ticket))}
                        className="text-[11px] uppercase tracking-wider font-bold bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 border border-rose-500/30 px-6 py-2 rounded-xl transition-all shadow-sm hover:shadow"
                    >
                        Fechar a Mercado
                    </button>
                </div>
            </div>
        </div>
    );
});

export const OperationsPage: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'pipeline' | 'drafts' | 'positions' | 'strategies'>('pipeline');
    const [engineState, setEngineState] = useState<EngineState | null>(null);
    const [signals, setSignals] = useState<any[]>([]);
    const [drafts, setDrafts] = useState<any[]>([]);
    const [positions, setPositions] = useState<any[]>([]);
    const [threats, setThreats] = useState<any[]>([]);


    const tabs = [
        { id: 'pipeline', label: 'Signals Pipeline', icon: Zap },
        { id: 'drafts', label: 'Risk & Drafts', icon: Activity },
        { id: 'positions', label: 'Live Positions', icon: Cpu },
        { id: 'strategies', label: 'Engine Tuning', icon: SlidersHorizontal },
    ] as const;

    useEffect(() => {
        const fetchState = async () => {
            const res = await api.get<EngineState>('/api/state').catch(() => null);
            if (res) setEngineState(res);

            const newsRes = await api.get<{ status: string, threats: any[] }>('/api/universe/news-threats').catch(() => null);
            if (newsRes && newsRes.threats) setThreats(newsRes.threats);
            const recentRes = await api.get<{ signals: any[], drafts: any[] }>('/api/events/recent').catch(() => null);
            if (recentRes) {
                if (recentRes.signals) setSignals(recentRes.signals);
                if (recentRes.drafts) setDrafts(recentRes.drafts);
            }
        };
        fetchState();
        const interval = setInterval(fetchState, 15000);
        const unsubscribe = wsClient.subscribeData((data: any) => {
            if (data.type === 'SIGNAL_GENERATED' && data.payload) {
                setSignals(prev => [{ ...data.payload, recv_time: Date.now() }, ...prev].slice(0, 50));
            } else if (data.type === 'ORDER_DRAFTED' && data.payload) {
                setDrafts(prev => [{ ...data.payload, recv_time: Date.now() }, ...prev].slice(0, 50));
            } else if (data.type === 'LIVE_POSITION_UPDATE' && data.payload) {
                if (data.payload.trades) {
                    setPositions(prev => {
                        if (data.payload.trades.length === 0 && prev.length > 0) {
                            return [];
                        }

                        // Merge by ticket to maintain object stability for React
                        const newTradesMap = new Map(data.payload.trades.map((t: any) => [t.ticket, t]));
                        const merged = prev.map(p => {
                            const newTrade = newTradesMap.get(p.ticket);
                            return newTrade ? { ...p, ...newTrade } : null;
                        }).filter(Boolean);

                        const existingTickets = new Set(prev.map(p => p.ticket));
                        const added = data.payload.trades.filter((t: any) => !existingTickets.has(t.ticket));

                        return [...merged, ...added];
                    });
                }
            } else if (['ORDER_FILLED', 'POSITION_CLOSED', 'POSITION_DESYNC_CLOSED', 'POSITION_ADOPTED'].includes(data.type)) {
                api.get<{ count: number, trades: any[] }>('/api/trades/active').then(res => {
                    if (res?.trades) setPositions(res.trades);
                }).catch(() => { });
            }
        });
        return () => { clearInterval(interval); unsubscribe(); };
    }, []);



    const handleClosePosition = useCallback(async (ticket: number) => {
        try {
            await api.post(`/api/trades/${ticket}/close`, {});
            setPositions(prev => prev.filter(p => Number(p.ticket) !== ticket));
        } catch (e) {
            console.error("Failed to close position manually", e);
        }
    }, []);

    return (
        <div className="space-y-6 h-full flex flex-col">
            <header className="flex flex-col gap-4 mb-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h2 className="text-3xl font-bold tracking-tight">Motor de Operações</h2>
                        <p className="text-sm text-muted-foreground mt-1">Live Execution Pipeline (Strategy ➔ Arbiter ➔ Broker)</p>
                    </div>

                    <div className="flex gap-2 items-center">
                        <div className="flex bg-muted/30 p-1.5 rounded-full border border-border/50 shadow-sm w-max overflow-x-auto max-w-full">
                            {tabs.map(tab => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id as any)}
                                    className={cn(
                                        "flex items-center gap-2 px-4 py-1.5 text-sm font-bold rounded-full transition-all duration-200 whitespace-nowrap",
                                        activeTab === tab.id
                                            ? "bg-background text-foreground shadow-[0_2px_8px_rgba(0,0,0,0.05)] border border-border/50"
                                            : "border border-transparent text-muted-foreground/80 hover:text-foreground"
                                    )}
                                >
                                    <tab.icon size={16} />
                                    {tab.label}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="bg-card border-b border-border/50 p-4 rounded-xl flex flex-wrap gap-4 items-center">
                    <div className={cn("flex items-center gap-2 px-3 py-1 bg-muted/50 border border-border/50 rounded flex-1", engineState?.strategy_engine?.running ? "bg-emerald-500/10 border-emerald-500/30" : "")}>
                        <span className={cn("w-2 h-2 rounded-full", engineState?.strategy_engine?.running ? "bg-emerald-500 animate-pulse" : "bg-neutral-500")} />
                        <span className="font-mono text-sm font-semibold">
                            STRATEGY ENGINE: {engineState?.strategy_engine?.running ? "ACTIVE" : "STOPPED"}
                        </span>
                    </div>
                    <div className={cn("flex items-center gap-2 px-3 py-1 bg-muted/50 border border-border/50 rounded flex-1", engineState?.arbiter ? "bg-emerald-500/10 border-emerald-500/30" : "")}>
                        <span className={cn("w-2 h-2 rounded-full", engineState?.arbiter ? "bg-emerald-500 animate-pulse" : "bg-neutral-500")} />
                        <span className="font-mono text-sm font-semibold">ARBITER: {engineState?.arbiter ? "ACTIVE" : "WAITING"}</span>
                    </div>
                    <div className={cn("flex items-center gap-2 px-3 py-1 bg-muted/50 border border-border/50 rounded flex-1", engineState?.execution?.status === "RUNNING" ? "bg-emerald-500/10 border-emerald-500/30" : "")}>
                        <span className={cn("w-2 h-2 rounded-full", engineState?.execution?.status === "RUNNING" ? "bg-emerald-500 animate-pulse" : "bg-neutral-500")} />
                        <span className="font-mono text-sm font-semibold">EXECUTION: {engineState?.execution?.status || "WAITING"}</span>
                    </div>
                </div>

                {/* Guardian Watchdog Status bar */}
                {engineState?.guardian && (
                    <div className="bg-card border-b border-border p-2 rounded-b-lg flex flex-wrap gap-4 items-center justify-end">
                        <div className={cn("flex items-center gap-2 px-3 py-1 rounded text-xs font-bold border", engineState.guardian.internet_ok ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/30" : "bg-destructive/10 text-destructive border-destructive/30 animate-pulse")}>
                            {engineState.guardian.internet_ok ? '🌐 INTERNET: ONLINE' : '⚠️ INTERNET: OFFLINE'}
                        </div>
                        <div className={cn("flex items-center gap-2 px-3 py-1 rounded text-xs font-bold border", engineState.guardian.mt5_running ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/30" : "bg-destructive/10 text-destructive border-destructive/30 animate-pulse")}>
                            {engineState.guardian.mt5_running ? '🚀 MT5.EXE: RUNNING' : '🔥 MT5.EXE: CRASHED'}
                        </div>
                        {engineState.guardian.hard_restarts > 0 && (
                            <div className="text-xs font-mono text-muted-foreground ml-2">
                                Restarts: {engineState.guardian.hard_restarts}
                            </div>
                        )}
                    </div>
                )}
            </header>

            {(() => {
                const now = new Date();
                const activeThreats = threats.filter(ev => {
                    const dateLocal = new Date(ev.time_utc);
                    const diffMins = (dateLocal.getTime() - now.getTime()) / 60000;
                    if (ev.impact === 'High' && diffMins >= -60 && diffMins <= 30) return true;
                    if (ev.impact === 'Holiday' && dateLocal.getDate() === now.getDate()) return true;
                    return false;
                });

                if (engineState?.execution?.circuit_breaker_tripped) {
                    return (
                        <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-lg flex items-center gap-3 animate-in fade-in shadow-sm">
                            <AlertTriangle className="animate-pulse" size={24} />
                            <div className="flex flex-col">
                                <span className="font-bold text-sm tracking-wide">🚨 CIRCUIT BREAKER TRIPADO (LOCKDOWN DIÁRIO)</span>
                                <span className="text-xs opacity-90 mt-0.5">
                                    O limite máximo de perda diária foi atingido! O robô cancelou novas ordens e o motor de execução está desativado até o próximo dia.
                                </span>
                            </div>
                        </div>
                    );
                }

                if (activeThreats.length > 0) {
                    return (
                        <div className="bg-amber-500/10 border border-amber-500/20 text-amber-500 px-4 py-3 rounded-lg flex items-center gap-3 animate-in fade-in shadow-sm">
                            <AlertTriangle className="animate-pulse" size={24} />
                            <div className="flex flex-col">
                                <span className="font-bold text-sm tracking-wide">SHIELD ATIVADO: BLOQUEIO DE NOTÍCIAS (LOCKDOWN)</span>
                                <span className="text-xs opacity-90 mt-0.5">
                                    O Motor de Operações está limitando entradas para ativos impactados pela alta volatilidade de notícias.
                                </span>
                            </div>
                        </div>
                    );
                }
                return null;
            })()}

            <div className="flex-1 overflow-hidden p-4 bg-muted/10 border border-border rounded-lg relative flex flex-col">
                {activeTab === 'strategies' && (
                    <div className="flex flex-col h-full overflow-y-auto">
                        <StrategyControlPanel />
                    </div>
                )}

                {activeTab === 'pipeline' && (
                    <div className="flex flex-col h-full overflow-y-auto">
                        {signals.length === 0 ? (
                            <div className="flex flex-col h-full items-center justify-center text-muted-foreground flex-1">
                                <Zap size={48} className="mb-4 opacity-50" />
                                <p>Aguardando Sinais da Strategy Engine...</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {signals.map((sig, idx) => (
                                    <SignalCard key={idx} sig={sig} />
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'drafts' && (
                    <div className="flex flex-col h-full overflow-y-auto">
                        {drafts.length === 0 ? (
                            <div className="flex flex-col h-full items-center justify-center text-muted-foreground flex-1">
                                <Activity size={48} className="mb-4 opacity-50" />
                                <p>Nenhum rascunho de ordem pendente para Arbiter e Risk Management.</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {drafts.map((draft, idx) => (
                                    <DraftCard key={idx} draft={draft} />
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'positions' && (
                    <div className="flex flex-col h-full overflow-y-auto">
                        {positions.length === 0 ? (
                            <div className="flex flex-col h-full items-center justify-center text-muted-foreground flex-1">
                                <Cpu size={48} className="mb-4 opacity-50" />
                                <p>Sem posições ativas sincronizadas com o servidor.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                                {positions.map((pos) => (
                                    <PositionCard
                                        key={pos.ticket}
                                        pos={pos}
                                        handleClosePosition={handleClosePosition}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};










