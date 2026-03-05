import React from 'react';
import { Activity, PlayCircle, StopCircle, ShieldAlert, ShieldCheck } from 'lucide-react';
import type { UniverseSnapshot } from '../../services/api';

interface ViewProps {
    snapshot?: UniverseSnapshot | null;
}

export const UniverseStatusStrip: React.FC<ViewProps> = React.memo(({ snapshot }) => {
    if (!snapshot) {
        return (
            <div className="rounded-xl border border-border/50 bg-card/50 p-4 flex items-center justify-between animate-pulse shadow-sm">
                <div className="flex items-center gap-2 text-muted-foreground/70">
                    <Activity size={16} />
                    <span className="text-sm font-medium">Waiting for Universe Data...</span>
                </div>
                <div className="text-xs font-mono text-muted-foreground/50">Backend Disconnected or Idle</div>
            </div>
        );
    }

    const isRunning = snapshot.status === 'RUNNING';
    const isGateOpen = snapshot.gate_status === 'OPEN';

    return (
        <div className="rounded-xl border border-border/50 bg-card/80 p-4 flex flex-wrap items-center justify-between gap-5 shadow-sm backdrop-blur-md">

            <div className="flex items-center gap-6">
                <div className="flex flex-col gap-1.5">
                    <span className="text-[10px] text-muted-foreground/80 uppercase tracking-widest font-bold">Scanner / Mode</span>
                    <div className="flex items-center gap-2">
                        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-bold border ${isRunning ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-destructive/10 text-destructive border-destructive/20'}`}>
                            {isRunning ? <PlayCircle size={14} /> : <StopCircle size={14} />}
                            {snapshot.status}
                        </div>
                        <div className="px-2.5 py-1 rounded text-xs font-bold border bg-secondary/30 text-secondary-foreground border-secondary/50">
                            {snapshot.selection_mode || 'AUTO'}
                        </div>
                    </div>
                </div>

                <div className="h-10 w-px bg-border/40" />

                {/* Middle: Gate & Active Set Status */}
                <div className="flex flex-col gap-1.5">
                    <span className="text-[10px] text-muted-foreground/80 uppercase tracking-widest font-bold">Gate / Active Set</span>
                    <div className="flex items-center gap-3">
                        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-bold border ${isGateOpen ? 'bg-primary/10 text-primary border-primary/20' : 'bg-orange-500/10 text-orange-500 border-orange-500/20'}`}>
                            {isGateOpen ? <ShieldCheck size={14} /> : <ShieldAlert size={14} />}
                            <span>{snapshot.gate_status}</span>
                            {!isGateOpen && <span className="text-[10px] font-medium opacity-80 uppercase ml-1">({snapshot.gate_reason})</span>}
                        </div>
                        <div className={`px-2 py-1 rounded text-[10px] uppercase font-bold tracking-wider ${snapshot.active_set_source === 'FROZEN' ? 'bg-sky-500/10 text-sky-500 border border-sky-500/20' : 'bg-muted/50 text-muted-foreground border border-border/50'}`}>
                            {snapshot.active_set_source} ({snapshot.active_set_size} Ativos)
                        </div>
                    </div>
                </div>

                <div className="h-10 w-px bg-border/40" />

                {/* Scope Stats */}
                <div className="flex flex-col gap-1.5">
                    <span className="text-[10px] text-muted-foreground/80 uppercase tracking-widest font-bold">Universe Pipeline</span>
                    <div className="text-xs flex gap-3 text-muted-foreground/70 bg-muted/20 px-3 py-1.5 rounded-md border border-border/30">
                        <span>Raw: <strong className="text-foreground/90 font-mono">{snapshot.universe?.raw_count ?? snapshot.universe_raw_total ?? 0}</strong></span>
                        <span title="Excluded by Class/Blocklist">Filtered: <strong className="text-foreground/90 font-mono">{snapshot.universe?.after_class_filter ?? snapshot.universe_raw_total ?? 0}</strong></span>
                        <span title="Scanned via MT5">Evaluated: <strong className="text-foreground/90 font-mono">{snapshot.universe?.with_metrics ?? snapshot.scanned_count ?? 0}</strong> <span className="opacity-50 text-[10px]">({(snapshot.scan_progress_pct || 0).toFixed(0)}%)</span></span>
                        <span>Eligible: <strong className="text-foreground/90 font-mono">{snapshot.universe?.eligible_count ?? snapshot.universe_active_total ?? 0}</strong></span>
                    </div>
                </div>

                <div className="h-10 w-px bg-border/40 hidden xl:block" />

                {/* Reject Stats */}
                <div className="flex flex-col gap-1.5 hidden xl:flex">
                    <span className="text-[10px] text-muted-foreground/80 uppercase tracking-widest font-bold">Rejections</span>
                    <div className="text-xs flex gap-3 text-muted-foreground/70 bg-muted/20 px-3 py-1.5 rounded-md border border-border/30">
                        <span title="Excluded by TimeMode Config">Time: <strong className="text-orange-500/90 font-mono">{snapshot.reasons?.out_of_hours ?? 0}</strong></span>
                        <span title="Excluded by >0.85 Correlation">Cloner: <strong className="text-rose-500/90 font-mono">{snapshot.reasons?.high_correlation ?? 0}</strong></span>
                        <span title="Spread/ATR Filter">Spread: <strong className="text-rose-500/90 font-mono">{snapshot.reasons?.spread_too_high ?? 0}</strong></span>
                    </div>
                </div>
            </div>

            {/* Right: Meta */}
            <div className="flex flex-col items-end text-right justify-center">
                <span className="text-[10px] font-mono text-muted-foreground/50 uppercase tracking-wider">Cycle: {snapshot.cycle_id ? snapshot.cycle_id.slice(-8) : '????'}</span>
                <span className="text-[10px] font-mono text-muted-foreground/50 uppercase tracking-wider mt-0.5">UTC: {snapshot.timestamp_utc ? new Date(snapshot.timestamp_utc).toLocaleTimeString() : '--:--:--'}</span>
            </div>
        </div>
    );
});

