import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { Calendar, AlertTriangle, ShieldX } from 'lucide-react';

interface NewsEvent {
    title: string;
    currency: string;
    impact: string;
    time_utc: string;
}

export const EconomicCalendar: React.FC = () => {
    const [events, setEvents] = useState<NewsEvent[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchNews = async () => {
            try {
                const response = await api.get<{ status: string, threats: NewsEvent[] }>('/api/universe/news-threats');
                if (response && response.threats) {
                    setEvents(response.threats);
                }
            } catch (err) {
                console.error("Failed to fetch news", err);
            } finally {
                setLoading(false);
            }
        };

        fetchNews();
        // Refresh every 5 minutes in case cache updates or day rolls over
        const intv = setInterval(fetchNews, 300000);
        return () => clearInterval(intv);
    }, []);

    if (loading) {
        return <div className="p-4 text-sm text-muted-foreground animate-pulse">Carregando Calendário Econômico...</div>;
    }

    if (events.length === 0) {
        return (
            <div className="p-6 text-center border border-border rounded-lg bg-card">
                <Calendar className="mx-auto mb-2 opacity-50 text-muted-foreground" size={24} />
                <h3 className="text-sm font-bold text-muted-foreground">Calendário Limpo Hoje</h3>
                <p className="text-xs text-muted-foreground mt-1">Nenhum evento Macro de alto impacto ou feriado bancário rastreado para o dia de hoje.</p>
            </div>
        );
    }

    return (
        <div className="space-y-4 animate-in fade-in">
            <h3 className="text-sm font-bold flex items-center gap-2">
                <AlertTriangle className="text-orange-500" size={16} />
                Feriados Globais & High-Impact News (Hoje)
            </h3>

            <div className="text-xs text-muted-foreground mb-4">
                Moedas expostas a estes eventos sofrem <b>LOCKDOWN</b> automático pelo AssetSelectionService entre <b>T-30 min e T+60 min</b>. Seus Spreads são fechados e entram num "Limbo" provisório do Scanner para proteger o capital inteligente. Feriados causam Block do Banco durante 100% do pregão.
            </div>

            <div className="overflow-hidden border border-border rounded-lg bg-card shadow-sm">
                <table className="w-full text-xs text-left">
                    <thead className="bg-muted/50 text-muted-foreground uppercase tracking-wider font-bold">
                        <tr>
                            <th className="px-4 py-3">Horário (Sua Máquina)</th>
                            <th className="px-4 py-3">Moeda</th>
                            <th className="px-4 py-3">Impacto</th>
                            <th className="px-4 py-3 w-1/2">Evento</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                        {events.map((ev, i) => {
                            const dateLocal = new Date(ev.time_utc);
                            const now = new Date();
                            const diffMins = (dateLocal.getTime() - now.getTime()) / 60000;

                            let isFrozenNow = false;
                            if (ev.impact === 'High' && diffMins >= -60 && diffMins <= 30) isFrozenNow = true;
                            if (ev.impact === 'Holiday' && dateLocal.getDate() === now.getDate()) isFrozenNow = true;

                            return (
                                <tr key={i} className={`hover:bg-muted/30 transition-colors ${isFrozenNow ? 'bg-destructive/10' : ''}`}>
                                    <td className="px-4 py-3 font-mono">
                                        {ev.impact === 'Holiday' ? 'ALL DAY' : dateLocal.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </td>
                                    <td className="px-4 py-3 font-bold">
                                        <span className={`px-2 py-0.5 rounded text-[10px] ${isFrozenNow ? 'bg-destructive/20 text-destructive' : 'bg-muted text-foreground'}`}>
                                            {ev.currency}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3">
                                        {ev.impact === 'High' ? (
                                            <span className="text-red-500 font-bold flex items-center gap-1"><AlertTriangle size={12} /> High</span>
                                        ) : (
                                            <span className="text-sky-500 font-bold flex items-center gap-1"><ShieldX size={12} /> Bank Holiday</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 space-y-1">
                                        <div className="font-medium">{ev.title}</div>
                                        {isFrozenNow && (
                                            <div className="text-[10px] text-destructive font-bold uppercase tracking-wider">
                                                🚨 Ativos contendo {ev.currency} estão em Lockdown agora.
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
