import React, { useState } from 'react';
import { Ban, Activity } from 'lucide-react';
import { api } from '../../services/api';
import type { UniverseConfig } from '../../services/api';
import { CorrelationHeatmap } from './CorrelationHeatmap';

interface ViewProps {
    config?: UniverseConfig | null;
    onConfigUpdate: () => void;
}

export const ScannerFiltersView: React.FC<ViewProps> = ({ config, onConfigUpdate }) => {
    const [newBlocked, setNewBlocked] = useState('');

    if (!config) return null;

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

                {/* Additional Info / Future Filters Room */}
                <div className="space-y-4 bg-card border border-border p-4 rounded-lg">
                    <h3 className="font-semibold text-lg flex items-center gap-2">
                        <Activity className="text-primary" size={20} />
                        Anti-Cloner Engine
                    </h3>
                    <p className="text-sm text-muted-foreground">
                        O Anti-Cloner impede que ativos com alta correlação ocupem vagas duplicadas no <i>Active Set</i>. Suas configurações e <i>Thresholds</i> podem ser ajustadas na aba <strong>Critérios (Global Rules)</strong>. Abaixo está a visão em tempo real das correlações (Heatmap).
                    </p>
                </div>
            </div>

            {/* Anti Cloner View */}
            <div className="px-4 pb-4">
                <CorrelationHeatmap />
            </div>
        </div>
    );
};
