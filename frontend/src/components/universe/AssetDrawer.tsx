import React from 'react';
import type { RankingRow } from '../../services/api';
import { X, Activity, Scale, Database } from 'lucide-react';

interface DrawerProps {
    asset: RankingRow;
    onClose: () => void;
}

export const AssetDrawer: React.FC<DrawerProps> = ({ asset, onClose }) => {
    if (!asset) return null;

    return (
        <div className="fixed inset-y-0 right-0 w-96 bg-background border-l border-border shadow-2xl transform transition-transform duration-300 z-50 flex flex-col">
            <div className="p-4 border-b border-border flex items-center justify-between bg-muted/20">
                <div>
                    <h2 className="text-xl font-bold font-mono">{asset.symbol}</h2>
                    <div className="flex gap-2 items-center mt-1">
                        <span className="text-xs text-muted-foreground uppercase">{asset.status}</span>
                        {asset.decision === 'selected' && <span className="px-1.5 py-0.5 rounded text-[10px] bg-primary/20 text-primary font-bold">IN ACTIVE SET</span>}
                    </div>
                </div>
                <button onClick={onClose} className="p-2 hover:bg-muted rounded-full">
                    <X size={20} />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-6">

                {/* Score Section */}
                <section>
                    <h3 className="text-sm font-bold text-muted-foreground uppercase mb-2 flex items-center gap-2">
                        <Activity size={14} /> Score Breakdown
                    </h3>
                    <div className="bg-card border border-border rounded-lg p-3 space-y-2">
                        <div className="flex justify-between">
                            <span className="text-sm">Total Score</span>
                            <span className="font-bold text-primary">{asset.score?.toFixed(1) ?? "—"}</span>
                        </div>
                        <div className="h-px bg-border/50" />
                        <div className="flex justify-between text-xs text-muted-foreground">
                            <span title="peso">Liquidity (w: {asset.weights_used?.liq ?? 1})</span>
                            <span>{asset.score_breakdown?.liquidity?.toFixed(1) ?? "0.0"}</span>
                        </div>
                        <div className="flex justify-between text-xs text-muted-foreground">
                            <span title="peso">Volatility (w: {asset.weights_used?.vol ?? 1})</span>
                            <span>{asset.score_breakdown?.volatility?.toFixed(1) ?? "0.0"}</span>
                        </div>
                        <div className="flex justify-between text-xs text-muted-foreground">
                            <span title="peso">Cost Factor (w: {asset.weights_used?.cost ?? 1})</span>
                            <span className="text-orange-400">{asset.score_breakdown?.cost?.toFixed(1) ?? "0.0"}</span>
                        </div>
                        <div className="flex justify-between text-xs text-muted-foreground">
                            <span title="peso">Stability (w: {asset.weights_used?.stab ?? 1})</span>
                            <span>{asset.score_breakdown?.stability?.toFixed(1) ?? "0.0"}</span>
                        </div>
                    </div>
                </section>

                {/* Microstructure */}
                <section>
                    <h3 className="text-sm font-bold text-muted-foreground uppercase mb-2 flex items-center gap-2">
                        <Scale size={14} /> Microstructure
                    </h3>
                    <div className="bg-card border border-border rounded-lg p-3 space-y-2 text-sm">
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Spread Points</span>
                            <span className="font-mono">{asset.metrics?.spread_points ?? "—"}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">ATR</span>
                            <span className="font-mono">{asset.metrics?.atr?.toFixed(5) ?? "—"}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Spread/ATR Ratio</span>
                            <span className={(asset.metrics?.spread_atr_ratio ?? 0) > 0.1 ? "text-destructive font-bold" : "text-success"}>
                                {asset.metrics?.spread_atr_ratio ? (asset.metrics.spread_atr_ratio * 100).toFixed(1) : "—"}%
                            </span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">ADX</span>
                            <span className="font-mono">{asset.metrics?.adx?.toFixed(1) ?? "—"}</span>
                        </div>
                    </div>
                </section>

                {/* Data Health */}
                <section>
                    <h3 className="text-sm font-bold text-muted-foreground uppercase mb-2 flex items-center gap-2">
                        <Database size={14} /> Data Health
                    </h3>
                    <div className="bg-card border border-border rounded-lg p-3 space-y-2 text-sm">
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Price</span>
                            <span className="font-mono text-xs">{asset.metrics?.price ?? "—"}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Staleness</span>
                            <span className={(asset.metrics?.staleness_sec ?? 0) > 60 ? "text-destructive" : "text-success"}>
                                {asset.metrics?.staleness_sec ?? 0}s
                            </span>
                        </div>
                    </div>
                </section>

                {/* Reason Codes */}
                <section>
                    <h3 className="text-sm font-bold text-muted-foreground uppercase mb-2">Decisions & Codes</h3>
                    <div className="space-y-2">
                        <div className="bg-muted/30 p-2 rounded text-xs font-mono border border-border">
                            {asset.reason_code}
                        </div>
                        <div className="text-xs text-muted-foreground">
                            Specification: <span className="text-foreground">{asset.specification || "N/A"}</span>
                        </div>
                        {asset.decision_reason && (
                            <div className="text-xs text-muted-foreground mt-2 border-t border-border/50 pt-2">
                                Gate Decision: <strong className="text-primary">{asset.decision_reason}</strong>
                            </div>
                        )}
                        {asset.computed_at && (
                            <div className="text-[10px] text-muted-foreground/50 text-right mt-2">
                                Computed {new Date(asset.computed_at).toLocaleTimeString()}
                            </div>
                        )}
                    </div>
                </section>

            </div>
        </div>
    );
};
