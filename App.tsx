import React, { useState, useEffect, useRef, Suspense, lazy } from 'react';
import { AuthProvider } from './contexts/AuthContext';
import { UIProvider, useUI } from './contexts/UIContext';
import { AnalysisProvider } from './contexts/AnalysisContext';
import { PortfolioProvider } from './contexts/PortfolioContext';
import { useAppNavigation } from './hooks/useAppNavigation';
import { AppHeader } from './components/layout/AppHeader';
import { AppFooter, type LegalTabType } from './components/layout/AppFooter';
import { AppModals } from './components/layout/AppModals';
import { renderPublicView } from './components/layout/AppPublicViews';
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
const InsurerManager = lazy(() =>
  import('./components/InsurerManager').then((m) => ({ default: m.InsurerManager }))
);
const PortfolioPage = lazy(() => import('./pages/Portfolio'));
const RenewalDetailPage = lazy(() => import('./pages/RenewalDetail'));

const AppShell: React.FC = () => {
  const { state, resetFlow, viewReport } = useAnalysisFlow();
  const { status, report } = state;
  const { currentView, activeRenewalId, navigateTo } = useAppNavigation(!!report);
  const [legalTab, setLegalTab] = useState<'terms' | 'privacy' | 'security' | 'disclaimer'>(
    'terms'
  );
  const [showLegalModal, setShowLegalModal] = useState(false);

  const { currentUser, bootstrapped, updateUser, handleLogin, handleSessionLogout } =
    useAuthSession({
      onLogin: () => navigateTo('DASHBOARD', { replace: true }),
      onLogout: () => navigateTo('LANDING', { replace: true }),
    });
  const {
    chatOpen,
    setChatOpen,
    showProfile,
    setShowProfile,
    showClauseAdmin,
    setShowClauseAdmin,
    toast,
    clearToast,
  } = useUI();

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

  const startNewAnalysis = () => {
    resetFlow();
    navigateTo('ANALYZER');
  };
  const handleLogout = () => {
    handleSessionLogout();
    resetFlow();
    navigateTo('LANDING', { replace: true });
  };
  const navigateToDashboard = () => {
    navigateTo('DASHBOARD');
  };

  const publicView = renderPublicView({
    currentView,
    currentUser,
    legalTab,
    setLegalTab,
    navigateTo,
    handleLogin,
  });
  if (publicView) return publicView;

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
            <ClientsPage
              onSelectClientForAudit={() => navigateTo('ANALYZER')}
              onViewReport={(rep) => {
                viewReport(rep);
                navigateTo('REPORT');
              }}
            />
          </Suspense>
        )}
        {(currentView === 'PORTFOLIO' || currentView === 'RENEWAL_DETAIL') && (
          <Suspense fallback={<ViewLoadingFallback />}>
            <PortfolioProvider>
              {currentView === 'PORTFOLIO' && (
                <PortfolioPage
                  onOpenRenewal={(id) => navigateTo('RENEWAL_DETAIL', { renewalId: id })}
                />
              )}
              {currentView === 'RENEWAL_DETAIL' && activeRenewalId && (
                <RenewalDetailPage
                  renewalId={activeRenewalId}
                  onBack={() => navigateTo('PORTFOLIO')}
                />
              )}
            </PortfolioProvider>
          </Suspense>
        )}
        {currentView === 'DASHBOARD' && (
          <Suspense fallback={<ViewLoadingFallback />}>
            <DashboardPage
              onNewAnalysis={() => startNewAnalysis()}
              onViewReport={(rep) => {
                viewReport(rep);
                navigateTo('REPORT');
              }}
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

      <AppFooter
        currentUser={currentUser}
        onOpenLegalModal={(tab: LegalTabType) => {
          setLegalTab(tab);
          setShowLegalModal(true);
        }}
      />

      <AppModals
        currentUser={currentUser}
        report={report}
        chatOpen={chatOpen}
        setChatOpen={setChatOpen}
        showProfile={showProfile}
        setShowProfile={setShowProfile}
        showClauseAdmin={showClauseAdmin}
        setShowClauseAdmin={setShowClauseAdmin}
        showLegalModal={showLegalModal}
        setShowLegalModal={setShowLegalModal}
        legalTab={legalTab}
        updateUser={updateUser}
        toast={toast}
        clearToast={clearToast}
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
