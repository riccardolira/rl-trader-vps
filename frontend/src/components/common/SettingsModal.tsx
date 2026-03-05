import React, { useState, useEffect } from 'react';
import { X, Server, Key, User, Power, Loader2, Save } from 'lucide-react';

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
    const [login, setLogin] = useState('');
    const [password, setPassword] = useState('');
    const [server, setServer] = useState('');

    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [message, setMessage] = useState<{ text: string, type: 'success' | 'error' | 'info' } | null>(null);

    // Fetch current config on mount/open
    useEffect(() => {
        if (isOpen) {
            fetchConfig();
        } else {
            // Reset state on close
            setMessage(null);
            setPassword('');
        }
    }, [isOpen]);

    const fetchConfig = async () => {
        setIsLoading(true);
        setMessage(null);
        try {
            const response = await fetch('/api/config/mt5');
            if (response.ok) {
                const data = await response.json();
                setLogin(data.login?.toString() || '');
                setServer(data.server || '');
            } else {
                setMessage({ text: 'Falha ao carregar configurações atuais', type: 'error' });
            }
        } catch (error) {
            console.error('Error fetching config:', error);
            setMessage({ text: 'Erro de conexão com o servidor', type: 'error' });
        } finally {
            setIsLoading(false);
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        setMessage({ text: 'Salvando e reiniciando Engine...', type: 'info' });

        try {
            const response = await fetch('/api/config/mt5', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    login: login ? parseInt(login, 10) : undefined,
                    password: password || undefined,
                    server: server || undefined
                }),
            });

            if (response.ok) {
                setMessage({ text: 'Credenciais atualizadas com sucesso!', type: 'success' });
                // Optional: wait a moment before closing to show success message
                setTimeout(() => {
                    onClose();
                }, 2000);
            } else {
                const data = await response.json();
                setMessage({ text: data.detail || 'Erro ao salvar credenciais', type: 'error' });
            }
        } catch (error) {
            console.error('Error saving config:', error);
            setMessage({ text: 'Erro de conexão com o servidor', type: 'error' });
        } finally {
            setIsSaving(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="relative w-full max-w-md bg-card/90 backdrop-blur-3xl border border-border/50 shadow-[0_0_40px_rgba(0,0,0,0.1)] rounded-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-5 border-b border-border/50 bg-muted/20">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-primary/10 text-primary rounded-xl border border-primary/20">
                            <Server className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-foreground/90 tracking-tight">Configurações MT5</h2>
                            <p className="text-[11px] text-muted-foreground/80 uppercase tracking-widest font-semibold mt-0.5">Credenciais da Corretora</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-muted-foreground/70 hover:text-foreground hover:bg-muted/50 rounded-full transition-colors"
                        disabled={isSaving}
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center py-10 space-y-4">
                            <Loader2 className="w-8 h-8 text-primary animate-spin" />
                            <p className="text-sm text-muted-foreground">Carregando configurações...</p>
                        </div>
                    ) : (
                        <form onSubmit={handleSave} className="space-y-5">
                            <div className="space-y-1">
                                <label className="text-sm font-medium text-foreground flex items-center gap-2">
                                    <User className="w-4 h-4 text-muted-foreground" />
                                    Conta (Login)
                                </label>
                                <input
                                    type="number"
                                    value={login}
                                    onChange={(e) => setLogin(e.target.value)}
                                    placeholder="Ex: 8123456"
                                    className="w-full px-4 py-3 bg-muted/30 border border-border/50 rounded-xl focus:outline-none focus:border-primary/50 text-foreground transition-colors font-mono"
                                    required
                                    disabled={isSaving}
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs font-bold text-foreground/80 flex items-center gap-2 uppercase tracking-wide">
                                    <Key className="w-4 h-4 text-muted-foreground" />
                                    Senha
                                </label>
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    className="w-full px-4 py-3 bg-muted/30 border border-border/50 rounded-xl focus:outline-none focus:border-primary/50 text-foreground transition-colors font-mono tracking-widest"
                                    disabled={isSaving}
                                    autoComplete="new-password"
                                />
                                <p className="text-xs text-muted-foreground mt-1">
                                    Por segurança, não recuperamos a senha atual no navegador.
                                </p>
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs font-bold text-foreground/80 flex items-center gap-2 uppercase tracking-wide">
                                    <Server className="w-4 h-4 text-muted-foreground" />
                                    Servidor
                                </label>
                                <input
                                    type="text"
                                    value={server}
                                    onChange={(e) => setServer(e.target.value)}
                                    placeholder="Ex: XP-DEMO, Clear-PRD"
                                    className="w-full px-4 py-3 bg-muted/30 border border-border/50 rounded-xl focus:outline-none focus:border-primary/50 text-foreground transition-colors font-mono"
                                    required
                                    disabled={isSaving}
                                />
                            </div>

                            {message && (
                                <div className={`p-3 rounded-lg flex items-center gap-2 text-sm ${message.type === 'success' ? 'bg-green-500/10 text-green-500 border border-green-500/20' :
                                    message.type === 'error' ? 'bg-red-500/10 text-red-500 border border-red-500/20' :
                                        'bg-blue-500/10 text-blue-500 border border-blue-500/20'
                                    }`}>
                                    {isSaving && message.type === 'info' && <Loader2 className="w-4 h-4 animate-spin" />}
                                    {message.text}
                                </div>
                            )}

                            <div className="pt-4 flex gap-3">
                                <button
                                    type="button"
                                    className="w-full px-4 py-2 border border-border rounded-lg text-sm font-medium hover:bg-muted transition-colors text-foreground"
                                    onClick={onClose}
                                    disabled={isSaving}
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
                                    disabled={isSaving}
                                >
                                    {isSaving ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            Salvando...
                                        </>
                                    ) : (
                                        <>
                                            <Save className="w-4 h-4" />
                                            Salvar Conta
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    )}
                </div>

                {/* Warning Footer */}
                <div className="px-6 py-3 bg-red-500/5 border-t border-red-500/10 flex items-start gap-2">
                    <Power className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                    <p className="text-xs text-red-400">
                        Atenção: A mudança de conta força um desligamento e reinício imediato do Worker MT5. Operações ou processos em andamento serao interrompidos até a nova conexão se restabelecer.
                    </p>
                </div>
            </div>
        </div>
    );
};
