import type { FC } from 'react';
import { Home, List } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';

export const BottomNav: FC = () => {
    const navigate = useNavigate();
    const location = useLocation();

    const navItems = [
        { label: 'Dashboard', path: '/mobile', icon: Home },
        { label: 'Ledger', path: '/mobile/ledger', icon: List },
    ];

    return (
        <div className="fixed bottom-0 left-0 right-0 bg-background/80 backdrop-blur-lg border-t border-border/50 pb-safe z-50">
            <div className="flex justify-around items-center h-16 px-4">
                {navItems.map((item) => {
                    const isActive = location.pathname === item.path;
                    const Icon = item.icon;

                    return (
                        <button
                            key={item.path}
                            onClick={() => navigate(item.path)}
                            className={`flex flex-col items-center justify-center w-full h-full gap-1 transition-colors ${isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
                                }`}
                        >
                            <Icon size={24} strokeWidth={isActive ? 2.5 : 2} />
                            <span className={`text-[10px] font-medium ${isActive ? 'font-bold' : ''}`}>
                                {item.label}
                            </span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
};
