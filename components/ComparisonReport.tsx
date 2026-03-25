import React, { useState } from 'react';
import { QuoteAnalysis, ComparisonReport as ReportType, AlertLevel } from '../types';
import { Check, Award, ShieldAlert, BarChart3, AlertTriangle, AlertCircle, Info, Scale, FileDown, Layers, ListChecks, FileText, Search, User, Briefcase, Eye, ChevronDown, ChevronUp, BookOpen } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Legend } from 'recharts';
import { DISCLAIMER_TEXT, PLANTILLA_ITEMS } from '../constants';
import { generatePDF } from '../services/pdfService';
import { DeductiblesComparisonTable } from './DeductiblesComparisonTable';
import { AuditSection } from './AuditSection';

interface ComparisonReportProps {
  report: ReportType;
}

// Robust string matching
const normalizeText = (text: string | undefined | null) => {
  if (!text || typeof text !== 'string') return "";
  return text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
};

const ComparisonReport: React.FC<ComparisonReportProps> = ({ report }) => {
  const [activeTab, setActiveTab] = useState<'resumen' | 'coberturas' | 'deducibles' | 'auditoria'>('resumen');
  const [viewMode, setViewMode] = useState<'client' | 'technical'>('client');
  const [showExportModal, setShowExportModal] = useState(false);
  const [pdfOptions, setPdfOptions] = useState<{ title: string, logo?: string, color: [number, number, number] }>({
    title: "Reporte Ejecutivo de Seguros",
    color: [79, 70, 229]
  });

  if (!report.quotes || report.quotes.length === 0) {
    return <div className="text-center p-8 text-slate-500">No se encontraron detalles de cotizaciones en el análisis.</div>;
  }

  const bestQuote = report.quotes.reduce((prev, current) => ((prev.score || 0) > (current.score || 0)) ? prev : current, report.quotes[0]);

  // Data for Bar Chart (Price)
  const priceData = report.quotes.map(q => ({
    name: (q.insurerName || 'Desconocido').substring(0, 15),
    fullPrice: q.priceAnnual || (q.priceMonthly ? q.priceMonthly * 12 : 0),
  }));

  // Data for Radar Chart (Scoring Dimensions)
  const radarData = [
    { subject: 'Coberturas', fullMark: 10 },
    { subject: 'Deducibles', fullMark: 10 },
    { subject: 'Exclusiones', fullMark: 10 },
    { subject: 'Costo/Beneficio', fullMark: 10 },
    { subject: 'Sublímites', fullMark: 10 },
    { subject: 'Garantías', fullMark: 10 },
  ].map((dim, i) => {
    const dataPoint: any = { subject: dim.subject, fullMark: 10 };
    report.quotes.forEach(q => {
      const bd = q.scoringBreakdown || { coverage: 5, deductibles: 5, exclusions: 5, priceRatio: 5, sublimits: 5, warranties: 5 };
      const values = [bd.coverage, bd.deductibles, bd.exclusions, bd.priceRatio, bd.sublimits, bd.warranties];
      dataPoint[q.insurerName] = values[i] || 5;
    });
    return dataPoint;
  });

  // Colors for charts
  const CHART_COLORS = ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

  const getAlertIcon = (level: AlertLevel) => {
    switch (level) {
      case 'CRITICAL': return <AlertCircle className="text-red-600" size={20} />;
      case 'WARNING': return <AlertTriangle className="text-amber-500" size={20} />;
      case 'GOOD': return <Check className="text-green-600" size={20} />;
      default: return <Info className="text-blue-500" size={20} />;
    }
  };

  const getAlertBg = (level: AlertLevel) => {
    switch (level) {
      case 'CRITICAL': return 'bg-red-50 border-red-100 border-l-4 border-l-red-500';
      case 'WARNING': return 'bg-amber-50 border-amber-100 border-l-4 border-l-amber-500';
      case 'GOOD': return 'bg-green-50 border-green-100 border-l-4 border-l-green-500';
      default: return 'bg-blue-50 border-blue-100 border-l-4 border-l-blue-500';
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">

      {/* Header Actions & View Toggle */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-slate-200 relative">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Dashboard de Análisis</h2>
          <p className="text-sm text-slate-500">
            {viewMode === 'client' ? 'Vista simplificada para toma de decisiones.' : 'Vista técnica detallada para auditores.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* View Toggle */}
          <div className="flex bg-slate-100 p-1 rounded-lg">
            <button
              onClick={() => setViewMode('client')}
              className={`flex items-center space-x-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${viewMode === 'client' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <User size={16} />
              <span>Cliente</span>
            </button>
            <button
              onClick={() => setViewMode('technical')}
              className={`flex items-center space-x-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${viewMode === 'technical' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <Briefcase size={16} />
              <span>Técnico</span>
            </button>
          </div>

          <div className="h-6 w-px bg-slate-200 hidden sm:block"></div>

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
              <button onClick={() => setShowExportModal(false)} className="text-slate-400 hover:text-slate-600">×</button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Título Personalizado</label>
                <input
                  type="text"
                  className="w-full text-sm border-slate-200 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="Ej: Informe Ejecutivo CSA"
                  value={pdfOptions.title}
                  onChange={(e) => setPdfOptions({ ...pdfOptions, title: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Logo del Aliado (Opcional)</label>
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
                <label className="block text-xs font-semibold text-slate-500 mb-1">Color Principal</label>
                <div className="flex gap-2">
                  {[
                    { c: '#4f46e5', v: [79, 70, 229] },
                    { c: '#059669', v: [5, 150, 105] },
                    { c: '#dc2626', v: [220, 38, 38] },
                    { c: '#2563eb', v: [37, 99, 235] }
                  ].map((color: any, i) => (
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
                    generatePDF(report, {
                      customTitle: pdfOptions.title,
                      logoBase64: pdfOptions.logo,
                      primaryColor: pdfOptions.color
                    });
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
        <button onClick={() => setActiveTab('resumen')} className={`flex items-center space-x-2 pb-2 px-1 text-sm font-medium border-b-2 transition-colors ${activeTab === 'resumen' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
          <BarChart3 size={18} /><span>Dashboard Resumen</span>
        </button>
        <button onClick={() => setActiveTab('coberturas')} className={`flex items-center space-x-2 pb-2 px-1 text-sm font-medium border-b-2 transition-colors ${activeTab === 'coberturas' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
          <Layers size={18} /><span>Matriz de Coberturas</span>
        </button>
        <button onClick={() => setActiveTab('deducibles')} className={`flex items-center space-x-2 pb-2 px-1 text-sm font-medium border-b-2 transition-colors ${activeTab === 'deducibles' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
          <Scale size={18} /><span>Deducibles</span>
        </button>
        <button onClick={() => setActiveTab('auditoria')} className={`flex items-center space-x-2 pb-2 px-1 text-sm font-medium border-b-2 transition-colors ${activeTab === 'auditoria' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
          <ShieldAlert size={18} /><span>Auditoría de Riesgos</span>
        </button>
      </div>

      {/* --- TAB CONTENT: RESUMEN (DASHBOARD) --- */}
      {activeTab === 'resumen' && (
        <div className="space-y-6 animate-in fade-in duration-300">

          {/* Scoring Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {report.quotes.map((q, idx) => {
              const isBest = q.insurerName === bestQuote.insurerName;
              return (
                <div key={idx} className={`relative rounded-xl p-6 border transition-all hover:shadow-lg ${isBest ? 'bg-gradient-to-br from-indigo-50 to-white border-indigo-200 shadow-md' : 'bg-white border-slate-200'}`}>
                  {isBest && <div className="absolute top-0 right-0 bg-indigo-600 text-white text-xs px-2 py-1 rounded-bl-lg rounded-tr-lg font-bold">MEJOR OPCIÓN</div>}
                  <h3 className="text-lg font-bold text-slate-800 mb-2">{q.insurerName}</h3>
                  <div className="flex items-end gap-2 mb-4">
                    <span className={`text-4xl font-bold ${isBest ? 'text-indigo-600' : 'text-slate-700'}`}>{q.score}</span>
                    <span className="text-sm text-slate-400 mb-1">/ 100</span>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Prima Anual</span>
                      <span className="font-bold text-slate-800">${(q.priceAnnual || 0).toLocaleString()}</span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${q.score >= 80 ? 'bg-green-500' : q.score >= 60 ? 'bg-yellow-400' : 'bg-red-400'}`} style={{ width: `${q.score}%` }}></div>
                    </div>
                  </div>
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
              <div className="h-[300px] w-full min-h-[300px]">
                {report.quotes.length > 0 && radarData.some(d => Object.keys(d).length > 2) ? (
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
                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
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
              <h3 className="text-lg font-bold text-slate-800 mb-2 w-full flex items-center">
                <BarChart3 className="mr-2 text-indigo-600" size={20} />
                Comparativa de Primas
              </h3>
              <div className="h-[300px] w-full mt-4 min-h-[300px]">
                {priceData.length > 0 && priceData.some(d => d.fullPrice > 0) ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={priceData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 12 }} axisLine={false} tickLine={false} />
                      <YAxis
                        tick={{ fill: '#64748b', fontSize: 12 }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(value) => `$${(value / 1000000).toFixed(1)}M`}
                      />
                      <Tooltip
                        cursor={{ fill: '#f8fafc' }}
                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                        formatter={(value: number) => [`$${value.toLocaleString()}`, 'Prima Anual']}
                      />
                      <Bar dataKey="fullPrice" name="Precio Anual" radius={[4, 4, 0, 0]} barSize={40}>
                        {priceData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
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
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden animate-in fade-in duration-300">
          <div className="p-6 bg-slate-50 border-b border-slate-200">
            <h3 className="font-bold text-slate-800 flex items-center">
              <ListChecks className="mr-2 text-indigo-600" size={20} />
              Plantilla PYME: Comparativo Lado a Lado
            </h3>
            <p className="text-sm text-slate-500 mt-1">
              Validación de los ítems esenciales del ramo. Se utiliza normalización para cruzar los datos.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-white text-slate-600 uppercase font-bold text-xs border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4 sticky left-0 bg-white border-r border-slate-100 min-w-[250px] shadow-[4px_0_10px_-5px_rgba(0,0,0,0.1)] z-10">
                    Rubro Normalizado
                  </th>
                  {report.quotes.map((q, i) => (
                    <th key={i} className="px-6 py-4 min-w-[220px] bg-slate-50/50">{q.insurerName}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {PLANTILLA_ITEMS.map((item, rowIdx) => (
                  <tr key={rowIdx} className="hover:bg-slate-50/80 transition-colors group">
                    <td className="px-6 py-4 font-semibold text-slate-700 bg-white sticky left-0 border-r border-slate-100 shadow-[4px_0_10px_-5px_rgba(0,0,0,0.05)] z-10 group-hover:bg-slate-50">
                      {item}
                    </td>
                    {report.quotes.map((q, colIdx) => {
                      const found = (q.coverages || []).find(c => {
                        if (!c.name) return false;
                        const nItem = normalizeText(item);
                        const nName = normalizeText(c.name);
                        return nName === nItem || nName.includes(nItem) || nItem.includes(nName);
                      });

                      const value = found ? found.value : 'No Especificado';
                      // Solo marcar como EXCLUIDO si el valor es EXACTAMENTE "EXCLUIDO", "NO CUBRE" o "NO APLICA"
                      // No usar .includes() para evitar falsos positivos (ej: "NO CUBRE hasta 100M" no es excluido)
                      const upperValue = value.toUpperCase().trim();
                      const isExcluded = upperValue === 'EXCLUIDO' || upperValue === 'NO CUBRE' || upperValue === 'NO APLICA' || upperValue === 'EXCLUDED';
                      const isUnspecified = upperValue === 'NO ESPECIFICADO' || upperValue === '' || upperValue === 'N/A';
                      const citations = found?.citations || [];

                      return (
                        <td key={colIdx} className={`px-6 py-4 leading-relaxed align-top ${isExcluded ? 'text-red-500 bg-red-50/30 italic' : isUnspecified ? 'text-slate-400 italic' : 'text-slate-600'}`}>
                          <div className="font-medium">{value}</div>
                          {citations.length > 0 && (
                            <div className="mt-3 text-xs text-slate-600 bg-slate-100/80 p-2.5 border border-slate-200 rounded-md">
                              <span className="font-semibold flex items-center mb-1.5 text-slate-700">
                                <Info size={12} className="mr-1.5" /> Referencias RAG:
                              </span>
                              {citations.map((c, i) => (
                                <div key={i} className="mb-2 last:mb-0">
                                  <span className="italic block mb-1">"{c.text}"</span>
                                  <div className="text-[10px] text-indigo-700 font-mono bg-indigo-50 inline-block px-1.5 py-0.5 rounded border border-indigo-100">
                                    {c.source} {c.section ? `• Sec: ${c.section}` : ''} {c.page ? `• Pág: ${c.page}` : ''}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* --- TAB CONTENT: DEDUCIBLES --- */}
      {activeTab === 'deducibles' && (
        <div className="animate-in fade-in duration-300 space-y-6">
          {/* Tabla Comparativa de Deducibles - Nuevo Componente */}
          <DeductiblesComparisonTable quotes={report.quotes} />
          
          {/* Texto Completo de Deducibles */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
            <div className="flex items-center mb-4 pb-3 border-b border-slate-100">
              <FileText className="mr-2 text-indigo-600" size={20} />
              <h3 className="font-bold text-slate-800">Texto Completo de Deducibles</h3>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {report.quotes.map((quote, idx) => (
                <div key={idx} className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                  <h4 className="font-bold text-slate-700 mb-2">{quote.insurerName}</h4>
                  <div className="prose prose-sm text-slate-600 whitespace-pre-line leading-7">
                    {quote.deductibles || "No detallado."}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* --- TAB CONTENT: AUDITORIA (ALERTS) --- */}
      {activeTab === 'auditoria' && (
        <AuditSection quotes={report.quotes} viewMode={viewMode} />
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