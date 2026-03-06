import React, { useEffect, useState, useRef } from 'react';
import useWebSocket, { ReadyState } from 'react-use-websocket';
import { WS_URL } from '../../services/config';
import { Terminal } from 'lucide-react';
import { cn } from '../../lib/utils';

export const LiveLogs: React.FC = () => {
    const [logs, setLogs] = useState<string[]>([]);
    const { lastMessage, readyState } = useWebSocket(WS_URL, {
        shouldReconnect: () => true,
        reconnectAttempts: 10,
        reconnectInterval: 3000,
    });

    // Auto-scroll logic could be added here
    const endRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (lastMessage !== null) {
            setLogs((prev) => [...prev, lastMessage.data].slice(-100)); // Keep last 100
        }
    }, [lastMessage]);

    useEffect(() => {
        endRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [logs]);

    const connectionStatus = {
        [ReadyState.CONNECTING]: 'Connecting',
        [ReadyState.OPEN]: 'Open',
        [ReadyState.CLOSING]: 'Closing',
        [ReadyState.CLOSED]: 'Closed',
        [ReadyState.UNINSTANTIATED]: 'Uninstantiated',
    }[readyState];

    return (
        <div className="h-full flex flex-col rounded-xl border border-border bg-[#0a0a0a] font-mono text-sm shadow-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2 border-b border-white/10 bg-white/5 backdrop-blur-sm">
                <div className="flex items-center gap-2 text-white/50">
                    <Terminal size={14} className="opacity-70" />
                    <span className="text-xs font-semibold tracking-wider uppercase text-white/80">Process Console</span>
                </div>
                <div className="flex items-center gap-2 bg-black/40 px-2 py-0.5 rounded border border-white/10">
                    <div className={cn("w-1.5 h-1.5 rounded-full", readyState === ReadyState.OPEN ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500 animate-pulse')} />
                    <span className="text-[10px] uppercase font-bold text-white/50">{connectionStatus}</span>
                </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4 text-xs leading-relaxed custom-scrollbar">
                {logs.length === 0 ? (
                    <div className="text-white/30 italic flex items-center gap-2 mt-2">
                        <span className="animate-pulse">_</span> Waiting for events...
                    </div>
                ) : (
                    logs.map((log, i) => (
                        <div key={i} className="break-words border-b border-white/5 py-1.5 flex items-start hover:bg-white/5 transition-colors px-1.5 rounded-sm gap-2 group">
                            <span className="text-emerald-500/80 select-none mt-0.5 text-[10px] font-bold opacity-50 group-hover:opacity-100 transition-opacity">{'>'}</span>
                            <span className="text-gray-300 text-[11px] font-medium leading-tight">{log}</span>
                        </div>
                    ))
                )}
                <div ref={endRef} />
            </div>
        </div>
    );
};
