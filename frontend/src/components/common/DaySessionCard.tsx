import React, { useEffect, useState, useCallback } from 'react';
import { TrendingUp, TrendingDown, Trophy, Target, Zap, AlertCircle } from 'lucide-react';
import { AreaChart, Area, ResponsiveContainer, Tooltip } from 'recharts';
import { cn } from '../../lib/utils';

interface SessionData {
    total_trades_today: number;
    wins_today: number;
    losses_today: number;
    daily_pnl: number;
    biggest_loss: number;
    win_rate_today: number;
    equity_curve_today: { val: number }[];
}

const StatChip: React.FC<{ label: string; value: string | number; color?: string; icon?: React.ReactNode }> = ({ label, value, color, icon }) => (
    <div className="flex flex-col items-center px-4 py-2 rounded-xl bg-muted/20 border border-border/30 min-w-[80px]">
        <div className={cn("flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1")}>
            {icon}<span>{label}</span>
        </div>
        <span className={cn("text-base font-black font-mono tracking-tight", color ?? "text-foreground")}>{value}</span>
    </div>
);

export const DaySessionCard: React.FC = () => {
    const [session, setSession] = useState<SessionData | null>(null);
    const [loading, setLoading] = useState(true);

    const fetch = useCallback(async () => {
        try {
            const [dashRes] = await Promise.all([
                window.fetch('/api/analytics/dashboard?start_dt=' + new Date().toISOString().slice(0, 10) + 'T00:00:00').then(r => r.ok ? r.json() : null),
            ]);
            if (!dashRes?.metrics) return;
            const m = dashRes.metrics;
            const curve: { val: number }[] = m.capital_curve ?? [];
            // Build today's equity curve from recent_ledger (cumulative)
            const todayLedger = (dashRes.recent_ledger ?? [])
                .filter((t: any) => t.close_time && new Date(t.close_time).toDateString() === new Date().toDateString())
                .sort((a: any, b: any) => new Date(a.close_time).getTime() - new Date(b.close_time).getTime());
            let cum = 0;
            const todayCurve = todayLedger.map((t: any) => { cum += t.profit ?? 0; return { val: parseFloat(cum.toFixed(2)) }; });

            const wins = todayLedger.filter((t: any) => t.profit > 0).length;
            const losses = todayLedger.filter((t: any) => t.profit <= 0).length;
            const total = todayLedger.length;
            const pnl = todayLedger.reduce((s: number, t: any) => s + (t.profit ?? 0), 0);
            const biggestLoss = Math.min(0, ...todayLedger.map((t: any) => t.profit ?? 0));

            setSession({
                total_trades_today: total,
                wins_today: wins,
                losses_today: losses,
                daily_pnl: parseFloat(pnl.toFixed(2)),
                biggest_loss: parseFloat(biggestLoss.toFixed(2)),
                win_rate_today: total > 0 ? Math.round((wins / total) * 100) : 0,
                equity_curve_today: todayCurve.length > 0 ? todayCurve : curve.slice(-20),
            });
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetch();
        const iv = setInterval(fetch, 15000);
        return () => clearInterval(iv);
    }, [fetch]);

    if (loading) return (
        <div className="animate-pulse bg-card border border-border/40 rounded-2xl h-24 w-full" />
    );

    if (!session) return null;

    const pnlPositive = session.daily_pnl >= 0;
    const curveColor = pnlPositive ? '#10b981' : '#f43f5e';

    return (
        <div className="bg-card border border-border/50 rounded-2xl p-4 flex flex-col sm:flex-row items-center gap-4 shadow-sm">
            {/* P&L GRANDE */}
            <div className="flex flex-col items-center sm:items-start shrink-0 min-w-[120px]">
                <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold mb-1 flex items-center gap-1">
                    {pnlPositive ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                    P&L Hoje
                </span>
                <span className={cn("text-3xl font-black font-mono tracking-tighter", pnlPositive ? "text-emerald-500" : "text-rose-500")}>
                    {pnlPositive ? '+' : ''}{session.daily_pnl.toFixed(2)}
                </span>
                <span className="text-[10px] text-muted-foreground mt-0.5">USD</span>
            </div>

            {/* Sparkline */}
            <div className="flex-1 h-14 min-w-[120px] max-w-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={session.equity_curve_today} margin={{ top: 4, right: 4, left: 4, bottom: 4 }}>
                        <defs>
                            <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor={curveColor} stopOpacity={0.4} />
                                <stop offset="95%" stopColor={curveColor} stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <Area type="monotone" dataKey="val" stroke={curveColor} strokeWidth={2} fill="url(#sparkGrad)" isAnimationActive={false} dot={false} />
                        <Tooltip
                            contentStyle={{ background: '#111', border: '1px solid #333', borderRadius: 8, fontSize: 11 }}
                            formatter={(v: any) => [`$${v}`, 'P&L do Dia']}
                            labelFormatter={() => ''}
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </div>

            {/* Stats chips */}
            <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
                <StatChip label="Trades" value={session.total_trades_today} icon={<Zap size={9} />} />
                <StatChip
                    label="Win Rate"
                    value={`${session.win_rate_today}%`}
                    color={session.win_rate_today >= 50 ? 'text-emerald-500' : 'text-amber-500'}
                    icon={<Trophy size={9} />}
                />
                <StatChip
                    label="Wins"
                    value={session.wins_today}
                    color="text-emerald-500"
                    icon={<Target size={9} />}
                />
                <StatChip
                    label="Losses"
                    value={session.losses_today}
                    color={session.losses_today > 0 ? 'text-rose-500' : 'text-muted-foreground'}
                    icon={<AlertCircle size={9} />}
                />
                {session.biggest_loss < 0 && (
                    <StatChip
                        label="Maior Loss"
                        value={`$${session.biggest_loss.toFixed(2)}`}
                        color="text-rose-400"
                    />
                )}
            </div>
        </div>
    );
};
