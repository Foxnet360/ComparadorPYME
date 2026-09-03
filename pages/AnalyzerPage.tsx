import React from 'react';
import { Sparkles, BookOpen, Activity } from 'lucide-react';
import FileUploader from '../components/FileUploader';
import DomainSelector from '../components/DomainSelector';
import ClientSelector from '../components/ClientSelector';
import { ClauseSelector } from '../components/ClauseSelector';
import { useAnalysisFlow } from '../hooks/useAnalysisFlow';
import { useUI } from '../contexts/UIContext';
import { AppStatus } from '../types';
import type { InsuranceDomainType } from '../types';

interface AnalyzerPageProps {
  onAnalysisComplete: () => void;
}

const AnalyzerPage: React.FC<AnalyzerPageProps> = ({ onAnalysisComplete }) => {
  const {
    state,
    dispatch,
    addQuoteFiles,
    removeQuoteFile,
    addClauseFiles,
    removeClauseFile,
    analyze,
    resetFlow,
    retry,
  } = useAnalysisFlow();
  const { clientSelectorOpen, setClientSelectorOpen } = useUI();

  const {
    status,
    selectedClient,
    quoteFiles,
    clauseFiles,
    clauseMode,
    selectedClauseIds,
    domain,
    statusMessage,
    errorMessage,
  } = state;

  const handleAnalyze = async () => {
    const nextView = await analyze();
    if (nextView === 'REPORT') onAnalysisComplete();
  };

  return (
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
                  onFilesSelected={addQuoteFiles}
                  onRemoveFile={removeQuoteFile}
                  variant="primary"
                  disabled={!selectedClient}
                  onFocusClientSelection={() => setClientSelectorOpen(true)}
                />
              </div>

              {/* Right: Clauses */}
              <div className="p-8 bg-slate-50/50">
                <ClauseSelector
                  mode={clauseMode}
                  onModeChange={(mode) => dispatch({ type: 'SET_CLAUSE_MODE', payload: mode })}
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
                      onFilesSelected={addClauseFiles}
                      onRemoveFile={removeClauseFile}
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
            <Activity className="absolute inset-0 m-auto text-indigo-600 animate-pulse" size={32} />
          </div>

          <h3 className="text-2xl font-bold text-slate-800 mb-2">
            Comparando Clausulados y Cotizaciones...
          </h3>
          <p className="text-slate-600 mb-6">
            Procesando análisis técnico para <strong>{selectedClient?.name || 'Cliente'}</strong>.
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
              onClick={retry}
              className="w-full sm:w-auto px-6 py-2.5 bg-indigo-600 text-white rounded-full font-semibold shadow hover:bg-indigo-700 transition-colors"
            >
              Reintentar comparación
            </button>
            <button
              onClick={resetFlow}
              className="w-full sm:w-auto px-4 py-2.5 text-slate-500 font-medium hover:text-slate-700 transition-colors"
            >
              Nueva Comparación
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default AnalyzerPage;
