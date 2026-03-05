import React, { useState, useEffect } from 'react';
import type { RankingRow } from '../../services/api';
import { ArrowRight, AlertTriangle, XCircle, CheckCircle2, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '../../lib/utils';

interface TableProps {
    data: RankingRow[];
    onRowClick: (asset: RankingRow) => void;
}

export const RankingTable: React.FC<TableProps> = React.memo(({ data, onRowClick }) => {
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 100;

    // Reset pagination if data shrinks drastically
    useEffect(() => {
        if (data && currentPage > Math.ceil(data.length / itemsPerPage)) {
            setCurrentPage(1);
        }
    }, [data.length, currentPage]);

    if (!data || !Array.isArray(data) || data.length === 0) {
        return (
            <div className="p-8 text-center text-muted-foreground border border-dashed border-border/50 rounded-xl flex-1 flex items-center justify-center bg-card/30">
                Sem dados de ranking ativos. O Scanner pode estar parado ou os ativos bloqueados.
            </div>
        );
    }

    const totalPages = Math.ceil(data.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const currentData = data.slice(startIndex, startIndex + itemsPerPage);

    return (
        <div className="flex flex-col gap-4 h-full">
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
                            <th className="px-5 py-3.5 tracking-wider uppercase text-[10px] text-right w-20">Action</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border/30">
                        {currentData.map((row) => (
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
                                                row.decision === 'selected' ? 'bg-primary/10 text-primary border-primary/20' : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
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
                                        <span className="text-destructive/80 font-medium bg-destructive/5 px-2 py-0.5 rounded text-[11px]">{row.specification} ({row.reason_code})</span>
                                    ) : (
                                        <div className="flex gap-1.5 font-mono text-[10px] opacity-70 group-hover:opacity-100 transition-opacity">
                                            <span title="Liquidity" className="bg-muted px-1.5 rounded">L:{row.score_breakdown?.liquidity?.toFixed(0) ?? '?'}</span>
                                            <span title="Volatility" className="bg-muted px-1.5 rounded">V:{row.score_breakdown?.volatility?.toFixed(0) ?? '?'}</span>
                                            <span title="Cost" className="bg-orange-500/10 text-orange-400 px-1.5 rounded">C:{row.score_breakdown?.cost?.toFixed(0) ?? '?'}</span>
                                            <span title="Stability" className="bg-muted px-1.5 rounded">S:{row.score_breakdown?.stability?.toFixed(0) ?? '?'}</span>
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

            {/* Pagination Controls */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between px-5 py-3 bg-card border border-border/50 rounded-xl shrink-0 shadow-sm">
                    <div className="text-sm text-muted-foreground/80">
                        Showing <span className="font-bold text-foreground">{startIndex + 1}</span> to <span className="font-bold text-foreground">{Math.min(startIndex + itemsPerPage, data.length)}</span> of <span className="font-bold text-foreground">{data.length}</span>
                    </div>
                    <div className="flex gap-2 items-center">
                        <button
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                            className="p-1.5 rounded-lg bg-muted/50 hover:bg-muted disabled:opacity-30 border border-transparent hover:border-border/50 transition-colors"
                        >
                            <ChevronLeft size={16} />
                        </button>
                        <div className="flex items-center px-4 font-mono text-sm font-bold bg-muted/30 rounded-lg py-1">
                            {currentPage} <span className="text-muted-foreground/50 mx-1">/</span> {totalPages}
                        </div>
                        <button
                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                            disabled={currentPage === totalPages}
                            className="p-1.5 rounded-lg bg-muted/50 hover:bg-muted disabled:opacity-30 border border-transparent hover:border-border/50 transition-colors"
                        >
                            <ChevronRight size={16} />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
});

