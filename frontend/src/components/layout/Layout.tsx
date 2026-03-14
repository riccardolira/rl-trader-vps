import React from 'react';
import { Topbar } from './Topbar';
import { EngineeringOverlay } from '../EngineeringOverlay';

interface LayoutProps {
    children: React.ReactNode;
    isManualOpen: boolean;
    setIsManualOpen: (open: boolean) => void;
    isSettingsOpen: boolean;
    setIsSettingsOpen: (open: boolean) => void;
}

// Layout sem sidebar — navegação por tabs no Topbar
export const Layout: React.FC<LayoutProps> = ({ children, isManualOpen, setIsManualOpen, isSettingsOpen, setIsSettingsOpen }) => {
    return (
        <div className="min-h-screen bg-background text-foreground font-sans flex flex-col h-screen overflow-hidden">
            <Topbar
                isManualOpen={isManualOpen}
                setIsManualOpen={setIsManualOpen}
                isSettingsOpen={isSettingsOpen}
                setIsSettingsOpen={setIsSettingsOpen}
                onMenuToggle={() => {}}
            />
            <main className="flex-1 overflow-auto bg-background/50 relative">
                <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/5 via-transparent to-transparent opacity-40" />
                <div className="relative z-10 h-full p-4 md:p-6 pt-safe pb-safe">
                    {children}
                </div>
            </main>
            <EngineeringOverlay />
        </div>
    );
};
