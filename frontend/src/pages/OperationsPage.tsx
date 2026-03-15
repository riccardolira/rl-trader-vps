import { useState, useEffect, useCallback } from 'react';
import React from 'react';
import { TrendingUp, TrendingDown, Zap, ShieldCheck, Cpu, AlertTriangle, SlidersHorizontal, Layers, Globe, Flame, Activity } from 'lucide-react';
import { cn } from '../lib/utils';
import { api } from '../services/api';
import type { EngineState } from '../services/api';
import { wsClient } from '../core/net/wsClient';
import { StrategyControlPanel } from '../components/operations/StrategyControlPanel';
import { RiskControlPanel } from '../components/operations/RiskControlPanel';
import { EngineTuningPanel } from '../components/operations/EngineTuningPanel';
import { Link, useLocation } from 'react-router-dom';

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

function getAssetClassBadge(symbol: string, presetClass?: string) {
    let aCls = (presetClass || '').toUpperCase();
    const sym = (symbol || '').toUpperCase();

    if (!aCls || aCls === 'UNKNOWN') {
        if (sym.includes('BTC') || sym.includes('ETH')) aCls = 'CRYPTO';
        else if (sym.includes('XAU') || sym.includes('GOLD') || sym.includes('XAG') || sym.includes('SILVER')) aCls = 'METALS';
        else if (sym.includes('US100') || sym.includes('NAS') || sym.includes('US30') || sym.includes('USA30') || sym.includes('GER40') || sym.includes('UK100') || sym.includes('SPX')) aCls = 'INDICES';
        else if (sym.includes('XBR') || sym.includes('WTI') || sym.includes('OIL') || sym.includes('BRENT')) aCls = 'COMMODITIES';
        else if (sym.includes('#')) aCls = 'STOCKS';
        else aCls = 'FOREX';
    }

    let colors = "bg-slate-500/10 text-slate-500 border-slate-500/20";
    if (aCls === 'FOREX') colors = "bg-blue-500/10 text-blue-500 border-blue-500/20";
    else if (aCls === 'INDICES') colors = "bg-purple-500/10 text-purple-500 border-purple-500/20";
    else if (aCls === 'CRYPTO') colors = "bg-orange-500/10 text-orange-500 border-orange-500/20";
    else if (aCls === 'METALS') colors = "bg-yellow-500/10 text-yellow-600 border-yellow-500/20";
    else if (aCls === 'COMMODITIES') colors = "bg-amber-700/10 text-amber-600 border-amber-700/20";

    return <span className={cn("text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border tracking-widest", colors)}>{aCls}</span>;
}

const SignalCard = React.memo(({ sig, draft }: { sig: any, draft?: any }) => {
    // Determine the raw volume to display
    let volumeDisplay = null;
    if (draft && draft.raw_volume !== undefined) {
        volumeDisplay = draft.raw_volume.toFixed(2);
    } else if (sig.volume !== undefined) {
        volumeDisplay = sig.volume.toFixed(2);
    }

    return (
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
                        {getAssetClassBadge(sig.symbol, sig.asset_class)}
                    </div>
                    <div className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold">
                        Estratégia: <span className="font-bold text-foreground/80">{sig.strategy_name}</span>
                        {sig.score && <span className="ml-2 bg-muted/50 px-1.5 py-0.5 rounded border border-border/50">Score {sig.score.toFixed(1)}</span>}
                    </div>
                </div>
            </div>
            <div className="flex flex-col items-end gap-1">
                <div className="text-[11px] font-mono text-muted-foreground font-medium">
                    {new Date(sig.timestamp ? sig.timestamp : (sig.recv_time || Date.now())).toLocaleTimeString()}
                </div>
                {volumeDisplay ? (
                    <div className="text-[11px] font-mono bg-muted/80 px-2 py-0.5 rounded border border-border/50 font-medium">
                        Lot: <span className="text-foreground font-bold">{volumeDisplay}</span>
                    </div>
                ) : (
                    <div className="text-[10px] font-mono bg-muted/50 px-2 py-0.5 rounded border border-border/50 text-muted-foreground/50 italic">
                        Calculando lote...
                    </div>
                )}
            </div>
        </div>
    );
});



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
                        {getAssetClassBadge(pos.symbol, pos.asset_class)}
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
                    <span className="text-[10px] font-mono text-muted-foreground/50 transition-opacity">#{pos.ticket}</span>
                </div>
            </div>

            <div className="flex flex-col md:flex-row justify-between items-center z-10 pl-2 gap-4">
                <div className="flex flex-wrap items-center gap-4 text-xs font-mono w-full md:w-auto">
                    <div className="bg-muted/30 px-3 py-1.5 rounded-lg border border-border/50 flex flex-col">
                        <span className="text-muted-foreground/70 text-[10px] uppercase mb-0.5">Entrada</span>
                        <span className="text-foreground/90 font-bold">{Number(pos.open_price || pos.price_open)?.toFixed(5) || 'N/A'}</span>
                    </div>

                    <div className="px-3 py-1.5 rounded-lg bg-muted/60 border border-border/50 flex flex-col">
                        <span className="text-muted-foreground/70 text-[10px] uppercase mb-0.5">Preço Atual</span>
                        <span className={cn("font-bold text-sm", (pos.pnl ?? pos.profit) >= 0 ? "text-emerald-500" : "text-rose-500")}>
                            {current !== undefined ? current.toFixed(5) : '...'}
                        </span>
                    </div>

                    {pos.tp && pos.tp > 0 ? (
                        <div className="text-emerald-500 bg-emerald-500/5 px-3 py-1.5 rounded-lg border border-emerald-500/20 flex flex-col">
                            <span className="font-bold text-[10px] uppercase mb-0.5">Alvo</span>
                            <span className="text-[11px] font-semibold">{(() => {
                                const diff = Math.abs(Number(pos.open_price || pos.price_open) - Number(pos.tp));
                                return formatPnlEstimate(diff, pos.symbol, Number(pos.volume) || 0.01, pos.asset_class);
                            })()}</span>
                        </div>
                    ) : null}

                    {pos.sl && pos.sl > 0 ? (
                        <div className="text-rose-500 bg-rose-500/5 px-3 py-1.5 rounded-lg border border-rose-500/20 flex flex-col relative group/sl">
                            <span className="font-bold text-[10px] uppercase mb-0.5 flex items-center gap-1">
                                Stop
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
    const location = useLocation();

    // Extract the active sub-tab from the URL path, defaulting to 'signals'
    const activeRoute = location.pathname.split('/')[2] || 'signals';
    const activeTab = ['signals', 'drafts', 'positions', 'strategies', 'risk', 'engine'].includes(activeRoute) ? activeRoute : 'signals';

    const [engineState, setEngineState] = useState<EngineState | null>(null);
    const [signals, setSignals] = useState<any[]>([]);
    const [drafts, setDrafts] = useState<any[]>([]);
    const [positions, setPositions] = useState<any[]>([]);
    const [threats, setThreats] = useState<any[]>([]);

    const tabs = [
        { id: 'signals', label: 'Sinais', icon: Zap },
        { id: 'positions', label: 'Trades Abertos', icon: Activity },
        { id: 'strategies', label: 'Estratégia', icon: SlidersHorizontal },
        { id: 'risk', label: 'Risco', icon: ShieldCheck },
        { id: 'engine', label: 'Motor', icon: Layers },
    ] as const;

    useEffect(() => {
        const fetchState = async () => {
            const [res, newsRes, recentRes] = await Promise.all([
                api.get<EngineState>('/api/state').catch(() => null),
                api.get<{ status: string, threats: any[] }>('/api/universe/news-threats').catch(() => null),
                api.get<{ signals: any[], drafts: any[] }>('/api/events/recent').catch(() => null)
            ]);

            if (res) setEngineState(res);

            if (newsRes && newsRes.threats) setThreats(newsRes.threats);

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
                        <h2 className="text-2xl font-bold tracking-tight">Motor de Operações</h2>
                        <p className="text-sm text-muted-foreground mt-1">Pipeline de Execução ao Vivo — Estratégia → Árbitro → Broker</p>
                    </div>

                    <div className="flex gap-2 items-center">
                        <div className="flex bg-muted/30 p-1.5 rounded-full border border-border/50 shadow-sm w-max overflow-x-auto max-w-full">
                            {tabs.map(tab => (
                                <Link
                                    key={tab.id}
                                    to={`/operations/${tab.id}`}
                                    className={cn(
                                        "flex items-center gap-2 px-4 py-1.5 text-sm font-bold rounded-full transition-all duration-200 whitespace-nowrap",
                                        activeTab === tab.id
                                            ? "bg-background text-foreground shadow-[0_2px_8px_rgba(0,0,0,0.05)] border border-border/50"
                                            : "border border-transparent text-muted-foreground/80 hover:text-foreground"
                                    )}
                                >
                                    <tab.icon size={16} />
                                    {tab.label}
                                </Link>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="bg-card border-b border-border/50 p-4 rounded-xl flex flex-wrap gap-4 items-center">
                    <div className={cn("flex items-center gap-2 px-3 py-1.5 bg-muted/50 border border-border/50 rounded-lg flex-1", engineState?.strategy_engine?.running ? "bg-emerald-500/10 border-emerald-500/30" : "")}>
                        <span className={cn("w-2 h-2 rounded-full", engineState?.strategy_engine?.running ? "bg-emerald-500 animate-pulse" : "bg-neutral-500")} />
                        <span className="font-semibold text-sm">
                            Strategy Engine: <span className={engineState?.strategy_engine?.running ? "text-emerald-500 font-bold" : "text-muted-foreground"}>{engineState?.strategy_engine?.running ? "Ativo" : "Parado"}</span>
                        </span>
                    </div>
                    <div className={cn("flex items-center gap-2 px-3 py-1.5 bg-muted/50 border border-border/50 rounded-lg flex-1", engineState?.arbiter ? "bg-emerald-500/10 border-emerald-500/30" : "")}>
                        <span className={cn("w-2 h-2 rounded-full", engineState?.arbiter ? "bg-emerald-500 animate-pulse" : "bg-neutral-500")} />
                        <span className="font-semibold text-sm">
                            Árbitro: <span className={engineState?.arbiter ? "text-emerald-500 font-bold" : "text-muted-foreground"}>{engineState?.arbiter ? "Ativo" : "Aguardando"}</span>
                        </span>
                    </div>
                    <div className={cn("flex items-center gap-2 px-3 py-1.5 bg-muted/50 border border-border/50 rounded-lg flex-1", engineState?.execution?.status === "RUNNING" ? "bg-emerald-500/10 border-emerald-500/30" : "")}>
                        <span className={cn("w-2 h-2 rounded-full", engineState?.execution?.status === "RUNNING" ? "bg-emerald-500 animate-pulse" : "bg-neutral-500")} />
                        <span className="font-semibold text-sm">
                            Execução: <span className={engineState?.execution?.status === "RUNNING" ? "text-emerald-500 font-bold" : "text-muted-foreground"}>{engineState?.execution?.status === "RUNNING" ? "Ativo" : (engineState?.execution?.status || "Aguardando")}</span>
                        </span>
                    </div>
                </div>

                {/* Guardian Watchdog Status bar */}
                {engineState?.guardian && (
                    <div className="bg-card border-b border-border p-2 rounded-b-lg flex flex-wrap gap-4 items-center justify-end">
                        <div className={cn("flex items-center gap-2 px-3 py-1 rounded text-xs font-bold border", engineState.guardian.internet_ok ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/30" : "bg-destructive/10 text-destructive border-destructive/30 animate-pulse")}>
                            <Globe size={12} /> Internet: {engineState.guardian.internet_ok ? 'Online' : 'Offline'}
                        </div>
                        <div className={cn("flex items-center gap-2 px-3 py-1 rounded text-xs font-bold border", engineState.guardian.mt5_running ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/30" : "bg-destructive/10 text-destructive border-destructive/30 animate-pulse")}>
                            {engineState.guardian.mt5_running ? <Cpu size={12} /> : <Flame size={12} />} MT5: {engineState.guardian.mt5_running ? 'Rodando' : 'Crashed'}
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
                            <span className="font-bold text-sm tracking-wide">Circuit Breaker Ativado — Lockdown Diário</span>
                            <span className="text-xs opacity-90 mt-0.5">
                                O limite máximo de perda diária foi atingido. Novas ordens canceladas. Motor desativado até amanhã.
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
                            <span className="font-bold text-sm tracking-wide">Shield Ativado — Bloqueio por Notícias</span>
                            <span className="text-xs opacity-90 mt-0.5">
                                Entradas limitadas nos ativos impactados pela volatilidade de notícias de alto impacto.
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

                {activeTab === 'signals' && (
                    <div className="flex flex-col h-full overflow-y-auto w-full max-w-5xl mx-auto">
                        {signals.length === 0 ? (
                            <div className="flex flex-col h-full items-center justify-center text-muted-foreground flex-1">
                                <Zap size={48} className="mb-4 opacity-50" />
                                <p>Aguardando Sinais da Strategy Engine...</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {signals.map((sig, idx) => {
                                    const draft = drafts.find(d => d.signal_id === sig.id || (d.symbol === sig.symbol && (!d.side || d.side === sig.direction || d.direction === sig.direction) && (!d.strategy_name || d.strategy_name === sig.strategy_name)));
                                    return <SignalCard key={idx} sig={sig} draft={draft} />;
                                })}
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

                {activeTab === 'risk' && (
                    <div className="flex flex-col h-full overflow-y-auto">
                        <RiskControlPanel />
                    </div>
                )}

                {activeTab === 'engine' && (
                    <div className="flex flex-col h-full overflow-y-auto">
                        <EngineTuningPanel />
                    </div>
                )}
            </div>
        </div>
    );
};










