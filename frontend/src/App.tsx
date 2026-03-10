import { useState, useEffect } from 'react';
import { wsClient } from './core/net/wsClient';
import { Layout } from './components/layout/Layout';
import { ScannerPage } from './pages/ScannerPage';
import { OperationsPage } from './pages/OperationsPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { LogsPage } from './pages/LogsPage';
import { ManualOverlay } from './components/common/ManualOverlay';
import { SettingsModal } from './components/common/SettingsModal';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LoginPage } from './pages/LoginPage';

import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';

function AppContent() {
  const [isManualOpen, setIsManualOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    if (isAuthenticated) {
      wsClient.connect();
    }
    return () => {
      if (isAuthenticated) wsClient.disconnect();
    };
  }, [isAuthenticated]);

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  return (
    <HashRouter>
      <Layout
        isManualOpen={isManualOpen}
        setIsManualOpen={setIsManualOpen}
        isSettingsOpen={isSettingsOpen}
        setIsSettingsOpen={setIsSettingsOpen}
      >
        <Routes>
          <Route path="/" element={<Navigate to="/scanner" replace />} />
          <Route path="/scanner/*" element={<ScannerPage />} />
          <Route path="/operations/*" element={<OperationsPage />} />
          <Route path="/analytics/*" element={<AnalyticsPage />} />
          <Route path="/logs/*" element={<LogsPage />} />
        </Routes>
      </Layout>
      <ManualOverlay isOpen={isManualOpen} onClose={() => setIsManualOpen(false)} />
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </HashRouter>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
