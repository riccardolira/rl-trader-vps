import React, { useState, useEffect } from 'react';
import { Save, HelpCircle, Loader2 } from 'lucide-react';
import { api } from '../../services/api';
import type { UniverseConfig, ClassWeights } from '../../services/api';

interface Props {
    config: UniverseConfig | null;
    onSaved: () => void;
}

const TooltipIcon = ({ text }: { text: string }) => (
    <div className="group relative inline-block ml-1">
        <HelpCircle size={14} className="text-muted-foreground hover:text-foreground cursor-help" />
        <div className="hidden group-hover:block absolute z-50 w-64 p-2 mt-1 text-xs bg-popover text-popover-foreground border border-border rounded shadow-lg pointer-events-none">
            {text}
        </div>
    </div>
);

export const CriteriaEditor: React.FC<Props> = ({ config, onSaved }) => {
    const [localConfig, setLocalConfig] = useState<UniverseConfig | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [isDirty, setIsDirty] = useState(false);

    useEffect(() => {
        if (config && (!localConfig || !isDirty)) {
            setLocalConfig(JSON.parse(JSON.stringify(config))); // Deep copy
            setIsDirty(false);
        }
    }, [config]);

    if (!localConfig) return <div className="p-4">Carregando configurações...</div>;

    const handleGlobalChange = (key: keyof UniverseConfig, value: any) => {
        setLocalConfig({ ...localConfig, [key]: value });
        setIsDirty(true);
    };

    const handleClassChange = (assetClass: string, key: keyof ClassWeights, value: number | string) => {
        setLocalConfig((prev) => {
            if (!prev) return prev;
            return {
                ...prev,
                weights: {
                    ...prev.weights,
                    [assetClass]: {
                        ...prev.weights[assetClass],
                        [key]: value
                    }
                }
            };
        });
        setIsDirty(true);
    };

    const saveChanges = async () => {
        setIsSaving(true);
        try {
            await api.post('/api/universe/config/update', localConfig);
            setIsDirty(false); // Reset dirty flag so it takes normal backend updates again
            onSaved();
        } catch (e) {
            console.error("Falha ao salvar", e);
        } finally {
            setIsSaving(false);
        }
    };

    const resetChanges = () => {
        if (config) {
            setLocalConfig(JSON.parse(JSON.stringify(config)));
            setIsDirty(false);
        }
    };

    return (
        <div className="space-y-8 animate-in fade-in">
            {/* Globals */}
            <section>
                <h3 className="text-lg font-bold mb-4 flex items-center justify-between">
                    Global Rules (Hysteresis & Setup)
                    <div className="flex items-center gap-2">
                        {isDirty && (
                            <button
                                onClick={resetChanges}
                                disabled={isSaving}
                                className="px-4 py-2 text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-md text-sm font-medium transition-colors disabled:opacity-50"
                            >
                                Cancelar
                            </button>
                        )}
                        <button
                            onClick={saveChanges}
                            disabled={isSaving || !isDirty}
                            className={`flex items-center gap-2 px-4 py-2 rounded-md font-bold text-sm transition-colors ${isDirty ? 'bg-primary text-primary-foreground hover:bg-primary/90' : 'bg-muted text-muted-foreground cursor-not-allowed'}`}
                        >
                            {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                            Salvar Alterações
                        </button>
                    </div>
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div className="bg-card border border-border p-4 rounded-lg">
                        <label className="text-sm font-bold flex items-center">
                            Min Active Set Size
                            <TooltipIcon text="Menos que isso, o Gate fecha (Trade Suspenso) por falta de ativos elegíveis suficientes." />
                        </label>
                        <input
                            type="number" min="1" max="10"
                            className="w-full mt-2 bg-background border border-border p-2 rounded text-sm"
                            value={localConfig.min_active_set_size}
                            onChange={e => handleGlobalChange('min_active_set_size', parseInt(e.target.value))}
                        />
                    </div>
                    <div className="bg-card border border-border p-4 rounded-lg">
                        <label className="text-sm font-bold flex items-center">
                            Max Active Set Size (Cap)
                            <TooltipIcon text="Número máximo de ativos operáveis ao mesmo tempo. Máximo suportado = 10." />
                        </label>
                        <input
                            type="number" min="1" max="10"
                            className="w-full mt-2 bg-background border border-border p-2 rounded text-sm"
                            value={localConfig.max_active_set_size}
                            onChange={e => handleGlobalChange('max_active_set_size', Math.min(10, parseInt(e.target.value)))}
                        />
                    </div>
                    <div className="bg-card border border-border p-4 rounded-lg">
                        <label className="text-sm font-bold flex items-center">
                            Rebuild Interval (segundos)
                            <TooltipIcon text="No modo AUTO, o ranking recria o Active Set a cada X segundos (Padrão 900s = 15min)." />
                        </label>
                        <input
                            type="number" min="60"
                            className="w-full mt-2 bg-background border border-border p-2 rounded text-sm"
                            value={localConfig.rebuild_interval_sec}
                            onChange={e => handleGlobalChange('rebuild_interval_sec', parseInt(e.target.value))}
                        />
                    </div>
                    <div className="bg-card border border-border p-4 rounded-lg">
                        <label className="text-sm font-bold flex items-center">
                            Swap Delta Score
                            <TooltipIcon text="Anti 'Pisca-Pisca': Um ativo de fora só toma a vaga de quem já está no Set se superar a nota dele por essa margem (ex: +5.0 pontos)." />
                        </label>
                        <input
                            type="number" step="0.1"
                            className="w-full mt-2 bg-background border border-border p-2 rounded text-sm"
                            value={localConfig.swap_delta_score}
                            onChange={e => handleGlobalChange('swap_delta_score', parseFloat(e.target.value))}
                        />
                    </div>
                    <div className="bg-card border border-border p-4 rounded-lg">
                        <label className="text-sm font-bold flex items-center">
                            Hold Buffer Slots
                            <TooltipIcon text="Folga de ranking que um ativo do Set tem antes de ser considerado substituível (Ex: set=5, buffer=2, ele cai até o rank 7 sem perder a vaga)." />
                        </label>
                        <input
                            type="number" min="0" max="5"
                            className="w-full mt-2 bg-background border border-border p-2 rounded text-sm"
                            value={localConfig.hold_buffer}
                            onChange={e => handleGlobalChange('hold_buffer', parseInt(e.target.value))}
                        />
                    </div>
                    <div className="bg-card border border-border p-4 rounded-lg">
                        <label className="text-sm font-bold flex items-center mb-2">
                            Anti-Correlation Shield
                            <TooltipIcon text="Impede a seleção de ativos altamente correlacionados (positiva ou negativamente) para diversificar o risco." />
                        </label>
                        <div className="flex flex-col gap-3">
                            <label className="flex items-center text-sm cursor-pointer">
                                <input
                                    type="checkbox"
                                    className="mr-2"
                                    checked={localConfig.correlation_enabled ?? true}
                                    onChange={e => handleGlobalChange('correlation_enabled', e.target.checked)}
                                />
                                Shield Ativado
                            </label>

                            <div>
                                <label className="text-[10px] uppercase font-bold text-muted-foreground block mb-1">Max Threshold</label>
                                <input
                                    type="number" step="0.01" min="0" max="1"
                                    className="w-full bg-background border border-border p-1.5 rounded text-sm disabled:opacity-50"
                                    value={localConfig.max_correlation_threshold ?? 0.85}
                                    onChange={e => handleGlobalChange('max_correlation_threshold', parseFloat(e.target.value))}
                                    disabled={!(localConfig.correlation_enabled ?? true)}
                                />
                            </div>

                            <div>
                                <label className="text-[10px] uppercase font-bold text-muted-foreground block mb-1">Periods (H1)</label>
                                <input
                                    type="number" min="2" max="100"
                                    className="w-full bg-background border border-border p-1.5 rounded text-sm disabled:opacity-50"
                                    value={localConfig.correlation_periods ?? 24}
                                    onChange={e => handleGlobalChange('correlation_periods', parseInt(e.target.value))}
                                    disabled={!(localConfig.correlation_enabled ?? true)}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Class Weights */}
            <section>
                <h3 className="text-lg font-bold mb-4">Class Score Multipliers & Thresholds</h3>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {['FOREX', 'METALS', 'CRYPTO', 'INDICES_NY', 'INDICES_B3', 'INDICES_EU', 'STOCKS_US', 'STOCKS_BR', 'STOCKS_EU', 'COMMODITIES_AGRI', 'COMMODITIES_ENERGY'].map(cls => {
                        const w = localConfig.weights[cls] || {
                            w_liquidity: 1, w_volatility: 1, w_cost: 1, w_stability: 1, max_spread_atr_ratio: 0.1
                        };

                        return (
                            <div key={cls} className="bg-card border border-border p-4 rounded-lg flex flex-col gap-4">
                                <div className="flex items-center justify-between border-b border-border pb-2">
                                    <h4 className="font-mono text-sm font-bold text-primary">{cls}</h4>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-xs font-bold text-muted-foreground flex items-center">
                                            Max Spread/ATR
                                            <TooltipIcon text="Filtro Duplo Cego. Se Spread for maior que X% do ATR, o ativo é desclassificado (HARD REJECT)." />
                                        </label>
                                        <input
                                            type="number" step="0.01"
                                            className="w-full mt-1 bg-background border border-border p-1.5 rounded text-sm"
                                            value={w.max_spread_atr_ratio}
                                            onChange={e => handleClassChange(cls, 'max_spread_atr_ratio', parseFloat(e.target.value))}
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-muted-foreground flex items-center">
                                            Liquidity Weight
                                            <TooltipIcon text="Peso dado ao volume/fluidez do spread na nota final." />
                                        </label>
                                        <input
                                            type="number" step="0.1" min="0" max="10"
                                            className="w-full mt-1 bg-background border border-border p-1.5 rounded text-sm"
                                            value={w.w_liquidity}
                                            onChange={e => handleClassChange(cls, 'w_liquidity', parseFloat(e.target.value))}
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-muted-foreground flex items-center">
                                            Volatility Weight
                                            <TooltipIcon text="Peso dado a movimentos grandes e ranges amplos via ADX." />
                                        </label>
                                        <input
                                            type="number" step="0.1" min="0" max="10"
                                            className="w-full mt-1 bg-background border border-border p-1.5 rounded text-sm"
                                            value={w.w_volatility}
                                            onChange={e => handleClassChange(cls, 'w_volatility', parseFloat(e.target.value))}
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-muted-foreground flex items-center">
                                            Cost Weight
                                            <TooltipIcon text="Peso negativo (penalidade) por spreads altos. Quanto maior a nota baseada na eficiência, melhor." />
                                        </label>
                                        <input
                                            type="number" step="0.1" min="0" max="10"
                                            className="w-full mt-1 bg-background border border-border p-1.5 rounded text-sm"
                                            value={w.w_cost}
                                            onChange={e => handleClassChange(cls, 'w_cost', parseFloat(e.target.value))}
                                        />
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            </section>
        </div>
    );
};
