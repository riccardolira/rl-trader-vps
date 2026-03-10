import React, { useState, useEffect } from 'react';
import { Ban, Activity, HelpCircle, Save, Loader2 } from 'lucide-react';
import { api } from '../../services/api';
import type { UniverseConfig } from '../../services/api';
import { CorrelationHeatmap } from './CorrelationHeatmap';

const TooltipIcon = ({ text }: { text: string }) => (
    <div className="group relative inline-block ml-1">
        <HelpCircle size={14} className="text-muted-foreground hover:text-foreground cursor-help" />
        <div className="hidden group-hover:block absolute z-50 w-64 p-2 mt-1 text-xs bg-popover text-popover-foreground border border-border rounded shadow-lg pointer-events-none">
            {text}
        </div>
    </div>
);

interface ViewProps {
    config?: UniverseConfig | null;
    onConfigUpdate: () => void;
}

export const ScannerFiltersView: React.FC<ViewProps> = ({ config, onConfigUpdate }) => {
    const [newBlocked, setNewBlocked] = useState('');
    const [localConfig, setLocalConfig] = useState<UniverseConfig | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [isDirty, setIsDirty] = useState(false);

    useEffect(() => {
        if (config && (!localConfig || !isDirty)) {
            setLocalConfig(JSON.parse(JSON.stringify(config)));
            setIsDirty(false);
        }
    }, [config]);

    if (!config || !localConfig) return <div className="p-4">Carregando configurações...</div>;

    const handleGlobalChange = (key: keyof UniverseConfig, value: any) => {
        setLocalConfig({ ...localConfig, [key]: value });
        setIsDirty(true);
    };

    const saveChanges = async () => {
        setIsSaving(true);
        try {
            await api.post('/api/universe/config/update', localConfig);
            setIsDirty(false);
            onConfigUpdate();
        } catch (e) {
            console.error("Falha ao salvar", e);
        } finally {
            setIsSaving(false);
        }
    };

    const addBlock = async () => {
        if (!newBlocked) return;
        await api.post(`/api/universe/blocklist/add?symbol=${newBlocked.toUpperCase()}`, {});
        setNewBlocked('');
        onConfigUpdate();
    };

    const removeBlock = async (symbol: string) => {
        await api.post(`/api/universe/blocklist/remove?symbol=${symbol}`, {});
        onConfigUpdate();
    };

    return (
        <div className="space-y-6 animate-in fade-in">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4">
                {/* Blocklist */}
                <div className="space-y-4 bg-card border border-border p-4 rounded-lg">
                    <h3 className="font-semibold text-lg flex items-center gap-2">
                        <Ban className="text-destructive" size={20} />
                        Manual Blocklist
                    </h3>
                    <p className="text-sm text-muted-foreground">
                        Ativos adicionados aqui serão <strong>sumariamente ignorados</strong> pelo motor, independente de passarem nas regras de liquidez ou score.
                    </p>

                    <div className="flex gap-2 pt-2">
                        <input
                            className="flex-1 bg-background border border-border rounded px-3 py-2 text-sm uppercase"
                            placeholder="Add Symbol (e.g. BTCUSD)"
                            value={newBlocked}
                            onChange={(e) => setNewBlocked(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && addBlock()}
                        />
                        <button
                            onClick={addBlock}
                            className="bg-destructive/10 text-destructive hover:bg-destructive/20 px-4 py-2 rounded text-sm font-semibold transition-colors"
                        >
                            Block
                        </button>
                    </div>

                    <div className="space-y-2 max-h-[400px] overflow-auto border border-border/50 rounded-md bg-background/50 p-2">
                        {(!config.blocklist || config.blocklist.length === 0) && (
                            <div className="text-sm text-muted-foreground italic p-4 text-center">
                                Nenhum ativo bloqueado manualmente.
                            </div>
                        )}
                        {config.blocklist && config.blocklist.map(s => (
                            <div key={s} className="flex items-center justify-between p-2 rounded bg-muted/30 border border-border hover:bg-muted/50 transition-colors">
                                <span className="font-mono font-bold text-sm tracking-wider">{s}</span>
                                <button
                                    type="button"
                                    onClick={() => removeBlock(s)}
                                    className="text-xs font-semibold text-destructive/80 hover:text-destructive hover:underline px-2 py-1"
                                >
                                    Remover
                                </button>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Anti-Correlation Shield */}
                <div className="space-y-4 bg-card border border-border p-4 rounded-lg flex flex-col justify-between">
                    <div>
                        <h3 className="font-semibold text-lg flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                                <Activity className="text-primary" size={20} />
                                Anti-Correlation Shield
                                <TooltipIcon text="Impede a seleção de ativos altamente correlacionados (positiva ou negativamente) para diversificar o risco." />
                            </div>
                            <div className="flex items-center h-8">
                                {(isDirty) && (
                                    <button
                                        onClick={saveChanges}
                                        disabled={isSaving}
                                        className="flex items-center gap-2 px-3 py-1.5 rounded-md font-bold text-xs bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                                    >
                                        {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                                        Salvar
                                    </button>
                                )}
                            </div>
                        </h3>

                        <div className="flex flex-col gap-4 mt-6">
                            <label className="flex items-center text-sm cursor-pointer font-bold">
                                <input
                                    type="checkbox"
                                    className="mr-2"
                                    checked={localConfig.correlation_enabled ?? true}
                                    onChange={e => handleGlobalChange('correlation_enabled', e.target.checked)}
                                />
                                Shield Ativado
                            </label>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[10px] uppercase font-bold text-muted-foreground block mb-1">Max Threshold</label>
                                    <input
                                        type="number" step="0.01" min="0" max="1"
                                        className="w-full bg-background border border-border p-2 rounded text-sm disabled:opacity-50"
                                        value={localConfig.max_correlation_threshold ?? 0.85}
                                        onChange={e => handleGlobalChange('max_correlation_threshold', parseFloat(e.target.value))}
                                        disabled={!(localConfig.correlation_enabled ?? true)}
                                    />
                                </div>

                                <div>
                                    <label className="text-[10px] uppercase font-bold text-muted-foreground block mb-1">Periods (H1)</label>
                                    <input
                                        type="number" min="2" max="100"
                                        className="w-full bg-background border border-border p-2 rounded text-sm disabled:opacity-50"
                                        value={localConfig.correlation_periods ?? 24}
                                        onChange={e => handleGlobalChange('correlation_periods', parseInt(e.target.value))}
                                        disabled={!(localConfig.correlation_enabled ?? true)}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Anti Cloner View */}
            <div className="px-4 pb-4">
                <CorrelationHeatmap />
            </div>
        </div>
    );
};
