import React, { useState } from 'react';
import { ComparisonReport as ReportType } from '../types';
import {
  Check,
  Award,
  ShieldAlert,
  BarChart3,
  AlertTriangle,
  Scale,
  FileDown,
  Layers,
  BookOpen,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Legend,
} from 'recharts';
import { DISCLAIMER_TEXT } from '../constants';
import { generatePDF } from '../services/pdfService';
import { storageService } from '../services/storageService';

import { AuditSection } from './AuditSection';
import { UnifiedCoverageMatrix } from './UnifiedCoverageMatrix';
import { ExecutiveSummary } from './ExecutiveSummary';
import { CoverageValidationMatrix } from './CoverageValidationMatrix';
import { DeductibleRiskGauge } from './DeductibleRiskGauge';
import { DeductibleMatrix } from './DeductibleMatrix';
import { ContextualExclusionCard } from './ContextualExclusionCard';
import { WarrantyComplianceDashboard } from './WarrantyComplianceDashboard';
import { LegalOpinionCard } from './LegalOpinionCard';
import { NegotiationPointsList } from './NegotiationPointsList';
import { InverseCoverageAlert } from './InverseCoverageAlert';
import { CorrectionUI } from './CorrectionUI';
import { formatCOP, formatCOPMillions } from '../utils/formatCurrency';
import { isAdvancedAnalysisEnabled } from '../config/features';

import { useCellNotes } from '../contexts/AnalysisContext';

interface ComparisonReportProps {
  report: ReportType;
  onUpdateReport?: (updatedReport: ReportType) => void;
}

const ComparisonReport: React.FC<ComparisonReportProps> = ({
  report: initialReport,
  onUpdateReport,
}) => {
  const [report, setReport] = useState<ReportType>(initialReport);

  React.useEffect(() => {
    setReport(initialReport);
  }, [initialReport]);

  const handleApplyCorrection = (
    quoteId: string,
    correction: { field: string; originalValue: string; correctedValue: string }
  ) => {
    setReport((prev) => {
      const updatedQuotes = prev.quotes.map((q) => {
        if (q.id !== quoteId && q.insurerName !== quoteId) return q;
        const updatedQuote = { ...q };

        if (correction.field.startsWith('coverage_')) {
          const covName = correction.field.replace(/^coverage_/, '');
          updatedQuote.coverages = (updatedQuote.coverages || []).map((cov) =>
            cov.name === covName ? { ...cov, value: correction.correctedValue } : cov
          );
        } else if (correction.field === 'deductible') {
          updatedQuote.deductibles = correction.correctedValue;
        } else if (correction.field === 'price_annual') {
          updatedQuote.priceAnnual = Number(correction.correctedValue) || updatedQuote.priceAnnual;
        } else if (correction.field === 'price_monthly') {
          updatedQuote.priceMonthly =
            Number(correction.correctedValue) || updatedQuote.priceMonthly;
        }
        return updatedQuote;
      });

      const nextReport = { ...prev, quotes: updatedQuotes };
      if (onUpdateReport) onUpdateReport(nextReport);
      return nextReport;
    });
  };

  const [activeTab, setActiveTab] = useState<
    'resumen' | 'coberturas' | 'deducibles' | 'auditoria' | 'analisis-avanzado'
  >('resumen');

  // Get cell notes from context
  const { cellNotes } = useCellNotes();

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
  const [showExportModal, setShowExportModal] = useState(false);
  const [pdfOptions, setPdfOptions] = useState<{
    title: string;
    logo?: string;
    color: [number, number, number];
  }>({
    title: 'Reporte Ejecutivo de Seguros',
    color: [79, 70, 229],
  });

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
    report.quotes[0]
  );

  // IVA toggle state
  const [showIva, setShowIva] = useState(false);
  const IVA_RATE = 0.19;

  // Data for Bar Chart (Price)
  const priceData = report.quotes.map((q) => {
    const basePrice = q.priceAnnual || (q.priceMonthly ? q.priceMonthly * 12 : 0);
    return {
      name: (q.insurerName || 'Desconocido').substring(0, 15),
      fullPrice: showIva ? Math.round(basePrice * (1 + IVA_RATE)) : basePrice,
    };
  });

  // Data for Radar Chart (Scoring Dimensions)
  const radarData = [
    { subject: 'Coberturas', fullMark: 10 },
    { subject: 'Deducibles', fullMark: 10 },
    { subject: 'Exclusiones', fullMark: 10 },
    { subject: 'Costo/Beneficio', fullMark: 10 },
    { subject: 'Sublímites', fullMark: 10 },
    { subject: 'Garantías', fullMark: 10 },
  ].map((dim, i) => {
    const dataPoint: Record<string, string | number> = { subject: dim.subject, fullMark: 10 };
    report.quotes.forEach((q) => {
      const bd = q.scoringBreakdown || {
        coverage: 5,
        deductibles: 5,
        exclusions: 5,
        priceRatio: 5,
        sublimits: 5,
        warranties: 5,
      };
      const values = [
        bd.coverage,
        bd.deductibles,
        bd.exclusions,
        bd.priceRatio,
        bd.sublimits,
        bd.warranties,
      ];
      dataPoint[q.insurerName] = values[i] || 5;
    });
    return dataPoint;
  });

  // Colors for charts
  const CHART_COLORS = ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Confidence Banner */}
      {report.quotes.some((q) => q.needsReview) && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="text-amber-600 flex-shrink-0 mt-0.5" size={20} />
          <div>
            <h3 className="font-semibold text-amber-800">Extracción Requiere Revisión</h3>
            <p className="text-sm text-amber-700 mt-1">
              Algunas cotizaciones tienen baja confianza de extracción. Se recomienda verificar los
              datos manualmente.
            </p>
          </div>
        </div>
      )}

      {/* Dual Extraction Discrepancy Alerts */}
      {report.quotes.some((q) => q.dualExtractionValidation?.some((v) => v.isDiscrepancy)) && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="text-red-600 flex-shrink-0 mt-0.5" size={20} />
          <div>
            <h3 className="font-semibold text-red-800">
              Discrepancias Detectadas en Extracción Dual
            </h3>
            <p className="text-sm text-red-700 mt-1">
              Se detectaron diferencias significativas (&gt;20%) entre las extracciones de
              coberturas críticas (Incendio y RC). Por favor verifique los valores manualmente.
            </p>
            <div className="mt-2 space-y-1">
              {report.quotes.map((q, idx) =>
                q.dualExtractionValidation
                  ?.filter((v) => v.isDiscrepancy)
                  .map((v, vIdx) => (
                    <div key={`${idx}-${vIdx}`} className="text-sm text-red-600">
                      <strong>{q.insurerName}</strong> - {v.coverageName}:{' '}
                      {v.discrepancy.toFixed(1)}% de diferencia
                      <br />
                      <span className="text-red-500">
                        Extracción 1: {v.firstExtraction.value} | Extracción 2:{' '}
                        {v.secondExtraction.value}
                      </span>
                    </div>
                  ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Header Actions */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-slate-200 relative">
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="text-2xl font-bold text-slate-800">Dashboard de Análisis</h2>
            <span
              className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase ${
                report.domain === 'autos'
                  ? 'bg-blue-100 text-blue-800'
                  : report.domain === 'copropiedades'
                  ? 'bg-emerald-100 text-emerald-800'
                  : report.domain === 'cumplimiento'
                  ? 'bg-amber-100 text-amber-800'
                  : report.domain === 'transporte'
                  ? 'bg-purple-100 text-purple-800'
                  : report.domain === 'salud'
                  ? 'bg-rose-100 text-rose-800'
                  : report.domain === 'vida_grupo'
                  ? 'bg-teal-100 text-teal-800'
                  : report.domain === 'hogar'
                  ? 'bg-cyan-100 text-cyan-800'
                  : 'bg-indigo-100 text-indigo-800'
              }`}
            >
              Ramo: {
                {
                  pyme: 'PYME',
                  copropiedades: 'Copropiedades',
                  autos: 'Autos',
                  cumplimiento: 'Cumplimiento',
                  transporte: 'Transporte',
                  salud: 'Salud',
                  vida_grupo: 'Vida Grupo',
                  hogar: 'Hogar',
                }[report.domain || 'pyme'] || (report.domain ? String(report.domain).toUpperCase() : 'PYME')
              }
            </span>
          </div>
          <p className="text-sm text-slate-500">
            {viewMode === 'technical'
              ? 'Vista técnica detallada para auditores de seguros (sublímites, deducibles, confianzas).'
              : 'Resumen ejecutivo simplificado para presentación y toma de decisión del cliente.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Dual View Mode Selector */}
          <div className="inline-flex bg-slate-100 p-1 rounded-xl border border-slate-200 shadow-inner">
            <button
              onClick={() => setViewMode('technical')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                viewMode === 'technical'
                  ? 'bg-indigo-600 text-white shadow'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Vista para Auditor Técnico"
            >
              <Layers size={14} />
              Auditor Técnico
            </button>
            <button
              onClick={() => setViewMode('client')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                viewMode === 'client'
                  ? 'bg-emerald-600 text-white shadow'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Vista Presentación Cliente"
            >
              <ShieldAlert size={14} />
              Cliente Final
            </button>
          </div>

          <button
            onClick={() => setShowExportModal(true)}
            className="flex items-center space-x-2 bg-slate-800 text-white px-5 py-2.5 rounded-lg hover:bg-slate-700 transition-all shadow-sm text-sm font-medium"
          >
            <FileDown size={18} />
            <span className="hidden sm:inline">Exportar PDF</span>
          </button>
        </div>

        {/* Export Modal */}
        {showExportModal && (
          <div className="absolute top-full right-0 mt-2 w-80 bg-white rounded-xl shadow-xl border border-slate-200 z-50 p-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-slate-800">Personalizar Reporte</h3>
              <button
                onClick={() => setShowExportModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                ×
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">
                  Título Personalizado
                </label>
                <input
                  type="text"
                  className="w-full text-sm border-slate-200 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="Ej: Informe Ejecutivo CSA"
                  value={pdfOptions.title}
                  onChange={(e) => setPdfOptions({ ...pdfOptions, title: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">
                  Logo del Aliado (Opcional)
                </label>
                <input
                  type="file"
                  accept="image/*"
                  className="w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onloadend = () => {
                        setPdfOptions({ ...pdfOptions, logo: reader.result as string });
                      };
                      reader.readAsDataURL(file);
                    }
                  }}
                />
              </div>

              {/* Color Picker Simple */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">
                  Color Principal
                </label>
                <div className="flex gap-2">
                  {[
                    { c: '#4f46e5', v: [79, 70, 229] },
                    { c: '#059669', v: [5, 150, 105] },
                    { c: '#dc2626', v: [220, 38, 38] },
                    { c: '#2563eb', v: [37, 99, 235] },
                  ].map((color: { c: string; v: [number, number, number] }, i) => (
                    <button
                      key={i}
                      className={`w-6 h-6 rounded-full border-2 ${pdfOptions.color[0] === color.v[0] ? 'border-slate-800 ring-1 ring-slate-800' : 'border-transparent'}`}
                      style={{ backgroundColor: color.c }}
                      onClick={() => setPdfOptions({ ...pdfOptions, color: color.v })}
                    />
                  ))}
                </div>
              </div>

              <div className="pt-2">
                <button
                  onClick={() => {
                    const user = storageService.getCurrentUser();
                    const brokerInfo = user
                      ? {
                          name: user.name,
                          intermediaryName: user.intermediaryName,
                          registrationNumber:
                            user.registrationNumber || user.agentDetails?.registrationNumber,
                          phone: user.agentDetails?.phone,
                          email: user.email,
                          address: user.address || user.agentDetails?.address,
                          city: user.city || user.agentDetails?.city,
                          logoUrl: user.logoUrl || user.agentDetails?.logoUrl,
                        }
                      : undefined;

                    generatePDF(
                      report,
                      {
                        customTitle: pdfOptions.title,
                        logoBase64: brokerInfo?.logoUrl || pdfOptions.logo,
                        primaryColor: pdfOptions.color,
                        brokerInfo,
                      },
                      cellNotes
                    );
                    setShowExportModal(false);
                  }}
                  className="w-full bg-indigo-600 text-white py-2 rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-colors"
                >
                  Generar PDF
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

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
          <span>Auditoría de Riesgos</span>
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
        <div className="space-y-6 animate-in fade-in duration-300">
          {/* Executive Summary */}
          <ExecutiveSummary
            quotes={report.quotes}
            recommendation={report.recommendation}
            onNavigate={setActiveTab}
          />

          {/* Scoring Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {report.quotes.map((q, idx) => {
              const isBest = q.insurerName === bestQuote.insurerName;
              return (
                <div
                  key={idx}
                  className={`relative rounded-xl p-6 border transition-all hover:shadow-lg ${isBest ? 'bg-gradient-to-br from-indigo-50 to-white border-indigo-200 shadow-md' : 'bg-white border-slate-200'}`}
                >
                  {isBest && (
                    <div className="absolute top-0 right-0 bg-indigo-600 text-white text-xs px-2 py-1 rounded-bl-lg rounded-tr-lg font-bold">
                      MEJOR OPCIÓN
                    </div>
                  )}
                  <h3 className="text-lg font-bold text-slate-800 mb-2">{q.insurerName}</h3>
                  <div className="flex items-end gap-2 mb-4">
                    <span
                      className={`text-4xl font-bold ${isBest ? 'text-indigo-600' : 'text-slate-700'}`}
                    >
                      {q.dataQualityScore || q.score}
                    </span>
                    <span className="text-sm text-slate-400 mb-1">/ 100</span>
                  </div>

                  {/* Verification Confidence Badge */}
                  {q.verificationConfidence !== undefined && q.verificationConfidence > 0 && (
                    <div className="mb-3 flex items-center gap-2">
                      <span className="text-xs text-slate-500">Verificación:</span>
                      <span
                        className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                          q.verificationConfidence >= 80
                            ? 'bg-green-100 text-green-700'
                            : q.verificationConfidence >= 50
                              ? 'bg-yellow-100 text-yellow-700'
                              : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {q.verificationConfidence}/100
                      </span>
                    </div>
                  )}

                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Prima Anual</span>
                      <span className="font-bold text-slate-800">{formatCOP(q.priceAnnual)}</span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${(q.dataQualityScore || q.score) >= 80 ? 'bg-green-500' : (q.dataQualityScore || q.score) >= 60 ? 'bg-yellow-400' : 'bg-red-400'}`}
                        style={{ width: `${q.dataQualityScore || q.score}%` }}
                      ></div>
                    </div>

                    {/* Confidence Indicator */}
                    {q.extractionConfidence !== undefined && (
                      <div className="mt-3 pt-3 border-t border-slate-100">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-slate-500">Confianza de Extracción</span>
                          <span
                            className={`text-xs font-bold ${
                              q.extractionConfidence >= 90
                                ? 'text-green-600'
                                : q.extractionConfidence >= 75
                                  ? 'text-yellow-600'
                                  : q.extractionConfidence >= 50
                                    ? 'text-orange-600'
                                    : 'text-red-600'
                            }`}
                          >
                            {q.extractionConfidence}/100
                            {q.needsReview && <span className="ml-1">⚠️</span>}
                          </span>
                        </div>
                        <div className="h-1 w-full bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              q.extractionConfidence >= 90
                                ? 'bg-green-500'
                                : q.extractionConfidence >= 75
                                  ? 'bg-yellow-400'
                                  : q.extractionConfidence >= 50
                                    ? 'bg-orange-400'
                                    : 'bg-red-400'
                            }`}
                            style={{ width: `${q.extractionConfidence}%` }}
                          ></div>
                        </div>

                        {/* Validation Flags */}
                        {q.validationFlags &&
                          q.validationFlags.length > 0 &&
                          viewMode === 'technical' && (
                            <div className="mt-2 space-y-1">
                              {q.validationFlags.slice(0, 3).map((flag, fidx) => (
                                <div
                                  key={fidx}
                                  className={`text-xs px-2 py-1 rounded ${
                                    flag.severity === 'CRITICAL'
                                      ? 'bg-red-50 text-red-700'
                                      : flag.severity === 'WARNING'
                                        ? 'bg-amber-50 text-amber-700'
                                        : 'bg-blue-50 text-blue-700'
                                  }`}
                                >
                                  {flag.message}
                                </div>
                              ))}
                              {q.validationFlags.length > 3 && (
                                <div className="text-xs text-slate-500">
                                  +{q.validationFlags.length - 3} más...
                                </div>
                              )}
                            </div>
                          )}
                      </div>
                    )}
                  </div>

                  {/* Correction UI */}
                  {viewMode === 'technical' && (
                    <CorrectionUI
                      quote={q}
                      onCorrection={(correction) => {
                        handleApplyCorrection(q.id || q.insurerName, correction);
                      }}
                    />
                  )}
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Radar Chart: Qualitative Analysis */}
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col items-center">
              <h3 className="text-lg font-bold text-slate-800 mb-2 w-full flex items-center">
                <Award className="mr-2 text-indigo-600" size={20} />
                Análisis Cualitativo (Radar)
              </h3>
              <div className="h-[300px] w-full min-h-[300px]" style={{ minWidth: '300px' }}>
                {activeTab === 'resumen' &&
                report.quotes.length > 0 &&
                radarData.some((d) => Object.keys(d).length > 2) ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData}>
                      <PolarGrid stroke="#e2e8f0" />
                      <PolarAngleAxis dataKey="subject" tick={{ fill: '#64748b', fontSize: 11 }} />
                      <PolarRadiusAxis angle={30} domain={[0, 10]} tick={false} axisLine={false} />
                      {report.quotes.map((q, i) => (
                        <Radar
                          key={i}
                          name={q.insurerName}
                          dataKey={q.insurerName}
                          stroke={CHART_COLORS[i % CHART_COLORS.length]}
                          fill={CHART_COLORS[i % CHART_COLORS.length]}
                          fillOpacity={0.2}
                        />
                      ))}
                      <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                      <Tooltip
                        contentStyle={{
                          borderRadius: '8px',
                          border: 'none',
                          boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                        }}
                      />
                    </RadarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-slate-400">
                    No hay datos suficientes para el gráfico
                  </div>
                )}
              </div>
            </div>

            {/* Bar Chart: Price Analysis */}
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-bold text-slate-800 flex items-center">
                  <BarChart3 className="mr-2 text-indigo-600" size={20} />
                  Comparativa de Primas
                </h3>
                <button
                  onClick={() => setShowIva(!showIva)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    showIva
                      ? 'bg-indigo-100 text-indigo-700 border border-indigo-300'
                      : 'bg-slate-100 text-slate-600 border border-slate-300 hover:bg-slate-200'
                  }`}
                  title={showIva ? 'Mostrar sin IVA' : 'Mostrar con IVA (19%)'}
                >
                  <span>{showIva ? 'Con IVA (19%)' : 'Sin IVA'}</span>
                  <span
                    className={`w-2 h-2 rounded-full ${showIva ? 'bg-indigo-500' : 'bg-slate-400'}`}
                  />
                </button>
              </div>
              <div className="h-[300px] w-full mt-4 min-h-[300px]" style={{ minWidth: '300px' }}>
                {activeTab === 'resumen' &&
                priceData.length > 0 &&
                priceData.some((d) => d.fullPrice > 0) ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={priceData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis
                        dataKey="name"
                        tick={{ fill: '#64748b', fontSize: 12 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fill: '#64748b', fontSize: 12 }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(value) => formatCOPMillions(value)}
                      />
                      <Tooltip
                        cursor={{ fill: '#f8fafc' }}
                        contentStyle={{
                          borderRadius: '8px',
                          border: 'none',
                          boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                        }}
                        formatter={(value: number) => [formatCOP(value), 'Prima Anual']}
                      />
                      <Bar
                        dataKey="fullPrice"
                        name="Precio Anual"
                        radius={[4, 4, 0, 0]}
                        barSize={40}
                      >
                        {priceData.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={CHART_COLORS[index % CHART_COLORS.length]}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-slate-400">
                    No hay datos de precios disponibles
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Recommendation Text */}
          <div className="bg-slate-800 text-white p-6 rounded-xl shadow-lg">
            <h3 className="text-lg font-bold mb-3 flex items-center">
              <Check className="mr-2 text-green-400" /> Dictamen del Auditor
            </h3>
            <p className="leading-relaxed text-slate-200 font-light">{report.recommendation}</p>
          </div>
        </div>
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
        <div className="space-y-6 animate-in fade-in duration-300">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Coverage Validation */}
            {report.quotes.some((q) => q.clauseValidation) && (
              <div className="bg-white rounded-xl border border-slate-200 p-6">
                <h3 className="text-lg font-bold text-slate-800 mb-4">Validación de Coberturas</h3>
                {report.quotes
                  .filter((q) => q.clauseValidation)
                  .map((quote, idx) => (
                    <CoverageValidationMatrix key={idx} quote={quote} />
                  ))}
              </div>
            )}

            {/* Deductible Risk */}
            {report.quotes.some((q) => q.deductibleAnalysis) && (
              <div className="bg-white rounded-xl border border-slate-200 p-6">
                <h3 className="text-lg font-bold text-slate-800 mb-4">Riesgo de Deducibles</h3>
                {report.quotes
                  .filter((q) => q.deductibleAnalysis)
                  .map((quote, idx) => (
                    <DeductibleRiskGauge key={idx} quote={quote} />
                  ))}
              </div>
            )}

            {/* Contextual Risk */}
            {report.quotes.some((q) => q.contextualRisk) && (
              <div className="bg-white rounded-xl border border-slate-200 p-6">
                <h3 className="text-lg font-bold text-slate-800 mb-4">Riesgo Contextualizado</h3>
                {report.quotes
                  .filter((q) => q.contextualRisk)
                  .map((quote, idx) => (
                    <ContextualExclusionCard key={idx} quote={quote} />
                  ))}
              </div>
            )}

            {/* Warranty Compliance */}
            {report.quotes.some((q) => q.warrantyCompliance) && (
              <div className="bg-white rounded-xl border border-slate-200 p-6">
                <h3 className="text-lg font-bold text-slate-800 mb-4">Cumplimiento de Garantías</h3>
                {report.quotes
                  .filter((q) => q.warrantyCompliance)
                  .map((quote, idx) => (
                    <WarrantyComplianceDashboard key={idx} quote={quote} />
                  ))}
              </div>
            )}

            {/* Legal Opinion */}
            {report.quotes.some((q) => q.legalOpinion) && (
              <div className="bg-white rounded-xl border border-slate-200 p-6">
                <h3 className="text-lg font-bold text-slate-800 mb-4">Asesoría Legal</h3>
                {report.quotes
                  .filter((q) => q.legalOpinion)
                  .map((quote, idx) => (
                    <LegalOpinionCard key={idx} quote={quote} />
                  ))}
              </div>
            )}

            {/* Inverse Coverage */}
            {report.quotes.some((q) => q.clauseValidation?.mandatoryMissingCount > 0) && (
              <div className="bg-white rounded-xl border border-slate-200 p-6">
                <h3 className="text-lg font-bold text-slate-800 mb-4">Coberturas Omitidas</h3>
                {report.quotes
                  .filter((q) => q.clauseValidation?.mandatoryMissingCount > 0)
                  .map((quote, idx) => (
                    <InverseCoverageAlert key={idx} quote={quote} />
                  ))}
              </div>
            )}

            {/* Negotiation Points */}
            {report.quotes.some((q) =>
              q.legalOpinion?.some((lo) => lo.negotiationPoints.length > 0)
            ) && (
              <div className="bg-white rounded-xl border border-slate-200 p-6">
                <h3 className="text-lg font-bold text-slate-800 mb-4">Puntos de Negociación</h3>
                {report.quotes
                  .filter((q) => q.legalOpinion?.some((lo) => lo.negotiationPoints.length > 0))
                  .map((quote, idx) => (
                    <NegotiationPointsList key={idx} quote={quote} />
                  ))}
              </div>
            )}
          </div>
        </div>
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
