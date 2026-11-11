import React, { useState, useEffect } from 'react';
import { BarChart3, ShieldAlert, Scale, Layers, BookOpen, Building2, Phone, Mail, Globe, ShieldCheck } from 'lucide-react';
import { DISCLAIMER_TEXT } from '../constants';
import { storageService } from '../services/storageService';
import { AuditSection } from './AuditSection';
import { UnifiedCoverageMatrix } from './UnifiedCoverageMatrix';
import { DeductibleMatrix } from './DeductibleMatrix';
import { AdvancedAnalysisTab } from './report/AdvancedAnalysisTab';
import ExportModal from './report/ExportModal';
import { ReportAlerts } from './report/ReportAlerts';
import { ReportHeader } from './report/ReportHeader';
import { SummaryTab } from './report/SummaryTab';
import { useReportCorrections } from '../hooks/useReportCorrections';
import { usePdfExport } from '../hooks/usePdfExport';
import { isAdvancedAnalysisEnabled } from '../config/features';
import { useCellNotes } from '../contexts/AnalysisContext';
import { ClaimSimulatorPanel } from './report/ClaimSimulatorPanel';
import { PromoteQuoteModal } from './report/PromoteQuoteModal';
import type { ComparisonReport as ReportType, QuoteAnalysis } from '../types';

// Renewal-mode (schemaVersion 3) extras: lazy-loaded so the NEW-mode bundle
// stays lean; only mounted for v3 reports, keeping v1/v2 output identical (XC-3).
const RenewalAnalysisSection = React.lazy(() => import('./report/RenewalAnalysisSection'));

interface ComparisonReportProps {
  report: ReportType;
  onUpdateReport?: (updatedReport: ReportType) => void;
  onOpenPortfolio?: () => void;
  initialTab?: 'resumen' | 'coberturas' | 'deducibles' | 'auditoria' | 'analisis-avanzado';
}

const ComparisonReport: React.FC<ComparisonReportProps> = ({
  report: initialReport,
  onUpdateReport,
  onOpenPortfolio,
  initialTab = 'resumen',
}) => {
  const { report, handleApplyCorrection } = useReportCorrections(initialReport, onUpdateReport);

  const initialActiveTab = (() => {
    if (typeof window !== 'undefined') {
      const tabParam = new URLSearchParams(window.location.search).get('reportTab');
      if (tabParam && ['resumen', 'coberturas', 'deducibles', 'auditoria', 'analisis-avanzado'].includes(tabParam)) {
        return tabParam as 'resumen' | 'coberturas' | 'deducibles' | 'auditoria' | 'analisis-avanzado';
      }
    }
    return initialTab;
  })();

  const [activeTab, setActiveTab] = useState<
    'resumen' | 'coberturas' | 'deducibles' | 'auditoria' | 'analisis-avanzado'
  >(initialActiveTab);

  // Promotion modal state
  const [promoteQuote, setPromoteQuote] = useState<QuoteAnalysis | null>(null);
  const [promoteQuoteIndex, setPromoteQuoteIndex] = useState<number>(0);

  // Get cell notes from context
  const { cellNotes } = useCellNotes();

  const { pdfOptions, setPdfOptions, showExportModal, openExportModal, closeExportModal } =
    usePdfExport();

  // Dynamic view mode toggle (Auditor Técnico vs Cliente Final)
  const [viewMode, setViewMode] = useState<'technical' | 'client'>('technical');

  // Broker & Intermediary contact details for footer
  const [brokerDetails, setBrokerDetails] = useState<{
    name: string;
    advisor: string;
    phone: string;
    email: string;
    website: string;
    registration: string;
  }>({
    name: 'Corredores de Seguros Asociados S.A.',
    advisor: 'Asesor Técnico de Seguros',
    phone: '+57 (601) 345-6789',
    email: 'soporte@comparadorcsa.com',
    website: 'https://correseguros.co/',
    registration: 'Inscripción Vigente SFC',
  });

  useEffect(() => {
    storageService
      .getCurrentUser()
      .then((user) => {
        if (user) {
          setBrokerDetails({
            name: user.intermediaryName || user.agencyName || 'Corredores de Seguros Asociados S.A.',
            advisor: user.name || 'Asesor Técnico de Seguros',
            phone: user.agentDetails?.phone || user.phone || '+57 (601) 345-6789',
            email: user.email || 'soporte@comparadorcsa.com',
            website: 'https://correseguros.co/',
            registration:
              user.registrationNumber ||
              user.agentDetails?.registrationNumber ||
              'Inscripción Vigente SFC',
          });
        }
      })
      .catch(() => {});
  }, []);

  if (!report.quotes || report.quotes.length === 0) {
    return (
      <div className="text-center p-8 text-slate-500">
        No se encontraron detalles de cotizaciones en el análisis.
      </div>
    );
  }

  const bestQuote = report.quotes.reduce(
    (prev, current) => ((prev.score || 0) > (current.score || 0) ? prev : current),
    report.quotes[0]!
  );

  // Check if advanced analysis is enabled via feature flag and any quote has data
  const hasAdvancedAnalysis =
    isAdvancedAnalysisEnabled() &&
    report.quotes.some(
      (q) =>
        q.clauseValidation ||
        q.deductibleAnalysis ||
        q.contextualRisk ||
        q.warrantyCompliance ||
        q.legalOpinion
    );

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <ReportAlerts quotes={report.quotes} />

      <ReportHeader
        domain={report.domain}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        onExport={openExportModal}
        exportModal={
          showExportModal && (
            <ExportModal
              report={report}
              pdfOptions={pdfOptions}
              onPdfOptionsChange={setPdfOptions}
              cellNotes={cellNotes}
              onClose={closeExportModal}
              onUpdateReport={onUpdateReport}
            />
          )
        }
      />

      {/* Renewal mode (schemaVersion 3): baseline badge + gap/delta panels (R2.2–R2.5) */}
      {report.schemaVersion === 3 && (
        <React.Suspense fallback={null}>
          <RenewalAnalysisSection baseline={report.baseline} analytics={report.renewalAnalytics} />
        </React.Suspense>
      )}

      {/* Tabs Navigation */}
      <div className="flex overflow-x-auto pb-2 border-b border-slate-200 gap-6">
        <button
          onClick={() => setActiveTab('resumen')}
          className={`flex items-center space-x-2 pb-2 px-1 text-sm font-medium border-b-2 transition-colors ${activeTab === 'resumen' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
        >
          <BarChart3 size={18} />
          <span>Dashboard Resumen</span>
        </button>
        <button
          onClick={() => setActiveTab('coberturas')}
          className={`flex items-center space-x-2 pb-2 px-1 text-sm font-medium border-b-2 transition-colors ${activeTab === 'coberturas' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
        >
          <Layers size={18} />
          <span>Matriz de Coberturas</span>
        </button>
        <button
          onClick={() => setActiveTab('deducibles')}
          className={`flex items-center space-x-2 pb-2 px-1 text-sm font-medium border-b-2 transition-colors ${activeTab === 'deducibles' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
        >
          <Scale size={18} />
          <span>Deducibles</span>
        </button>
        <button
          onClick={() => setActiveTab('auditoria')}
          className={`flex items-center space-x-2 pb-2 px-1 text-sm font-medium border-b-2 transition-colors ${activeTab === 'auditoria' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
        >
          <ShieldAlert size={18} />
          <span>Análisis de Letra Chica y Brechas</span>
        </button>
        {hasAdvancedAnalysis && (
          <button
            onClick={() => setActiveTab('analisis-avanzado')}
            className={`flex items-center space-x-2 pb-2 px-1 text-sm font-medium border-b-2 transition-colors ${activeTab === 'analisis-avanzado' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
          >
            <BookOpen size={18} />
            <span>Análisis Avanzado</span>
          </button>
        )}
      </div>

      {/* --- TAB CONTENT: RESUMEN (DASHBOARD) --- */}
      {activeTab === 'resumen' && (
        <SummaryTab
          quotes={report.quotes}
          bestQuote={bestQuote}
          recommendation={report.recommendation}
          viewMode={viewMode}
          domain={report.domain}
          perQuoteCompliance={report.regulatoryBacking?.perQuoteCompliance}
          onCorrection={(q, correction) => handleApplyCorrection(q.id || q.insurerName, correction)}
          onNavigate={setActiveTab}
          onPromoteQuote={(q) => {
            const idx = report.quotes.findIndex((quote) => quote.insurerName === q.insurerName);
            setPromoteQuote(q);
            setPromoteQuoteIndex(idx >= 0 ? idx : 0);
          }}
        />
      )}

      {/* --- TAB CONTENT: COBERTURAS --- */}
      {activeTab === 'coberturas' && (
        <div className="animate-in fade-in duration-300">
          <UnifiedCoverageMatrix
            quotes={report.quotes}
            rows={report.matrix}
            metadata={report.quoteMetadata}
            viewMode={viewMode}
            analysisId={report.id}
            schemaVersion={report.schemaVersion}
            domain={report.domain}
          />
        </div>
      )}

      {/* --- TAB CONTENT: DEDUCIBLES --- */}
      {activeTab === 'deducibles' && (
        <div className="animate-in fade-in duration-300 space-y-6">
          {/* Claim Simulator Panel - Interactive calculation */}
          <ClaimSimulatorPanel quotes={report.quotes} />

          {/* Deductible Matrix - Structured Comparison */}
          <DeductibleMatrix
            quotes={report.quotes}
            matrix={report.matrix}
            metadata={report.quoteMetadata}
          />
        </div>
      )}

      {/* --- TAB CONTENT: AUDITORIA (ALERTS) --- */}
      {activeTab === 'auditoria' && <AuditSection quotes={report.quotes} viewMode={viewMode} />}

      {/* --- TAB CONTENT: ANÁLISIS AVANZADO --- */}
      {activeTab === 'analisis-avanzado' && hasAdvancedAnalysis && (
        <AdvancedAnalysisTab quotes={report.quotes} />
      )}

      {/* Modal de Promoción de Póliza a Portafolio */}
      {promoteQuote && (
        <PromoteQuoteModal
          isOpen={true}
          onClose={() => setPromoteQuote(null)}
          analysisId={report.id}
          quoteIndex={promoteQuoteIndex}
          quote={promoteQuote}
          domain={report.domain}
          initialClientName={report.clientInfo?.name}
          onOpenPortfolio={onOpenPortfolio}
        />
      )}

      {/* Footer */}
      <footer className="mt-12 pt-8 border-t border-slate-200">
        <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-6 mb-6 shadow-xs">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200/60">
            <div>
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-indigo-600" />
                <h4 className="font-bold text-slate-800 text-sm">{brokerDetails.name}</h4>
                <span className="text-[11px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full font-medium border border-indigo-100">
                  {brokerDetails.registration}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Asesor Responsable: <strong className="text-slate-700">{brokerDetails.advisor}</strong> · Vigilado por la Superintendencia Financiera de Colombia
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600">
              <a
                href={brokerDetails.website}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 hover:text-indigo-600 font-medium transition-colors"
              >
                <Globe className="w-4 h-4 text-slate-400" />
                <span>correseguros.co</span>
              </a>
              <a
                href={`tel:${brokerDetails.phone.replace(/[^0-9+]/g, '')}`}
                className="flex items-center gap-1.5 hover:text-indigo-600 font-medium transition-colors"
              >
                <Phone className="w-4 h-4 text-slate-400" />
                <span>{brokerDetails.phone}</span>
              </a>
              <a
                href={`mailto:${brokerDetails.email}`}
                className="flex items-center gap-1.5 hover:text-indigo-600 font-medium transition-colors"
              >
                <Mail className="w-4 h-4 text-slate-400" />
                <span>{brokerDetails.email}</span>
              </a>
            </div>
          </div>
          <div className="pt-3 flex flex-col sm:flex-row sm:items-center justify-between text-[11px] text-slate-500 gap-2">
            <span>Acompañamiento técnico permanente y radicación de siniestros.</span>
            <span className="text-slate-400">Intermediación regulada por el Estatuto Orgánico del Sistema Financiero</span>
          </div>
        </div>

        <p className="text-xs text-slate-400 max-w-4xl mx-auto leading-relaxed text-center">
          {DISCLAIMER_TEXT}
        </p>
      </footer>
    </div>
  );
};

export default ComparisonReport;
