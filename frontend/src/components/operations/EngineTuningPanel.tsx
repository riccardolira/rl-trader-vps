import React, { useState, useEffect } from 'react';
import { Save, Layers, GitBranch, Clock, TrendingUp, BookOpen } from 'lucide-react';
import { api } from '../../services/api';

const Section: React.FC<{ title: string; icon: React.ReactNode; children: React.ReactNode; accent?: string }> = ({
    title, icon, children, accent = 'primary'
}) => (
    <div className={`rounded-2xl border border-border/50 bg-card/80 p-6 shadow-sm backdrop-blur-md`}>
        <div className={`flex items-center gap-3 mb-6 text-${accent}`}>
            <div className={`p-2.5 bg-${accent}/10 rounded-xl`}>{icon}</div>
            <h3 className="font-semibold text-lg tracking-tight">{title}</h3>
        </div>
        <div className="space-y-5">{children}</div>
    </div>
);

const Field: React.FC<{
    label: string;
    hint?: string;
    type?: 'number' | 'toggle';
    value: number | boolean;
    step?: number;
    onChange: (v: number | boolean) => void;
    unit?: string;
    disabled?: boolean;
}> = ({ label, hint, type = 'number', value, step = 1, onChange, unit, disabled }) => {
    if (type === 'toggle') {
        return (
            <label className="flex items-center justify-between p-4 bg-muted/20 rounded-xl border border-border/50 cursor-pointer hover:bg-muted/40 transition-all group">
                <div>
                    <div className="text-sm font-bold text-foreground/90">{label}</div>
                    {hint && <div className="text-[11px] text-muted-foreground/60 mt-0.5">{hint}</div>}
                </div>
                <input
                    type="checkbox"
                    checked={value as boolean}
                    onChange={(e) => onChange(e.target.checked)}
                    disabled={disabled}
                    className="w-5 h-5 accent-primary cursor-pointer"
                />
            </label>
        );
    }
    return (
        <div className="group">
            <label className="text-[11px] font-bold text-muted-foreground/80 mb-2 block tracking-wider uppercase">{label}</label>
            <div className="flex items-center gap-3">
                <input
                    type="number"
                    step={step}
                    value={value as number}
                    onChange={(e) => onChange(parseFloat(e.target.value))}
                    disabled={disabled}
                    className="w-full bg-muted/30 border border-border/50 rounded-xl px-4 py-3 font-mono text-base focus:outline-none focus:border-primary/50 transition-colors disabled:opacity-40"
                />
                {unit && <span className="text-muted-foreground/50 font-bold text-sm whitespace-nowrap">{unit}</span>}
            </div>
            {hint && <p className="text-[10px] text-muted-foreground/50 mt-2">{hint}</p>}
        </div>
    );
};

export const EngineTuningPanel: React.FC = () => {
    const [config, setConfig] = useState<any>(null);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    useEffect(() => { fetchConfig(); }, []);

    const fetchConfig = async () => {
        const res = await api.get<any>('/api/engine/config').catch(() => null);
        if (res) setConfig(res);
    };

    const handleSave = async () => {
        if (!config) return;
        setSaving(true);
        await api.post('/api/engine/config', config);
        setSaving(false);
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
    };

    const set = (path: string, value: number | boolean) => {
        const keys = path.split('.');
        setConfig((prev: any) => {
            const next = { ...prev };
            let ref: any = next;
            for (let i = 0; i < keys.length - 1; i++) ref = ref[keys[i]] = { ...ref[keys[i]] };
            ref[keys[keys.length - 1]] = value;
            return next;
        });
    };

    if (!config) {
        return (
            <div className="p-8 text-center text-muted-foreground border border-dashed rounded-lg animate-pulse">
                Carregando configurações do motor...
            </div>
        );
    }

    return (
        <div className="space-y-6 pb-8">
            <header className="flex items-center justify-between py-2 border-b border-border/10">
                <div className="text-[11px] text-muted-foreground/60 leading-relaxed max-w-xl">
                    Parâmetros do motor de decisão. São salvos em <code className="bg-muted/40 px-1 rounded">engine_config.json</code> e aplicados no próximo ciclo de análise — <strong>sem restart</strong>.
                </div>
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-2 bg-primary text-primary-foreground px-5 py-2.5 rounded-lg font-bold text-[11px] uppercase tracking-wider hover:bg-primary/90 disabled:opacity-50 transition-all shadow-sm hover:shadow active:scale-95"
                >
                    <Save size={16} />
                    {saved ? '✓ Salvo!' : saving ? 'Salvando...' : 'Salvar Engine Config'}
                </button>
            </header>

            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">

                {/* MTF */}
                <Section title="MTF Confluency" icon={<Layers size={18} />}>
                    <Field label="Penalidade Contra" hint="Sinal oposto ao MTF — subtrai do score" step={1} value={config.mtf.contra_penalty} onChange={(v) => set('mtf.contra_penalty', v)} unit="pts" />
                    <Field label="Bônus Alinhado" hint="Sinal alinhado com o MTF — adiciona ao score" step={1} value={config.mtf.aligned_bonus} onChange={(v) => set('mtf.aligned_bonus', v)} unit="pts" />
                </Section>

                {/* Ensemble */}
                <Section title="Ensemble Score" icon={<GitBranch size={18} />}>
                    <Field label="Bônus Consenso Forte" hint="Mínimo de estratégias concordando → bônus" step={1} value={config.ensemble.strong_bonus} onChange={(v) => set('ensemble.strong_bonus', v)} unit="pts" />
                    <Field label="Penalidade Consenso Fraco" hint="Apenas 1 de 3+ concordando → penalidade (negativo)" step={1} value={config.ensemble.weak_penalty} onChange={(v) => set('ensemble.weak_penalty', v)} unit="pts" />
                    <Field label="Min. Candidatos (Voting)" hint="Mínimo de estratégias com score > 0 para ativar ensemble" step={1} value={config.ensemble.min_voting} onChange={(v) => set('ensemble.min_voting', v)} />
                    <Field label="Min. Concordando (Strong)" hint="Quantas devem concordar para ser 'consenso forte'" step={1} value={config.ensemble.min_agree_count} onChange={(v) => set('ensemble.min_agree_count', v)} />
                </Section>

                {/* Tie-break + Scan */}
                <Section title="Tie-Break & Scan" icon={<Clock size={18} />}>
                    <Field label="Delta Empate" hint="Diferença de score abaixo deste valor → aplica tie-break avançado" step={0.5} value={config.tie_break.delta_threshold} onChange={(v) => set('tie_break.delta_threshold', v)} unit="pts" />
                    <Field label="Intervalo de Scan" hint="Tempo entre ciclos de análise do StrategyEngine" step={10} value={config.scan.interval_sec} onChange={(v) => set('scan.interval_sec', v)} unit="s" />
                    <Field label="Delay por Símbolo" hint="Throttle entre análise de cada símbolo (evita flood MT5)" step={0.1} value={config.scan.symbol_delay_sec} onChange={(v) => set('scan.symbol_delay_sec', v)} unit="s" />
                </Section>

                {/* Kelly */}
                <Section title="Kelly Criterion" icon={<TrendingUp size={18} />} accent="primary">
                    <Field type="toggle" label="Kelly Ativo" hint="Desabilita → usa volume base fixo" value={config.kelly.enabled} onChange={(v) => set('kelly.enabled', v)} />
                    <Field label="Fração Half-Kelly" hint="0.5 = Half-Kelly conservador | 1.0 = Full Kelly" step={0.05} value={config.kelly.half_kelly_fraction} onChange={(v) => set('kelly.half_kelly_fraction', v)} disabled={!config.kelly.enabled} />
                    <Field label="Cap Máx Kelly" hint="Teto máximo de risco por trade calculado pelo Kelly (% equity)" step={0.5} value={config.kelly.max_kelly_pct} onChange={(v) => set('kelly.max_kelly_pct', v)} unit="%" disabled={!config.kelly.enabled} />
                    <Field label="Mín. Trades Para Ativar" hint="Kelly só é calculado a partir desse número de trades históricos" step={5} value={config.kelly.min_trades_to_activate} onChange={(v) => set('kelly.min_trades_to_activate', v)} disabled={!config.kelly.enabled} />
                    <Field label="Cache TTL" hint="Tempo de cache do cálculo por estratégia" step={30} value={config.kelly.cache_ttl_sec} onChange={(v) => set('kelly.cache_ttl_sec', v)} unit="s" disabled={!config.kelly.enabled} />
                </Section>

                {/* Walk-Forward */}
                <Section title="Walk-Forward Auto-Tuner" icon={<BookOpen size={18} />} accent="primary">
                    <Field type="toggle" label="Walk-Forward Ativo" hint="Ajuste automático dos pesos por Sharpe Ratio (1x/dia)" value={config.walk_forward.enabled} onChange={(v) => set('walk_forward.enabled', v)} />
                    <Field label="Sharpe Alto (bônus peso)" hint="Sharpe acima deste valor → aumenta weight_multiplier da estratégia" step={0.1} value={config.walk_forward.sharpe_high_threshold} onChange={(v) => set('walk_forward.sharpe_high_threshold', v)} disabled={!config.walk_forward.enabled} />
                    <Field label="Sharpe Baixo (penalidade)" hint="Sharpe abaixo deste valor → reduz weight_multiplier" step={0.1} value={config.walk_forward.sharpe_low_threshold} onChange={(v) => set('walk_forward.sharpe_low_threshold', v)} disabled={!config.walk_forward.enabled} />
                    <Field label="Aumento de Peso (%)" hint="% de aumento quando Sharpe alto" step={5} value={config.walk_forward.weight_increase_pct} onChange={(v) => set('walk_forward.weight_increase_pct', v)} unit="%" disabled={!config.walk_forward.enabled} />
                    <Field label="Redução de Peso (%)" hint="% de redução quando Sharpe baixo" step={5} value={config.walk_forward.weight_decrease_pct} onChange={(v) => set('walk_forward.weight_decrease_pct', v)} unit="%" disabled={!config.walk_forward.enabled} />
                    <Field label="Peso Mínimo" hint="Floor do weight_multiplier" step={0.1} value={config.walk_forward.weight_min} onChange={(v) => set('walk_forward.weight_min', v)} disabled={!config.walk_forward.enabled} />
                    <Field label="Peso Máximo" hint="Cap do weight_multiplier" step={0.1} value={config.walk_forward.weight_max} onChange={(v) => set('walk_forward.weight_max', v)} disabled={!config.walk_forward.enabled} />
                    <Field label="Mín. Trades por Estratégia" hint="Trades históricos necessários para ajustar o peso" step={5} value={config.walk_forward.min_trades_per_strategy} onChange={(v) => set('walk_forward.min_trades_per_strategy', v)} disabled={!config.walk_forward.enabled} />
                </Section>

            </div>
        </div>
    );
};
