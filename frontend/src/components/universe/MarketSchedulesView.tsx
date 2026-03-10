import React, { useState, useEffect } from 'react';
import { Clock, Save, Loader2, Activity } from 'lucide-react';
import { api } from '../../services/api';
import type { UniverseConfig, ScheduleConfig } from '../../services/api';

interface ViewProps {
    config?: UniverseConfig | null;
    onConfigUpdate: () => void;
}

export const MarketSchedulesView: React.FC<ViewProps> = ({ config, onConfigUpdate }) => {
    const [localSchedules, setLocalSchedules] = useState<Record<string, ScheduleConfig> | null>(null);
    const [isSavingSched, setIsSavingSched] = useState(false);
    const [isSchedDirty, setIsSchedDirty] = useState(false);
    const [now, setNow] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => setNow(new Date()), 10000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        if (config?.schedules && !isSchedDirty) {
            setLocalSchedules(JSON.parse(JSON.stringify(config.schedules)));
        }
    }, [config]);

    if (!config) return null;

    const handleScheduleChange = (region: string, key: keyof ScheduleConfig, value: string) => {
        setLocalSchedules(prev => {
            if (!prev) return prev;
            return { ...prev, [region]: { ...prev[region], [key]: value } };
        });
        setIsSchedDirty(true);
    };

    const saveSchedules = async () => {
        if (!config || !localSchedules) return;
        setIsSavingSched(true);
        try {
            const updatedConfig = { ...config, schedules: localSchedules };
            await api.post('/api/universe/config/update', updatedConfig);
            setIsSchedDirty(false);
            onConfigUpdate();
        } catch (e) {
            console.error("Failed to save schedules", e);
        } finally {
            setIsSavingSched(false);
        }
    };

    const getRegionTimes = (region: string, sched: ScheduleConfig) => {
        let start = sched.time_start;
        let end = sched.time_end;
        if (sched.time_mode === 'AUTO') {
            if (region === 'FOREX' || region === 'METALS') { start = '01:00'; end = '21:00'; }
            else if (region === 'INDICES_NY') { start = '13:30'; end = '20:00'; }
            else if (region === 'INDICES_B3') { start = '12:00'; end = '21:00'; }
            else if (region === 'INDICES_EU') { start = '07:00'; end = '16:30'; }
            else if (region === 'CRYPTO') { start = '00:00'; end = '23:59'; }
            else if (region === 'COMMODITIES_ENERGY') { start = '01:00'; end = '22:59'; }
            else if (region === 'COMMODITIES_AGRI') { start = '13:30'; end = '18:20'; }
            else if (region === 'STOCKS_US') { start = '13:30'; end = '20:00'; }
            else if (region === 'STOCKS_BR') { start = '12:00'; end = '21:00'; }
            else if (region === 'STOCKS_EU') { start = '07:00'; end = '16:30'; }
        }
        return { start, end };
    };

    const isMarketOpen = (utcStart: string, utcEnd: string, nowUtc: Date) => {
        if (!utcStart || !utcEnd) return false;
        if (utcStart === utcEnd) return true;

        const nowMinutes = nowUtc.getUTCHours() * 60 + nowUtc.getUTCMinutes();
        const startParts = utcStart.split(':').map(Number);
        const endParts = utcEnd.split(':').map(Number);
        const startMinutes = startParts[0] * 60 + startParts[1];
        const endMinutes = endParts[0] * 60 + endParts[1];

        if (startMinutes < endMinutes) {
            return nowMinutes >= startMinutes && nowMinutes <= endMinutes;
        } else {
            // Overlaps midnight
            return nowMinutes >= startMinutes || nowMinutes <= endMinutes;
        }
    };

    const toLocalTimeStr = (utcHHMM: string) => {
        if (!utcHHMM || !utcHHMM.includes(':')) return utcHHMM;
        try {
            const [hh, mm] = utcHHMM.split(":");
            const d = new Date();
            d.setUTCHours(parseInt(hh, 10));
            d.setUTCMinutes(parseInt(mm, 10));
            d.setUTCSeconds(0);
            return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } catch {
            return utcHHMM;
        }
    };

    return (
        <div className="space-y-8 p-1">
            {/* Live Schedule Status Panel */}
            <div className="space-y-4 pt-4 border-t border-border/50">
                <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-lg flex items-center gap-2">
                        <Activity className="text-blue-500" size={20} />
                        Status das Classes (Aberto/Fechado)
                    </h3>
                    <div className="text-sm font-mono text-muted-foreground bg-muted/50 px-3 py-1 rounded-md border border-border/50">
                        ⌚ {now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} (Local) | {now.toISOString().substring(11, 16)} (UTC)
                    </div>
                </div>

                <div className="bg-card border border-border rounded-lg overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="text-xs text-muted-foreground bg-muted/30 border-b border-border">
                                <tr>
                                    <th className="px-4 py-3 font-semibold">Região / Classe</th>
                                    <th className="px-4 py-3 font-semibold">Status</th>
                                    <th className="px-4 py-3 font-semibold">Abre (Local)</th>
                                    <th className="px-4 py-3 font-semibold">Fecha (Local)</th>
                                    <th className="px-4 py-3 font-semibold">Modo</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {localSchedules && Object.entries(localSchedules).map(([region, sched]) => {
                                    const { start, end } = getRegionTimes(region, sched);
                                    const isOpen = isMarketOpen(start, end, now);

                                    // Also check if the class is disabled globally
                                    // E.g. INDICES_NY maps to INDICES, STOCKS_US maps to STOCKS_US
                                    // It's just visual, so we won't grey out entirely, but it's good to indicate.

                                    return (
                                        <tr key={region} className="hover:bg-muted/10 transition-colors">
                                            <td className="px-4 py-3 font-mono font-bold text-foreground">
                                                {region.replace('_', ' ')}
                                            </td>
                                            <td className="px-4 py-3">
                                                {isOpen ? (
                                                    <span className="flex items-center gap-1.5 text-green-500 font-bold text-xs bg-green-500/10 px-2.5 py-1 rounded-full w-fit">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                                                        ABERTO
                                                    </span>
                                                ) : (
                                                    <span className="flex items-center gap-1.5 text-neutral-500 font-bold text-xs bg-neutral-500/10 px-2.5 py-1 rounded-full w-fit">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-neutral-500" />
                                                        FECHADO
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 font-mono">
                                                <div className="flex flex-col">
                                                    <span className="text-foreground">{toLocalTimeStr(start)}</span>
                                                    <span className="text-[10px] text-muted-foreground">{start} UTC</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 font-mono">
                                                <div className="flex flex-col">
                                                    <span className="text-foreground">{toLocalTimeStr(end)}</span>
                                                    <span className="text-[10px] text-muted-foreground">{end} UTC</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${sched.time_mode === 'AUTO' ? 'bg-primary/20 text-primary' : 'bg-orange-500/20 text-orange-500'}`}>
                                                    {sched.time_mode}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Trading Hours & Regions Edit Config */}
            <div className="space-y-4 pt-4 border-t border-border/50">
                <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-lg flex items-center gap-2">
                        <Clock className="text-primary" size={20} />
                        Editar Horários (UTC)
                    </h3>
                    <div className="flex items-center gap-2">
                        {isSchedDirty && (
                            <button
                                type="button"
                                onClick={() => { setLocalSchedules(JSON.parse(JSON.stringify(config.schedules))); setIsSchedDirty(false); }}
                                disabled={isSavingSched}
                                className="px-4 py-2 text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-md text-sm font-medium transition-colors disabled:opacity-50"
                            >
                                Cancelar
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={saveSchedules}
                            disabled={isSavingSched || !isSchedDirty}
                            className={`flex items-center gap-2 px-4 py-2 rounded-md font-bold text-sm transition-colors ${isSchedDirty ? 'bg-primary text-primary-foreground hover:bg-primary/90' : 'bg-muted text-muted-foreground cursor-not-allowed'}`}
                        >
                            {isSavingSched ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                            Salvar Horários
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {localSchedules && Object.entries(localSchedules).map(([region, sched]) => {
                        const { start: displayStart, end: displayEnd } = getRegionTimes(region, sched);

                        return (
                            <div key={region} className="bg-card border border-border p-4 rounded-lg flex flex-col gap-4">
                                <div className="flex items-center justify-between border-b border-border pb-2">
                                    <div>
                                        <h4 className="font-mono text-sm font-bold text-primary">{region.replace('_', ' ')}</h4>
                                        <span className="text-[10px] text-muted-foreground">{sched.timezone || 'UTC'}</span>
                                    </div>

                                    <div className="flex flex-col items-end gap-2">
                                        <div className="flex items-center bg-muted/50 rounded-lg p-1 border border-border/50">
                                            <button
                                                type="button"
                                                onClick={() => handleScheduleChange(region, 'time_mode', 'AUTO')}
                                                className={`px-2 py-0.5 text-[10px] font-bold rounded shadow-sm transition-all ${sched.time_mode === 'AUTO' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                                            >
                                                AUTO
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleScheduleChange(region, 'time_mode', 'MANUAL')}
                                                className={`px-2 py-0.5 text-[10px] font-bold rounded shadow-sm transition-all ${sched.time_mode === 'MANUAL' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                                            >
                                                MANUAL
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex gap-4 p-2 bg-background/50 rounded-md border border-border/40">
                                    <div className="flex-1">
                                        <label className="text-[10px] uppercase font-bold text-muted-foreground block mb-1">Início (UTC)</label>
                                        <input
                                            type="time"
                                            disabled={sched.time_mode === 'AUTO'}
                                            value={displayStart}
                                            onChange={e => handleScheduleChange(region, 'time_start', e.target.value)}
                                            className="w-full bg-background border border-border p-1 rounded text-xs disabled:opacity-50"
                                        />
                                    </div>
                                    <div className="flex-1">
                                        <label className="text-[10px] uppercase font-bold text-muted-foreground block mb-1">Fim (UTC)</label>
                                        <input
                                            type="time"
                                            disabled={sched.time_mode === 'AUTO'}
                                            value={displayEnd}
                                            onChange={e => handleScheduleChange(region, 'time_end', e.target.value)}
                                            className="w-full bg-background border border-border p-1 rounded text-xs disabled:opacity-50"
                                        />
                                    </div>
                                </div>

                                {/* Weekend Toggle */}
                                <div className="flex items-center justify-between p-2 bg-background/50 rounded-md border border-border/40">
                                    <span className="text-xs font-semibold text-muted-foreground">Operar Fim de Semana</span>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            // Toggle logic: If currently has 7 days, set to 5 days, else 7 days
                                            const hasWeekends = (sched.trading_days?.length || 5) === 7;
                                            const newDays = hasWeekends ? [0, 1, 2, 3, 4] : [0, 1, 2, 3, 4, 5, 6];
                                            handleScheduleChange(region, 'trading_days' as any, newDays as any);
                                        }}
                                        className={`w-9 h-5 rounded-full transition-colors relative ${(sched.trading_days?.length || 5) === 7 ? 'bg-primary' : 'bg-slate-300 dark:bg-slate-700'}`}
                                    >
                                        <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${(sched.trading_days?.length || 5) === 7 ? 'translate-x-4' : ''}`} />
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

