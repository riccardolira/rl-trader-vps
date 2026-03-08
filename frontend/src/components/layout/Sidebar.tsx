import React from 'react';
import { LayoutDashboard, ScrollText, ShieldCheck, Cpu, PieChart, X } from 'lucide-react';
import { cn } from '../../lib/utils';

interface SidebarProps {
    activeTab: string;
    setActiveTab: (tab: string) => void;
    isMobileMenuOpen: boolean;
    setIsMobileMenuOpen: (open: boolean) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab, isMobileMenuOpen, setIsMobileMenuOpen }) => {
    const navItems = [
        { id: 'universe', label: 'Universe', icon: LayoutDashboard },
        { id: 'operations', label: 'Motor de Operações', icon: Cpu },
        { id: 'analytics', label: 'Analytics', icon: PieChart },
        { id: 'logs', label: 'Logs & Transparência', icon: ScrollText },
        { id: 'risk', label: 'Risco', icon: ShieldCheck },
    ];

    return (
        <>
            {/* Mobile Backdrop */}
            {isMobileMenuOpen && (
                <div
                    className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 md:hidden"
                    onClick={() => setIsMobileMenuOpen(false)}
                />
            )}

            <aside className={cn(
                "fixed inset-y-0 left-0 z-50 w-64 border-r border-border/50 bg-card/95 backdrop-blur-2xl flex flex-col shadow-[4px_0_24px_rgba(0,0,0,0.02)] transition-transform duration-300 md:relative md:translate-x-0 h-[100dvh]",
                isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
            )}>
                <div className="h-16 shrink-0 flex items-center justify-between px-6 border-b border-border/50">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary/30 to-primary/10 border border-primary/20 flex items-center justify-center shadow-inner">
                            <span className="text-primary font-bold text-lg tracking-tighter">RL</span>
                        </div>
                        <div className="flex flex-col justify-center">
                            <h1 className="font-bold text-foreground/90 leading-tight tracking-tight text-sm">RL Trader</h1>
                            <span className="text-[10px] text-muted-foreground/70 uppercase tracking-widest font-bold">V3.0 Control Tower</span>
                        </div>
                    </div>
                    {/* Close button for Mobile Drawer */}
                    <button
                        onClick={() => setIsMobileMenuOpen(false)}
                        className="md:hidden p-1.5 rounded-lg text-muted-foreground hover:bg-muted transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                <nav className="flex-1 p-4 space-y-2">
                    {navItems.map((item) => {
                        const Icon = item.icon;
                        const isActive = activeTab === item.id;
                        return (
                            <button
                                key={item.id}
                                onClick={() => setActiveTab(item.id)}
                                className={cn(
                                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-all duration-300 border group",
                                    isActive
                                        ? "bg-primary/10 text-primary border-primary/20 shadow-sm relative overflow-hidden ring-1 ring-primary/20"
                                        : "border-transparent text-muted-foreground/80 hover:bg-muted/40 hover:text-foreground hover:border-border/60 hover:-translate-y-0.5"
                                )}
                            >
                                {isActive && <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary rounded-l-lg" />}
                                <Icon size={18} className={cn("transition-transform", isActive ? "scale-110" : "group-hover:scale-110 group-hover:text-primary/70")} />
                                {item.label}
                            </button>
                        );
                    })}
                </nav>

                <div className="p-4 border-t border-border/50 mt-auto shrink-0 pb-safe">
                    <div className="bg-muted/20 border border-border/50 rounded-xl p-4 text-[11px] text-muted-foreground/80 shadow-sm">
                        <div className="flex justify-between items-center mb-1.5">
                            <span className="uppercase tracking-widest font-bold">Status</span>
                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)] animate-pulse" />
                        </div>
                        <div className="font-mono font-medium text-foreground/80">System Online</div>
                    </div>
                </div>
            </aside>
        </>
    );
};
