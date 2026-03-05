import React from 'react';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { EngineeringOverlay } from '../EngineeringOverlay';

interface LayoutProps {
    children: React.ReactNode;
    activeTab: string;
    setActiveTab: (tab: string) => void;
    isManualOpen: boolean;
    setIsManualOpen: (open: boolean) => void;
    isSettingsOpen: boolean;
    setIsSettingsOpen: (open: boolean) => void;
}

export const Layout: React.FC<LayoutProps> = ({ children, activeTab, setActiveTab, isManualOpen, setIsManualOpen, isSettingsOpen, setIsSettingsOpen }) => {
    return (
        <div className="min-h-screen bg-background text-foreground font-sans flex h-screen overflow-hidden">
            <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
            <div className="flex-1 flex flex-col h-screen overflow-hidden">
                <Topbar
                    isManualOpen={isManualOpen}
                    setIsManualOpen={setIsManualOpen}
                    isSettingsOpen={isSettingsOpen}
                    setIsSettingsOpen={setIsSettingsOpen}
                />
                <main className="flex-1 overflow-auto bg-background/50 relative">
                    {/* Radial Gradient Overlay */}
                    <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/5 via-transparent to-transparent opacity-50" />
                    <div className="relative z-10 h-full p-4 md:p-6 lg:p-8">
                        {children}
                    </div>
                </main>
            </div>
            <EngineeringOverlay />
        </div>
    );
};
