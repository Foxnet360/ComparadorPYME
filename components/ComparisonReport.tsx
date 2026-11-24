import React, { useState } from 'react';
import { DISCLAIMER_TEXT } from '../constants';
import { AuditSection } from './AuditSection';
import { UnifiedCoverageMatrix } from './UnifiedCoverageMatrix';
import { DeductibleMatrix } from './DeductibleMatrix';
import { AdvancedAnalysisTab } from './report/AdvancedAnalysisTab';
import ExportModal from './report/ExportModal';
import { ReportAlerts } from './report/ReportAlerts';
import { ReportHeader } from './report/ReportHeader';
import { ReportTabsNav, REPORT_TABS, type ReportTab } from './report/ReportTabsNav';
import { SummaryTab } from './report/SummaryTab';
import { useReportCorrections } from '../hooks/useReportCorrections';
import { usePdfExport } from '../hooks/usePdfExport';
import { isAdvancedAnalysisEnabled } from '../config/features';
import { useCellNotes } from '../contexts/AnalysisContext';
import { ClaimSimulatorPanel } from './report/ClaimSimulatorPanel';
import { GoverningAuditPanel } from './report/GoverningAuditPanel';
import { PromoteQuoteModal } from './report/PromoteQuoteModal';
import { AddLateQuoteModal } from './report/AddLateQuoteModal';
import { storageService } from '../services/storageService';
import type { ComparisonReport as ReportType, QuoteAnalysis } from '../types';

// Renewal-mode (schemaVersion 3) extras: lazy-loaded so the NEW-mode bundle
// stays lean; only mounted for v3 reports, keeping v1/v2 output identical (XC-3).
const RenewalAnalysisSection = React.lazy(() => import('./report/RenewalAnalysisSection'));

interface ComparisonReportProps {
  report: ReportType;
  onUpdateReport?: (updatedReport: ReportType) => void;
  onOpenPortfolio?: () => void;
  initialTab?: ReportTab;
}

const ComparisonReport: React.FC<ComparisonReportProps> = ({
  report: initialReport,
  onUpdateReport,
  onOpenPortfolio,
  initialTab = 'resumen',
}) => {
  const { report, handleApplyCorrection, replaceReport } = useReportCorrections(
    initialReport,
    onUpdateReport
  );
  const [showAddQuoteModal, setShowAddQuoteModal] = useState(false);

  const initialActiveTab = (() => {
    if (typeof window !== 'undefined') {
      const tabParam = new URLSearchParams(window.location.search).get('reportTab');
      if (tabParam && REPORT_TABS.includes(tabParam as ReportTab)) {
        return tabParam as ReportTab;
      }
    }
    return initialTab;
  })();

  const [activeTab, setActiveTab] = useState<ReportTab>(initialActiveTab);

  // Promotion modal state
  const [promoteQuote, setPromoteQuote] = useState<QuoteAnalysis | null>(null);
  const [promoteQuoteIndex, setPromoteQuoteIndex] = useState<number>(0);

  // Get cell notes from context
  const { cellNotes } = useCellNotes();

  const { pdfOptions, setPdfOptions, showExportModal, openExportModal, closeExportModal } =
    usePdfExport();

  // Dynamic view mode toggle (Auditor Técnico vs Cliente Final)
  const [viewMode, setViewMode] = useState<'technical' | 'client'>('technical');

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
        onAddQuote={report.id ? () => setShowAddQuoteModal(true) : undefined}
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

      {/* Cumplimiento mode: Governing Document (Pliego / Contrato / Otrosí) Audit Panel */}
      {report.governingAudit && <GoverningAuditPanel audit={report.governingAudit} />}

      {/* Tabs Navigation */}
      <ReportTabsNav
        activeTab={activeTab}
        onTabChange={setActiveTab}
        hasAdvancedAnalysis={hasAdvancedAnalysis}
      />

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
            const exactIdx = report.quotes.findIndex(
              (quote) => quote === q || (q.id && quote.id === q.id)
            );
            const idx =
              exactIdx >= 0
                ? exactIdx
                : report.quotes.findIndex((quote) => quote.insurerName === q.insurerName);
            setPromoteQuote(q);
            setPromoteQuoteIndex(idx >= 0 ? idx : 0);
          }}
        />
      )}

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
            perQuoteCompliance={report.regulatoryBacking?.perQuoteCompliance}
          />
        </div>
      )}

      {activeTab === 'deducibles' && (
        <div className="animate-in fade-in duration-300 space-y-6">
          <ClaimSimulatorPanel quotes={report.quotes} />
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

      {/* Modal para adicionar cotizaciones tardías */}
      {showAddQuoteModal && report.id && (
        <AddLateQuoteModal
          analysisId={report.id}
          domain={report.domain}
          existingInsurers={report.quotes.map((q) => q.insurerName)}
          onClose={() => setShowAddQuoteModal(false)}
          onQuotesAppended={(updatedReport) => {
            replaceReport(updatedReport);
            const clientLabel = updatedReport.clientInfo?.name || 'Cliente';
            void storageService.saveAnalysis(clientLabel, updatedReport);
          }}
        />
      )}

      {/* Disclaimer */}
      <div className="text-center py-6 border-t border-slate-200 mt-8">
        <p className="text-xs text-slate-400 max-w-4xl mx-auto leading-relaxed">
          {DISCLAIMER_TEXT}
        </p>
      </div>
    </div>
  );
};

export default ComparisonReport;
