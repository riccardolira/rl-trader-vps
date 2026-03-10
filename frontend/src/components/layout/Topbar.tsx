import React, { useEffect, useState } from 'react';
import { Moon, Sun, Settings, Square, Zap, Menu } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

interface TopbarProps {
    isManualOpen: boolean;
    setIsManualOpen: (open: boolean) => void;
    isSettingsOpen: boolean;
    setIsSettingsOpen: (open: boolean) => void;
    onMenuToggle: () => void;
}

export const Topbar: React.FC<TopbarProps> = ({ isSettingsOpen, setIsSettingsOpen, onMenuToggle }) => {
    const { theme, setTheme } = useTheme();
    const [mt5Config, setMt5Config] = useState<{ login: string, server: string } | null>(null);

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

    return (
        <header className="h-16 border-b border-border/50 bg-card/40 backdrop-blur-2xl flex items-center justify-between px-4 md:px-6 z-10 shadow-[0_4px_24px_rgba(0,0,0,0.02)]">
            <div className="flex items-center gap-3 md:gap-5">
                {/* Mobile Hamburger Menu */}
                <button
                    onClick={onMenuToggle}
                    className="md:hidden p-2 rounded-lg hover:bg-muted/50 text-foreground transition-colors"
                    aria-label="Toggle menu"
                >
                    <Menu size={24} />
                </button>

                {/* Connection Status & Telemetry Button */}
                <button className="flex items-center gap-2.5 px-3 py-1.5 bg-muted/20 border border-border/50 hover:bg-muted/40 hover:border-border/80 transition-colors rounded-lg shadow-sm group">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 group-hover:bg-emerald-400 group-hover:shadow-[0_0_12px_rgba(16,185,129,0.7)] shadow-[0_0_10px_rgba(16,185,129,0.5)] transition-all"></span>
                    <span className="text-[11px] text-foreground/90 font-mono font-bold tracking-widest flex items-center gap-2">
                        {mt5Config ? `${mt5Config.login} • ${mt5Config.server}` : 'API ...'}
                        <Zap size={12} className="text-muted-foreground group-hover:text-primary transition-colors" />
                    </span>
                </button>
            </div>

            <div className="flex items-center gap-2">
                {/* PANIC BUTTON */}
                <button
                    onClick={() => {
                        // TODO: Implement Panic endpoint call
                        console.warn("PANIC TRIGGERED");
                    }}
                    className="flex items-center gap-1.5 px-4 py-1.5 mr-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white shadow-[0_0_15px_rgba(225,29,72,0.4)] hover:shadow-[0_0_20px_rgba(225,29,72,0.6)] border border-rose-500 text-[11px] uppercase tracking-wider font-bold transition-all duration-200 hover:-translate-y-px"
                    title="Stop all operations immediately"
                >
                    <Square size={12} fill="currentColor" /> Panic T-Kill
                </button>

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
