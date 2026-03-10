import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { ShieldCheck, Crosshair, TrendingUp, Zap, SlidersHorizontal, Settings2 } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface StrategyConfigItem {
    name: string;
    enabled: boolean;
    weight_multiplier: number;
    min_score_threshold: number;
    parameters?: Record<string, any>;
}

export const StrategyControlPanel: React.FC = () => {
    const [strategies, setStrategies] = useState<StrategyConfigItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' } | null>(null);

    const showToast = (message: string, type: 'success' | 'error' = 'success') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 3000);
    };

    const fetchConfig = async () => {
        try {
            const res = await api.get<StrategyConfigItem[]>('/api/engine/strategies/config');
            if (res) {
                setStrategies(res);
            }
        } catch (e) {
            console.error("Failed to load strategy config", e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchConfig();
        // Optional polling if other user changes it
        const interval = setInterval(fetchConfig, 30000);
        return () => clearInterval(interval);
    }, []);

    const updateStrategy = async (name: string, updates: Partial<StrategyConfigItem>) => {
        // Optimistic UI Update
        setStrategies(prev => prev.map(s => s.name === name ? { ...s, ...updates } : s));
        try {
            await api.put(`/api/engine/strategies/config/${name}`, updates);
            showToast(`[SYS] ${name} atualizada.`, 'success');
        } catch (e) {
            console.error("Failed to update strategy", e);
            showToast(`[ERR] Falha de comunicação (${name})`, 'error');
            // Revert on error
            fetchConfig();
        }
    };



    const getIcon = (name: string) => {
        if (name.includes('Trend')) return <TrendingUp size={18} />;
        if (name.includes('Mean')) return <Crosshair size={18} />;
        if (name.includes('Breakout')) return <Zap size={18} />;
        if (name.includes('SmartMoney')) return <ShieldCheck size={18} />;
        return <Settings2 size={18} />;
    };

    const getModeLabel = (threshold: number) => {
        if (threshold <= 35) return "Agressivo";
        if (threshold <= 50) return "Balanceado";
        return "Conservador";
    };

    if (loading) return <div className="p-4 text-muted-foreground animate-pulse text-sm font-mono">Carregando painel do motor...</div>;

    return (
        <div className="bg-card border border-border/50 rounded-xl p-4 shadow-sm relative">
            {/* Toast Notification Layer */}
            {toast && (
                <div className={cn(
                    "fixed top-24 left-1/2 -translate-x-1/2 z-[100] px-4 py-2 rounded-lg text-xs font-mono font-bold shadow-lg flex items-center gap-2 animate-in slide-in-from-top-2",
                    toast.type === 'success' ? "bg-emerald-500/20 text-emerald-500 border border-emerald-500/50" : "bg-rose-500/20 text-rose-500 border border-rose-500/50"
                )}>
                    {toast.type === 'success' ? <ShieldCheck size={14} /> : <Zap size={14} />}
                    {toast.message}
                </div>
            )}

            <div className="flex items-center justify-between mb-4 border-b border-border/50 pb-3">
                <div className="flex items-center gap-2">
                    <SlidersHorizontal size={18} className="text-primary" />
                    <h3 className="font-bold text-lg tracking-tight">Afinação do Motor (Estratégias)</h3>
                </div>
                <div className="text-xs bg-muted/60 px-2 py-1 rounded text-muted-foreground font-mono">
                    Live Tuning
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {strategies.map(strat => (
                    <div
                        key={strat.name}
                        className={cn(
                            "relative overflow-hidden group border rounded-xl p-4 transition-all duration-300",
                            strat.enabled
                                ? "bg-muted/10 border-primary/20 hover:border-primary/40"
                                : "bg-muted/5 border-border/30 opacity-75 grayscale-[0.5]"
                        )}
                    >
                        {/* Status Glow */}
                        <div className={cn(
                            "absolute top-0 left-0 w-1 h-full transition-colors",
                            strat.enabled ? "bg-emerald-500/50" : "bg-neutral-500/30"
                        )} />

                        <div className="flex justify-between items-start mb-3 ml-2">
                            <div className="flex items-center gap-2">
                                <div className={cn("p-1.5 rounded-md", strat.enabled ? "bg-primary/10 text-primary" : "bg-neutral-500/10 text-neutral-500")}>
                                    {getIcon(strat.name)}
                                </div>
                                <div>
                                    <h4 className="font-bold tracking-tight text-foreground/90">{strat.name}</h4>
                                    <span className="text-[10px] font-mono uppercase text-muted-foreground/70">
                                        Status: {strat.enabled ? 'Ativa' : 'Desativada'}
                                    </span>
                                </div>
                            </div>

                            {/* Toggle Switch */}
                            <button
                                onClick={() => updateStrategy(strat.name, { enabled: !strat.enabled })}
                                className={cn(
                                    "relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background",
                                    strat.enabled ? "bg-emerald-500" : "bg-neutral-500"
                                )}
                            >
                                <span className={cn(
                                    "inline-block h-3 w-3 transform rounded-full bg-white transition-transform",
                                    strat.enabled ? "translate-x-5" : "translate-x-1"
                                )} />
                            </button>
                        </div>

                        <div className="space-y-4 ml-2">
                            {/* Threshold Slider */}
                            <div className="space-y-1.5">
                                <div className="flex justify-between text-xs">
                                    <span className="text-muted-foreground font-semibold">Exigência (Score)</span>
                                    <span className={cn(
                                        "font-mono font-bold",
                                        strat.min_score_threshold <= 35 ? "text-rose-500" : strat.min_score_threshold >= 60 ? "text-emerald-500" : "text-amber-500"
                                    )}>
                                        {strat.min_score_threshold.toFixed(1)} ({getModeLabel(strat.min_score_threshold)})
                                    </span>
                                </div>
                                <input
                                    type="range"
                                    min="20"
                                    max="80"
                                    step="5"
                                    value={strat.min_score_threshold}
                                    disabled={!strat.enabled}
                                    onChange={(e) => updateStrategy(strat.name, { min_score_threshold: parseFloat(e.target.value) })}
                                    className="w-full h-1.5 bg-neutral-200 dark:bg-neutral-800 rounded-lg appearance-none cursor-pointer disabled:cursor-not-allowed accent-primary"
                                />
                                <div className="flex justify-between text-[9px] text-muted-foreground/50 font-mono uppercase">
                                    <span>Agressivo (30)</span>
                                    <span>Conservador (60)</span>
                                </div>
                            </div>

                            {/* Weight Multiplier Input */}
                            <div className="flex items-center justify-between border-t border-border/40 pt-2 pb-1">
                                <span className="text-xs text-muted-foreground font-semibold">Peso no Desempate (x1.0)</span>
                                <div className="flex items-center gap-2">
                                    <button
                                        disabled={!strat.enabled || strat.weight_multiplier <= 0.5}
                                        onClick={() => updateStrategy(strat.name, { weight_multiplier: Math.max(0.5, strat.weight_multiplier - 0.1) })}
                                        className="w-6 h-6 rounded bg-muted hover:bg-muted/80 flex items-center justify-center text-xs font-bold disabled:opacity-50"
                                    >-</button>
                                    <span className="text-xs font-mono font-bold w-8 text-center bg-background border border-border/50 py-0.5 rounded">
                                        x{strat.weight_multiplier.toFixed(1)}
                                    </span>
                                    <button
                                        disabled={!strat.enabled || strat.weight_multiplier >= 2.0}
                                        onClick={() => updateStrategy(strat.name, { weight_multiplier: Math.min(2.0, strat.weight_multiplier + 0.1) })}
                                        className="w-6 h-6 rounded bg-muted hover:bg-muted/80 flex items-center justify-center text-xs font-bold disabled:opacity-50"
                                    >+</button>
                                </div>
                            </div>

                            {/* Dynamic AI / Physics Parameters (Phase 5/6) */}
                            {strat.parameters && Object.keys(strat.parameters).length > 0 && (
                                <div className="mt-2 border-t border-border/40 pt-3 space-y-2">
                                    <h5 className="text-[11px] font-bold text-muted-foreground/80 uppercase tracking-wider mb-2">
                                        Calibragem Física (IA Ready)
                                    </h5>
                                    {Object.entries(strat.parameters).map(([key, value]) => {
                                        if (key.startsWith('_description_')) {
                                            return (
                                                <div key={key} className="text-[10px] text-muted-foreground bg-muted/40 p-2.5 rounded border border-border/50 leading-relaxed font-mono mb-2">
                                                    {value}
                                                </div>
                                            );
                                        }
                                        if (typeof value === 'number') {
                                            return (
                                                <div key={key} className="flex justify-between items-center bg-background border border-border/50 shadow-sm rounded-lg px-3 py-2">
                                                    <span className="text-[11px] font-mono font-medium text-foreground/80 flex-1 truncate pr-2">{key.replace(/_/g, ' ')}</span>
                                                    <div className="flex items-center gap-2">
                                                        <input
                                                            type="number"
                                                            step={value % 1 !== 0 || value < 5 ? "0.01" : "1"}
                                                            value={value}
                                                            disabled={!strat.enabled}
                                                            onChange={(e) => {
                                                                const val = parseFloat(e.target.value);
                                                                if (!isNaN(val)) {
                                                                    updateStrategy(strat.name, {
                                                                        parameters: { ...strat.parameters, [key]: val }
                                                                    });
                                                                }
                                                            }}
                                                            className="w-16 bg-transparent text-right text-xs font-mono font-bold text-primary focus:outline-none border-b border-primary/20 focus:border-primary transition-colors pb-0.5 disabled:opacity-50"
                                                        />
                                                    </div>
                                                </div>
                                            );
                                        }
                                        return null;
                                    })}
                                </div>
                            )}
                        </div>

                    </div>
                ))}
            </div>


        </div>
    );
};
