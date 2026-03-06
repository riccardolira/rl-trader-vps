import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Lock, ArrowRight, ShieldCheck, Activity, Terminal } from 'lucide-react';
import { cn } from '../lib/utils';

export const LoginPage: React.FC = () => {
    const { login } = useAuth();
    const [password, setPassword] = useState('');
    const [error, setError] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError(false);

        // Simulate a slight network delay for better UX feel
        setTimeout(() => {
            const success = login(password);
            if (!success) {
                setError(true);
                setPassword('');
            }
            setIsLoading(false);
        }, 600);
    };

    return (
        <div className="min-h-screen w-full bg-[#0a0f18] flex items-center justify-center relative overflow-hidden font-sans">
            {/* Background Effects */}
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/20 blur-[120px] rounded-full pointer-events-none" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-500/10 blur-[120px] rounded-full pointer-events-none" />

            <div className="absolute inset-0 bg-[url('/noise.png')] opacity-20 mix-blend-overlay pointer-events-none"></div>

            <div className="w-full max-w-md z-10 p-6">
                <div className="bg-[#121927]/80 backdrop-blur-2xl border border-white/10 p-10 rounded-3xl shadow-[0_0_60px_rgba(0,0,0,0.5)] flex flex-col items-center">

                    {/* Logo Section */}
                    <div className="mb-8 w-full flex flex-col items-center">
                        <div className="w-24 h-24 mb-6 relative flex items-center justify-center rounded-2xl bg-black/40 border border-white/5 shadow-inner overflow-hidden">
                            {/* We use Logo 2.png from the user's files */}
                            <img src="/images/logo-2.png" alt="RL Trader Logo" className="w-[85%] h-[85%] object-contain drop-shadow-[0_0_15px_rgba(255,255,255,0.2)]" />
                        </div>

                        <h1 className="text-3xl font-extrabold tracking-tight text-white mb-2 text-center">
                            RL Control Tower
                        </h1>
                        <p className="text-sm text-muted-foreground/80 text-center font-medium px-4">
                            Sistemas de Automação de Alta Frequência
                        </p>
                    </div>

                    {/* Form Section */}
                    <form onSubmit={handleSubmit} className="w-full space-y-6">
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-white/70 uppercase tracking-widest ml-1">
                                Master Password
                            </label>
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                    <Lock className={cn("w-5 h-5 transition-colors", error ? "text-rose-500" : "text-white/40 group-focus-within:text-primary")} />
                                </div>
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => {
                                        setPassword(e.target.value);
                                        if (error) setError(false);
                                    }}
                                    className={cn(
                                        "w-full bg-black/40 border rounded-xl py-4 pl-12 pr-4 text-white placeholder-white/30 focus:outline-none focus:ring-2 transition-all font-mono tracking-widest",
                                        error
                                            ? "border-rose-500/50 focus:ring-rose-500/20 text-rose-100"
                                            : "border-white/10 focus:border-primary/50 focus:ring-primary/20"
                                    )}
                                    placeholder="••••••••••••"
                                    disabled={isLoading}
                                    autoFocus
                                />
                            </div>
                            {error && (
                                <p className="text-xs text-rose-500 font-medium ml-1 animate-in fade-in slide-in-from-top-1">
                                    Acesso Negado. Credenciais incorretas.
                                </p>
                            )}
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading || !password}
                            className={cn(
                                "w-full flex items-center justify-center gap-3 bg-primary hover:bg-primary/90 text-primary-foreground py-4 rounded-xl font-bold transition-all shadow-lg hover:shadow-primary/25 disabled:opacity-50 disabled:cursor-not-allowed group relative overflow-hidden"
                            )}
                        >
                            <span className="relative z-10 flex items-center gap-2">
                                {isLoading ? "Autenticando..." : "Unlock Dashboard"}
                                {!isLoading && <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />}
                            </span>
                            {!isLoading && (
                                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
                            )}
                        </button>
                    </form>
                </div>

                {/* Footer Badges */}
                <div className="mt-8 flex items-center justify-center gap-6 text-white/30 text-[10px] uppercase tracking-widest font-bold">
                    <div className="flex items-center gap-1.5 opacity-60">
                        <Terminal className="w-3 h-3" />
                        <span>V4 Engine</span>
                    </div>
                    <div className="flex items-center gap-1.5 opacity-60">
                        <ShieldCheck className="w-3 h-3" />
                        <span>Encrypted</span>
                    </div>
                    <div className="flex items-center gap-1.5 opacity-60">
                        <Activity className="w-3 h-3" />
                        <span>Live Sync</span>
                    </div>
                </div>
            </div>
        </div>
    );
};
