import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { Clock, TrendingDown, TrendingUp, History, Trash2, Calendar } from 'lucide-react';
import { cn } from '../../lib/utils';
import { wsClient } from '../../core/net/wsClient';

interface Trade {
    ticket: number;
    symbol: string;
    side: string;
    volume: number;
    open_price: number;
    open_time: string;
    sl: number;
    tp: number;
    asset_class?: string;
    close_price: number;
    close_time: string;
    profit: number;
    status: string;
}

interface HistoryResponse {
    count: number;
    total_pnl: number;
    win_rate: number;
    trades: Trade[];
}

interface TradeHistoryProps {
    dataOverride?: Trade[];
    onDeleteSuccess?: () => void;
    periodPreset?: 'today' | '24h' | '7d' | '30d' | 'all';
    onTradeClick?: (trade: Trade) => void;
}

export const TradeHistory: React.FC<TradeHistoryProps> = ({ dataOverride, onDeleteSuccess, periodPreset = 'all', onTradeClick }) => {
    const [data, setData] = useState<HistoryResponse | null>(null);
    const [loading, setLoading] = useState(!dataOverride);

    const fetchHistory = async () => {
        try {
            const res = await api.get<HistoryResponse>('/api/trades/history?limit=100');
            if (res) setData(res);
        } catch (e) {
            console.error("Failed to fetch history", e);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (ticket: number) => {
        if (!window.confirm(`Tem certeza que deseja apagar o histórico do Trade #${ticket}? Isso não pode ser desfeito.`)) {
            return;
        }
        try {
            const res = await api.delete<{ status: string, message: string }>(`/api/trades/history/${ticket}`);
            if (res && res.status === 'success') {
                if (onDeleteSuccess) {
                    onDeleteSuccess();
                } else if (dataOverride && data) {
                    const newTrades = data.trades.filter(t => t.ticket !== ticket);
                    const wins = newTrades.filter(t => t.profit > 0).length;
                    const total_pnl = newTrades.reduce((acc, t) => acc + (t.profit || 0), 0);
                    const win_rate = newTrades.length > 0 ? (wins / newTrades.length) * 100 : 0;
                    setData({
                        count: newTrades.length,
                        total_pnl,
                        win_rate,
                        trades: newTrades
                    });
                } else {
                    fetchHistory();
                }
            } else {
                alert(`Erro ao apagar trade: O servidor não confirmou a exclusão. Você reiniciou o backend?`);
            }
        } catch (e) {
            console.error("Failed to delete trade", e);
            alert("Erro interno ao tentar apagar o trade. Verifique o console.");
        }
    };

    useEffect(() => {
        if (dataOverride) {
            const wins = dataOverride.filter(t => t.profit > 0).length;
            const total_pnl = dataOverride.reduce((acc, t) => acc + (t.profit || 0), 0);
            const win_rate = dataOverride.length > 0 ? (wins / dataOverride.length) * 100 : 0;

            setData({
                count: dataOverride.length,
                total_pnl,
                win_rate,
                trades: dataOverride
            });
            setLoading(false);
            return;
        }

        fetchHistory();

        const unsubscribe = wsClient.subscribeData((msg) => {
            if (msg.type === 'POSITION_CLOSED' || msg.type === 'POSITION_DESYNC_CLOSED') {
                fetchHistory(); // Refresh
            }
        });

        return () => {
            unsubscribe();
        };
    }, [dataOverride]);

    const getFilteredAndGroupedTrades = () => {
        if (!data || !data.trades) return [];

        const now = new Date();
        const filtered = data.trades.filter(t => {
            if (periodPreset === 'all') return true;
            if (!t.close_time) return true; // keep if no timestamp fallback

            const closeDate = new Date(t.close_time);
            const diffHours = (now.getTime() - closeDate.getTime()) / (1000 * 60 * 60);

            if (periodPreset === 'today') {
                return closeDate.getDate() === now.getDate() && closeDate.getMonth() === now.getMonth() && closeDate.getFullYear() === now.getFullYear();
            }
            if (periodPreset === '24h') return diffHours <= 24;
            if (periodPreset === '7d') return diffHours <= 24 * 7;
            if (periodPreset === '30d') return diffHours <= 24 * 30;
            return true;
        });

        filtered.sort((a, b) => {
            const timeA = a.close_time ? new Date(a.close_time).getTime() : 0;
            const timeB = b.close_time ? new Date(b.close_time).getTime() : 0;
            return timeB - timeA;
        });

        const groupArray: { dateKey: string, trades: Trade[] }[] = [];
        const seen = new Set();
        for (const t of filtered) {
            let dateKey = 'Data Desconhecida';
            if (t.close_time) {
                const d = new Date(t.close_time);
                // "25 de fev" format for elegance
                dateKey = d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).replace(' de ', ' ');
            }
            if (!seen.has(dateKey)) {
                seen.add(dateKey);
                groupArray.push({ dateKey, trades: [] });
            }
            groupArray.find(g => g.dateKey === dateKey)!.trades.push(t);
        }

        return groupArray;
    };

    if (loading) {
        return (
            <div className="flex flex-col h-full items-center justify-center text-muted-foreground flex-1 animate-pulse">
                <History size={48} className="mb-4 opacity-50" />
                <p>Carregando Histórico Transacional...</p>
            </div>
        );
    }

    if (!data || data.trades.length === 0) {
        return (
            <div className="flex flex-col h-full items-center justify-center text-muted-foreground flex-1 py-10">
                <History size={48} className="mb-4 opacity-50" />
                <h3 className="text-lg font-bold mb-1">Nenhum Histórico</h3>
                <p className="text-sm text-center max-w-sm">
                    Ainda não há trades liquidados armazenados na base local de eventos.
                </p>
            </div>
        );
    }

    const groupedTrades = getFilteredAndGroupedTrades();

    if (groupedTrades.length === 0) {
        return (
            <div className="flex flex-col h-full items-center justify-center text-muted-foreground flex-1 py-10 opacity-70">
                <Calendar size={48} className="mb-4 opacity-50" />
                <h3 className="text-md font-bold mb-1">Sem dados neste período</h3>
                <p className="text-sm text-center max-w-sm">
                    Tente ampliar o intervalo do filtro.
                </p>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full animate-in fade-in overflow-y-auto custom-scrollbar pr-2 relative">
            <div className="space-y-6">
                {groupedTrades.map((group) => (
                    <div key={group.dateKey} className="space-y-2 relative">
                        {/* Sticky Date Header */}
                        <div className="sticky top-0 z-10 bg-card/95 backdrop-blur-sm py-1.5 flex items-center justify-between mb-2 -mx-1 px-1">
                            <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest bg-muted/40 px-2.5 py-1 rounded-md border border-border/30 shadow-sm flex items-center gap-1.5">
                                <Calendar size={12} />
                                {group.dateKey}
                            </span>
                            <span className="text-[10px] text-muted-foreground/80 font-mono font-bold bg-muted/20 px-2 py-0.5 rounded">
                                {group.trades.length} ops
                            </span>
                        </div>

                        {group.trades.map((trade) => {
                            const isWin = trade.profit > 0;
                            const timeStr = trade.close_time ? new Date(trade.close_time).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '';

                            return (
                                <div
                                    key={trade.ticket}
                                    onClick={() => onTradeClick && onTradeClick(trade)}
                                    className={cn(
                                        "flex items-center justify-between p-3 rounded-lg border border-border/50 bg-muted/20 transition-colors group",
                                        onTradeClick ? "cursor-pointer hover:bg-muted/60 hover:border-border" : "hover:bg-muted/40"
                                    )}
                                >
                                    <div className="flex items-center gap-4">
                                        <div className={cn(
                                            "w-10 h-10 rounded-full flex items-center justify-center shrink-0 border",
                                            isWin ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-500" : "bg-rose-500/10 border-rose-500/30 text-rose-500"
                                        )}>
                                            {isWin ? <TrendingUp size={20} /> : <TrendingDown size={20} />}
                                        </div>
                                        <div className="flex flex-col">
                                            <div className="flex items-center gap-2">
                                                <span className="font-bold text-base">
                                                    {trade.asset_class && <span className="text-muted-foreground mr-1.5 opacity-80">{trade.asset_class}</span>}
                                                    {trade.symbol}
                                                </span>
                                                <span className={cn("text-[10px] uppercase font-bold px-1.5 py-0.5 rounded", trade.side === "BUY" ? "bg-emerald-500/20 text-emerald-500" : "bg-rose-500/20 text-rose-500")}>
                                                    {trade.side}
                                                </span>
                                            </div>
                                            <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5 font-mono">
                                                <Clock size={12} className="text-muted-foreground/70" /> {timeStr} • #{trade.ticket}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-6">
                                        <div className="hidden md:flex flex-col items-end text-[10px] font-mono text-muted-foreground/70">
                                            <span>V: {trade.volume?.toFixed(2)}</span>
                                            <span>I: {trade.open_price?.toFixed(5)}</span>
                                            <span>O: {trade.close_price?.toFixed(5)}</span>
                                        </div>
                                        <div className={cn(
                                            "text-right font-bold font-mono text-lg min-w-[90px]",
                                            isWin ? "text-emerald-500" : "text-rose-500"
                                        )}>
                                            {isWin ? '+' : ''}${trade.profit?.toFixed(2)}
                                        </div>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleDelete(trade.ticket);
                                            }}
                                            className="opacity-0 group-hover:opacity-100 transition-opacity p-2 hover:bg-rose-500/20 text-rose-500 rounded-md shrink-0"
                                            title="Apagar Histórico"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ))}
            </div>
        </div>
    );
};
