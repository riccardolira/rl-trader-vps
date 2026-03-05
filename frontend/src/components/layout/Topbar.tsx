import React, { useEffect, useState } from 'react';
import { Moon, Sun, Bell, Settings, BookOpen, Play, Square, Zap } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { cn } from '../../lib/utils';
import { api } from '../../services/api';
import type { UniverseConfig, EngineState } from '../../services/api';

interface TopbarProps {
    isManualOpen: boolean;
    setIsManualOpen: (open: boolean) => void;
    isSettingsOpen: boolean;
    setIsSettingsOpen: (open: boolean) => void;
}

export const Topbar: React.FC<TopbarProps> = ({ isManualOpen, setIsManualOpen, isSettingsOpen, setIsSettingsOpen }) => {
    const { theme, setTheme } = useTheme();
    const [mt5Config, setMt5Config] = useState<{ login: string, server: string } | null>(null);
    const [accountInfo, setAccountInfo] = useState<{ balance: number, equity: number, profit: number } | null>(null);

    // Global controls state
    const [config, setConfig] = useState<UniverseConfig | null>(null);
    const [engineState, setEngineState] = useState<EngineState | null>(null);
    const [isTogglingScanner, setIsTogglingScanner] = useState(false);
    const [isTogglingEngine, setIsTogglingEngine] = useState(false);

    useEffect(() => {
        // Fetch config initially and when settings modal closes (to catch updates)
        if (!isSettingsOpen) {
            fetch('/api/config/mt5')
                .then(res => {
                    if (res.ok) return res.json();
                    throw new Error('Network response was not ok');
                })
                .then(data => {
                    if (data.login && data.server) {
                        setMt5Config({ login: data.login.toString(), server: data.server });
                    }
                })
                .catch(err => console.error("Failed to fetch MT5 config for topbar", err));
        }
    }, [isSettingsOpen]);

    useEffect(() => {
        const fetchAccountInfo = () => {
            fetch('/api/account')
                .then(res => {
                    if (res.ok) return res.json();
                })
                .then(data => {
                    if (data && !data.error) {
                        setAccountInfo({
                            balance: data.balance || 0,
                            equity: data.equity || 0,
                            profit: data.profit || 0
                        });
                    }
                })
                .catch(err => console.debug("Failed to fetch API account info", err));
        };

        fetchAccountInfo(); // initial fetch

        // Listen to Websocket for Live Updates
        const wsUrl = `ws://${window.location.hostname}:8001/ws`;
        const ws = new WebSocket(wsUrl);

        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data.type === 'LIVE_ACCOUNT_UPDATE' && data.payload) {
                    setAccountInfo({
                        balance: data.payload.balance || 0,
                        equity: data.payload.equity || 0,
                        profit: data.payload.profit || 0
                    });
                }
            } catch (e) {
                // Ignore parse errors
            }
        };

        return () => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.close();
            }
        };
    }, []);

    useEffect(() => {
        const fetchGlobalStatus = async () => {
            const configRes = await api.get<UniverseConfig>('/api/universe/config').catch(() => null);
            if (configRes) setConfig(configRes);
            const stateRes = await api.get<EngineState>('/api/state').catch(() => null);
            if (stateRes) setEngineState(stateRes);
        };
        fetchGlobalStatus();
        const interval = setInterval(fetchGlobalStatus, 5000);
        return () => clearInterval(interval);
    }, []);

    const toggleScanner = async () => {
        if (!config) return;
        setIsTogglingScanner(true);
        const endpoint = config.scanner_enabled ? '/api/universe/scanner/stop' : '/api/universe/scanner/start';
        try {
            await api.post(endpoint, {});
            setConfig(prev => prev ? { ...prev, scanner_enabled: !config.scanner_enabled } : prev);
        } finally {
            setIsTogglingScanner(false);
        }
    };

    const toggleEngine = async () => {
        if (!engineState) return;
        setIsTogglingEngine(true);
        const endpoint = engineState.strategy_engine?.running ? '/api/engine/stop' : '/api/engine/start';
        try {
            await api.post(endpoint, {});
            const res = await api.get<EngineState>('/api/state').catch(() => null);
            if (res) setEngineState(res);
        } finally {
            setIsTogglingEngine(false);
        }
    };

    return (
        <header className="h-16 border-b border-border/50 bg-card/40 backdrop-blur-2xl flex items-center justify-between px-6 z-10 shadow-[0_4px_24px_rgba(0,0,0,0.02)]">
            <div className="flex items-center gap-5">
                {/* Connection Status */}
                <div className="flex items-center gap-2.5 px-3 py-1.5 bg-muted/20 border border-border/50 rounded-lg shadow-sm">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.5)]"></span>
                    <span className="text-[11px] text-foreground/90 font-mono font-bold tracking-widest">
                        {mt5Config ? `${mt5Config.login} • ${mt5Config.server}` : '...'}
                    </span>
                </div>

                {/* Live Account Badges */}
                {accountInfo && (
                    <div className="hidden lg:flex items-center gap-4 px-4 py-1.5 border border-border/50 rounded-xl bg-card/30 backdrop-blur-md shadow-sm">
                        <div className="flex flex-col items-start leading-tight">
                            <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider mb-0.5">Balance</span>
                            <span className="font-mono text-sm text-foreground/90 font-medium">${accountInfo.balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                        <div className="h-6 w-px bg-border/50 mx-1" />
                        <div className="flex flex-col items-start leading-tight">
                            <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider mb-0.5">Equity</span>
                            <span className="font-mono text-sm text-foreground/90 font-medium">${accountInfo.equity.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                        <div className="h-6 w-px bg-border/50 mx-1" />
                        <div className="flex flex-col items-start leading-tight">
                            <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider mb-0.5">Open PnL</span>
                            <span className={cn(
                                "font-mono text-sm font-bold",
                                accountInfo.profit > 0 ? 'text-emerald-500' : accountInfo.profit < 0 ? 'text-rose-500' : 'text-muted-foreground'
                            )}>
                                {accountInfo.profit > 0 ? '+' : ''}{accountInfo.profit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                        </div>
                    </div>
                )}
            </div>

            <div className="flex items-center gap-2">
                <div className="flex items-center gap-2 mr-3">
                    {/* Scanner Toggle */}
                    <button
                        onClick={toggleScanner}
                        disabled={isTogglingScanner || !config}
                        className={cn(
                            "flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[11px] uppercase tracking-wider font-bold transition-all duration-200",
                            !config ? "border-transparent text-muted-foreground opacity-50 cursor-not-allowed"
                                : config.scanner_enabled
                                    ? "bg-rose-500/10 text-rose-500 border-rose-500/20 hover:bg-rose-500/20 hover:shadow-md"
                                    : "bg-surface text-muted-foreground border-border/50 hover:bg-muted/50 hover:text-foreground hover:border-border hover:-translate-y-px"
                        )}
                        title={config?.scanner_enabled ? "Stop Scanner" : "Start Scanner"}
                    >
                        {config?.scanner_enabled ? (
                            <><Square size={12} fill="currentColor" /> Stop Scanner</>
                        ) : (
                            <><Play size={12} fill="currentColor" /> Start Scanner</>
                        )}
                    </button>

                    {/* Engine Toggle */}
                    <button
                        onClick={toggleEngine}
                        disabled={isTogglingEngine || !engineState}
                        className={cn(
                            "flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[11px] uppercase tracking-wider font-bold transition-all duration-200",
                            !engineState ? "border-transparent text-muted-foreground opacity-50 cursor-not-allowed"
                                : engineState.strategy_engine?.running
                                    ? "bg-rose-500/10 text-rose-500 border-rose-500/20 hover:bg-rose-500/20 hover:shadow-md"
                                    : "bg-surface text-muted-foreground border-border/50 hover:bg-muted/50 hover:text-foreground hover:border-border hover:-translate-y-px"
                        )}
                        title={engineState?.strategy_engine?.running ? "Stop Engine" : "Start Engine"}
                    >
                        <Zap size={14} className={cn(engineState?.strategy_engine?.running ? "animate-pulse" : "")} />
                        {isTogglingEngine ? '...' : (engineState?.strategy_engine?.running ? 'Stop Engine' : 'Start Engine')}
                    </button>
                </div>

                <div className="h-7 w-px bg-border/50 mx-2" />

                <button
                    onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                    className="relative flex items-center justify-center w-9 h-9 rounded-lg hover:bg-muted/50 text-muted-foreground/80 hover:text-foreground transition-colors border border-transparent hover:border-border/50"
                    title="Toggle Theme"
                >
                    <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                    <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                    <span className="sr-only">Toggle theme</span>
                </button>

                <div className="h-7 w-px bg-border/50 mx-2" />

                <button
                    onClick={() => setIsManualOpen(!isManualOpen)}
                    className={`w-9 h-9 flex items-center justify-center rounded-lg transition-colors border ${isManualOpen ? 'bg-primary/10 text-primary border-primary/20 shadow-sm' : 'border-transparent hover:bg-muted/50 text-muted-foreground/80 hover:text-foreground hover:border-border/50'}`}
                    title="Manual de Instruções"
                >
                    <BookOpen size={18} />
                </button>

                <div className="h-7 w-px bg-border/50 mx-2" />

                <button className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-muted/50 text-muted-foreground/80 hover:text-foreground transition-colors border border-transparent hover:border-border/50">
                    <Bell size={18} />
                </button>
                <button
                    onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                    className={`w-9 h-9 flex items-center justify-center rounded-lg transition-colors border ${isSettingsOpen ? 'bg-primary/10 text-primary border-primary/20 shadow-sm' : 'border-transparent hover:bg-muted/50 text-muted-foreground/80 hover:text-foreground hover:border-border/50'}`}
                    title="Configurações"
                >
                    <Settings size={18} />
                </button>
            </div>
        </header>
    );
};
