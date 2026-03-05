import { useState, useEffect, useCallback } from 'react';
import { UniverseStatusStrip } from '../components/universe/UniverseStatusStrip';
import { RankingTable } from '../components/universe/RankingTable';
import { AssetDrawer } from '../components/universe/AssetDrawer';
import { ClassesAndBlockedView } from '../components/universe/ClassesAndBlockedView';
import { CriteriaEditor } from '../components/universe/CriteriaEditor';
import { EconomicCalendar } from '../components/universe/EconomicCalendar';
import { CorrelationHeatmap } from '../components/universe/CorrelationHeatmap';
import { api } from '../services/api';
import type { UniverseSnapshot, RankingRow, UniverseConfig } from '../services/api';
import { Layers, ListFilter, Settings, AlertTriangle, Activity, Calendar } from 'lucide-react';
import { uxWatchdog } from '../core/watchdog/uxWatchdog';
import { wsClient } from '../core/net/wsClient';
import { cn } from '../lib/utils';

// For diagnostics modal
interface DiagnosticsData extends UniverseSnapshot {
    mt5_connected?: boolean;
    mt5_latency_ms?: number;
    last_mt5_error?: string;
    universe_source?: string;
}

export const WatchdogBanner: React.FC<{
    wdState: { isSnapshotStale: boolean, lastSnapshotAt: number },
    wsState: { status: string, isStale: boolean, lastMessageAt: number },
    isRestFallbackActive: boolean
}> = ({ wdState, wsState, isRestFallbackActive }) => {
    const [now, setNow] = useState(() => Date.now());

    useEffect(() => {
        const interval = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(interval);
    }, []);

    const formatAgo = (timestamp: number) => {
        if (!timestamp) return 'Nunca';
        const diff = Math.round((now - timestamp) / 1000);
        return `${diff}s atrás`;
    };

    if (!wdState.isSnapshotStale && wsState.status === 'open' && !wsState.isStale) {
        return null;
    }

    return (
        <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-lg flex items-start gap-3 text-sm animate-in fade-in">
            <AlertTriangle size={18} className="shrink-0 mt-0.5" />
            <div className="flex flex-col flex-1 w-full">
                <span className="font-bold">System Telemetry Alert</span>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-2 text-xs opacity-90 border-t border-destructive/10 pt-2 pb-2">
                    <div><strong>WS Status:</strong> {wsState.status}</div>
                    <div><strong>Última msg WS:</strong> {formatAgo(wsState.lastMessageAt)}</div>
                    <div><strong>Fallback REST:</strong> {isRestFallbackActive ? 'ATIVO (2000ms)' : 'Inativo'}</div>
                    <div><strong>Último Snapshot:</strong> {formatAgo(wdState.lastSnapshotAt)}</div>
                </div>
                <span className="opacity-90 mt-1 block font-medium">
                    {wsState.status !== 'open' ? "Conexão WebSocket fechada. Usando polling REST..." :
                        wsState.isStale ? "Stream WebSocket estagnado (nenhuma cotação chegando há 15s)." :
                            wdState.isSnapshotStale ? "Snapshot de dados estagnado (backend travado ou scanner desligado)." : ""}
                </span>
                <div className="text-xs opacity-75 mt-1 font-mono">
                    Dica: Acesse Logs & Transparency ou pressione [Ctrl+Shift+D] para mais detalhes.
                </div>
            </div>
        </div>
    );
};

export const UniversePage = () => {
    const [snapshot, setSnapshot] = useState<DiagnosticsData | null>(null);
    const [ranking, setRanking] = useState<RankingRow[]>([]);
    const [config, setConfig] = useState<UniverseConfig | null>(null);
    const [selectedAsset, setSelectedAsset] = useState<RankingRow | null>(null);
    const [manualBasket, setManualBasket] = useState<Set<string>>(new Set());
    const [showDiagnostics, setShowDiagnostics] = useState(false);

    const [activeTab, setActiveTab] = useState<'ranking' | 'filters' | 'criteria' | 'calendar' | 'heatmap'>('ranking');

    const [wdState, setWdState] = useState(uxWatchdog.getStatus());
    const [wsState, setWsState] = useState({
        status: wsClient.status,
        isStale: wsClient.isStale,
        lastMessageAt: wsClient.lastMessageAt
    });

    const fetchData = useCallback(async () => {
        // Fetch extended diagnostics instead of just snapshot for the new diagnostic panel
        const s = await api.get<DiagnosticsData>('/api/universe/diagnostics').catch(() => null);
        if (s) {
            setSnapshot(s);
            uxWatchdog.notifySnapshotReceived(s.cycle_id);
        }

        const r = await api.get<RankingRow[]>('/api/universe/ranking');
        if (r) setRanking(r);

        const c = await api.get<UniverseConfig>('/api/universe/config');
        if (c) {
            setConfig(c);
            if (c.manual_basket) {
                setManualBasket(new Set(c.manual_basket));
            }
        }
    }, []);

    useEffect(() => {
        const unsubWd = uxWatchdog.subscribe(() => setWdState(uxWatchdog.getStatus()));
        const unsubWs = wsClient.subscribe(() => setWsState({
            status: wsClient.status,
            isStale: wsClient.isStale,
            lastMessageAt: wsClient.lastMessageAt
        }));

        return () => {
            unsubWd();
            unsubWs();
        };
    }, []);

    useEffect(() => {
        fetchData(); // Initial or re-trigger fetch

        let interval: ReturnType<typeof setInterval>;

        if (wsState.status !== 'open') {
            interval = setInterval(fetchData, 2000); // Fallback REST Polling
        }

        const unsubscribeWsData = wsClient.subscribeData((msg: { type: string, payload: any }) => {
            if (msg.type === 'UNIVERSE_SNAPSHOT' && msg.payload) {
                // Ensure typescript is happy, some payloads might be partial
                setSnapshot(prev => ({ ...prev, ...msg.payload }));
                uxWatchdog.notifySnapshotReceived(msg.payload.cycle_id);

                // If the snapshot says it has a ranking, use it
                if (msg.payload.ranking) {
                    setRanking(msg.payload.ranking);
                }
            } else if (msg.type === 'UNIVERSE_RANKING_COMPUTED' && msg.payload) {
                // Occurs every 20 ticks in the scanner or at the end
                fetchData();
            } else if (msg.type === 'UNIVERSE_SCAN_STARTED') {
                // Optionally start loading state
                setConfig(prev => prev ? { ...prev, scanner_enabled: true } : prev);
            } else if (msg.type === 'UNIVERSE_SCANNER_STOPPED') {
                setConfig(prev => prev ? { ...prev, scanner_enabled: false } : prev);
            }
        });

        return () => {
            if (interval) clearInterval(interval);
            unsubscribeWsData();
        };
    }, [fetchData, wsState.status]);

    const isRestFallbackActive = wsState.status !== 'open';



    const forceRefresh = async () => {
        // To quickly force a cycle, starting and then triggering fetch
        if (config && !config.scanner_enabled) {
            await api.post('/api/universe/scanner/start', {});
            setTimeout(() => fetchData(), 1000); // give it a sec to run
        } else {
            // Just trigger a fetch, or if there was a "force-run" endpoint we could call it.
            // Auto mode handles its own loop, but we can restart it.
            await api.post('/api/universe/scanner/stop', {});
            await api.post('/api/universe/scanner/start', {});
            setTimeout(() => fetchData(), 1000);
        }
    };

    const handleModeChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
        await api.post('/api/universe/mode', { mode: e.target.value });
        fetchData();
    };

    const handlePublishManual = async () => {
        await api.post('/api/universe/manual/publish', { symbols: Array.from(manualBasket) });
        fetchData();
    };

    return (
        <div className="space-y-6 h-full flex flex-col">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Universe & Selection</h2>
                    <p className="text-sm text-muted-foreground mt-1">Global Asset Scanner & Universe Gate</p>
                </div>

                <div className="flex gap-2 items-center">
                    {config && (
                        <select
                            className="bg-card border border-border rounded px-3 py-2 text-sm font-bold"
                            value={config.selection_mode || 'AUTO'}
                            onChange={handleModeChange}
                        >
                            <option value="AUTO">Mode: AUTO</option>
                            <option value="MANUAL">Mode: MANUAL</option>
                        </select>
                    )}

                    {config && (
                        <div className="flex gap-2">
                            <button onClick={forceRefresh} className="bg-secondary text-secondary-foreground px-4 py-2 flex items-center gap-2 rounded-md hover:bg-secondary/80 font-bold transition-colors">
                                <Activity size={16} /> Force Refresh
                            </button>
                        </div>
                    )}
                </div>
            </header>

            {/* Quick Diagnostic Panel */}
            <div className="bg-card border border-border rounded-lg p-3 flex flex-wrap items-center justify-between gap-4 text-sm">
                <div className="flex items-center gap-6">
                    <div className="flex items-center gap-2">
                        <span className="font-bold text-muted-foreground mr-1">Source:</span>
                        <div className={`flex items-center gap-1 font-bold ${snapshot?.universe_source === 'empty' ? 'text-destructive' : 'text-primary'}`}>
                            {snapshot?.universe_source?.toUpperCase() || 'UNKNOWN'}
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="font-bold text-muted-foreground mr-1">MT5:</span>
                        <div className={`px-2 py-0.5 rounded text-xs font-bold ${snapshot?.mt5_connected ? 'bg-emerald-500/10 text-emerald-500' : 'bg-destructive/10 text-destructive'}`}>
                            {snapshot?.mt5_connected ? 'Connected' : 'Disconnected'}
                        </div>
                    </div>
                    {snapshot?.mt5_connected && snapshot?.mt5_latency_ms !== undefined && snapshot.mt5_latency_ms >= 0 && (
                        <div className="flex items-center gap-1 border-l border-border pl-3 ml-1">
                            <Activity size={14} className={snapshot.mt5_latency_ms < 50 ? "text-emerald-500" : snapshot.mt5_latency_ms < 200 ? "text-orange-500" : "text-destructive"} />
                            <span className={`text-xs font-bold font-mono ${snapshot.mt5_latency_ms < 50 ? "text-emerald-500" : snapshot.mt5_latency_ms < 200 ? "text-orange-500" : "text-destructive"}`}>
                                {snapshot.mt5_latency_ms}ms
                            </span>
                        </div>
                    )}
                    <div className="flex items-center gap-2">
                        <span className="font-bold text-muted-foreground mr-1">WS:</span>
                        <span className={wsState.status === 'open' ? 'text-emerald-500 font-bold' : 'text-orange-500 font-bold'}>{wsState.status.toUpperCase()}</span>
                    </div>
                    {isRestFallbackActive && (
                        <div className="flex items-center gap-2">
                            <span className="font-bold text-muted-foreground mr-1">REST Fallback:</span>
                            <span className="text-orange-500 font-bold">2000ms</span>
                        </div>
                    )}
                </div>
                <button onClick={() => setShowDiagnostics(true)} className="text-primary hover:underline font-medium flex items-center gap-1">
                    Ver Diagnostics Completo &rarr;
                </button>
            </div>

            {/* UX Watchdog Banner */}
            <WatchdogBanner wdState={wdState} wsState={wsState} isRestFallbackActive={isRestFallbackActive} />

            {/* Status Strip */}
            <UniverseStatusStrip snapshot={snapshot} />

            {/* Tabs - Segmented Control */}
            <div className="flex bg-muted/30 p-1.5 rounded-full w-max border border-border/50 shadow-sm overflow-x-auto max-w-full">
                <button
                    onClick={() => setActiveTab('ranking')}
                    className={cn("flex items-center gap-2 px-4 py-1.5 text-sm font-bold rounded-full transition-all duration-200", activeTab === 'ranking' ? "bg-background text-foreground shadow-[0_2px_8px_rgba(0,0,0,0.05)] border border-border/50" : "text-muted-foreground/80 hover:text-foreground border border-transparent")}
                >
                    <Layers size={16} /> Live Ranking
                </button>
                <button
                    onClick={() => setActiveTab('filters')}
                    className={cn("flex items-center gap-2 px-4 py-1.5 text-sm font-bold rounded-full transition-all duration-200", activeTab === 'filters' ? "bg-background text-foreground shadow-[0_2px_8px_rgba(0,0,0,0.05)] border border-border/50" : "text-muted-foreground/80 hover:text-foreground border border-transparent")}
                >
                    <ListFilter size={16} /> Classes & Blocked
                </button>
                <button
                    onClick={() => setActiveTab('criteria')}
                    className={cn("flex items-center gap-2 px-4 py-1.5 text-sm font-bold rounded-full transition-all duration-200", activeTab === 'criteria' ? "bg-background text-foreground shadow-[0_2px_8px_rgba(0,0,0,0.05)] border border-border/50" : "text-muted-foreground/80 hover:text-foreground border border-transparent")}
                >
                    <Settings size={16} /> Criteria Editor
                </button>
                <button
                    onClick={() => setActiveTab('calendar')}
                    className={cn("flex items-center gap-2 px-4 py-1.5 text-sm font-bold rounded-full transition-all duration-200", activeTab === 'calendar' ? "bg-background text-foreground shadow-[0_2px_8px_rgba(0,0,0,0.05)] border border-border/50" : "text-muted-foreground/80 hover:text-foreground border border-transparent")}
                >
                    <Calendar size={16} /> Macro Events
                </button>
                <button
                    onClick={() => setActiveTab('heatmap')}
                    className={cn("flex items-center gap-2 px-4 py-1.5 text-sm font-bold rounded-full transition-all duration-200", activeTab === 'heatmap' ? "bg-background text-foreground shadow-[0_2px_8px_rgba(0,0,0,0.05)] border border-border/50" : "text-muted-foreground/80 hover:text-foreground border border-transparent")}
                >
                    <Activity size={16} /> Anti-Cloner
                </button>
            </div>

            <div className="flex-1 overflow-hidden">
                {activeTab === 'ranking' && (
                    <div className="h-full flex flex-col lg:flex-row gap-6">
                        {/* Ranking Table */}
                        <div className="flex-1 overflow-auto">
                            {config?.selection_mode === 'MANUAL' && (
                                <div className="mb-4 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-primary/10 border border-primary/20 p-4 rounded-lg">
                                    <div className="text-sm font-medium text-primary">
                                        Modo Manual Ativo. Selecione os ativos abaixo (Total selecionado: <strong>{manualBasket.size}</strong>)
                                    </div>
                                    <button
                                        onClick={handlePublishManual}
                                        disabled={manualBasket.size === 0}
                                        className="bg-primary text-primary-foreground px-4 py-2 rounded-lg font-bold text-sm hover:bg-primary/90 disabled:opacity-50 transition-colors shadow-sm w-full md:w-auto"
                                    >
                                        Publicar Manual Basket
                                    </button>
                                </div>
                            )}

                            {config?.selection_mode === 'MANUAL' ? (
                                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
                                    {ranking.filter(r => r.status === 'ELIGIBLE' || r.decision === 'selected').map(r => (
                                        <div
                                            key={r.symbol}
                                            onClick={() => {
                                                const next = new Set(manualBasket);
                                                if (next.has(r.symbol)) next.delete(r.symbol);
                                                else next.add(r.symbol);
                                                setManualBasket(next);
                                            }}
                                            className={`cursor-pointer p-3 rounded-md border text-center font-bold font-mono transition-colors ${manualBasket.has(r.symbol)
                                                ? 'bg-primary text-primary-foreground border-primary'
                                                : 'bg-card border-border hover:border-primary/50'
                                                }`}
                                        >
                                            {r.symbol}
                                        </div>
                                    ))}
                                    {ranking.filter(r => r.status === 'ELIGIBLE' || r.decision === 'selected').length === 0 && (
                                        <div className="col-span-full p-4 text-center text-muted-foreground border border-dashed rounded">
                                            Nenhum ativo Elegível encontrado no modo Manual. Verifique os critérios.
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <>
                                    {/* Empty States */}
                                    {(!snapshot?.universe?.raw_count && !snapshot?.universe_raw_total) ? (
                                        <div className="flex flex-col items-center justify-center p-12 text-center h-full border border-dashed border-border rounded-lg bg-card/50">
                                            <AlertTriangle size={48} className="text-destructive mb-4 opacity-80" />
                                            <h3 className="text-2xl font-bold mb-2">Universo Vazio (Nenhum símbolo carregado)</h3>
                                            <p className="text-muted-foreground max-w-md">
                                                O motor não encontrou nenhum ativo listado. Verifique se o MT5 está conectado corretamente, se o <i>Market Watch</i> tem ativos visíveis, ou se a lista de <i>seeds</i> no backend está configurada.
                                            </p>
                                        </div>
                                    ) : (!snapshot?.universe?.eligible_count && !snapshot?.scanned_count) ? (
                                        <div className="flex flex-col items-center justify-center p-12 text-center h-full border border-dashed border-border/50 rounded-xl bg-card/30">
                                            <Activity size={48} className="text-orange-500 mb-4 opacity-80" />
                                            <h3 className="text-2xl font-bold mb-2 text-foreground/90">Nenhum Ativo Elegível</h3>
                                            <p className="text-muted-foreground max-w-md mb-4 leading-relaxed">
                                                Existem ativos brutos (<strong className="font-mono text-foreground/80">{snapshot.universe?.raw_count || snapshot.universe_raw_total}</strong>), mas nenhum passou nos critérios de liquidez e métricas. Revise os <strong className="text-foreground/80">Thresholds e Critérios</strong> no Editor, ou verifique se o MT5 está puxando ticks corretamente.
                                            </p>
                                        </div>
                                    ) : (
                                        <RankingTable
                                            data={ranking}
                                            onRowClick={(asset) => setSelectedAsset(asset)}
                                        />
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                )}

                {activeTab === 'filters' && (
                    <div className="h-full overflow-auto">
                        <ClassesAndBlockedView config={config} snapshot={snapshot} onConfigUpdate={fetchData} />
                    </div>
                )}

                {activeTab === 'criteria' && (
                    <div className="h-full overflow-auto p-4">
                        <CriteriaEditor config={config} onSaved={fetchData} />
                    </div>
                )}

                {activeTab === 'calendar' && (
                    <div className="h-full overflow-auto p-4">
                        <EconomicCalendar />
                    </div>
                )}

                {activeTab === 'heatmap' && (
                    <div className="h-full overflow-auto p-4">
                        <CorrelationHeatmap />
                    </div>
                )}
            </div>

            {selectedAsset && (
                <AssetDrawer asset={selectedAsset} onClose={() => setSelectedAsset(null)} />
            )}

            {/* Diagnostics Modal */}
            {showDiagnostics && (
                <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-card w-full max-w-3xl border border-border rounded-lg shadow-xl shadow-black/40 overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="p-4 border-b border-border flex justify-between items-center bg-muted/30">
                            <h3 className="font-bold text-lg flex items-center gap-2"><Activity size={18} className="text-primary" /> Diagnostics Snapshot (JSON)</h3>
                            <button onClick={() => setShowDiagnostics(false)} className="text-muted-foreground hover:text-foreground font-bold p-1">&times;</button>
                        </div>
                        <div className="p-4 overflow-auto bg-black/50 text-[#a6e22e] text-sm font-mono whitespace-pre-wrap">
                            {JSON.stringify(snapshot, null, 2)}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

