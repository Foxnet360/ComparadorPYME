import React, { useState, useEffect, useRef, Suspense, lazy } from 'react';
import { AuthProvider } from './contexts/AuthContext';
import { UIProvider, useUI } from './contexts/UIContext';
import { AnalysisProvider } from './contexts/AnalysisContext';
import { PortfolioProvider } from './contexts/PortfolioContext';
import { useAppNavigation } from './hooks/useAppNavigation';
import LandingPage from './components/LandingPage';
import LoginScreen from './components/LoginScreen';
import RegisterScreen from './components/RegisterScreen';
import ResetPasswordScreen from './components/ResetPasswordScreen';
import LegalPage from './pages/LegalPage';
import { AppHeader } from './components/layout/AppHeader';
import { AppFooter, type LegalTabType } from './components/layout/AppFooter';
import { LegalModal } from './components/legal/LegalModal';
import { ToastContainer } from './components/ToastNotification';
import { ViewLoadingFallback } from './components/layout/ViewLoadingFallback';
import { useAnalysisFlow } from './hooks/useAnalysisFlow';
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
const InsurerManager = lazy(() => import('./components/InsurerManager').then((m) => ({ default: m.InsurerManager })));
const PortfolioPage = lazy(() => import('./pages/Portfolio'));
const RenewalDetailPage = lazy(() => import('./pages/RenewalDetail'));

const AppShell: React.FC = () => {
  const { state, resetFlow, viewReport } = useAnalysisFlow();
  const { status, report } = state;
  const { currentView, activeRenewalId, navigateTo } = useAppNavigation(!!report);
  const [legalTab, setLegalTab] = useState<'terms' | 'privacy' | 'security' | 'disclaimer'>('terms');
  const [showLegalModal, setShowLegalModal] = useState(false);

  const { currentUser, bootstrapped, updateUser, handleLogin, handleSessionLogout } = useAuthSession({
    onLogin: () => navigateTo('DASHBOARD', { replace: true }),
    onLogout: () => navigateTo('LANDING', { replace: true }),
  });
  const { chatOpen, setChatOpen, showProfile, setShowProfile, showClauseAdmin, setShowClauseAdmin, toast, clearToast } = useUI();

  const handledBoot = useRef(false);
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const searchParams = new URLSearchParams(window.location.search);
      if (searchParams.has('view') || searchParams.get('demo') === '1') {
        return;
      }

      if (window.location.hash?.includes('type=recovery')) {
        navigateTo('RESET_PASSWORD', { replace: true });
        return;
      }
    }
    if (!handledBoot.current && bootstrapped) {
      handledBoot.current = true;
      if (currentUser && currentView === 'LANDING') {
        navigateTo('DASHBOARD', { replace: true });
      }
    }
  }, [bootstrapped, currentUser, currentView, navigateTo]);

  const startNewAnalysis = () => { resetFlow(); navigateTo('ANALYZER'); };
  const handleLogout = () => { handleSessionLogout(); resetFlow(); navigateTo('LANDING', { replace: true }); };
  const navigateToDashboard = () => { navigateTo('DASHBOARD'); };

  if (currentView === 'LANDING') {
    return (
      <LandingPage
        onLoginClick={() => navigateTo('LOGIN')}
        onRegisterClick={() => navigateTo('REGISTER')}
        onOpenLegal={(tab) => {
          if (tab) setLegalTab(tab as typeof legalTab);
          navigateTo('LEGAL');
        }}
      />
    );
  }
  if (currentView === 'LOGIN') {
    return <LoginScreen onLoginSuccess={handleLogin} onRegisterClick={() => navigateTo('REGISTER')} />;
  }
  if (currentView === 'REGISTER') {
    return <RegisterScreen onRegisterSuccess={handleLogin} onBackToLogin={() => navigateTo('LOGIN')} />;
  }
  if (currentView === 'RESET_PASSWORD') {
    return <ResetPasswordScreen onSuccess={() => navigateTo('LOGIN')} onBackToLogin={() => navigateTo('LOGIN')} />;
  }
  if (currentView === 'LEGAL') {
    return <LegalPage defaultTab={legalTab} onBack={() => navigateTo(currentUser ? 'DASHBOARD' : 'LANDING')} />;
  }

  const extendedUser = currentUser as unknown as ExtendedUserProfile | null;

  return (
    <div className="min-h-screen bg-slate-50 font-sans selection:bg-indigo-100 selection:text-indigo-900 flex flex-col justify-between">
      <AppHeader
        currentUser={currentUser}
        currentView={currentView}
        showChatButton={status === AppStatus.COMPLETED || !!report}
        chatOpen={chatOpen}
        onNavigateDashboard={navigateToDashboard}
        onOpenClients={() => navigateTo('CLIENTS')}
        onOpenPortfolio={() => navigateTo('PORTFOLIO')}
        onOpenAnalytics={() => navigateTo('ANALYTICS')}
        onOpenUsers={() => navigateTo('USERS')}
        onOpenInsurers={() => navigateTo('INSURERS')}
        onOpenClauseAdmin={() => setShowClauseAdmin(true)}
        onToggleChat={() => setChatOpen(!chatOpen)}
        onOpenProfile={() => setShowProfile(true)}
        onOpenLegal={() => navigateTo('LEGAL')}
        onLogout={handleLogout}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full">
        {currentView === 'CLIENTS' && (
          <Suspense fallback={<ViewLoadingFallback />}>
            <ClientsPage onSelectClientForAudit={() => startNewAnalysis()} onViewReport={(rep) => { viewReport(rep); navigateTo('REPORT'); }} />
          </Suspense>
        )}
        {(currentView === 'PORTFOLIO' || currentView === 'RENEWAL_DETAIL') && (
          <Suspense fallback={<ViewLoadingFallback />}>
            <PortfolioProvider>
              {currentView === 'PORTFOLIO' && (
                <PortfolioPage onOpenRenewal={(id) => navigateTo('RENEWAL_DETAIL', { renewalId: id })} />
              )}
              {currentView === 'RENEWAL_DETAIL' && activeRenewalId && (
                <RenewalDetailPage renewalId={activeRenewalId} onBack={() => navigateTo('PORTFOLIO')} />
              )}
            </PortfolioProvider>
          </Suspense>
        )}
        {currentView === 'DASHBOARD' && (
          <Suspense fallback={<ViewLoadingFallback />}>
            <DashboardPage
              onNewAnalysis={() => startNewAnalysis()}
              onViewReport={(rep) => { viewReport(rep); navigateTo('REPORT'); }}
            />
          </Suspense>
        )}
        {currentView === 'ANALYTICS' && (
          <Suspense fallback={<ViewLoadingFallback />}>
            <AnalyticsPage
              onBackToDashboard={() => navigateTo('DASHBOARD')}
              currentUserRole={extendedUser?.role || 'ally_technical'}
            />
          </Suspense>
        )}
        {currentView === 'USERS' && (
          <Suspense fallback={<ViewLoadingFallback />}>
            <UsersPage
              currentUserRole={extendedUser?.role || 'ally_technical'}
              currentAllyId={extendedUser?.allyId || ''}
              onClose={() => navigateTo('DASHBOARD')}
            />
          </Suspense>
        )}
        {currentView === 'INSURERS' && (
          <Suspense fallback={<ViewLoadingFallback />}>
            <InsurerManager onBack={() => navigateTo('DASHBOARD')} />
          </Suspense>
        )}
        {currentView === 'ANALYZER' && (
          <AnalyzerPage onAnalysisComplete={() => navigateTo('REPORT')} />
        )}
        {currentView === 'REPORT' && report && (
          <ReportPage
            onBackToDashboard={() => navigateTo('DASHBOARD')}
            onNewAudit={() => startNewAnalysis()}
            onOpenPortfolio={() => navigateTo('PORTFOLIO')}
          />
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

      <AppFooter
        currentUser={currentUser}
        onOpenLegalModal={(tab: LegalTabType) => {
          setLegalTab(tab);
          setShowLegalModal(true);
        }}
      />

      <LegalModal
        isOpen={showLegalModal}
        onClose={() => setShowLegalModal(false)}
        initialTab={legalTab}
      />

      <ToastContainer
        toasts={toast ? [{ id: 'global-toast', message: toast.message, type: toast.type }] : []}
        onClose={clearToast}
      />
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
