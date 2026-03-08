import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { List, Loader2 } from 'lucide-react';
import { TradeHistory } from '../../components/operations/TradeHistory';

export const MobileLedger: React.FC = () => {
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    // Re-use logic to fetch today's dashboard data, getting recent_ledger
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

    return (
        <div className="p-4 space-y-4 pt-6 flex flex-col h-[calc(100vh-64px)]">
            <h2 className="text-xl font-bold flex items-center gap-2 shrink-0">
                <List className="text-primary" />
                Extrato de Trades
            </h2>
            <p className="text-xs text-muted-foreground shrink-0 border-b border-border pb-2">
                Histórico referente a sessão atual (Hoje).
            </p>

            {loading ? (
                <div className="flex-1 flex flex-col items-center justify-center space-y-4">
                    <Loader2 size={32} className="animate-spin text-primary opacity-60" />
                    <p className="text-xs text-muted-foreground">Buscando ledger...</p>
                </div>
            ) : (
                <div className="flex-1 overflow-hidden bg-card border border-border rounded-2xl p-2 relative">
                    {/* Custom Wrapper to tweak TradeHistory layout for Mobile */}
                    <div className="mobile-ledger-wrapper h-full flex flex-col [&>div]:h-full [&>div>div:first-child]:hidden [&_table]:text-xs [&_th]:px-2 [&_td]:px-2 [&_th]:py-2 [&_td]:py-2 overflow-y-auto custom-scrollbar">
                        <TradeHistory dataOverride={data?.recent_ledger || []} periodPreset="today" hideFilters={true} />
                    </div>
                </div>
            )}
        </div>
    );
};
