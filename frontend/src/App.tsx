import { useState, useEffect } from 'react';
import { wsClient } from './core/net/wsClient';
import { Layout } from './components/layout/Layout';
import { UniversePage } from './pages/UniversePage';
import { OperationsPage } from './pages/OperationsPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { LogsPage } from './pages/LogsPage';
import { RiskPage } from './pages/RiskPage';
import { ManualOverlay } from './components/common/ManualOverlay';
import { SettingsModal } from './components/common/SettingsModal';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LoginPage } from './pages/LoginPage';

function AppContent() {
  const [activeTab, setActiveTab] = useState(() => {
    return localStorage.getItem('activeTab') || 'universe';
  });
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

  useEffect(() => {
    localStorage.setItem('activeTab', activeTab);
  }, [activeTab]);

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  return (
    <>
      <Layout
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isManualOpen={isManualOpen}
        setIsManualOpen={setIsManualOpen}
        isSettingsOpen={isSettingsOpen}
        setIsSettingsOpen={setIsSettingsOpen}
      >
        {activeTab === 'universe' && <UniversePage />}
        {activeTab === 'operations' && <OperationsPage />}
        {activeTab === 'analytics' && <AnalyticsPage />}
        {activeTab === 'logs' && <LogsPage />}
        {activeTab === 'risk' && <RiskPage />}
      </Layout>
      <ManualOverlay isOpen={isManualOpen} onClose={() => setIsManualOpen(false)} />
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </>
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
