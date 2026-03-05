import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { Activity, ShieldAlert, Cpu } from 'lucide-react';
import { cn } from '../../lib/utils';
import { wsClient } from '../../core/net/wsClient';

interface CorrelationData {
    symbols: string[];
    matrix: number[][];
}

export const CorrelationHeatmap: React.FC = () => {
    const [data, setData] = useState<CorrelationData | null>(null);
    const [loading, setLoading] = useState(true);

    const fetchCorrelation = async () => {
        try {
            const response = await api.get<CorrelationData>('/api/universe/correlation');
            if (response && response.symbols) {
                setData(response);
            }
        } catch (err) {
            console.error("Failed to fetch correlation matrix", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchCorrelation();

        // Listen to Scanner finishing a cycle to refresh the matrix
        const unsubscribe = wsClient.subscribeData((msg) => {
            if (msg.type === 'UNIVERSE_RANKING_COMPUTED') {
                fetchCorrelation();
            }
        });

        return () => {
            unsubscribe();
        };
    }, []);

    if (loading) {
        return <div className="p-8 text-center text-muted-foreground animate-pulse flex flex-col items-center justify-center h-64 border border-dashed rounded-lg"><Cpu className="mb-2 opacity-50" size={32} />Calculando Matriz de Distância (Numpy)...</div>;
    }

    if (!data || data.symbols.length < 2) {
        return (
            <div className="p-8 text-center border border-dashed border-border rounded-lg bg-card/50 flex flex-col items-center justify-center h-64">
                <ShieldAlert className="mb-4 opacity-50 text-muted-foreground" size={48} />
                <h3 className="text-lg font-bold text-muted-foreground">Matriz de Correlação Vazia</h3>
                <p className="text-sm text-muted-foreground mt-2 max-w-sm">
                    O Scanner precisa de pelo menos 2 ativos Elegíveis para calcular vetores espaciais e distância Euclidiana/Pearson.
                </p>
            </div>
        );
    }

    const { symbols, matrix } = data;

    // Helper to get color style based on Pearson (-1 to 1)
    const getColorForValue = (val: number) => {
        // Red for close to 1 (highly correlated, bad for diversification if same direction)
        // Green for close to -1 (inversely correlated, hedge)
        // Dark for 0 (no correlation)

        if (Math.abs(val) > 0.99) return 'bg-neutral-800 text-transparent'; // Self correlation diagonal usually 1.0

        // Map to roughly our tailwind scales. We'll use inline styles for dynamic HSL
        // 1.0 = Red (0 hue, 80% saturation, 40% lightness)
        // 0.0 = Gray/Dark (220 hue, 20% saturation, 15% lightness)
        // -1.0 = Green (150 hue, 80% saturation, 40% lightness)

        if (val >= 0) {
            // 0 to 1 -> Dark to Red
            const hue = 0; // Red
            const sat = 10 + (val * 70); // 10% to 80%
            const light = 15 + (val * 35); // 15% to 50%
            return `hsl(${hue}, ${sat}%, ${light}%)`;
        } else {
            // -1 to 0 -> Green to Dark
            const intensity = Math.abs(val);
            const hue = 150; // Green
            const sat = 10 + (intensity * 70);
            const light = 15 + (intensity * 35);
            return `hsl(${hue}, ${sat}%, ${light}%)`;
        }
    };

    return (
        <div className="space-y-4 animate-in fade-in h-full flex flex-col">
            <div className="flex justify-between items-center">
                <h3 className="text-sm font-bold flex items-center gap-2 text-primary">
                    <Activity size={16} />
                    Matriz de Correlação Global (Pearson)
                </h3>
                <div className="text-xs text-muted-foreground flex items-center gap-4 bg-muted/50 px-3 py-1.5 rounded-md border border-border">
                    <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-sm bg-rose-500/80"></span>
                        <span>Alta (+1.0)</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-sm bg-neutral-800"></span>
                        <span>Neutra (0.0)</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-sm bg-emerald-500/80"></span>
                        <span>Inversa (-1.0)</span>
                    </div>
                </div>
            </div>

            <div className="text-xs text-muted-foreground">
                Exibe as correlações matemáticas entre os Top 15 ativos selecionados. Valores superiores ao seu <b className="text-foreground">Threshold de Escudo</b> causam bloqueio sumário (<i>"Anti-Cloning Shield"</i>) dos ativos menos ranqueados para forçar uma topologia diversificada na montagem da Carteira (Arbiter).
            </div>

            <div className="flex-1 overflow-auto border border-border rounded-lg bg-card shadow-sm p-4 custom-scrollbar">
                <div className="inline-block min-w-full">
                    <table className="border-collapse text-xs text-center w-full">
                        <thead>
                            <tr>
                                <th className="p-2 sticky top-0 left-0 z-20 bg-card border-b border-border"></th>
                                {symbols.map((sym, i) => (
                                    <th key={i} className="p-2 sticky top-0 z-10 bg-card border-b border-r border-border min-w-[60px] max-w-[80px] truncate font-mono text-muted-foreground" title={sym}>
                                        {sym.replace('-T', '').replace('.US', '')}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {matrix.map((row, i) => (
                                <tr key={i}>
                                    <th className="p-2 sticky left-0 z-10 bg-card border-b border-r border-border font-mono text-muted-foreground text-left min-w-[80px] truncate" title={symbols[i]}>
                                        {symbols[i].replace('-T', '').replace('.US', '')}
                                    </th>
                                    {row.map((val, j) => {
                                        const isDiag = i === j;
                                        const bgColor = getColorForValue(val);
                                        // Text color contrast
                                        const isExtreme = Math.abs(val) > 0.6;

                                        return (
                                            <td
                                                key={j}
                                                className={cn(
                                                    "p-1 border-b border-r border-border/50 font-mono transition-colors hover:brightness-125",
                                                    isDiag ? "bg-neutral-900" : ""
                                                )}
                                                style={{ backgroundColor: !isDiag ? bgColor : undefined }}
                                                title={`${symbols[i]} vs ${symbols[j]}: ${val.toFixed(3)}`}
                                            >
                                                {!isDiag && (
                                                    <span className={cn(
                                                        "font-semibold drop-shadow-md",
                                                        isExtreme ? "text-white" : "text-white/70"
                                                    )}>
                                                        {val.toFixed(2)}
                                                    </span>
                                                )}
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};
