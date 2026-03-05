import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('Uncaught error:', error, errorInfo);
    }

    public render() {
        if (this.state.hasError) {
            return (
                <div className="flex h-screen w-full flex-col items-center justify-center bg-background p-4 text-foreground">
                    <div className="max-w-md rounded-lg border border-destructive/50 bg-destructive/10 p-6 text-center">
                        <AlertTriangle className="mx-auto mb-4 h-12 w-12 text-destructive" />
                        <h2 className="mb-2 text-xl font-bold">Something went wrong</h2>
                        <p className="mb-4 text-sm text-muted-foreground">
                            The application encountered a critical error and could not render.
                        </p>
                        <div className="mb-4 overflow-auto rounded bg-black/10 p-2 text-left text-xs font-mono text-destructive">
                            {this.state.error?.message}
                        </div>
                        <button
                            className="rounded bg-primary px-4 py-2 font-bold text-primary-foreground hover:bg-primary/90"
                            onClick={() => window.location.reload()}
                        >
                            Reload Application
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
