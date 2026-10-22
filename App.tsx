import React, { useState, useEffect, useRef, Suspense, lazy } from 'react';
import { AuthProvider } from './contexts/AuthContext';
import { UIProvider, useUI } from './contexts/UIContext';
import { AnalysisProvider } from './contexts/AnalysisContext';
import { PortfolioProvider } from './contexts/PortfolioContext';
import LandingPage from './components/LandingPage';
import LoginScreen from './components/LoginScreen';
import RegisterScreen from './components/RegisterScreen';
import ResetPasswordScreen from './components/ResetPasswordScreen';
import LegalPage from './pages/LegalPage';
import { AppHeader } from './components/layout/AppHeader';
import { ViewLoadingFallback } from './components/layout/ViewLoadingFallback';
import { useAnalysisFlow, type AppView } from './hooks/useAnalysisFlow';
import { useAuthSession } from './hooks/useAuthSession';
import AnalyzerPage from './pages/AnalyzerPage';
import { AppStatus, type ExtendedUserProfile } from './types';

// Lazy load heavy pages and components
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const ReportPage = lazy(() => import('./pages/ReportPage'));
const ClientsPage = lazy(() => import('./pages/ClientsPage'));
const AnalyticsPage = lazy(() => import('./pages/AnalyticsPage'));
const UsersPage = lazy(() => import('./pages/UsersPage'));
const ChatBot = lazy(() => import('./components/ChatBot'));
const ProfileScreen = lazy(() => import('./components/ProfileScreen'));
const ClauseAdmin = lazy(() => import('./components/ClauseAdmin'));
const InsurerManager = lazy(() =>
  import('./components/InsurerManager').then((m) => ({ default: m.InsurerManager }))
);
const PortfolioPage = lazy(() => import('./pages/Portfolio'));
const RenewalDetailPage = lazy(() => import('./pages/RenewalDetail'));

const AppShell: React.FC = () => {
  const { state, resetFlow, viewReport } = useAnalysisFlow();
  const { currentUser, bootstrapped, updateUser, handleLogin, handleSessionLogout } =
    useAuthSession({
      onLogin: () => setCurrentView('DASHBOARD'),
      onLogout: () => setCurrentView('LANDING'),
    });
  const {
    chatOpen,
    setChatOpen,
    showProfile,
    setShowProfile,
    showClauseAdmin,
    setShowClauseAdmin,
  } = useUI();

  const [currentView, setCurrentView] = useState<AppView>('LANDING');
  const [activeRenewalId, setActiveRenewalId] = useState<string | null>(null);
  const { status, report } = state;

  const handledBoot = useRef(false);
  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.hash?.includes('type=recovery')) {
      setCurrentView('RESET_PASSWORD');
      return;
    }
    if (!handledBoot.current && bootstrapped) {
      handledBoot.current = true;
      if (currentUser) setCurrentView('DASHBOARD');
    }
  }, [bootstrapped, currentUser]);

  const handleReset = () => {
    resetFlow();
    if (currentView === 'REPORT') setCurrentView('ANALYZER');
  };

  const handleLogout = () => {
    handleSessionLogout();
    handleReset();
  };

  const navigateToDashboard = () => {
    handleReset();
    setCurrentView('DASHBOARD');
  };

  if (currentView === 'LANDING') {
    return (
      <LandingPage
        onLoginClick={() => setCurrentView('LOGIN')}
        onRegisterClick={() => setCurrentView('REGISTER')}
        onOpenLegal={() => setCurrentView('LEGAL')}
      />
    );
  }
  if (currentView === 'LOGIN') {
    return <LoginScreen onLoginSuccess={handleLogin} onRegisterClick={() => setCurrentView('REGISTER')} />;
  }
  if (currentView === 'REGISTER') {
    return <RegisterScreen onRegisterSuccess={handleLogin} onBackToLogin={() => setCurrentView('LOGIN')} />;
  }
  if (currentView === 'RESET_PASSWORD') {
    return <ResetPasswordScreen onSuccess={() => setCurrentView('LOGIN')} onBackToLogin={() => setCurrentView('LOGIN')} />;
  }
  if (currentView === 'LEGAL') {
    return <LegalPage onBack={() => setCurrentView(currentUser ? 'DASHBOARD' : 'LANDING')} />;
  }

  const extendedUser = currentUser as unknown as ExtendedUserProfile | null;

  return (
    <div className="min-h-screen bg-slate-50 font-sans selection:bg-indigo-100 selection:text-indigo-900">
      <AppHeader
        currentUser={currentUser}
        currentView={currentView}
        showChatButton={status === AppStatus.COMPLETED || !!report}
        chatOpen={chatOpen}
        onNavigateDashboard={navigateToDashboard}
        onOpenClients={() => setCurrentView('CLIENTS')}
        onOpenPortfolio={() => setCurrentView('PORTFOLIO')}
        onOpenAnalytics={() => setCurrentView('ANALYTICS')}
        onOpenUsers={() => setCurrentView('USERS')}
        onOpenInsurers={() => setCurrentView('INSURERS')}
        onOpenClauseAdmin={() => setShowClauseAdmin(true)}
        onToggleChat={() => setChatOpen(!chatOpen)}
        onOpenProfile={() => setShowProfile(true)}
        onOpenLegal={() => setCurrentView('LEGAL')}
        onLogout={handleLogout}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {currentView === 'CLIENTS' && (
          <Suspense fallback={<ViewLoadingFallback />}>
            <ClientsPage onSelectClientForAudit={() => setCurrentView('ANALYZER')} onViewReport={() => setCurrentView('REPORT')} />
          </Suspense>
        )}
        {currentView === 'PORTFOLIO' && (
          <Suspense fallback={<ViewLoadingFallback />}>
            <PortfolioProvider>
              <PortfolioPage onOpenRenewal={(id) => { setActiveRenewalId(id); setCurrentView('RENEWAL_DETAIL'); }} />
            </PortfolioProvider>
          </Suspense>
        )}
        {currentView === 'RENEWAL_DETAIL' && activeRenewalId && (
          <Suspense fallback={<ViewLoadingFallback />}>
            <RenewalDetailPage renewalId={activeRenewalId} onBack={() => setCurrentView('PORTFOLIO')} />
          </Suspense>
        )}
        {currentView === 'DASHBOARD' && (
          <Suspense fallback={<ViewLoadingFallback />}>
            <DashboardPage
              onNewAnalysis={() => setCurrentView('ANALYZER')}
              onViewReport={(rep) => { viewReport(rep); setCurrentView('REPORT'); }}
            />
          </Suspense>
        )}
        {currentView === 'ANALYTICS' && (
          <Suspense fallback={<ViewLoadingFallback />}>
            <AnalyticsPage onBackToDashboard={() => setCurrentView('DASHBOARD')} />
          </Suspense>
        )}
        {currentView === 'USERS' && (
          <Suspense fallback={<ViewLoadingFallback />}>
            <UsersPage
              currentUserRole={extendedUser?.role || 'super_admin'}
              currentAllyId={extendedUser?.allyId || 'ally-100'}
              onClose={() => setCurrentView('DASHBOARD')}
            />
          </Suspense>
        )}
        {currentView === 'INSURERS' && (
          <Suspense fallback={<ViewLoadingFallback />}>
            <InsurerManager onBack={() => setCurrentView('ANALYZER')} />
          </Suspense>
        )}
        {currentView === 'ANALYZER' && status !== AppStatus.COMPLETED && (
          <AnalyzerPage onAnalysisComplete={() => setCurrentView('REPORT')} />
        )}
        {currentView === 'REPORT' && report && (
          <ReportPage onBackToDashboard={() => setCurrentView('DASHBOARD')} onNewAudit={() => setCurrentView('ANALYZER')} />
        )}
      </main>

      {showProfile && currentUser && (
        <Suspense fallback={null}>
          <ProfileScreen currentUser={currentUser} onUpdateProfile={updateUser} onClose={() => setShowProfile(false)} />
        </Suspense>
      )}
      {showClauseAdmin && (
        <Suspense fallback={null}>
          <ClauseAdmin currentUser={currentUser} onClose={() => setShowClauseAdmin(false)} />
        </Suspense>
      )}
      <Suspense fallback={null}>
        <ChatBot reportContext={report || undefined} isOpen={chatOpen} onClose={() => setChatOpen(false)} />
      </Suspense>
    </div>
  );
};

const App: React.FC = () => (
  <AuthProvider>
    <UIProvider>
      <AnalysisProvider>
        <AppShell />
      </AnalysisProvider>
    </UIProvider>
  </AuthProvider>
);

export default App;
