import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { TrendingUp, Cpu, Activity } from 'lucide-react';
import { AreaChart, Area, ResponsiveContainer, YAxis } from 'recharts';

export const MobileDashboard: React.FC = () => {
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const start = new Date();
                start.setHours(0, 0, 0, 0);
                const end = new Date();
                const startDt = start.toISOString();
                const endDt = end.toISOString();

                const res = await api.get<any>(`/api/analytics/dashboard?start_dt=${startDt}&end_dt=${endDt}`);
                setData(res);
            } catch (e) {
                console.error("Dashboard failed", e);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
        const interval = setInterval(fetchData, 30000);
        return () => clearInterval(interval);
    }, []);

    if (loading) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center pt-24 space-y-4">
                <Cpu size={40} className="animate-pulse text-muted-foreground opacity-50" />
                <p className="text-muted-foreground text-sm font-medium">Carregando Analytics...</p>
            </div>
        );
    }

    if (!data || !data.metrics) {
        return (
            <div className="p-4 pt-12 text-center text-muted-foreground">
                Nenhum dado encontrado para hoje.
            </div>
        );
    }

    const { metrics } = data;
    const isPositive = metrics.total_profit >= 0;

    return (
        <div className="p-4 space-y-4 pt-6">
            <div className="flex items-center justify-between mb-2">
                <h1 className="text-xl font-bold flex items-center gap-2">
                    <span className="text-primary tracking-tight">RL Trade</span>
                    <span className="text-muted-foreground font-normal">| Mobile</span>
                </h1>
                <div className="flex items-center gap-1.5 px-2 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-500">Live</span>
                </div>
            </div>

            {/* Main Balance Card */}
            <div className="bg-card p-5 rounded-3xl border border-border shadow-md flex flex-col items-center justify-center relative overflow-hidden">
                <p className="text-xs text-muted-foreground font-bold uppercase tracking-wider mb-1 z-10 text-center">
                    PnL Hoje (Sessão)
                </p>
                <p className={`text-5xl font-black font-mono tracking-tighter z-10 ${isPositive ? 'text-emerald-500' : 'text-rose-500'}`}>
                    {isPositive ? '+' : ''}${metrics.total_profit.toFixed(2)}
                </p>
                <div className="flex items-center gap-4 mt-4 z-10 text-sm">
                    <div className="flex flex-col items-center">
                        <span className="text-[10px] uppercase text-muted-foreground font-bold">Win Rate</span>
                        <span className={`font-mono font-bold ${metrics.win_rate >= 50 ? 'text-emerald-500' : 'text-amber-500'}`}>{metrics.win_rate.toFixed(1)}%</span>
                    </div>
                    <div className="w-px h-8 bg-border/50" />
                    <div className="flex flex-col items-center">
                        <span className="text-[10px] uppercase text-muted-foreground font-bold">Trades</span>
                        <span className="font-mono font-bold text-foreground">{metrics.total_trades}</span>
                    </div>
                </div>

                {/* Decorative background circle */}
                <div className={`absolute -right-8 -bottom-8 w-32 h-32 rounded-full opacity-[0.03] blur-xl ${isPositive ? 'bg-emerald-500' : 'bg-rose-500'}`} />
            </div>

            {/* Capital Curve */}
            <div className="bg-card border border-border p-4 rounded-3xl h-[220px] flex flex-col">
                <h3 className="font-bold flex items-center gap-2 text-sm mb-4">
                    <TrendingUp size={16} className="text-primary" />
                    Curva de Capital (Hoje)
                </h3>
                <div className="flex-1 min-h-0 w-full relative">
                    {metrics.capital_curve && metrics.capital_curve.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={metrics.capital_curve}>
                                <defs>
                                    <linearGradient id="colorMobilePnl" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor={isPositive ? "#10b981" : "#f43f5e"} stopOpacity={0.4} />
                                        <stop offset="95%" stopColor={isPositive ? "#10b981" : "#f43f5e"} stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <YAxis hide domain={['auto', 'auto']} />
                                <Area
                                    type="monotone"
                                    dataKey="val"
                                    stroke={isPositive ? "#10b981" : "#f43f5e"}
                                    strokeWidth={3}
                                    fillOpacity={1}
                                    fill="url(#colorMobilePnl)"
                                    isAnimationActive={false}
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="h-full w-full flex items-center justify-center text-muted-foreground text-xs">
                            Sem dados suficientes
                        </div>
                    )}
                </div>
            </div>

            {/* Engine Status Snippet */}
            <div className="grid grid-cols-2 gap-3">
                <div className="bg-card border border-border rounded-2xl p-4 flex flex-col items-center justify-center text-center gap-2">
                    <Cpu size={24} className="text-blue-500 opacity-80" />
                    <div className="text-[10px] font-bold uppercase text-muted-foreground border-b border-border/40 pb-1">Engine</div>
                    <span className="text-xs font-bold text-emerald-500">RUNNING</span>
                </div>
                <div className="bg-card border border-border rounded-2xl p-4 flex flex-col items-center justify-center text-center gap-2">
                    <Activity size={24} className="text-emerald-500 opacity-80" />
                    <div className="text-[10px] font-bold uppercase text-muted-foreground border-b border-border/40 pb-1">MT5 Adapter</div>
                    <span className="text-xs font-bold text-emerald-500">CONNECTED</span>
                </div>
            </div>

        </div>
    );
};
