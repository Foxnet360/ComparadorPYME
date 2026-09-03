import React, { useState, useEffect, useRef, Suspense, lazy } from 'react';
import {
  Sparkles,
  MessageSquare,
  ShieldCheck,
  LogOut,
  LayoutDashboard,
  BookOpen,
  Activity,
  Library,
  Users,
  BarChart3,
} from 'lucide-react';
import FileUploader from './components/FileUploader';
import DomainSelector from './components/DomainSelector';
import { AnalysisProvider, useAnalysis } from './contexts/AnalysisContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { UIProvider, useUI } from './contexts/UIContext';
import LoginScreen from './components/LoginScreen';
import ClientSelector from './components/ClientSelector';
import { ClauseSelector } from './components/ClauseSelector';
import { analyzeQuotesWithGemini } from './services/geminiService';
import { storageService } from './services/storageService';
import {
  ComparisonReport as ReportType,
  AppStatus,
  UserProfile,
  Client,
  InsuranceDomain,
} from './types';
import type { ExtendedUserProfile, InsuranceDomainType } from './types';
// Chat is now handled via backend API

import RegisterScreen from './components/RegisterScreen';
import LandingPage from './components/LandingPage';

// Lazy load heavy components
const ComparisonReport = lazy(() => import('./components/ComparisonReport'));
const ChatBot = lazy(() => import('./components/ChatBot'));
const TechnicalDashboard = lazy(() => import('./components/TechnicalDashboard'));
const ClauseAdmin = lazy(() => import('./components/ClauseAdmin'));
const ProfileScreen = lazy(() => import('./components/ProfileScreen'));
const ClientManager = lazy(() => import('./components/ClientManager'));
const ExecutiveAnalytics = lazy(() => import('./components/ExecutiveAnalytics'));
const UserManagement = lazy(() => import('./components/UserManagement'));

type ViewState =
  | 'LANDING'
  | 'LOGIN'
  | 'REGISTER'
  | 'DASHBOARD'
  | 'ANALYZER'
  | 'REPORT'
  | 'CLIENTS'
  | 'ANALYTICS'
  | 'USERS';

const AppShell: React.FC = () => {
  // Analyzer state lives in AnalysisContext (single source of truth).
  const {
    state,
    dispatch,
    addQuoteFiles,
    removeQuoteFile,
    addClauseFiles,
    removeClauseFile,
    reset,
  } = useAnalysis();
  // Session state lives in AuthContext, resolved by authService.
  const { currentUser, bootstrapped, login, logout, updateUser } = useAuth();
  // Ephemeral UI state lives in UIContext.
  const {
    chatOpen,
    setChatOpen,
    showProfile,
    setShowProfile,
    showClauseAdmin,
    setShowClauseAdmin,
    clientSelectorOpen,
    setClientSelectorOpen,
  } = useUI();

  const [currentView, setCurrentView] = useState<ViewState>('LANDING');

  const {
    status,
    report,
    selectedClient,
    quoteFiles,
    clauseFiles,
    clauseMode,
    selectedClauseIds,
    domain,
    statusMessage,
    errorMessage,
  } = state;

  // Navigate to the dashboard once the initial Supabase session resolution
  // completes with an active user (replaces the legacy boot effect).
  const handledBoot = useRef(false);
  useEffect(() => {
    if (!handledBoot.current && bootstrapped) {
      handledBoot.current = true;
      if (currentUser) setCurrentView('DASHBOARD');
    }
  }, [bootstrapped, currentUser]);

  const handleLogin = (user: UserProfile) => {
    login(user);
    setCurrentView('DASHBOARD');
  };

  const handleLogout = () => {
    logout();
    setCurrentView('LANDING');
    setShowProfile(false);
    handleReset();
  };

  const handleQuotesSelected = (newFiles: File[]) => {
    addQuoteFiles(newFiles);
  };

  const handleClausesSelected = (newFiles: File[]) => {
    addClauseFiles(newFiles);
  };

  const handleRemoveQuote = (index: number) => {
    removeQuoteFile(index);
  };

  const handleRemoveClause = (index: number) => {
    removeClauseFile(index);
  };

  const handleAnalyze = async () => {
    if (quoteFiles.length === 0) return;
    dispatch({ type: 'SET_STATUS', payload: AppStatus.ANALYZING });

    try {
      const clientName = selectedClient?.name || 'Cliente Desconocido';
      // Pass clauseIds when using library mode
      const clauseIdsToUse = clauseMode === 'library' ? selectedClauseIds : undefined;
      const result = await analyzeQuotesWithGemini(
        quoteFiles,
        clauseFiles,
        clientName,
        (msg) => dispatch({ type: 'SET_STATUS_MESSAGE', payload: msg }),
        clauseIdsToUse,
        domain
      );
      // Save to history unconditionally and capture generated ID
      const savedId = await storageService.saveAnalysis(clientName, result, selectedClient?.id);

      if (savedId) {
        result.id = savedId;
        dispatch({ type: 'SET_REPORT', payload: { ...result, id: savedId } });
      } else {
        dispatch({ type: 'SET_REPORT', payload: result });
      }

      dispatch({ type: 'SET_STATUS', payload: AppStatus.COMPLETED });
      setCurrentView('REPORT');
    } catch (error: unknown) {
      console.error(error);
      dispatch({ type: 'SET_STATUS_MESSAGE', payload: '' }); // Clear status
      dispatch({ type: 'SET_STATUS', payload: AppStatus.ERROR });
      // Extract clean message
      const msg = error instanceof Error ? error.message : 'Hubo un problema desconocido.';
      dispatch({ type: 'SET_ERROR_MESSAGE', payload: msg });
    }
  };

  const handleReset = () => {
    reset();
    setChatOpen(false);
    // Don't change view here if we are just resetting for a new analysis within the tool
    if (currentView === 'REPORT') setCurrentView('ANALYZER');
  };

  const handleRetry = () => {
    dispatch({ type: 'SET_ERROR_MESSAGE', payload: '' });
    dispatch({ type: 'SET_STATUS_MESSAGE', payload: '' });
    dispatch({ type: 'SET_STATUS', payload: AppStatus.IDLE });
  };

  const handleViewExistingReport = (existingReport: ReportType) => {
    dispatch({ type: 'SET_REPORT', payload: existingReport });
    dispatch({ type: 'SET_STATUS', payload: AppStatus.COMPLETED });
    setCurrentView('REPORT');
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
        onLoginSuccess={handleLogin}
        onRegisterClick={() => setCurrentView('REGISTER')}
      />
    );
  }

  if (currentView === 'REGISTER') {
    return (
      <RegisterScreen
        onRegisterSuccess={handleLogin}
        onBackToLogin={() => setCurrentView('LOGIN')}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans selection:bg-indigo-100 selection:text-indigo-900">
      {/* App Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-2 cursor-pointer" onClick={navigateToDashboard}>
            <div className="bg-indigo-600 p-2 rounded-lg">
              <ShieldCheck className="text-white w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-700 to-indigo-500 leading-tight hidden sm:block">
                Agente Comparador CSA
              </h1>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            {currentUser && (
              <div
                onClick={() => setShowProfile(true)}
                className="hidden md:flex items-center px-3 py-1 bg-slate-100 rounded-full cursor-pointer hover:bg-slate-200 transition-colors"
              >
                <img
                  src={currentUser.avatarUrl}
                  alt="Avatar"
                  className="w-6 h-6 rounded-full mr-2"
                />
                <span className="text-sm font-medium text-slate-700">{currentUser.name}</span>
              </div>
            )}

            {currentView !== 'DASHBOARD' && (
              <button
                onClick={navigateToDashboard}
                className="p-2 text-slate-500 hover:bg-slate-100 rounded-full transition-colors"
                title="Ir al Dashboard"
              >
                <LayoutDashboard size={20} />
              </button>
            )}

            {/* Clientes & Auditorías Correlacionadas */}
            <button
              onClick={() => setCurrentView('CLIENTS')}
              className={`p-2 rounded-full transition-colors ${
                currentView === 'CLIENTS'
                  ? 'bg-indigo-100 text-indigo-700 font-semibold'
                  : 'text-slate-500 hover:bg-indigo-100 hover:text-indigo-600'
              }`}
              title="Gestión de Clientes y Auditorías"
            >
              <Users size={20} />
            </button>

            {/* Analítica Ejecutiva (RBAC) */}
            <button
              onClick={() => setCurrentView('ANALYTICS')}
              className={`p-2 rounded-full transition-colors ${
                currentView === 'ANALYTICS'
                  ? 'bg-indigo-100 text-indigo-700 font-semibold'
                  : 'text-slate-500 hover:bg-indigo-100 hover:text-indigo-600'
              }`}
              title="Analítica Ejecutiva (KPIs)"
            >
              <BarChart3 size={20} />
            </button>

            {/* Gestión de Usuarios & Aliados (RBAC) */}
            <button
              onClick={() => setCurrentView('USERS')}
              className={`p-2 rounded-full transition-colors ${
                currentView === 'USERS'
                  ? 'bg-indigo-100 text-indigo-700 font-semibold'
                  : 'text-slate-500 hover:bg-indigo-100 hover:text-indigo-600'
              }`}
              title="Gestión de Usuarios y Aliados (RBAC)"
            >
              <ShieldCheck size={20} />
            </button>

            {/* Clause Library Button (Admin) */}
            <button
              onClick={() => setShowClauseAdmin(true)}
              className="p-2 text-slate-500 hover:bg-indigo-100 hover:text-indigo-600 rounded-full transition-colors"
              title="Biblioteca de Clausulados"
            >
              <Library size={20} />
            </button>

            {(status === AppStatus.COMPLETED || report) && (
              <button
                onClick={() => setChatOpen(!chatOpen)}
                className={`flex items-center space-x-2 px-3 py-2 rounded-lg transition-colors font-medium text-sm ${
                  chatOpen
                    ? 'bg-indigo-600 text-white'
                    : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
                }`}
              >
                <MessageSquare size={18} />
                <span className="hidden sm:inline">SeguroBot</span>
              </button>
            )}

            <button
              onClick={handleLogout}
              className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
              title="Cerrar Sesión"
            >
              <LogOut size={20} />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* VIEW: CLIENTS */}
        {currentView === 'CLIENTS' && (
          <Suspense
            fallback={
              <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
              </div>
            }
          >
            <ClientManager
              onSelectClientForAudit={(client) => {
                dispatch({ type: 'SET_SELECTED_CLIENT', payload: client });
                setCurrentView('ANALYZER');
              }}
              onViewReport={(rep) => {
                dispatch({ type: 'SET_REPORT', payload: rep });
                setCurrentView('REPORT');
              }}
            />
          </Suspense>
        )}

        {/* VIEW: DASHBOARD */}
        {currentView === 'DASHBOARD' && (
          <Suspense
            fallback={
              <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
              </div>
            }
          >
            <TechnicalDashboard
              onNewAnalysis={() => setCurrentView('ANALYZER')}
              onViewReport={handleViewExistingReport}
            />
          </Suspense>
        )}

        {/* VIEW: ANALYTICS (RBAC) */}
        {currentView === 'ANALYTICS' && (
          <Suspense
            fallback={
              <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
              </div>
            }
          >
            <ExecutiveAnalytics onBackToDashboard={() => setCurrentView('DASHBOARD')} />
          </Suspense>
        )}

        {/* VIEW: USERS (RBAC Management) */}
        {currentView === 'USERS' && (
          <Suspense
            fallback={
              <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
              </div>
            }
          >
            <UserManagement
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
          <>
            {/* Intro */}
            {status === AppStatus.IDLE && (
              <div className="text-center mb-8 max-w-2xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
                <h2 className="text-3xl font-bold text-slate-900 mb-3 tracking-tight">
                  Nueva Comparación de Seguros
                </h2>
                <p className="text-slate-600">
                  Selecciona el cliente, el ramo de seguro y carga los documentos para iniciar la
                  comparación.
                </p>
              </div>
            )}

            {/* Config & Upload Section */}
            {status === AppStatus.IDLE && (
              <div className="max-w-5xl mx-auto animate-in zoom-in-95 duration-500 space-y-6">
                {/* 1. Selection of Domain and Client */}
                <div className="space-y-4">
                  <DomainSelector
                    selectedDomain={domain}
                    onChange={(newDomain: InsuranceDomainType) =>
                      dispatch({ type: 'SET_DOMAIN', payload: newDomain })
                    }
                  />

                  <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                    <ClientSelector
                      selectedClient={selectedClient}
                      onSelectClient={(client) => {
                        dispatch({ type: 'SET_SELECTED_CLIENT', payload: client });
                        setClientSelectorOpen(false);
                      }}
                      isOpen={clientSelectorOpen}
                      onOpenChange={setClientSelectorOpen}
                      activeDomain={domain}
                    />
                  </div>
                </div>

                {/* 2. File Uploaders */}
                <div
                  className={`bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden transition-all duration-300 ${!selectedClient ? 'opacity-50 grayscale pointer-events-none' : 'opacity-100'}`}
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-100">
                    {/* Left: Quotes */}
                    <div className="p-8">
                      <FileUploader
                        title="1. Cotizaciones de Aseguradoras"
                        description="Carga aquí las ofertas y proposiciones (PDF)."
                        files={quoteFiles}
                        onFilesSelected={handleQuotesSelected}
                        onRemoveFile={handleRemoveQuote}
                        variant="primary"
                        disabled={!selectedClient}
                        onFocusClientSelection={() => setClientSelectorOpen(true)}
                      />
                    </div>

                    {/* Right: Clauses */}
                    <div className="p-8 bg-slate-50/50">
                      <ClauseSelector
                        mode={clauseMode}
                        onModeChange={(mode) =>
                          dispatch({ type: 'SET_CLAUSE_MODE', payload: mode })
                        }
                        onClausesSelected={(ids) =>
                          dispatch({ type: 'SET_SELECTED_CLAUSE_IDS', payload: ids })
                        }
                      />

                      {/* Show file uploader only in upload mode */}
                      {clauseMode === 'upload' && (
                        <div className="mt-4">
                          <FileUploader
                            title=""
                            description="Arrastra PDFs de clausulados aquí"
                            files={clauseFiles}
                            onFilesSelected={handleClausesSelected}
                            onRemoveFile={handleRemoveClause}
                            variant="secondary"
                            icon={<BookOpen className="w-6 h-6 text-slate-600" />}
                            disabled={!selectedClient}
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end">
                    <button
                      onClick={handleAnalyze}
                      disabled={quoteFiles.length === 0 || !selectedClient}
                      className="group relative flex items-center justify-center space-x-2 bg-indigo-600 text-white px-8 py-3 rounded-full font-semibold shadow-lg shadow-indigo-200 hover:bg-indigo-700 disabled:opacity-50 disabled:shadow-none disabled:cursor-not-allowed transition-all w-full md:w-auto overflow-hidden"
                    >
                      <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
                      <Sparkles size={20} className="relative z-10" />
                      <span className="relative z-10">
                        {clauseMode === 'library' && selectedClauseIds.length > 0
                          ? `Comparar (${selectedClauseIds.length} clausulados biblioteca)`
                          : clauseFiles.length > 0
                            ? `Comparar con ${clauseFiles.length} referencias`
                            : 'Comparar Cotizaciones'}
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Loading State with Progress Bar & Pipeline Steps */}
            {status === AppStatus.ANALYZING && (
              <div className="max-w-2xl mx-auto text-center py-12 px-4 animate-in fade-in duration-300">
                <div className="relative w-24 h-24 mx-auto mb-6">
                  <div className="absolute inset-0 border-4 border-indigo-100 rounded-full"></div>
                  <div className="absolute inset-0 border-4 border-indigo-600 rounded-full border-t-transparent animate-spin"></div>
                  <Activity
                    className="absolute inset-0 m-auto text-indigo-600 animate-pulse"
                    size={32}
                  />
                </div>

                <h3 className="text-2xl font-bold text-slate-800 mb-2">
                  Comparando Clausulados y Cotizaciones...
                </h3>
                <p className="text-slate-600 mb-6">
                  Procesando análisis técnico para{' '}
                  <strong>{selectedClient?.name || 'Cliente'}</strong>.
                </p>

                {/* Status Message */}
                <div className="mb-4 p-3 bg-indigo-50 border border-indigo-100 rounded-xl text-indigo-800 font-medium text-sm">
                  {statusMessage || 'Ejecutando motor de reconciliación ontológica...'}
                </div>

                {/* Progress Steps (Technical Natural Language Pipeline) */}
                <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm mb-6 text-left space-y-3">
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Etapas del Análisis Técnico
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                    <div className="flex items-center space-x-2 text-slate-700">
                      <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                      <span>1. Extracción OCR Multimodal y Estructuración PDF</span>
                    </div>
                    <div className="flex items-center space-x-2 text-slate-700">
                      <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></div>
                      <span>2. Normalización Ontológica (Gemini 3.5)</span>
                    </div>
                    <div className="flex items-center space-x-2 text-slate-700">
                      <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></div>
                      <span>3. Matriz de Coberturas y Reconciliación de Deducibles</span>
                    </div>
                    <div className="flex items-center space-x-2 text-slate-700">
                      <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></div>
                      <span>4. Evaluador de Riesgos y Scoring Multidimensional</span>
                    </div>
                  </div>
                </div>

                {/* Progress Bar (Indeterminate) */}
                <div className="w-full bg-slate-200 rounded-full h-2.5 mb-6 overflow-hidden">
                  <div
                    className="bg-indigo-600 h-2.5 rounded-full animate-progress"
                    style={{ width: '100%' }}
                  ></div>
                </div>

                <div className="inline-flex items-center px-4 py-2 bg-slate-100 text-slate-700 rounded-full text-xs font-semibold">
                  <Sparkles size={14} className="mr-2 text-indigo-600" />
                  Motor IA Gemini 3.5 • Supabase PGVector 3072d • Prevalencia Técnica
                </div>
              </div>
            )}

            {/* Error State */}
            {status === AppStatus.ERROR && (
              <div className="max-w-lg mx-auto text-center py-10 bg-white rounded-2xl shadow-lg border border-red-100 p-8">
                <div className="bg-red-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-red-600">
                  <Activity size={32} />
                </div>
                <h3 className="text-xl font-bold text-slate-800 mb-2">Error en el análisis</h3>
                <p className="text-slate-500 mb-6">
                  {errorMessage || 'Hubo un problema al procesar los archivos.'}
                </p>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                  <button
                    onClick={handleRetry}
                    className="w-full sm:w-auto px-6 py-2.5 bg-indigo-600 text-white rounded-full font-semibold shadow hover:bg-indigo-700 transition-colors"
                  >
                    Reintentar comparación
                  </button>
                  <button
                    onClick={handleReset}
                    className="w-full sm:w-auto px-4 py-2.5 text-slate-500 font-medium hover:text-slate-700 transition-colors"
                  >
                    Nueva Comparación
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {/* VIEW: REPORT */}
        {currentView === 'REPORT' && report && (
          <div>
            <div className="flex justify-between items-center mb-6">
              <button
                onClick={() => setCurrentView('DASHBOARD')}
                className="text-sm text-slate-500 hover:text-indigo-600 font-medium px-4 py-2 rounded-lg hover:bg-slate-100 transition-colors flex items-center"
              >
                <LayoutDashboard size={16} className="mr-2" />
                Volver al Dashboard
              </button>
              <button
                onClick={handleReset}
                className="text-sm text-white bg-indigo-600 px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
              >
                Nueva Auditoría
              </button>
            </div>
            <Suspense
              fallback={
                <div className="flex items-center justify-center h-64">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
                </div>
              }
            >
              <ComparisonReport
                report={report}
                onUpdateReport={(updatedReport) =>
                  dispatch({ type: 'SET_REPORT', payload: updatedReport })
                }
              />
            </Suspense>
          </div>
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
          <ClauseAdmin onClose={() => setShowClauseAdmin(false)} />
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
