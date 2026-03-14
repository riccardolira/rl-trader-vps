import React, { useState, useEffect } from 'react';
import { Shield, TrendingUp, Wallet, Save } from 'lucide-react';
import { api } from '../../services/api';

export const RiskControlPanel: React.FC = () => {
    const [config, setConfig] = useState<any>(null);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetchConfig();
    }, []);

    const fetchConfig = async () => {
        const res = await api.get<any>('/api/risk/config').catch(() => null);
        if (res) setConfig(res);
    };

    const handleSave = async () => {
        if (!config) return;
        setSaving(true);
        await api.post('/api/risk/config', config);
        setSaving(false);
    };

    if (!config) {
        return <div className="p-8 text-center text-muted-foreground border border-dashed rounded-lg flex-1 flex flex-col items-center justify-center h-full animate-pulse">Carregando métricas de risco...</div>;
    }

    return (
        <div className="space-y-6 h-full flex flex-col pb-8">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 py-2 border-b border-border/10">
                <div className="flex gap-2 items-center ml-auto">
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="flex items-center gap-2 bg-primary text-primary-foreground px-5 py-2.5 rounded-lg font-bold text-[11px] uppercase tracking-wider hover:bg-primary/90 disabled:opacity-50 transition-all shadow-sm hover:shadow active:scale-95"
                    >
                        <Save size={16} />
                        {saving ? "Salvando..." : "Salvar Configurações"}
                    </button>
                </div>
            </header>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-2">

                {/* 1. Portfolio Risk */}
                <div className="rounded-2xl border border-border/50 bg-card/80 p-6 shadow-sm backdrop-blur-md">
                    <div className="flex items-center gap-3 mb-6 text-primary">
                        <div className="p-2.5 bg-primary/10 rounded-xl">
                            <Wallet className="h-5 w-5" />
                        </div>
                        <h3 className="font-semibold text-lg tracking-tight">Portfolio Risk</h3>
                    </div>

                    <div className="space-y-5">
                        <div className="group">
                            <label className="text-[11px] font-bold text-muted-foreground/80 mb-2 block tracking-wider uppercase">Hard Risk Cap (Money / Balance)</label>
                            <input
                                type="number"
                                step="0.5"
                                value={config.hard_risk_cap_money}
                                onChange={(e) => setConfig({ ...config, hard_risk_cap_money: parseFloat(e.target.value) })}
                                className="w-full bg-muted/30 border border-border/50 rounded-xl px-4 py-3 font-mono text-lg focus:outline-none focus:border-primary/50 transition-colors"
                            />
                            <p className="text-[10px] text-muted-foreground/50 mt-2">Maximum allowed loss per trade in account currency.</p>
                        </div>

                        <div className="group">
                            <label className="text-[11px] font-bold text-muted-foreground/80 mb-2 block tracking-wider uppercase">Max Daily Drawdown (%)</label>
                            <div className="flex items-center gap-3">
                                <input
                                    type="number"
                                    step="0.01"
                                    value={config.max_daily_dd_pct * 100}
                                    onChange={(e) => setConfig({ ...config, max_daily_dd_pct: parseFloat(e.target.value) / 100 })}
                                    className="w-full bg-muted/30 border border-border/50 rounded-xl px-4 py-3 font-mono text-lg focus:outline-none focus:border-primary/50 transition-colors"
                                />
                                <span className="text-muted-foreground/50 font-bold text-xl">%</span>
                            </div>
                            <p className="text-[10px] text-muted-foreground/50 mt-2">Halts new operations if DD exceeds this value globally.</p>
                        </div>

                        <div className="group">
                            <label className="text-[11px] font-bold text-orange-400/80 mb-2 block tracking-wider uppercase">🔥 Portfolio Heat Max (%)</label>
                            <div className="flex items-center gap-3">
                                <input
                                    type="number"
                                    step="0.5"
                                    min="1"
                                    max="30"
                                    value={config.portfolio_heat_max_pct ?? 6.0}
                                    onChange={(e) => setConfig({ ...config, portfolio_heat_max_pct: parseFloat(e.target.value) })}
                                    className="w-full bg-orange-500/5 border border-orange-500/30 rounded-xl px-4 py-3 font-mono text-lg text-orange-400 focus:outline-none focus:border-orange-500/60 transition-colors"
                                />
                                <span className="text-orange-400 font-bold text-xl">%</span>
                            </div>
                            <p className="text-[10px] text-muted-foreground/50 mt-2">Guardian rejeita novos trades se o risco total aberto (SL × volume × pt_val) ultrapassar este % do equity.</p>
                        </div>
                    </div>
                </div>

                {/* 2. Safety Gates */}
                <div className="rounded-2xl border border-border/50 bg-card/80 p-6 shadow-sm backdrop-blur-md">
                    <div className="flex items-center gap-3 mb-6 text-primary">
                        <div className="p-2.5 bg-primary/10 rounded-xl">
                            <Shield className="h-5 w-5" />
                        </div>
                        <h3 className="font-semibold text-lg tracking-tight">Safety Gates</h3>
                    </div>
                    <div className="space-y-4">
                        <label className="flex items-center justify-between p-4 bg-muted/20 rounded-xl border border-border/50 cursor-pointer hover:bg-muted/40 transition-all hover:border-primary/30 group">
                            <div>
                                <div className="text-sm font-bold text-foreground/90">News Filter Shield</div>
                                <div className="text-[11px] text-muted-foreground/70 mt-0.5">Block entries on high-impact events and bank holidays</div>
                            </div>
                            <input
                                type="checkbox"
                                checked={config.news_filter_active}
                                onChange={(e) => setConfig({ ...config, news_filter_active: e.target.checked })}
                                className="w-5 h-5 accent-primary cursor-pointer"
                            />
                        </label>

                        <label className="flex items-center justify-between p-4 bg-muted/20 rounded-xl border border-border/50 cursor-pointer hover:bg-muted/40 transition-all hover:border-primary/30 group">
                            <div>
                                <div className="text-sm font-bold text-foreground/90">Spread Guard</div>
                                <div className="text-[11px] text-muted-foreground/70 mt-0.5">Block entries when spread spikes above threshold</div>
                            </div>
                            <input
                                type="checkbox"
                                checked={config.spread_guard_active}
                                onChange={(e) => setConfig({ ...config, spread_guard_active: e.target.checked })}
                                className="w-5 h-5 accent-primary cursor-pointer"
                            />
                        </label>
                    </div>
                </div>

                {/* 3. Exposure Limits */}
                <div className="rounded-2xl border border-border/50 bg-card/80 p-6 shadow-sm backdrop-blur-md">
                    <div className="flex items-center gap-3 mb-6 text-primary">
                        <div className="p-2.5 bg-primary/10 rounded-xl">
                            <TrendingUp className="h-5 w-5" />
                        </div>
                        <h3 className="font-semibold text-lg tracking-tight">Exposure Limits</h3>
                    </div>
                    <div className="space-y-5">
                        <div>
                            <label className="text-[11px] font-bold text-muted-foreground/80 mb-2 block tracking-wider uppercase">Max Open Trades</label>
                            <input
                                type="number"
                                value={config.max_trades_open}
                                onChange={(e) => setConfig({ ...config, max_trades_open: parseInt(e.target.value) })}
                                className="w-full bg-muted/30 border border-border/50 rounded-xl px-4 py-3 font-mono text-lg focus:outline-none focus:border-primary/50 transition-colors"
                            />
                        </div>
                        <div>
                            <label className="text-[11px] font-bold text-muted-foreground/80 mb-2 block tracking-wider uppercase">Max Trades Por Ativo</label>
                            <input
                                type="number"
                                value={config.max_trades_per_asset || 1}
                                onChange={(e) => setConfig({ ...config, max_trades_per_asset: parseInt(e.target.value) })}
                                className="w-full bg-muted/30 border border-border/50 rounded-xl px-4 py-3 font-mono text-lg focus:outline-none focus:border-primary/50 transition-colors"
                            />
                        </div>
                        <div>
                            <label className="text-[11px] font-bold text-muted-foreground/80 mb-2 block tracking-wider uppercase">Max Lot Size (Fat Finger Protection)</label>
                            <input
                                type="number"
                                step="0.01"
                                value={config.max_lot_size}
                                onChange={(e) => setConfig({ ...config, max_lot_size: parseFloat(e.target.value) })}
                                className="w-full bg-muted/30 border border-border/50 rounded-xl px-4 py-3 font-mono text-lg focus:outline-none focus:border-primary/50 transition-colors"
                            />
                        </div>
                    </div>
                </div>

                {/* 4. Global Safety Locks (Guardian) */}
                <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-6 shadow-sm col-span-1 md:col-span-2 backdrop-blur-md">
                    <div className="flex items-center gap-3 mb-6 text-destructive">
                        <div className="p-2.5 bg-destructive/10 rounded-xl">
                            <Shield className="h-5 w-5" />
                        </div>
                        <h3 className="font-semibold text-lg tracking-tight">Travas Globais de Segurança (Guardian)</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="group">
                            <label className="text-[11px] font-bold text-muted-foreground/80 mb-2 block tracking-wider uppercase">Proteção de Spread Máximo (Pontos)</label>
                            <input
                                type="number"
                                value={config.global_max_spread_points || 0}
                                onChange={(e) => setConfig({ ...config, global_max_spread_points: parseInt(e.target.value) || 0 })}
                                className="w-full bg-background border border-border/50 rounded-xl px-4 py-3 font-mono text-lg focus:outline-none focus:border-primary/50 transition-colors"
                            />
                            <p className="text-[10px] text-muted-foreground/50 mt-2">Impede a execução se a distância entre Bid e Ask estiver predatória.</p>
                        </div>
                        <div className="group">
                            <label className="text-[11px] font-bold text-destructive/80 mb-2 block tracking-wider uppercase">Circuit Breaker Diário (Currency)</label>
                            <input
                                type="number"
                                step="10"
                                value={config.global_max_daily_loss_currency || 0}
                                onChange={(e) => setConfig({ ...config, global_max_daily_loss_currency: parseFloat(e.target.value) || 0 })}
                                className="w-full bg-background border border-destructive/30 rounded-xl px-4 py-3 font-mono text-lg text-rose-500 font-bold focus:outline-none focus:border-destructive/50 transition-colors"
                            />
                            <p className="text-[10px] text-muted-foreground/50 mt-2">Desativa o robô e zera posições se a perda atingir este valor.</p>
                        </div>
                    </div>
                </div>

                {/* 3.5. Asset Class Profiles */}
                {config.profiles && Object.keys(config.profiles).length > 0 && (
                    <div className="rounded-2xl border border-border/50 bg-card/80 p-6 shadow-sm col-span-1 md:col-span-2 backdrop-blur-md">
                        <div className="flex items-center gap-3 mb-6 text-primary">
                            <div className="p-2.5 bg-primary/10 rounded-xl">
                                <Shield className="h-5 w-5" />
                            </div>
                            <h3 className="font-semibold text-lg tracking-tight">Asset Class Profiles</h3>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                            {Object.entries(config.profiles).map(([className, profile]: [string, any]) => (
                                <div key={className} className={`p-5 rounded-2xl border flex flex-col gap-4 transition-all ${profile.active ? 'bg-primary/5 border-primary/20 shadow-sm' : 'bg-muted/10 border-border/30 border-dashed opacity-60 grayscale'}`}>
                                    <div className="flex justify-between items-center">
                                        <span className="font-bold text-lg tracking-tight text-foreground/90">{className}</span>
                                        <label className="flex items-center cursor-pointer gap-2.5 bg-background/50 px-3 py-1.5 rounded-lg border border-border/50 hover:bg-muted/50 transition-colors">
                                            <span className="text-[10px] font-bold text-muted-foreground tracking-wider uppercase">{profile.active ? 'ACTIVE' : 'BLOCKED'}</span>
                                            <input
                                                type="checkbox"
                                                checked={profile.active}
                                                onChange={(e) => {
                                                    const newProfiles = { ...config.profiles };
                                                    newProfiles[className] = { ...profile, active: e.target.checked };
                                                    setConfig({ ...config, profiles: newProfiles });
                                                }}
                                                className="w-4 h-4 accent-primary cursor-pointer"
                                            />
                                        </label>
                                    </div>

                                    <div className="space-y-4 mt-2">
                                        <div>
                                            <label className="text-[10px] font-bold text-muted-foreground/80 tracking-wider uppercase">Max Spread (Pts)</label>
                                            <input
                                                type="number"
                                                value={profile.spread_max_points}
                                                onChange={(e) => {
                                                    const newProfiles = { ...config.profiles };
                                                    newProfiles[className] = { ...profile, spread_max_points: parseInt(e.target.value) };
                                                    setConfig({ ...config, profiles: newProfiles });
                                                }}
                                                className="w-full bg-muted/30 border border-border/50 rounded-xl px-3 py-2 font-mono text-sm mt-1.5 focus:outline-none focus:border-primary/50 transition-colors"
                                                disabled={!profile.active}
                                            />
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="text-[10px] font-bold text-muted-foreground/80 tracking-wider uppercase">Max Risk/Trade</label>
                                                <div className="flex items-center gap-2 mt-1.5">
                                                    <input
                                                        type="number"
                                                        step="0.01"
                                                        value={profile.max_risk_per_trade_pct * 100}
                                                        onChange={(e) => {
                                                            const newProfiles = { ...config.profiles };
                                                            newProfiles[className] = { ...profile, max_risk_per_trade_pct: parseFloat(e.target.value) / 100 };
                                                            setConfig({ ...config, profiles: newProfiles });
                                                        }}
                                                        className="w-full bg-muted/30 border border-border/50 rounded-xl px-3 py-2 font-mono text-sm focus:outline-none focus:border-primary/50 transition-colors"
                                                        disabled={!profile.active}
                                                    />
                                                    <span className="text-xs font-bold text-muted-foreground/50">%</span>
                                                </div>
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-bold text-muted-foreground/80 tracking-wider uppercase">Min Rank Score</label>
                                                <input
                                                    type="number"
                                                    step="0.5"
                                                    value={profile.min_score_to_trade}
                                                    onChange={(e) => {
                                                        const newProfiles = { ...config.profiles };
                                                        newProfiles[className] = { ...profile, min_score_to_trade: parseFloat(e.target.value) };
                                                        setConfig({ ...config, profiles: newProfiles });
                                                    }}
                                                    className="w-full bg-muted/30 border border-border/50 rounded-xl px-3 py-2 font-mono text-sm mt-1.5 focus:outline-none focus:border-primary/50 transition-colors"
                                                    disabled={!profile.active}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
