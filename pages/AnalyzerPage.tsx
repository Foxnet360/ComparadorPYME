import React from 'react';
import { Sparkles, BookOpen, Activity } from 'lucide-react';
import FileUploader from '../components/FileUploader';
import DomainSelector from '../components/DomainSelector';
import ClientSelector from '../components/ClientSelector';
import { ClauseSelector, type CumplimientoProcessStage } from '../components/ClauseSelector';
import { RegulatoryBackingPanel } from '../components/report/RegulatoryBackingPanel';
import { useAnalysisFlow } from '../hooks/useAnalysisFlow';
import { useUI } from '../contexts/UIContext';
import { AppStatus, InsuranceDomain } from '../types';
import type { InsuranceDomainType } from '../types';

interface AnalyzerPageProps {
  onAnalysisComplete: () => void;
}

const CUMPLIMIENTO_STAGES: Array<{
  id: CumplimientoProcessStage;
  label: string;
  badge: string;
  description: string;
}> = [
  {
    id: 'AUTO',
    label: 'Automático (IA)',
    badge: 'Detección Inteligente',
    description:
      'El motor identifica automáticamente si las cotizaciones corresponden a Seriedad de la Oferta (Licitación) o a Garantía Única de Ejecución (Contrato / Otrosí), evitando falsos incumplimientos entre etapas.',
  },
  {
    id: 'LICITACION',
    label: '1. Licitación / Pliego',
    badge: 'Precontractual · Seriedad',
    description:
      'Compara contra el Pliego de Condiciones y Adendas: verifica Seriedad de la Oferta (mín. 10% Decreto 1082 Art. 2.2.1.2.3.1.9 o 1.000 SMMLV), vigencia exacta desde la fecha de cierre, NIT del Consorcio/UT y cupo/pagaré.',
  },
  {
    id: 'CONTRATO',
    label: '2. Contrato / Minuta',
    badge: 'Contractual · Ejecución + RCE',
    description:
      'Compara contra la Minuta del Contrato: verifica suficiencia % (Cumplimiento 10-20%, Anticipo 100%, Salarios >=5% + 3 años, Estabilidad + 5 años), RCE Derivada en SMMLV (Ocurrencia/Patronal/Cruzada), régimen Ley 80 vs. Particular, tasas y contragarantía.',
  },
  {
    id: 'OTROSI',
    label: '3. Otrosí / Modificación',
    badge: 'Adición · Prórroga · Suspensión',
    description:
      'Compara contra el Otrosí o Acta Modificatoria: audita el ajuste proporcional de sumas aseguradas por Adición en valor y el desplazamiento cronológico de vigencias post-contractuales (+3 años Salarios, +5 años Estabilidad).',
  },
];

const AnalyzerPage: React.FC<AnalyzerPageProps> = ({ onAnalysisComplete }) => {
  const [cumplimientoStage, setCumplimientoStage] =
    React.useState<CumplimientoProcessStage>('AUTO');
  const {
    state,
    dispatch,
    addQuoteFiles,
    removeQuoteFile,
    addClauseFiles,
    removeClauseFile,
    analyze,
    cancelAnalysis,
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
    progressPercent,
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

            {/* Inyección de Tesauro y Respaldo Normativo Colombiano por Ramo */}
            <RegulatoryBackingPanel domain={domain} compact={true} />

            {/* Selector de Momento Contractual exclusivo para Cumplimiento y Fianzas */}
            {domain === InsuranceDomain.CUMPLIMIENTO && (
              <div
                className="bg-white p-5 rounded-2xl border border-indigo-200 shadow-sm space-y-3"
                data-testid="cumplimiento-stage-selector"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-indigo-700">
                      Momento del Proceso Contractual y Documento Rector (Cumplimiento y Fianzas)
                    </span>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Selecciona contra qué documento rector estás auditando las cotizaciones para
                      ajustar las reglas de suficiencia (%) y vigencias
                    </p>
                  </div>
                  <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 self-start sm:self-auto">
                    {CUMPLIMIENTO_STAGES.find((s) => s.id === cumplimientoStage)?.badge}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                  {CUMPLIMIENTO_STAGES.map((stage) => {
                    const isSelected = cumplimientoStage === stage.id;
                    return (
                      <button
                        key={stage.id}
                        type="button"
                        onClick={() => setCumplimientoStage(stage.id)}
                        aria-pressed={isSelected}
                        className={`text-left px-3 py-2 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-indigo-50/60 hover:border-indigo-200'
                        }`}
                      >
                        {stage.label}
                      </button>
                    );
                  })}
                </div>

                <div className="p-3 rounded-xl bg-indigo-50/70 border border-indigo-100 text-xs text-indigo-950">
                  {CUMPLIMIENTO_STAGES.find((s) => s.id === cumplimientoStage)?.description}
                </div>
              </div>
            )}

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
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden transition-all duration-300 opacity-100">
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
                  disabled={false}
                  domain={domain}
                  onDomainChange={(newDomain) =>
                    dispatch({ type: 'SET_DOMAIN', payload: newDomain })
                  }
                  onFocusClientSelection={() => setClientSelectorOpen(true)}
                />
              </div>

              {/* Right: Clauses / Governing Document */}
              <div className="p-8 bg-slate-50/50">
                <ClauseSelector
                  mode={clauseMode}
                  domain={domain}
                  cumplimientoStage={
                    domain === InsuranceDomain.CUMPLIMIENTO ? cumplimientoStage : undefined
                  }
                  onModeChange={(mode) => dispatch({ type: 'SET_CLAUSE_MODE', payload: mode })}
                  onClausesSelected={(ids) =>
                    dispatch({ type: 'SET_SELECTED_CLAUSE_IDS', payload: ids })
                  }
                />

                {/* Supplemental uploader: Available in both library and upload mode */}
                {clauseMode === 'library' && (
                  <div className="mt-4 pt-3 border-t border-slate-200/60">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-semibold text-slate-700">
                        {domain === InsuranceDomain.CUMPLIMIENTO
                          ? '¿Deseas anexar el Pliego, la Minuta del Contrato o un clausulado?'
                          : '¿Falta alguna aseguradora en la biblioteca?'}
                      </span>
                      <span className="text-[10px] text-slate-500">
                        {domain === InsuranceDomain.CUMPLIMIENTO
                          ? 'Documento Rector / Clausulado PDF'
                          : 'Carga el PDF complementario'}
                      </span>
                    </div>
                    <FileUploader
                      title=""
                      description={
                        domain === InsuranceDomain.CUMPLIMIENTO
                          ? 'Arrastra aquí el Pliego de Condiciones, Minuta del Contrato, Otrosí o Clausulado PDF'
                          : 'Arrastra aquí el clausulado PDF faltante'
                      }
                      files={clauseFiles}
                      onFilesSelected={addClauseFiles}
                      onRemoveFile={removeClauseFile}
                      variant="secondary"
                      icon={<BookOpen className="w-5 h-5 text-indigo-600" />}
                      disabled={false}
                    />
                  </div>
                )}

                {/* Show file uploader in upload mode */}
                {clauseMode === 'upload' && (
                  <div className="mt-4">
                    <FileUploader
                      title=""
                      description={
                        domain === InsuranceDomain.CUMPLIMIENTO
                          ? 'Arrastra aquí el Pliego de Condiciones, Minuta del Contrato, Otrosí o Clausulados PDF'
                          : 'Arrastra PDFs de clausulados aquí'
                      }
                      files={clauseFiles}
                      onFilesSelected={addClauseFiles}
                      onRemoveFile={removeClauseFile}
                      variant="secondary"
                      icon={<BookOpen className="w-6 h-6 text-slate-600" />}
                      disabled={false}
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="p-6 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
              {!selectedClient ? (
                <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-full flex items-center gap-1.5">
                  <span className="font-semibold">Modo Rápido:</span>
                  <span>Sin cliente asignado (se registrará como cotización de mercado)</span>
                </div>
              ) : (
                <div className="text-xs text-slate-500">
                  Cliente asignado:{' '}
                  <span className="font-semibold text-slate-700">{selectedClient.name}</span>
                </div>
              )}
              <button
                onClick={handleAnalyze}
                disabled={quoteFiles.length === 0}
                className="group relative flex items-center justify-center space-x-2 bg-indigo-600 text-white px-8 py-3 rounded-full font-semibold shadow-lg shadow-indigo-200 hover:bg-indigo-700 disabled:opacity-50 disabled:shadow-none disabled:cursor-not-allowed transition-all w-full sm:w-auto overflow-hidden"
              >
                <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
                <Sparkles size={20} className="relative z-10" />
                <span className="relative z-10">
                  {selectedClauseIds.length > 0 && clauseFiles.length > 0
                    ? `Comparar (${selectedClauseIds.length} biblioteca + ${clauseFiles.length} subido${clauseFiles.length > 1 ? 's' : ''})`
                    : selectedClauseIds.length > 0
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
                <span>2. Normalización Ontológica (Gemini IA)</span>
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

          {/* Progress Bar with real percentage */}
          <div className="mb-6">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-600 mb-1.5">
              <span>Progreso del análisis</span>
              <span>{progressPercent}%</span>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden">
              <div
                className={`bg-indigo-600 h-2.5 rounded-full transition-all duration-300 ${
                  progressPercent === 0 ? 'animate-progress' : ''
                }`}
                style={{ width: `${progressPercent > 0 ? progressPercent : 100}%` }}
              ></div>
            </div>
          </div>

          <div className="flex flex-col items-center gap-4">
            <div className="inline-flex items-center px-4 py-2 bg-slate-100 text-slate-700 rounded-full text-xs font-semibold">
              <Sparkles size={14} className="mr-2 text-indigo-600" />
              Motor IA Gemini • Supabase PGVector 3072d • Prevalencia Técnica
            </div>
            <button
              type="button"
              onClick={cancelAnalysis}
              className="px-4 py-2 rounded-full border border-red-200 bg-white text-red-700 text-xs font-semibold hover:bg-red-50 transition-colors cursor-pointer"
            >
              Cancelar análisis
            </button>
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
