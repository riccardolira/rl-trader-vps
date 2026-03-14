import React, { useEffect, useState } from 'react';
import { cn } from '../../lib/utils';
import { TrendingUp, Shield, Activity } from 'lucide-react';

interface PerfMetrics {
    sharpe_ratio: number | null;
    sortino_ratio: number | null;
    calmar_ratio: number | null;
    win_rate: number | null;
    avg_rr: number | null;
    total_trades: number;
}

const MetricPill: React.FC<{ label: string; value: string; good?: boolean | null; icon?: React.ReactNode }> = ({ label, value, good, icon }) => (
    <div className={cn(
        "flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[11px] font-bold whitespace-nowrap",
        good === true ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" :
        good === false ? "bg-rose-500/10 border-rose-500/20 text-rose-400" :
        "bg-muted/30 border-border/40 text-muted-foreground"
    )}>
        {icon && <span className="opacity-70">{icon}</span>}
        <span className="text-muted-foreground/70 font-normal">{label}</span>
        <span>{value}</span>
    </div>
);

export const PerformanceBar: React.FC = () => {
    const [metrics, setMetrics] = useState<PerfMetrics | null>(null);

    useEffect(() => {
        const load = async () => {
            try {
                const res = await fetch('/api/analytics/performance');
                if (res.ok) setMetrics(await res.json());
            } catch {}
        };
        load();
        const iv = setInterval(load, 60000); // refresh 1x/min
        return () => clearInterval(iv);
    }, []);

    if (!metrics || metrics.total_trades < 10) return null; // Não mostra sem histórico suficiente

    const fmt = (v: number | null, dec = 2) => v != null ? v.toFixed(dec) : '—';

    return (
        <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">Métricas</span>
            <MetricPill
                label="Sharpe"
                value={fmt(metrics.sharpe_ratio)}
                good={metrics.sharpe_ratio != null ? metrics.sharpe_ratio > 1 : null}
                icon={<TrendingUp size={11} />}
            />
            <MetricPill
                label="Sortino"
                value={fmt(metrics.sortino_ratio)}
                good={metrics.sortino_ratio != null ? metrics.sortino_ratio > 1.5 : null}
                icon={<Shield size={11} />}
            />
            <MetricPill
                label="Win Rate"
                value={metrics.win_rate != null ? `${metrics.win_rate.toFixed(1)}%` : '—'}
                good={metrics.win_rate != null ? metrics.win_rate >= 50 : null}
                icon={<Activity size={11} />}
            />
            <MetricPill
                label="R/R"
                value={fmt(metrics.avg_rr)}
                good={metrics.avg_rr != null ? metrics.avg_rr >= 1 : null}
            />
        </div>
    );
};
