import React from 'react';
import { BarChart3 } from 'lucide-react';

export const StatsView: React.FC = () => {
    return (
        <div className="h-full flex flex-col items-center justify-center text-muted-foreground bg-card rounded-lg border border-border p-8 border-dashed">
            <BarChart3 size={48} className="mb-4 opacity-50" />
            <h3 className="text-lg font-medium text-foreground">Statistics Unavailable</h3>
            <p className="text-sm max-w-sm text-center mt-2">
                Performance metrics will be available once the Strategy Engine completes the first full rotation.
            </p>
        </div>
    );
};
