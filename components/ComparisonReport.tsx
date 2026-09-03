import React, { useState } from 'react';
import {
  BarChart3,
  ShieldAlert,
  Scale,
  Layers,
  BookOpen,
} from 'lucide-react';
import { DISCLAIMER_TEXT } from '../constants';
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
import type { ComparisonReport as ReportType } from '../types';

interface ComparisonReportProps {
  report: ReportType;
  onUpdateReport?: (updatedReport: ReportType) => void;
}

const ComparisonReport: React.FC<ComparisonReportProps> = ({
  report: initialReport,
  onUpdateReport,
}) => {
  const { report, handleApplyCorrection } = useReportCorrections(initialReport, onUpdateReport);

  const [activeTab, setActiveTab] = useState<
    'resumen' | 'coberturas' | 'deducibles' | 'auditoria' | 'analisis-avanzado'
  >('resumen');

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
        exportModal={
          showExportModal && (
            <ExportModal
              report={report}
              pdfOptions={pdfOptions}
              onPdfOptionsChange={setPdfOptions}
              cellNotes={cellNotes}
              onClose={closeExportModal}
            />
          )
        }
      />

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
          <span>Evaluación de Riesgos</span>
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
          onCorrection={(q, correction) => handleApplyCorrection(q.id || q.insurerName, correction)}
          onNavigate={setActiveTab}
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
            domain={(report as any).domain}
          />
        </div>
      )}

      {/* --- TAB CONTENT: DEDUCIBLES --- */}
      {activeTab === 'deducibles' && (
        <div className="animate-in fade-in duration-300 space-y-6">
          {/* Deductible Matrix - Structured Comparison */}
          <DeductibleMatrix quotes={report.quotes} />
        </div>
      )}

      {/* --- TAB CONTENT: AUDITORIA (ALERTS) --- */}
      {activeTab === 'auditoria' && <AuditSection quotes={report.quotes} viewMode={viewMode} />}

      {/* --- TAB CONTENT: ANÁLISIS AVANZADO --- */}
      {activeTab === 'analisis-avanzado' && hasAdvancedAnalysis && (
        <AdvancedAnalysisTab quotes={report.quotes} />
      )}

      {/* Footer */}
      <div className="text-center py-6 border-t border-slate-200 mt-8">
        <p className="text-xs text-slate-400 max-w-4xl mx-auto leading-relaxed">
          {DISCLAIMER_TEXT}
        </p>
      </div>
    </div>
  );
};

export default ComparisonReport;
