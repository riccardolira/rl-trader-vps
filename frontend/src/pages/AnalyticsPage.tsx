import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Target, TrendingUp, Clock, ShieldAlert, Cpu, Lightbulb, BarChart2, Calendar } from 'lucide-react';
import { cn } from '../lib/utils';
import { PerformanceBar } from '../components/common/PerformanceBar';
import { TradeHistory } from '../components/operations/TradeHistory';
import { BarChart, Bar, CartesianGrid as BarCartesianGrid, Tooltip as BarTooltip, XAxis as BarXAxis, YAxis as BarYAxis, Legend } from 'recharts';
import { ShieldCheck } from 'lucide-react';
import { wsClient } from '../core/net/wsClient'; // Import WS Client

// --- Redesign UI Helper for Rejection Cards (3 States) ---
const RejectionCardContent = ({ data, colors, type }: { data: Record<string, number>, colors: string[], type: 'SCANNER' | 'GUARDIAN' }) => {
    const entries = Object.entries(data || {}).filter(([_, v]) => v > 0).sort((a, b) => b[1] - a[1]);
    const total = entries.reduce((acc, [_, v]) => acc + v, 0);

    // State C: Empty State
    if (entries.length === 0) {
        return (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground/60 p-4">
                <ShieldCheck size={32} className="mb-3 opacity-50" />
                <p className="text-sm font-medium">Sem {type === 'SCANNER' ? 'rejeições' : 'bloqueios'} registrados</p>
                <p className="text-xs opacity-70">Operações fluidas nesta sessão</p>
            </div>
        );
    }

    // State B: Single Dominant Reason
    if (entries.length === 1) {
        const [reason, count] = entries[0];
        const color = colors[0];
        return (
            <div className="h-full flex flex-col justify-center p-2 mt-4">
                <div className="mb-6 text-center">
                    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Causa Dominante</p>
                    <p className="text-3xl font-black" style={{ color }}>100%</p>
                    <p className="text-base font-medium text-foreground/90 mt-2 px-4 text-center leading-tight">{reason}</p>
                </div>

                <div className="bg-muted/30 p-4 rounded-xl flex items-center justify-between border border-border/40 mb-2">
                    <span className="text-sm font-medium text-foreground/80">Ocorrências totais</span>
                    <span className="font-mono font-bold text-base bg-background px-3 py-1 rounded-md shadow-sm border border-border/50">{count}</span>
                </div>

                <div className="mt-4 h-2 w-full bg-muted/50 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-1000 ease-out" style={{ width: '100%', backgroundColor: color }} />
                </div>
                <p className="text-[10px] text-center text-muted-foreground/50 mt-3 font-mono uppercase tracking-widest">Motivo Único</p>
            </div>
        );
    }

    // State A: Multiple Reasons (Ranking & Mini Bar)
    return (
        <div className="h-full flex flex-col pt-1 min-h-0">
            {/* 100% Stacked Progress Bar (Compact Summary) */}
            <div className="h-2.5 w-full bg-muted/30 rounded-full overflow-hidden flex mb-5 shadow-inner">
                {entries.map(([_, count], idx) => (
                    <div
                        key={idx}
                        className="h-full transition-all duration-500 hover:brightness-110"
                        style={{ width: `${(count / total) * 100}%`, backgroundColor: colors[idx % colors.length] }}
                        title={`${Math.round((count / total) * 100)}%`}
                    />
                ))}
            </div>

            {/* Scrolling Ranked List */}
            <div className="flex-1 overflow-y-auto pr-2 space-y-4 scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent min-h-0">
                {entries.map(([reason, count], idx) => {
                    const pct = Math.round((count / total) * 100);
                    const color = colors[idx % colors.length];
                    return (
                        <div key={idx} className="group">
                            <div className="flex justify-between items-end mb-2">
                                <span className="text-sm font-medium text-foreground/80 truncate pr-2 flex items-center gap-2">
                                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                                    <span className="group-hover:text-foreground transition-colors" title={reason}>{reason}</span>
                                </span>
                                <div className="flex items-center gap-2 shrink-0">
                                    <span className="text-xs text-muted-foreground mr-1" style={{ color }}>{pct}%</span>
                                    <span className="font-mono font-bold text-sm text-foreground bg-muted/50 px-2 py-0.5 rounded-md">{count}</span>
                                </div>
                            </div>
                            <div className="h-2 w-full bg-muted/50 rounded-full overflow-hidden flex justify-start">
                                <div className="h-full rounded-full transition-all duration-700 ease-out opacity-80 group-hover:opacity-100" style={{ width: `${pct}%`, backgroundColor: color }} />
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="mt-3 pt-2 border-t border-border/30 flex justify-between items-center text-[10px] text-muted-foreground">
                <span className="uppercase font-bold tracking-wider">Total Registros</span>
                <span className="font-mono font-bold text-foreground bg-muted/50 px-2 py-0.5 rounded">{total}</span>
            </div>
        </div>
    );
};
// ---------------------------------------------------------

export const AnalyticsPage: React.FC = () => {
    const [dashboardData, setDashboardData] = useState<any>(null);
    const [transparencyData, setTransparencyData] = useState<any>(null);
    const [insights, setInsights] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    // Global Date Filter State (Frontend Only)
    const [periodPreset, setPeriodPreset] = useState<'today' | '24h' | '7d' | '30d' | 'all'>('all');

    // Tab Navigation State
    const [activeTab, setActiveTab] = useState<'performance' | 'post-mortem'>('performance');

    // Post-Mortem Drawer State
    const [selectedTrade, setSelectedTrade] = useState<any | null>(null);

    // Minimal Live State for Signals
    const [liveSignals, setLiveSignals] = useState<Record<string, number>>({});

    const fetchAll = React.useCallback(async () => {
        try {
            let startDt = '';
            let endDt = '';
            const now = new Date();
            if (periodPreset !== 'all') {
                const start = new Date(now);
                if (periodPreset === 'today') {
                    start.setHours(0, 0, 0, 0);
                } else if (periodPreset === '24h') {
                    start.setHours(start.getHours() - 24);
                } else if (periodPreset === '7d') {
                    start.setDate(start.getDate() - 7);
                } else if (periodPreset === '30d') {
                    start.setDate(start.getDate() - 30);
                }
                startDt = start.toISOString();
                endDt = now.toISOString();
            }

            const queryParams = startDt ? `?start_dt=${startDt}&end_dt=${endDt}` : '';

            const [dashRes, insRes, transRes] = await Promise.all([
                api.get<any>(`/api/analytics/dashboard${queryParams}`).catch(e => { console.error("Dashboard failed", e); return null; }),
                api.get<any>('/api/analytics/insights').catch(e => { console.error("Insights failed", e); return null; }),
                api.get<any>('/api/analytics/transparency').catch(e => { console.error("Transparency failed", e); return null; })
            ]);

            if (dashRes) setDashboardData(dashRes);
            if (insRes && insRes.insights) setInsights(insRes.insights);
            if (transRes) {
                setTransparencyData(transRes);
                // Hydrate base counters from DB on boot/poll
                setLiveSignals(prev => ({
                    ...transRes.strategy_signals,
                    ...prev // live events have priority if already counting
                }));
            }

        } catch (e) {
            console.error("Failed to fetch analytics", e);
        } finally {
            setLoading(false);
        }
    }, [periodPreset]);

    useEffect(() => {
        setLoading(true);
        fetchAll();
        const interval = setInterval(fetchAll, 30000); // refresh heavy DB queries every 30s
        return () => clearInterval(interval);
    }, [fetchAll]);

    // WebSocket listener for instant signals (Minimal footprint)
    useEffect(() => {
        const unsubscribe = wsClient.subscribeData((data: any) => {
            if (data?.type === 'SIGNAL_GENERATED') {
                const stratName = data.payload?.strategy_name || "Unknown";
                setLiveSignals(prev => ({
                    ...prev,
                    [stratName]: (prev[stratName] || 0) + 1
                }));
            }
        });
        return () => { unsubscribe(); };
    }, []);

    if (loading) {
        return (
            <div className="flex flex-1 items-center justify-center text-muted-foreground animate-pulse flex-col">
                <Cpu size={48} className="mb-4 opacity-50" />
                <p>Processando Matriz de Analytics...</p>
            </div>
        );
    }

    if (!dashboardData || !dashboardData.metrics) {
        return (
            <div className="p-6">Falha ao carregar Analytics.</div>
        );
    }

    const { metrics } = dashboardData;
    const sortedSymbols = Object.entries(metrics.symbol_performance || {})
        .sort((a: any, b: any) => b[1].profit - a[1].profit)
        .slice(0, 5);

    const strategyData = Object.entries(metrics.strategy_performance || {}).map(([name, data]: [string, any]) => ({
        name,
        profit: data.profit,
        winRate: data.win_rate,
        trades: data.trades
    })).sort((a: any, b: any) => b.profit - a.profit);

    return (
        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">Analytics</h2>
                    <p className="text-sm text-muted-foreground mt-1">Performance, Ledger e Recomendações do Sistema</p>
                </div>

                <div className="flex flex-col gap-2 items-end">
                    {/* Métricas profissionais (Sharpe, Sortino, Win Rate, R/R) */}
                    <PerformanceBar />

                    {/* Global Date Filter Bar */}
                    <div className="flex items-center gap-2 bg-card border border-border/50 p-1.5 rounded-full shadow-sm">
                        <Calendar size={16} className="text-muted-foreground ml-3" />
                        <span className="text-[11px] font-bold text-muted-foreground mr-1 uppercase tracking-wider">Período:</span>
                        <div className="flex bg-muted/30 rounded-full p-0.5 border border-border/40 overflow-hidden">
                            {(['today', '24h', '7d', '30d', 'all'] as const).map((preset) => (
                                <button
                                    key={preset}
                                    onClick={() => setPeriodPreset(preset)}
                                    className={cn(
                                        "px-4 py-1.5 text-[10px] font-bold rounded-full transition-all uppercase tracking-widest",
                                        periodPreset === preset
                                            ? "bg-background text-foreground shadow-[0_2px_8px_rgba(0,0,0,0.05)] border border-border/50"
                                            : "text-muted-foreground/80 hover:text-foreground border border-transparent"
                                    )}
                                >
                                    {preset === 'today' ? 'Hoje' : preset === 'all' ? 'Tudo' : preset}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </header>

            {/* Segmented Control / Tabs */}
            <div className="flex justify-center mb-6">
                <div className="flex bg-muted/40 p-1 rounded-xl shadow-inner border border-border/50">
                    <button
                        onClick={() => setActiveTab('performance')}
                        className={cn("px-8 py-2 text-sm font-bold rounded-lg transition-all", activeTab === 'performance' ? "bg-background shadow-md text-foreground border border-border" : "text-muted-foreground hover:text-foreground")}
                    >
                        Visão Geral
                    </button>
                    <button
                        onClick={() => setActiveTab('post-mortem')}
                        className={cn("px-8 py-2 text-sm font-bold rounded-lg transition-all", activeTab === 'post-mortem' ? "bg-background shadow-md text-primary border border-primary/20" : "text-muted-foreground hover:text-primary")}
                    >
                        Análise Post-Mortem
                    </button>
                </div>
            </div>

            {activeTab === 'performance' && (
                <div className="space-y-6">
                    {/* AI Recommendations */}
                    {insights.length > 0 && (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {insights.map((ins, idx) => (
                                <div key={idx} className={cn(
                                    "p-4 rounded-xl border flex items-start gap-4",
                                    ins.type === 'warning' ? "bg-rose-500/10 border-rose-500/20" :
                                        ins.type === 'success' ? "bg-emerald-500/10 border-emerald-500/20" :
                                            "bg-blue-500/10 border-blue-500/20"
                                )}>
                                    <div className={cn(
                                        "p-2 rounded-lg mt-0.5",
                                        ins.type === 'warning' ? "bg-rose-500/20 text-rose-500" :
                                            ins.type === 'success' ? "bg-emerald-500/20 text-emerald-500" :
                                                "bg-blue-500/20 text-blue-500"
                                    )}>
                                        {ins.type === 'warning' ? <ShieldAlert size={20} /> :
                                            ins.type === 'success' ? <TrendingUp size={20} /> : <Lightbulb size={20} />}
                                    </div>
                                    <div>
                                        <h4 className={cn("font-bold mb-1",
                                            ins.type === 'warning' ? "text-rose-500" :
                                                ins.type === 'success' ? "text-emerald-500" : "text-blue-500"
                                        )}>{ins.title}</h4>
                                        <p className="text-sm text-foreground/80 leading-snug">{ins.message}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Main KPIs (With Donuts) */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="bg-card border border-border p-5 rounded-xl flex flex-col">
                            <p className="text-xs text-muted-foreground font-bold uppercase tracking-wider mb-2 flex justify-between">Total PnL Histórico <span className="text-[9px] opacity-50">SESSÃO</span></p>
                            <div className="flex-1 flex items-center">
                                <p className={cn("text-4xl font-bold font-mono tracking-tighter", metrics.total_profit >= 0 ? "text-emerald-500" : "text-rose-500")}>
                                    {metrics.total_profit >= 0 ? '+' : ''}${metrics.total_profit.toFixed(2)}
                                </p>
                            </div>
                        </div>

                        <div className="bg-card border border-border p-5 rounded-xl relative flex items-center justify-between overflow-hidden">
                            <div className="z-10">
                                <p className="text-xs text-muted-foreground font-bold uppercase tracking-wider mb-2 flex justify-between gap-4">Win Rate Global <span className="text-[9px] opacity-50">SESSÃO</span></p>
                                <p className={cn("text-3xl font-bold font-mono tracking-tighter", metrics.win_rate >= 50 ? "text-emerald-500" : "text-amber-500")}>
                                    {metrics.win_rate.toFixed(1)}%
                                </p>
                            </div>
                            <div className="h-24 w-24 absolute -right-2 top-1/2 -translate-y-1/2 opacity-20">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={[{ value: metrics.win_rate }, { value: 100 - metrics.win_rate }]}
                                            innerRadius={25}
                                            outerRadius={40}
                                            dataKey="value"
                                            stroke="none"
                                        >
                                            <Cell fill={metrics.win_rate >= 50 ? "#10b981" : "#f59e0b"} />
                                            <Cell fill="#333333" />
                                        </Pie>
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        <div className="bg-card border border-border p-5 rounded-xl relative flex items-center justify-between overflow-hidden">
                            <div className="z-10">
                                <p className="text-xs text-muted-foreground font-bold uppercase tracking-wider mb-2 flex justify-between gap-4">Profit Factor <span className="text-[9px] opacity-50">SESSÃO</span></p>
                                <p className={cn("text-3xl font-bold font-mono tracking-tighter", metrics.profit_factor >= 1.0 ? "text-emerald-500" : "text-rose-500")}>
                                    {metrics.profit_factor === 999 ? 'MAX' : metrics.profit_factor.toFixed(2)}
                                </p>
                            </div>
                            <div className="h-24 w-24 absolute -right-2 top-1/2 -translate-y-1/2 opacity-20">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={[{ value: Math.min(metrics.profit_factor, 3) }, { value: Math.max(0, 3 - metrics.profit_factor) }]}
                                            innerRadius={25}
                                            outerRadius={40}
                                            dataKey="value"
                                            stroke="none"
                                            startAngle={180}
                                            endAngle={0}
                                        >
                                            <Cell fill={metrics.profit_factor >= 1.0 ? "#10b981" : "#f43f5e"} />
                                            <Cell fill="#333333" />
                                        </Pie>
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        <div className="bg-card border border-border p-5 rounded-xl flex flex-col">
                            <p className="text-xs text-muted-foreground font-bold uppercase tracking-wider mb-2 flex justify-between">Max Drawdown <span className="text-[9px] opacity-50">SESSÃO</span></p>
                            <div className="flex-1 flex items-center">
                                <p className="text-4xl font-bold font-mono tracking-tighter text-rose-500">
                                    -${metrics.max_drawdown_amount.toFixed(2)}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Middle Section: Chart and Symbol Performance */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[350px]">
                        {/* Capital Curve */}
                        <div className="lg:col-span-2 bg-card border border-border p-5 rounded-xl flex flex-col h-full min-h-0">
                            <h3 className="font-bold mb-4 flex items-center gap-2">
                                <TrendingUp className="text-primary" size={18} />
                                Curva de Capital
                                <span className="ml-auto text-[10px] text-muted-foreground/50 uppercase tracking-wider font-bold">Sessão</span>
                            </h3>
                            <div className="flex-1 w-full relative min-h-0">
                                {metrics.capital_curve && metrics.capital_curve.length > 0 ? (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={metrics.capital_curve} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                            <defs>
                                                <linearGradient id="colorPnlGreen" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                                                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                                </linearGradient>
                                                <linearGradient id="colorPnlRed" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.4} />
                                                    <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" opacity={0.06} />
                                            <XAxis dataKey="name" hide />
                                            <YAxis hide domain={['auto', 'auto']} />
                                            <Tooltip
                                                contentStyle={{ backgroundColor: 'var(--tooltip-bg, #1a1a1a)', borderColor: 'var(--tooltip-border, #333)', borderRadius: '12px', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3)' }}
                                                itemStyle={{ color: 'var(--tooltip-fg, #fff)', fontWeight: 'bold' }}
                                            />
                                            <Area
                                                type="monotone"
                                                dataKey="val"
                                                name="Accumulated $ "
                                                stroke={metrics.total_profit >= 0 ? "#10b981" : "#f43f5e"}
                                                strokeWidth={3}
                                                fillOpacity={1}
                                                fill={metrics.total_profit >= 0 ? "url(#colorPnlGreen)" : "url(#colorPnlRed)"}
                                                isAnimationActive={false}
                                                activeDot={{ r: 5, strokeWidth: 0, fill: metrics.total_profit >= 0 ? "#10b981" : "#f43f5e" }}
                                            />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <div className="h-full flex items-center justify-center text-muted-foreground text-sm">Sem dados suficientes da Curva de Capital</div>
                                )}
                            </div>
                        </div>

                        {/* Top Assets */}
                        <div className="bg-card border border-border p-5 rounded-xl flex flex-col h-full overflow-hidden min-h-0">
                            <h3 className="font-bold mb-4 flex items-center gap-2 text-sm">
                                <Target className="text-primary" size={16} />
                                Top Ativos (Por Lucro $ )
                                <span className="ml-auto text-[10px] text-muted-foreground/50 uppercase tracking-wider font-bold">Sessão</span>
                            </h3>
                            <div className="flex-1 overflow-y-auto pr-2 space-y-1 custom-scrollbar mt-2 min-h-0">
                                {sortedSymbols.length > 0 ? sortedSymbols.map(([sym, st]: [string, any]) => (
                                    <div key={sym} className="flex justify-between items-center px-4 py-3 rounded-xl hover:bg-muted/40 transition-colors group border border-transparent hover:border-border/50">
                                        <div>
                                            <p className="font-bold text-foreground/90 group-hover:text-primary transition-colors">{sym}</p>
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full font-bold", st.win_rate >= 50 ? "bg-emerald-500/10 text-emerald-500" : "bg-amber-500/10 text-amber-500")}>W {st.win_rate.toFixed(0)}%</span>
                                                <span className="text-xs text-muted-foreground">{st.trades} ops</span>
                                            </div>
                                        </div>
                                        <div className={cn("font-mono text-lg font-bold tracking-tighter", st.profit >= 0 ? "text-emerald-500" : "text-rose-500")}>
                                            {st.profit > 0 ? '+' : ''}{st.profit.toFixed(2)}
                                        </div>
                                    </div>
                                )) : (
                                    <div className="text-center text-muted-foreground text-sm mt-10">Nenhum ativo operado.</div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Strategy Performance & Signals Section */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[400px]">
                        {/* 1. Strategy Performance Section */}
                        <div className="bg-card border border-border p-5 rounded-xl flex flex-col h-full min-h-0">
                            <h3 className="font-bold mb-4 flex items-center gap-2">
                                <BarChart2 className="text-primary" size={18} />
                                Performance por Estratégia
                                <span className="ml-auto text-[10px] text-muted-foreground/50 uppercase tracking-wider font-bold">Sessão</span>
                            </h3>

                            <div className="flex-1 flex gap-6 mt-2 min-h-0">
                                {/* Strategy Chart */}
                                <div className="flex-1 relative min-h-0">
                                    {strategyData.length > 0 ? (
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={strategyData} layout="vertical" margin={{ top: 0, right: 30, left: 40, bottom: 0 }}>
                                                <BarCartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#333" opacity={0.3} />
                                                <BarXAxis type="number" hide />
                                                <BarYAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fill: '#888', fontSize: 12 }} />
                                                <BarTooltip
                                                    contentStyle={{ backgroundColor: '#131313', borderColor: '#222', borderRadius: '8px', fontSize: '12px' }}
                                                    itemStyle={{ color: '#fff', fontWeight: 'bold' }}
                                                    formatter={(value: any, name: any) => name === 'profit' ? [`$${value}`, 'PnL'] : [`${value}%`, 'Win Rate']}
                                                />
                                                <Legend />
                                                <Bar dataKey="profit" name="PnL ($)" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={20}>
                                                    {
                                                        strategyData.map((entry: any, index: number) => (
                                                            <Cell key={`cell-${index}`} fill={entry.profit >= 0 ? '#10b981' : '#f43f5e'} />
                                                        ))
                                                    }
                                                </Bar>
                                                <Bar dataKey="winRate" name="Win Rate (%)" fill="#8b5cf6" radius={[0, 4, 4, 0]} barSize={20} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    ) : (
                                        <div className="h-full flex items-center justify-center text-muted-foreground text-sm">Nenhum dado de estratégia.</div>
                                    )}
                                </div>

                                {/* Strategy List Cards */}
                                <div className="w-[35%] overflow-y-auto space-y-3 custom-scrollbar pr-2 min-h-0">
                                    {strategyData.map((strat: any) => (
                                        <div key={strat.name} className={cn("p-4 rounded-xl flex flex-col justify-between border transition-all", strat.name === 'Unknown' ? "bg-muted/10 border-dashed border-border/60 opacity-80" : "bg-card border-border shadow-sm")}>
                                            <div className="flex justify-between items-start mb-3">
                                                <h4 className="font-bold text-sm text-foreground/90 flex items-center gap-2 truncate">
                                                    {strat.name === 'Unknown' && <span className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-pulse shrink-0"></span>}
                                                    <span className="truncate">{strat.name}</span>
                                                </h4>
                                                <span className="text-xs text-muted-foreground whitespace-nowrap ml-2">{strat.trades} ops</span>
                                            </div>
                                            <div className="grid grid-cols-2 gap-2">
                                                <div className="bg-muted/30 rounded-lg p-2">
                                                    <p className="text-[10px] uppercase text-muted-foreground font-bold mb-1">PnL</p>
                                                    <p className={cn("text-xs font-bold font-mono", strat.profit >= 0 ? "text-emerald-500" : "text-rose-500")}>
                                                        {strat.profit > 0 ? '+' : ''}{strat.profit.toFixed(2)}
                                                    </p>
                                                </div>
                                                <div className="bg-muted/30 rounded-lg p-2">
                                                    <p className="text-[10px] uppercase text-muted-foreground font-bold mb-1">Win Rate</p>
                                                    <p className={cn("text-xs font-bold font-mono", strat.winRate >= 50 ? "text-emerald-500" : "text-amber-500")}>
                                                        {strat.winRate.toFixed(1)}%
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* 2. Sinais por Estratégia Section */}
                        <div className="bg-card border border-border p-5 rounded-xl flex flex-col h-full min-h-0">
                            <h3 className="font-bold mb-4 flex items-center gap-2">
                                <Cpu className="text-blue-500" size={18} />
                                Sinais por Estratégia
                                <span className="ml-auto flex items-center gap-1.5 text-[10px] uppercase font-bold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                    Live
                                </span>
                            </h3>
                            <div className="flex-1 flex flex-col pt-2 min-h-0">
                                {(() => {
                                    const stratSignals = liveSignals;
                                    const entries = Object.entries(stratSignals).filter(([_, v]) => (v as number) > 0).sort((a, b) => (b[1] as number) - (a[1] as number));
                                    const total = entries.reduce((acc, [_, v]) => acc + (v as number), 0);
                                    const signalColors = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444'];

                                    if (entries.length === 0) {
                                        return (
                                            <div className="h-full flex flex-col items-center justify-center text-muted-foreground/60 p-4">
                                                <Cpu size={32} className="mb-3 opacity-50" />
                                                <p className="text-sm font-medium">Nenhum sinal gerado ainda</p>
                                            </div>
                                        );
                                    }

                                    return (
                                        <>
                                            <div className="h-2.5 w-full bg-muted/30 rounded-full overflow-hidden flex mb-6 shadow-inner">
                                                {entries.map(([_, count], idx) => (
                                                    <div
                                                        key={idx}
                                                        className="h-full transition-all duration-500 hover:brightness-110"
                                                        style={{ width: `${((count as number) / total) * 100}%`, backgroundColor: signalColors[idx % signalColors.length] }}
                                                    />
                                                ))}
                                            </div>
                                            <div className="flex-1 overflow-y-auto pr-2 space-y-4 scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent min-h-0">
                                                {entries.map(([reason, count], idx) => {
                                                    const pct = Math.round(((count as number) / total) * 100);
                                                    const color = signalColors[idx % signalColors.length];
                                                    return (
                                                        <div key={idx} className="group">
                                                            <div className="flex justify-between items-end mb-2">
                                                                <span className="text-sm font-medium text-foreground/80 truncate pr-2 flex items-center gap-2">
                                                                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                                                                    <span className="group-hover:text-foreground transition-colors" title={reason}>{reason}</span>
                                                                </span>
                                                                <div className="flex items-center gap-2 shrink-0">
                                                                    <span className="text-xs text-muted-foreground mr-1" style={{ color }}>{pct}%</span>
                                                                    <span className="font-mono font-bold text-sm text-foreground bg-muted/50 px-2 py-0.5 rounded-md">{count as number}</span>
                                                                </div>
                                                            </div>
                                                            <div className="h-2 w-full bg-muted/50 rounded-full overflow-hidden flex justify-start">
                                                                <div className="h-full rounded-full transition-all duration-700 ease-out opacity-80 group-hover:opacity-100" style={{ width: `${pct}%`, backgroundColor: color }} />
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                            <div className="mt-4 pt-3 border-t border-border/30 flex justify-between items-center text-xs text-muted-foreground">
                                                <span className="uppercase font-bold tracking-wider">Total Gerados</span>
                                                <span className="font-mono font-bold text-foreground bg-muted/50 px-2 flex items-center h-6 rounded">{total}</span>
                                            </div>
                                        </>
                                    );
                                })()}
                            </div>
                        </div>
                    </div>

                    {/* Glass Box Analytics: Funnel & Rejections */}
                    {
                        transparencyData && (
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[350px]">
                                {/* Funnel */}
                                <div className="bg-card border border-border p-5 rounded-xl flex flex-col h-full min-h-0">
                                    <h3 className="font-bold mb-4 flex items-center gap-2">
                                        <Target className="text-primary" size={18} />
                                        Funil de Sobrevivência (Sinais)
                                        <span className="ml-auto text-[10px] text-muted-foreground/50 uppercase tracking-wider font-bold">Sessão</span>
                                    </h3>
                                    <div className="flex-1 flex flex-col justify-center space-y-5 px-4 min-h-0">
                                        {[
                                            { label: 'Gerados (Engine)', val: transparencyData.funnel.generated, color: 'bg-blue-500' },
                                            { label: 'Aprov. Arbiter', val: transparencyData.funnel.drafted, color: 'bg-indigo-500' },
                                            { label: 'Aprov. Guardian', val: transparencyData.funnel.approved, color: 'bg-emerald-500' },
                                            { label: 'Executados  (MT5)', val: transparencyData.funnel.executed, color: 'bg-emerald-400' }
                                        ].map((step, idx) => {
                                            const max = Math.max(transparencyData.funnel.generated || 1, 1);
                                            const pct = Math.round((step.val / max) * 100);
                                            return (
                                                <div key={idx} className="w-full group">
                                                    <div className="flex justify-between items-end mb-2">
                                                        <span className="text-sm font-medium text-foreground/80 group-hover:text-primary transition-colors">{step.label}</span>
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-xs text-muted-foreground">{pct}%</span>
                                                            <span className="font-mono font-bold text-foreground bg-muted/50 px-2 py-0.5 rounded-md">{step.val}</span>
                                                        </div>
                                                    </div>
                                                    <div className="h-2 w-full bg-muted/50 rounded-full overflow-hidden flex justify-start">
                                                        <div className={cn("h-full rounded-full transition-all duration-1000 ease-out", step.color)} style={{ width: `${pct}%` }} />
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Scanner Rejections */}
                                <div className="bg-card border border-border p-5 rounded-xl flex flex-col h-full min-h-0">
                                    <h3 className="font-bold mb-4 flex items-center gap-2">
                                        <ShieldAlert className="text-amber-500" size={18} />
                                        Motivos Rejeição: Scanner
                                    </h3>
                                    <div className="flex-1 relative pt-2 min-h-0">
                                        {Object.keys(transparencyData.scanner_reasons || {}).length > 0 ? (
                                            <RejectionCardContent
                                                data={transparencyData.scanner_reasons}
                                                colors={['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444']}
                                                type="SCANNER"
                                            />
                                        ) : (
                                            <RejectionCardContent data={{}} colors={[]} type="SCANNER" />
                                        )}
                                    </div>
                                </div>

                                {/* Guardian Rejections */}
                                <div className="bg-card border border-border p-5 rounded-xl flex flex-col h-full min-h-0">
                                    <h3 className="font-bold mb-4 flex items-center gap-2">
                                        <ShieldAlert className="text-rose-500" size={18} />
                                        Motivos Bloqueio: Guardian
                                    </h3>
                                    <div className="flex-1 relative pt-2 min-h-0">
                                        {Object.keys(transparencyData.guardian_rejections || {}).length > 0 ? (
                                            <RejectionCardContent
                                                data={transparencyData.guardian_rejections}
                                                colors={['#ef4444', '#f59e0b', '#3b82f6', '#10b981', '#8b5cf6']}
                                                type="GUARDIAN"
                                            />
                                        ) : (
                                            <RejectionCardContent data={{}} colors={[]} type="GUARDIAN" />
                                        )}
                                    </div>
                                </div>
                            </div>
                        )
                    }

                    {/* Ledger Component */}
                    <div className="bg-card border border-border p-5 rounded-xl flex-1 flex flex-col min-h-[500px]">
                        <h3 className="font-bold mb-4 flex items-center gap-2">
                            <Clock className="text-primary" size={18} />
                            Histórico de Trades
                        </h3>
                        <div className="flex-1 w-full overflow-hidden">
                            <TradeHistory dataOverride={dashboardData.recent_ledger} onDeleteSuccess={fetchAll} periodPreset={periodPreset as any} />
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'post-mortem' && (
                <div className="bg-card border border-border p-5 rounded-xl flex-1 flex flex-col min-h-[500px]">
                    <h3 className="font-bold mb-4 flex items-center gap-2 text-primary">
                        <ShieldCheck className="text-primary" size={18} />
                        Análise Post-Mortem
                    </h3>
                    <p className="text-sm text-muted-foreground mb-4">
                        Clique em um trade para ver o contexto matemático da entrada.
                    </p>
                    <div className="flex-1 w-full overflow-hidden">
                        <TradeHistory dataOverride={dashboardData.recent_ledger} onDeleteSuccess={fetchAll} periodPreset={periodPreset as any} onTradeClick={setSelectedTrade} />
                    </div>
                </div>
            )}

            {/* --- Post Mortem Drawer Overlay --- */}
            {selectedTrade && (
                <div className="fixed inset-0 z-50 flex justify-end animate-in fade-in duration-200">
                    {/* Backdrop */}
                    <div
                        className="absolute inset-0 bg-background/80 backdrop-blur-sm cursor-pointer"
                        onClick={() => setSelectedTrade(null)}
                    />

                    {/* Drawer Panel */}
                    <div className="relative w-full max-w-md h-full bg-card border-l border-border shadow-2xl flex flex-col pt-safe animate-in slide-in-from-right-full duration-300">
                        {/* Header */}
                        <div className="p-5 border-b border-border/50 flex items-center justify-between bg-muted/10">
                            <div>
                                <h3 className="font-bold text-lg flex items-center gap-2">
                                    <span className={cn("px-2 py-0.5 rounded text-xs uppercase tracking-wider font-bold", selectedTrade.side === 'BUY' ? "bg-emerald-500/20 text-emerald-500" : "bg-rose-500/20 text-rose-500")}>
                                        {selectedTrade.side}
                                    </span>
                                    {selectedTrade.symbol}
                                </h3>
                                <p className="text-xs text-muted-foreground mt-1 font-mono">
                                    Ticket #{selectedTrade.ticket}
                                </p>
                            </div>
                            <div className="text-right">
                                <p className={cn("text-xl font-bold font-mono tracking-tighter", selectedTrade.profit >= 0 ? "text-emerald-500" : "text-rose-500")}>
                                    {selectedTrade.profit >= 0 ? '+' : ''}${selectedTrade.profit?.toFixed(2)}
                                </p>
                                <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">Líquido</p>
                            </div>
                        </div>

                        {/* Body - Scrollable */}
                        <div className="flex-1 overflow-y-auto p-5 custom-scrollbar space-y-6 flex flex-col min-h-0">

                            {/* General Trade Info Box */}
                            <div className="bg-muted/20 border border-border/40 rounded-xl p-4 space-y-3 shrink-0">
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-muted-foreground font-medium">Data Execução</span>
                                    <span className="font-mono font-bold text-foreground/90">{new Date(selectedTrade.open_time).toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-muted-foreground font-medium">Tempo de Tela</span>
                                    <span className="font-mono font-bold text-foreground/90">
                                        {selectedTrade.close_time ? `${Math.round((new Date(selectedTrade.close_time).getTime() - new Date(selectedTrade.open_time).getTime()) / 60000)} min` : 'Aberto'}
                                    </span>
                                </div>
                                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border/30">
                                    <div>
                                        <p className="text-[10px] uppercase text-muted-foreground font-bold mb-1">Entrada</p>
                                        <p className="font-mono text-sm font-bold bg-muted/40 px-2 py-1 rounded inline-block">{selectedTrade.open_price}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[10px] uppercase text-muted-foreground font-bold mb-1">Saída</p>
                                        <p className="font-mono text-sm font-bold bg-muted/40 px-2 py-1 rounded inline-block">{selectedTrade.close_price}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Market Context Section */}
                            <div className="flex flex-col flex-1 min-h-0">
                                <h4 className="font-bold text-sm text-primary mb-3 flex items-center gap-2 shrink-0">
                                    <Lightbulb size={16} />
                                    Contexto Matemático (Entrada)
                                </h4>

                                {selectedTrade.market_context && Object.keys(selectedTrade.market_context).length > 0 ? (
                                    <div className="bg-card border border-border/50 rounded-xl p-4 flex-1 flex flex-col font-mono overflow-hidden shadow-inner">
                                        <p className="text-muted-foreground/70 mb-4 text-[11px] pb-2 border-b border-border/30 shrink-0 flex items-center justify-between uppercase tracking-widest font-bold">
                                            <span>// Snapshot Arbiter</span>
                                            <span className="text-emerald-500/70">Sys_OK</span>
                                        </p>
                                        <div className="overflow-y-auto flex-1 custom-scrollbar pr-2 leading-relaxed">
                                            <div className="grid grid-cols-2 gap-x-3 gap-y-3">
                                                {Object.entries(selectedTrade.market_context).map(([key, val]) => (
                                                    <div key={key} className="flex flex-col bg-muted/30 p-2.5 rounded-lg border border-border/40 hover:bg-muted/50 transition-colors">
                                                        <span className="text-[9px] text-muted-foreground uppercase font-bold tracking-widest truncate mb-1">
                                                            {key.replace(/_/g, ' ')}
                                                        </span>
                                                        <span className={cn(
                                                            "text-xs font-bold truncate",
                                                            typeof val === 'number' ? 'text-blue-500 dark:text-blue-400' :
                                                                typeof val === 'boolean' ? (val ? 'text-emerald-500' : 'text-rose-500') :
                                                                    'text-amber-600 dark:text-amber-400'
                                                        )}>
                                                            {typeof val === 'number' ? (Number.isInteger(val) ? val : val.toFixed(4)) : String(val).toUpperCase()}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="bg-muted/20 border border-border/40 border-dashed rounded-xl p-6 flex flex-col items-center justify-center text-center opacity-70 flex-1">
                                        <ShieldAlert size={32} className="text-muted-foreground/50 mb-3" />
                                        <p className="text-sm font-bold text-foreground/80 mb-1">Contexto Ausente</p>
                                        <p className="text-xs text-muted-foreground max-w-[200px]">Este trade foi registrado antes da implementação do radar pos-mortem.</p>
                                    </div>
                                )}
                            </div>

                        </div>

                        {/* Footer */}
                        <div className="p-4 border-t border-border/50 bg-card mt-auto shrink-0">
                            <button
                                onClick={() => setSelectedTrade(null)}
                                className="w-full py-2.5 bg-muted/50 hover:bg-muted text-foreground rounded-lg font-bold transition-colors border border-border/50"
                            >
                                Fechar Raio-X
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
