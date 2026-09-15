import React from 'react';
import { AlertCircle, AlertTriangle, CheckCircle, Shield, TrendingUp } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import DeferredChart from './DeferredChart';
import { QuoteAnalysis, CrossInsurerRisk } from '../types';

interface AuditDashboardProps {
  quotes: QuoteAnalysis[];
  crossInsurerRisks: CrossInsurerRisk[];
  businessContextAnalysis: string;
  viewMode: 'client' | 'technical';
}

export const AuditDashboard: React.FC<AuditDashboardProps> = ({
  quotes,
  crossInsurerRisks,
  businessContextAnalysis,
  viewMode,
}) => {
  // Calculate totals
  const totals = quotes.map((quote) => {
    const alerts = quote.alerts || [];
    return {
      insurerName: quote.insurerName,
      critical: alerts.filter((a) => a.level === 'CRITICAL').length,
      warning: alerts.filter((a) => a.level === 'WARNING').length,
      good: alerts.filter((a) => a.level === 'GOOD').length,
      total: alerts.length,
    };
  });

  const totalCritical = totals.reduce((sum, t) => sum + t.critical, 0);
  const totalWarning = totals.reduce((sum, t) => sum + t.warning, 0);
  const totalGood = totals.reduce((sum, t) => sum + t.good, 0);

  // Chart data
  const chartData = totals.map((t) => ({
    name: t.insurerName.substring(0, 10),
    Críticos: t.critical,
    Advertencias: t.warning,
    Destacados: t.good,
  }));

  const COLORS = {
    critical: '#ef4444',
    warning: '#f59e0b',
    good: '#10b981',
  };

  return (
    <div className="space-y-6 mb-8">
      {/* Severity Counters */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-red-50 rounded-xl border border-red-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
              <AlertCircle className="text-red-600" size={20} />
            </div>
            <div>
              <p className="text-2xl font-bold text-red-700">{totalCritical}</p>
              <p className="text-sm text-red-600">Críticos</p>
            </div>
          </div>
        </div>

        <div className="bg-amber-50 rounded-xl border border-amber-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
              <AlertTriangle className="text-amber-600" size={20} />
            </div>
            <div>
              <p className="text-2xl font-bold text-amber-700">{totalWarning}</p>
              <p className="text-sm text-amber-600">Advertencias</p>
            </div>
          </div>
        </div>

        <div className="bg-green-50 rounded-xl border border-green-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle className="text-green-600" size={20} />
            </div>
            <div>
              <p className="text-2xl font-bold text-green-700">{totalGood}</p>
              <p className="text-sm text-green-600">Destacados</p>
            </div>
          </div>
        </div>

        <div className="bg-indigo-50 rounded-xl border border-indigo-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center">
              <Shield className="text-indigo-600" size={20} />
            </div>
            <div>
              <p className="text-2xl font-bold text-indigo-700">{crossInsurerRisks.length}</p>
              <p className="text-sm text-indigo-600">Riesgos Cruzados</p>
            </div>
          </div>
        </div>
      </div>

      {/* Coverage Validation Metrics */}
      {viewMode === 'technical' && quotes.some((q) => q.clauseValidation) && (
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <h3 className="font-bold text-slate-800 mb-3">Validación de Coberturas</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {quotes
              .filter((q) => q.clauseValidation)
              .map((quote, idx) => (
                <React.Fragment key={idx}>
                  <div className="bg-green-50 rounded-lg p-3 border border-green-200">
                    <p className="text-sm text-green-600">
                      Verificadas ({quote.insurerName.substring(0, 10)})
                    </p>
                    <p className="text-xl font-bold text-green-700">
                      {quote.clauseValidation!.verifiedCount}
                    </p>
                  </div>
                  <div className="bg-red-50 rounded-lg p-3 border border-red-200">
                    <p className="text-sm text-red-600">
                      Fantasma ({quote.insurerName.substring(0, 10)})
                    </p>
                    <p className="text-xl font-bold text-red-700">
                      {quote.clauseValidation!.phantomCount}
                    </p>
                  </div>
                  <div className="bg-amber-50 rounded-lg p-3 border border-amber-200">
                    <p className="text-sm text-amber-600">
                      Oblig. Omitidas ({quote.insurerName.substring(0, 10)})
                    </p>
                    <p className="text-xl font-bold text-amber-700">
                      {quote.clauseValidation!.mandatoryMissingCount}
                    </p>
                  </div>
                </React.Fragment>
              ))}
          </div>
        </div>
      )}

      {/* Deductible Risk Metrics */}
      {viewMode === 'technical' && quotes.some((q) => q.deductibleAnalysis) && (
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <h3 className="font-bold text-slate-800 mb-3">Riesgo de Deducibles</h3>
          {quotes
            .filter((q) => q.deductibleAnalysis)
            .map((quote, idx) => {
              const lowRisk = quote.deductibleAnalysis!.filter((d) => d.riskLevel === 'LOW').length;
              const mediumRisk = quote.deductibleAnalysis!.filter(
                (d) => d.riskLevel === 'MEDIUM'
              ).length;
              const highRisk = quote.deductibleAnalysis!.filter(
                (d) => d.riskLevel === 'HIGH'
              ).length;

              return (
                <div key={idx} className="mb-4">
                  <p className="text-sm text-slate-500 mb-2">{quote.insurerName}</p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-green-50 rounded-lg p-3 border border-green-200">
                      <p className="text-sm text-green-600">Riesgo Bajo</p>
                      <p className="text-xl font-bold text-green-700">{lowRisk}</p>
                    </div>
                    <div className="bg-amber-50 rounded-lg p-3 border border-amber-200">
                      <p className="text-sm text-amber-600">Riesgo Medio</p>
                      <p className="text-xl font-bold text-amber-700">{mediumRisk}</p>
                    </div>
                    <div className="bg-red-50 rounded-lg p-3 border border-red-200">
                      <p className="text-sm text-red-600">Riesgo Alto</p>
                      <p className="text-xl font-bold text-red-700">{highRisk}</p>
                    </div>
                  </div>
                </div>
              );
            })}
        </div>
      )}

      {/* Business Context */}
      {viewMode === 'technical' && businessContextAnalysis && (
        <div className="bg-blue-50 rounded-xl border border-blue-200 p-4">
          <div className="flex items-start gap-3">
            <TrendingUp className="text-blue-600 mt-0.5" size={18} />
            <div>
              <p className="font-semibold text-blue-800 text-sm">Análisis Contextual del Negocio</p>
              <p className="text-sm text-blue-700 mt-1">{businessContextAnalysis}</p>
            </div>
          </div>
        </div>
      )}

      {/* Cross-Insurer Risk Matrix */}
      {crossInsurerRisks.length > 0 && viewMode === 'technical' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 bg-slate-50 border-b border-slate-200">
            <h3 className="font-bold text-slate-800">Matriz de Riesgos Cruzados</h3>
            <p className="text-sm text-slate-500 mt-1">
              Riesgos que afectan a múltiples aseguradoras
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-100 text-slate-600 font-bold text-xs uppercase">
                <tr>
                  <th className="px-4 py-3 text-left">Riesgo</th>
                  <th className="px-4 py-3 text-left">Severidad</th>
                  <th className="px-4 py-3 text-left">Aseguradoras Afectadas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {crossInsurerRisks.map((risk, idx) => (
                  <tr key={idx} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-800">{risk.riskTitle}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                          risk.severity === 'CRITICAL'
                            ? 'bg-red-100 text-red-700'
                            : risk.severity === 'WARNING'
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-green-100 text-green-700'
                        }`}
                      >
                        {risk.severity}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {risk.affectedInsurers.map((insurer, i) => (
                          <span
                            key={i}
                            className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded"
                          >
                            {insurer}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Stacked Bar Chart */}
      {chartData.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <h3 className="font-bold text-slate-800 mb-4">Distribución de Riesgos por Aseguradora</h3>
          <div className="h-[250px]">
            <DeferredChart>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis
                    dataKey="name"
                    tick={{ fill: '#64748b', fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis tick={{ fill: '#64748b', fontSize: 12 }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      borderRadius: '8px',
                      border: 'none',
                      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                    }}
                  />
                  <Bar dataKey="Críticos" stackId="a" fill={COLORS.critical} radius={[0, 0, 4, 4]} />
                  <Bar dataKey="Advertencias" stackId="a" fill={COLORS.warning} />
                  <Bar dataKey="Destacados" stackId="a" fill={COLORS.good} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </DeferredChart>
          </div>
        </div>
      )}
    </div>
  );
};

export default AuditDashboard;
