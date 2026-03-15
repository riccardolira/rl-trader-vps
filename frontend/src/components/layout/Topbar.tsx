import React, { useEffect, useState, useCallback } from 'react';
import { Moon, Sun, Settings, OctagonAlert, Zap, Play, Radar, Cpu, BarChart3, ScrollText, TrendingUp, TrendingDown, AlertTriangle, Square } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { cn } from '../../lib/utils';
import { api } from '../../services/api';
import { Link, useLocation } from 'react-router-dom';
import type { UniverseConfig, EngineState } from '../../services/api';

interface TopbarProps {
    isManualOpen: boolean;
    setIsManualOpen: (open: boolean) => void;
    isSettingsOpen: boolean;
    setIsSettingsOpen: (open: boolean) => void;
    onMenuToggle: () => void;
}

interface SessionStats {
    daily_pnl: number;
    heat_pct: number;
    heat_usd: number;
}

const NAV_ITEMS = [
    { id: 'scanner',    path: '/scanner',    label: 'Scanner',    icon: Radar },
    { id: 'operations', path: '/operations', label: 'Operações',  icon: Cpu },
    { id: 'analytics',  path: '/analytics',  label: 'Analytics',  icon: BarChart3 },
    { id: 'logs',       path: '/logs',       label: 'Auditoria',  icon: ScrollText },
];

export const Topbar: React.FC<TopbarProps> = ({ isSettingsOpen, setIsSettingsOpen }) => {
    const { theme, setTheme } = useTheme();
    const location = useLocation();
    const activeRoute = location.pathname.split('/')[1] || 'scanner';

    const [mt5Config, setMt5Config] = useState<{ login: string; server: string } | null>(null);
    const [config, setConfig] = useState<UniverseConfig | null>(null);
    const [engineState, setEngineState] = useState<EngineState | null>(null);
    const [isTogglingScanner, setIsTogglingScanner] = useState(false);
    const [isTogglingEngine, setIsTogglingEngine] = useState(false);
    const [isPanicking, setIsPanicking] = useState(false);
    const [session, setSession] = useState<SessionStats>({ daily_pnl: 0, heat_pct: 0, heat_usd: 0 });

    // Fetch global status (engine, scanner)
    const fetchStatus = useCallback(async () => {
        const [configRes, stateRes] = await Promise.all([
            api.get<UniverseConfig>('/api/universe/config').catch(() => null),
            api.get<EngineState>('/api/state').catch(() => null),
        ]);
        if (configRes) setConfig(configRes);
        if (stateRes) setEngineState(stateRes);
    }, []);

    // Fetch session stats (P&L diário + Portfolio Heat)
    const fetchSession = useCallback(async () => {
        const [heatRes, analyticsRes] = await Promise.all([
            fetch('/api/analytics/portfolio-heat').then(r => r.ok ? r.json() : null).catch(() => null),
            fetch('/api/analytics/dashboard').then(r => r.ok ? r.json() : null).catch(() => null),
        ]);
        setSession({
            daily_pnl: analyticsRes?.metrics?.total_profit_today ?? 0,
            heat_pct: heatRes?.heat_pct ?? 0,
            heat_usd: heatRes?.heat_usd ?? 0,
        });
    }, []);

    useEffect(() => {
        fetch('/api/config/mt5').then(r => r.ok ? r.json() : null).then(d => {
            if (d?.login && d?.server) setMt5Config({ login: d.login.toString(), server: d.server });
        }).catch(() => {});
    }, [isSettingsOpen]);

    useEffect(() => {
        fetchStatus();
        fetchSession();
        const statusInterval = setInterval(fetchStatus, 5000);
        const sessionInterval = setInterval(fetchSession, 10000);
        return () => { clearInterval(statusInterval); clearInterval(sessionInterval); };
    }, [fetchStatus, fetchSession]);

    const toggleScanner = async () => {
        if (!config) return;
        setIsTogglingScanner(true);
        const endpoint = config.scanner_enabled ? '/api/universe/scanner/stop' : '/api/universe/scanner/start';
        try { await api.post(endpoint, {}); setConfig(prev => prev ? { ...prev, scanner_enabled: !config.scanner_enabled } : prev); }
        finally { setIsTogglingScanner(false); }
    };

    const toggleEngine = async () => {
        if (!engineState) return;
        setIsTogglingEngine(true);
        const endpoint = engineState.strategy_engine?.running ? '/api/engine/stop' : '/api/engine/start';
        try {
            await api.post(endpoint, {});
            const res = await api.get<EngineState>('/api/state').catch(() => null);
            if (res) setEngineState(res);
        } finally { setIsTogglingEngine(false); }
    };

    const triggerPanic = async () => {
        if (!window.confirm('⚠️ PANIC KILL — Fechar TODAS as posições abertas agora?')) return;
        setIsPanicking(true);
        try { await api.post('/api/engine/panic', {}); }
        finally { setTimeout(() => setIsPanicking(false), 3000); }
    };

    // Heat color
    const heatColor = session.heat_pct > 5 ? 'text-rose-500' : session.heat_pct > 3 ? 'text-amber-500' : 'text-emerald-500';
    const heatBg   = session.heat_pct > 5 ? 'bg-rose-500/10 border-rose-500/20' : session.heat_pct > 3 ? 'bg-amber-500/10 border-amber-500/20' : 'bg-emerald-500/10 border-emerald-500/20';

    const pnlPositive = session.daily_pnl >= 0;

    return (
        <header className="shrink-0 border-b border-border/50 bg-card/60 backdrop-blur-2xl z-20 shadow-[0_4px_24px_rgba(0,0,0,0.04)]">

            {/* ── Linha 1: Logo + Controles + Status ── */}
            <div className="h-14 flex items-center justify-between px-4 md:px-6 gap-4">

                {/* Logo */}
                <div className="flex items-center gap-2.5 shrink-0">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary/30 to-primary/10 border border-primary/20 flex items-center justify-center">
                        <span className="text-primary font-black text-sm tracking-tighter">RL</span>
                    </div>
                    <div className="hidden sm:flex flex-col">
                        <span className="font-bold text-foreground text-sm leading-tight">RL Trader</span>
                        <span className="text-[9px] text-muted-foreground uppercase tracking-wider font-semibold">Control Tower</span>
                    </div>
                </div>

                {/* ── Status chips: MT5 + P&L + Heat ── */}
                <div className="flex items-center gap-2 flex-1 justify-center overflow-x-auto hide-scrollbar">
                    {/* MT5 Chip */}
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-muted/20 border border-border/40 text-[11px] font-mono font-semibold text-foreground/70 shrink-0">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.7)] animate-pulse" />
                        {mt5Config ? `${mt5Config.login}` : 'MT5'}
                    </div>

                    {/* P&L Diário */}
                    <div className={cn(
                        "flex items-center gap-1 px-2.5 py-1 rounded-md border text-[11px] font-bold shrink-0",
                        pnlPositive ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
                    )}>
                        {pnlPositive ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                        {pnlPositive ? '+' : ''}{session.daily_pnl.toFixed(2)} hoje
                    </div>

                    {/* Portfolio Heat */}
                    {session.heat_pct > 0 && (
                        <div className={cn("flex items-center gap-1 px-2.5 py-1 rounded-md border text-[11px] font-bold shrink-0", heatBg, heatColor)}>
                            {session.heat_pct > 4 && <AlertTriangle size={11} />}
                            Heat {session.heat_pct.toFixed(1)}%
                        </div>
                    )}
                </div>

                {/* ── Controles: Scanner / Engine / Panic / Theme / Config ── */}
                <div className="flex items-center gap-1.5 shrink-0">
                    {/* Scanner Toggle */}
                    <button
                        onClick={toggleScanner}
                        disabled={isTogglingScanner || !config}
                        title={config?.scanner_enabled ? 'Stop Scanner' : 'Start Scanner'}
                        className={cn(
                            "hidden md:flex items-center gap-1 px-2.5 py-1.5 rounded-md border text-[10px] uppercase tracking-wider font-bold transition-all",
                            config?.scanner_enabled
                                ? "bg-rose-500/10 text-rose-400 border-rose-500/20 hover:bg-rose-500/20"
                                : "text-muted-foreground border-border/40 hover:bg-muted/50 hover:text-foreground"
                        )}
                    >
                        {config?.scanner_enabled ? <><Square size={10} fill="currentColor" /> Scanner</> : <><Play size={10} fill="currentColor" /> Scanner</>}
                    </button>

                    {/* Engine Toggle */}
                    <button
                        onClick={toggleEngine}
                        disabled={isTogglingEngine || !engineState}
                        title={engineState?.strategy_engine?.running ? 'Stop Engine' : 'Start Engine'}
                        className={cn(
                            "hidden md:flex items-center gap-1 px-2.5 py-1.5 rounded-md border text-[10px] uppercase tracking-wider font-bold transition-all",
                            engineState?.strategy_engine?.running
                                ? "bg-rose-500/10 text-rose-400 border-rose-500/20 hover:bg-rose-500/20"
                                : "text-muted-foreground border-border/40 hover:bg-muted/50 hover:text-foreground"
                        )}
                    >
                        <Zap size={11} className={engineState?.strategy_engine?.running ? 'animate-pulse' : ''} />
                        {isTogglingEngine ? '...' : 'Engine'}
                    </button>

                    {/* PANIC */}
                    <button
                        onClick={triggerPanic}
                        disabled={isPanicking}
                        className={cn(
                            "flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-[10px] uppercase tracking-wider font-black transition-all",
                            isPanicking
                                ? "bg-rose-900 text-rose-200 border-rose-700 cursor-not-allowed animate-pulse"
                                : "bg-rose-600 hover:bg-rose-500 text-white border-rose-500 shadow-[0_0_12px_rgba(225,29,72,0.35)] hover:shadow-[0_0_20px_rgba(225,29,72,0.6)] hover:-translate-y-px"
                        )}
                    >
                        <OctagonAlert size={11} />
                        {isPanicking ? 'Encerrando...' : 'Panic'}
                    </button>

                    <div className="h-6 w-px bg-border/40 mx-1" />

                    {/* Theme toggle */}
                    <button
                        onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                        className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
                        title="Alternar tema"
                    >
                        <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                        <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                    </button>

                    {/* Settings */}
                    <button
                        onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                        className={cn(
                            "w-8 h-8 flex items-center justify-center rounded-md transition-colors border",
                            isSettingsOpen ? 'bg-primary/10 text-primary border-primary/20' : 'border-transparent hover:bg-muted/50 text-muted-foreground hover:text-foreground'
                        )}
                        title="Configurações"
                    >
                        <Settings size={16} />
                    </button>
                </div>
            </div>

            {/* ── Linha 2: Tabs de navegação ── */}
            <nav className="flex items-end px-4 md:px-6 gap-1 border-t border-border/30">
                {NAV_ITEMS.map(({ id, path, label, icon: Icon }) => {
                    const isActive = activeRoute === id || (id === 'scanner' && activeRoute === '');
                    return (
                        <Link
                            key={id}
                            to={path}
                            className={cn(
                                "flex items-center gap-1.5 px-4 py-2.5 text-[12px] font-semibold transition-all duration-200 border-b-2 -mb-px whitespace-nowrap",
                                isActive
                                    ? "border-primary text-primary"
                                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                            )}
                        >
                            <Icon size={13} />
                            {label}
                        </Link>
                    );
                })}
            </nav>
        </header>
    );
};
