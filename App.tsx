import React, { useState, useEffect, useRef, Suspense, lazy } from 'react';
import { AuthProvider } from './contexts/AuthContext';
import { UIProvider, useUI } from './contexts/UIContext';
import { AnalysisProvider } from './contexts/AnalysisContext';
import { PortfolioProvider } from './contexts/PortfolioContext';
import LandingPage from './components/LandingPage';
import LoginScreen from './components/LoginScreen';
import RegisterScreen from './components/RegisterScreen';
import { AppHeader } from './components/layout/AppHeader';
import { ViewLoadingFallback } from './components/layout/ViewLoadingFallback';
import { useAnalysisFlow, type AppView } from './hooks/useAnalysisFlow';
import { useAuthSession } from './hooks/useAuthSession';
import AnalyzerPage from './pages/AnalyzerPage';
import { AppStatus, type ExtendedUserProfile, type UserProfile } from './types';

// Lazy load heavy pages and components
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const ReportPage = lazy(() => import('./pages/ReportPage'));
const ClientsPage = lazy(() => import('./pages/ClientsPage'));
const AnalyticsPage = lazy(() => import('./pages/AnalyticsPage'));
const UsersPage = lazy(() => import('./pages/UsersPage'));
const ChatBot = lazy(() => import('./components/ChatBot'));
const ProfileScreen = lazy(() => import('./components/ProfileScreen'));
const ClauseAdmin = lazy(() => import('./components/ClauseAdmin'));
// Renewal portfolio (renovacion-polizas PR-5): lazy-loaded to keep bundle lean (XC-3)
const PortfolioPage = lazy(() => import('./pages/Portfolio'));
const RenewalDetailPage = lazy(() => import('./pages/RenewalDetail'));

const AppShell: React.FC = () => {
  // Analyzer state and flow live in AnalysisContext via useAnalysisFlow.
  const { state, analyze, resetFlow, retry, viewReport } = useAnalysisFlow();
  // Session state lives in AuthContext, resolved by authService.
  const { currentUser, bootstrapped, updateUser, handleLogin, handleSessionLogout } =
    useAuthSession({
      onLogin: () => setCurrentView('DASHBOARD'),
      onLogout: () => setCurrentView('LANDING'),
    });
  // Ephemeral UI state lives in UIContext.
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

  // Navigate to dashboard once initial Supabase session resolution completes with active user.
  const handledBoot = useRef(false);
  useEffect(() => {
    if (!handledBoot.current && bootstrapped) {
      handledBoot.current = true;
      if (currentUser) setCurrentView('DASHBOARD');
    }
  }, [bootstrapped, currentUser]);

  const handleReset = () => {
    resetFlow();
    // Don't change view here if we are just resetting for a new analysis within the tool
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

  // --- RENDER ---

  if (currentView === 'LANDING') {
    return (
      <LandingPage
        onLoginClick={() => setCurrentView('LOGIN')}
        onRegisterClick={() => setCurrentView('REGISTER')}
      />
    );
  }

  if (currentView === 'LOGIN') {
    return (
      <LoginScreen
        onLoginSuccess={(user: UserProfile) => handleLogin(user)}
        onRegisterClick={() => setCurrentView('REGISTER')}
      />
    );
  }

  if (currentView === 'REGISTER') {
    return (
      <RegisterScreen
        onRegisterSuccess={(user: UserProfile) => handleLogin(user)}
        onBackToLogin={() => setCurrentView('LOGIN')}
      />
    );
  }

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
        onOpenClauseAdmin={() => setShowClauseAdmin(true)}
        onToggleChat={() => setChatOpen(!chatOpen)}
        onOpenProfile={() => setShowProfile(true)}
        onLogout={handleLogout}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* VIEW: CLIENTS */}
        {currentView === 'CLIENTS' && (
          <Suspense fallback={<ViewLoadingFallback />}>
            <ClientsPage
              onSelectClientForAudit={() => setCurrentView('ANALYZER')}
              onViewReport={() => setCurrentView('REPORT')}
            />
          </Suspense>
        )}

        {/* VIEW: PORTFOLIO (renewal portfolio, PR-5) */}
        {currentView === 'PORTFOLIO' && (
          <Suspense fallback={<ViewLoadingFallback />}>
            <PortfolioProvider>
              <PortfolioPage
                onOpenRenewal={(renewalId) => {
                  setActiveRenewalId(renewalId);
                  setCurrentView('RENEWAL_DETAIL');
                }}
              />
            </PortfolioProvider>
          </Suspense>
        )}

        {/* VIEW: RENEWAL DETAIL (PR-5) */}
        {currentView === 'RENEWAL_DETAIL' && activeRenewalId && (
          <Suspense fallback={<ViewLoadingFallback />}>
            <RenewalDetailPage
              renewalId={activeRenewalId}
              onBack={() => setCurrentView('PORTFOLIO')}
            />
          </Suspense>
        )}

        {/* VIEW: DASHBOARD */}
        {currentView === 'DASHBOARD' && (
          <Suspense fallback={<ViewLoadingFallback />}>
            <DashboardPage
              onNewAnalysis={() => setCurrentView('ANALYZER')}
              onViewReport={(existingReport) => {
                viewReport(existingReport);
                setCurrentView('REPORT');
              }}
            />
          </Suspense>
        )}

        {/* VIEW: ANALYTICS (RBAC) */}
        {currentView === 'ANALYTICS' && (
          <Suspense fallback={<ViewLoadingFallback />}>
            <AnalyticsPage onBackToDashboard={() => setCurrentView('DASHBOARD')} />
          </Suspense>
        )}

        {/* VIEW: USERS (RBAC Management) */}
        {currentView === 'USERS' && (
          <Suspense fallback={<ViewLoadingFallback />}>
            <UsersPage
              currentUserRole={
                (currentUser as unknown as ExtendedUserProfile | null)?.role || 'super_admin'
              }
              currentAllyId={
                (currentUser as unknown as ExtendedUserProfile | null)?.allyId || 'ally-100'
              }
              onClose={() => setCurrentView('DASHBOARD')}
            />
          </Suspense>
        )}

        {/* VIEW: ANALYZER (Upload) */}
        {currentView === 'ANALYZER' && status !== AppStatus.COMPLETED && (
          <AnalyzerPage onAnalysisComplete={() => setCurrentView('REPORT')} />
        )}

        {/* VIEW: REPORT */}
        {currentView === 'REPORT' && report && (
          <ReportPage
            onBackToDashboard={() => setCurrentView('DASHBOARD')}
            onNewAudit={() => setCurrentView('ANALYZER')}
          />
        )}
      </main>

      {/* Profile Modal */}
      {showProfile && currentUser && (
        <Suspense fallback={null}>
          <ProfileScreen
            currentUser={currentUser}
            onUpdateProfile={updateUser}
            onClose={() => setShowProfile(false)}
          />
        </Suspense>
      )}

      {/* Clause Library Admin Modal */}
      {showClauseAdmin && (
        <Suspense fallback={null}>
          <ClauseAdmin currentUser={currentUser} onClose={() => setShowClauseAdmin(false)} />
        </Suspense>
      )}

      {/* Chat Interface */}
      <Suspense fallback={null}>
        <ChatBot
          reportContext={report || undefined}
          isOpen={chatOpen}
          onClose={() => setChatOpen(false)}
        />
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
