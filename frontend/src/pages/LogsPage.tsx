import { useState } from 'react';
import { TransparencyFeed } from '../components/logs/TransparencyFeed';
import { LiveLogs } from '../components/logs/LiveLogs';
import { AuditTrail } from '../components/logs/AuditTrail';
import { StatsView } from '../components/logs/StatsView';
import { cn } from '../lib/utils';
import { Terminal, FileClock, BarChart3 } from 'lucide-react';

export const LogsPage = () => {
    const [activeTab, setActiveTab] = useState<'glassbox' | 'live' | 'audit' | 'stats'>('glassbox');

    const tabs = [
        { id: 'glassbox', label: 'Glass Box Stream', icon: Terminal },
        { id: 'live', label: 'Process Console', icon: Terminal },
        { id: 'audit', label: 'Frontend Telemetry', icon: FileClock },
        { id: 'stats', label: 'Statistics', icon: BarChart3 },
    ] as const;

    return (
        <div className="space-y-6 h-full flex flex-col">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Logs & Transparency</h2>
                    <p className="text-sm text-muted-foreground mt-1">System Audit & Real-time Monitoring</p>
                </div>

                <div className="flex gap-2 items-center">
                    <div className="flex bg-muted/30 p-1.5 rounded-full border border-border/50 shadow-sm w-max overflow-x-auto max-w-full">
                        {tabs.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as any)}
                                className={cn(
                                    "flex items-center gap-2 px-4 py-1.5 text-sm font-bold rounded-full transition-all duration-200 whitespace-nowrap",
                                    activeTab === tab.id
                                        ? "bg-background text-foreground shadow-[0_2px_8px_rgba(0,0,0,0.05)] border border-border/50"
                                        : "border border-transparent text-muted-foreground/80 hover:text-foreground"
                                )}
                            >
                                <tab.icon size={16} />
                                {tab.label}
                            </button>
                        ))}
                    </div>
                </div>
            </header>

            <div className="flex-1 overflow-hidden">
                {activeTab === 'glassbox' && <TransparencyFeed />}
                {activeTab === 'live' && <LiveLogs />}
                {activeTab === 'audit' && <AuditTrail />}
                {activeTab === 'stats' && <StatsView />}
            </div>
        </div>
    );
};
