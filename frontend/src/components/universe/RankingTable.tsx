import React, { useState, useEffect, useMemo } from 'react';
import type { RankingRow } from '../../services/api';
import { ArrowRight, AlertTriangle, XCircle, CheckCircle2, ChevronLeft, ChevronRight, SlidersHorizontal } from 'lucide-react';
import { cn } from '../../lib/utils';

type FilterKey = 'all' | 'selected' | 'eligible' | 'warn' | 'blocked';

interface TableProps {
    data: RankingRow[];
    onRowClick: (asset: RankingRow) => void;
}

const FILTERS: { key: FilterKey; label: string; color: string }[] = [
    { key: 'all',      label: 'Todos',        color: 'text-foreground' },
    { key: 'selected', label: 'Selecionados',  color: 'text-blue-400' },
    { key: 'eligible', label: 'Elegíveis',     color: 'text-emerald-400' },
    { key: 'warn',     label: 'Alerta',        color: 'text-yellow-400' },
    { key: 'blocked',  label: 'Bloqueados',    color: 'text-rose-400' },
];

export const RankingTable: React.FC<TableProps> = React.memo(({ data, onRowClick }) => {
    const [currentPage, setCurrentPage] = useState(1);
    const [activeFilter, setActiveFilter] = useState<FilterKey>('all');
    const itemsPerPage = 100;

    const counts = useMemo(() => ({
        all:      data.length,
        selected: data.filter(r => r.decision === 'selected').length,
        eligible: data.filter(r => r.status === 'ELIGIBLE' && r.decision !== 'selected').length,
        warn:     data.filter(r => r.status === 'WARN').length,
        blocked:  data.filter(r => r.status === 'HARD_REJECT').length,
    }), [data]);

    const filtered = useMemo(() => {
        if (activeFilter === 'all')      return data;
        if (activeFilter === 'selected') return data.filter(r => r.decision === 'selected');
        if (activeFilter === 'eligible') return data.filter(r => r.status === 'ELIGIBLE' && r.decision !== 'selected');
        if (activeFilter === 'warn')     return data.filter(r => r.status === 'WARN');
        if (activeFilter === 'blocked')  return data.filter(r => r.status === 'HARD_REJECT');
        return data;
    }, [data, activeFilter]);

    useEffect(() => setCurrentPage(1), [activeFilter]);
    useEffect(() => {
        if (data && currentPage > Math.ceil(filtered.length / itemsPerPage)) {
            setCurrentPage(1);
        }
    }, [filtered.length, currentPage]);

    if (!data || !Array.isArray(data) || data.length === 0) {
        return (
            <div className="p-8 text-center text-muted-foreground border border-dashed border-border/50 rounded-xl flex-1 flex items-center justify-center bg-card/30">
                Sem dados de ranking ativos. O Scanner pode estar parado ou os ativos bloqueados.
            </div>
        );
    }

    const totalPages = Math.ceil(filtered.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const currentData = filtered.slice(startIndex, startIndex + itemsPerPage);

    return (
        <div className="flex flex-col gap-3 h-full">
            {/* ── Quick Filters ── */}
            <div className="flex items-center gap-2 flex-wrap bg-card border border-border/40 rounded-xl px-4 py-2.5 shadow-sm">
                <SlidersHorizontal size={13} className="text-muted-foreground shrink-0" />
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mr-1">Filtrar:</span>
                {FILTERS.map(f => (
                    <button
                        key={f.key}
                        onClick={() => setActiveFilter(f.key)}
                        className={cn(
                            "flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold border transition-all",
                            activeFilter === f.key
                                ? "bg-card border-border shadow-sm " + f.color
                                : "bg-muted/30 border-transparent text-muted-foreground/70 hover:border-border/50 hover:text-foreground"
                        )}
                    >
                        {f.label}
                        <span className="text-[10px] font-mono bg-muted/60 px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
                            {counts[f.key]}
                        </span>
                    </button>
                ))}
                <span className="ml-auto text-[10px] text-muted-foreground/60 font-mono">
                    {filtered.length}/{data.length}
                </span>
            </div>

            <div className="rounded-xl border border-border/50 bg-card overflow-auto flex-1 relative shadow-sm">
                <table className="w-full text-[13px] text-left">
                    <thead className="bg-muted/80 text-muted-foreground font-semibold border-b border-border/50 sticky top-0 z-10 backdrop-blur-md shadow-sm">
                        <tr>
                            <th className="px-5 py-3.5 tracking-wider uppercase text-[10px] w-20">Rank</th>
                            <th className="px-5 py-3.5 tracking-wider uppercase text-[10px] w-32">Symbol</th>
                            <th className="px-5 py-3.5 tracking-wider uppercase text-[10px] w-24">Class</th>
                            <th className="px-5 py-3.5 tracking-wider uppercase text-[10px] text-right w-24">Score</th>
                            <th className="px-5 py-3.5 tracking-wider uppercase text-[10px] w-32">Status</th>
                            <th className="px-5 py-3.5 tracking-wider uppercase text-[10px] hidden md:table-cell">Breakdown (L / V / C / S)</th>
                            <th className="px-5 py-3.5 tracking-wider uppercase text-[10px] text-right w-20">→</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border/30">
                        {currentData.length === 0 ? (
                            <tr>
                                <td colSpan={7} className="px-5 py-12 text-center text-muted-foreground text-sm">
                                    Nenhum ativo nesta categoria.
                                </td>
                            </tr>
                        ) : currentData.map((row) => (
                            <tr
                                key={row.symbol}
                                onClick={() => onRowClick(row)}
                                className="hover:bg-muted/40 cursor-pointer transition-colors even:bg-muted/10 group"
                            >
                                <td className="px-5 py-3 font-mono text-muted-foreground/70 text-xs w-20">#{row.rank}</td>
                                <td className="px-5 py-3 font-bold text-foreground/90 group-hover:text-foreground transition-colors w-32">{row.symbol}</td>
                                <td className="px-5 py-3 w-24">
                                    <span className="text-[10px] font-mono bg-muted px-2 py-0.5 rounded-full text-muted-foreground border border-border/50">
                                        {row.asset_class}
                                    </span>
                                </td>
                                <td className="px-5 py-3 text-right w-24">
                                    <span className={cn(
                                        "font-mono font-bold text-xs px-2 py-0.5 rounded",
                                        row.score && row.score > 70 ? "bg-emerald-500/10 text-emerald-500" :
                                        row.score && row.score > 40 ? "bg-blue-500/10 text-blue-500" :
                                        "text-muted-foreground"
                                    )}>
                                        {row.score !== null ? row.score.toFixed(1) : '-'}
                                    </span>
                                </td>
                                <td className="px-5 py-3 w-32">
                                    <div className="flex items-center gap-2">
                                        {row.status === 'ELIGIBLE' && (
                                            <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 border",
                                                row.decision === 'selected'
                                                    ? 'bg-primary/10 text-primary border-primary/20'
                                                    : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                                            )}>
                                                <CheckCircle2 size={12} />
                                                {row.decision === 'selected' ? 'SELECTED' : 'ELIGIBLE'}
                                            </span>
                                        )}
                                        {row.status === 'WARN' && (
                                            <span className="text-[10px] font-bold bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 px-2 py-0.5 rounded-full flex items-center gap-1">
                                                <AlertTriangle size={12} /> WARN
                                            </span>
                                        )}
                                        {row.status === 'HARD_REJECT' && (
                                            <span className="text-[10px] font-bold bg-destructive/10 text-destructive border border-destructive/20 px-2 py-0.5 rounded-full flex items-center gap-1 opacity-80">
                                                <XCircle size={12} /> BLOCKED
                                            </span>
                                        )}
                                    </div>
                                </td>
                                <td className="px-5 py-3 hidden md:table-cell text-xs text-muted-foreground">
                                    {row.status === 'HARD_REJECT' ? (
                                        <span className="text-destructive/80 font-medium bg-destructive/5 px-2 py-0.5 rounded text-[11px]">
                                            {row.specification} ({row.reason_code})
                                        </span>
                                    ) : (
                                        <div className="flex gap-1.5 font-mono text-[10px] opacity-70 group-hover:opacity-100 transition-opacity">
                                            <span title="Liquidity"  className="bg-muted px-1.5 rounded">L:{row.score_breakdown?.liquidity?.toFixed(0)  ?? '?'}</span>
                                            <span title="Volatility" className="bg-muted px-1.5 rounded">V:{row.score_breakdown?.volatility?.toFixed(0) ?? '?'}</span>
                                            <span title="Cost"       className="bg-orange-500/10 text-orange-400 px-1.5 rounded">C:{row.score_breakdown?.cost?.toFixed(0) ?? '?'}</span>
                                            <span title="Stability"  className="bg-muted px-1.5 rounded">S:{row.score_breakdown?.stability?.toFixed(0)  ?? '?'}</span>
                                        </div>
                                    )}
                                </td>
                                <td className="px-5 py-3 text-right w-20">
                                    <div className="flex justify-end opacity-0 group-hover:opacity-100 transition-opacity translate-x-2 group-hover:translate-x-0">
                                        <ArrowRight size={16} className="text-primary" />
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {totalPages > 1 && (
                <div className="flex items-center justify-between px-5 py-3 bg-card border border-border/50 rounded-xl shrink-0 shadow-sm">
                    <div className="text-sm text-muted-foreground/80">
                        Mostrando <span className="font-bold text-foreground">{startIndex + 1}</span> a <span className="font-bold text-foreground">{Math.min(startIndex + itemsPerPage, filtered.length)}</span> de <span className="font-bold text-foreground">{filtered.length}</span>
                    </div>
                    <div className="flex gap-2 items-center">
                        <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}
                            className="p-1.5 rounded-lg bg-muted/50 hover:bg-muted disabled:opacity-30 border border-transparent hover:border-border/50 transition-colors">
                            <ChevronLeft size={16} />
                        </button>
                        <div className="flex items-center px-4 font-mono text-sm font-bold bg-muted/30 rounded-lg py-1">
                            {currentPage} <span className="text-muted-foreground/50 mx-1">/</span> {totalPages}
                        </div>
                        <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}
                            className="p-1.5 rounded-lg bg-muted/50 hover:bg-muted disabled:opacity-30 border border-transparent hover:border-border/50 transition-colors">
                            <ChevronRight size={16} />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
});
