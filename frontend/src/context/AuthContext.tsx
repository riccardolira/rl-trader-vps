import React, { createContext, useContext, useState } from 'react';

interface AuthContextType {
    isAuthenticated: boolean;
    login: (password: string) => boolean;
    logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    // Check local storage for existing session
    const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
        const savedAuth = localStorage.getItem('rl_trader_auth');
        return savedAuth === 'true';
    });

    const login = (password: string) => {
        // The password should be set in .env as VITE_DASHBOARD_PASSWORD
        // If no password is set in .env, default to 'admin'
        const correctPassword = import.meta.env.VITE_DASHBOARD_PASSWORD || 'admin';

        if (password === correctPassword) {
            setIsAuthenticated(true);
            localStorage.setItem('rl_trader_auth', 'true');
            return true;
        }
        return false;
    };

    const logout = () => {
        setIsAuthenticated(false);
        localStorage.removeItem('rl_trader_auth');
    };

    return (
        <AuthContext.Provider value={{ isAuthenticated, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
