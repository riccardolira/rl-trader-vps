import type { FC } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { BottomNav } from '../../components/mobile/BottomNav';
import { MobileDashboard } from './MobileDashboard';
import { MobileLedger } from './MobileLedger';

export const MobileApp: FC = () => {
    return (
        <div className="flex flex-col min-h-[100dvh] bg-background text-foreground pb-16">
            <div className="flex-1 w-full max-w-md mx-auto relative">
                <Routes>
                    <Route path="/" element={<MobileDashboard />} />
                    <Route path="/ledger" element={<MobileLedger />} />
                    <Route path="*" element={<Navigate to="/mobile" replace />} />
                </Routes>
            </div>
            <BottomNav />
        </div>
    );
};

