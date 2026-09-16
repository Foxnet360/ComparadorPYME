import React, { useState } from 'react';
import { Award, BarChart3 } from 'lucide-react';
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
import DeferredChart from '../DeferredChart';
import { formatCOP, formatCOPMillions } from '../../utils/formatCurrency';
import type { QuoteAnalysis } from '../../types';

interface ReportChartsProps {
  quotes: QuoteAnalysis[];
}

const IVA_RATE = 0.19;

// Colors for charts
const CHART_COLORS = ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

const RADAR_DIMENSIONS = [
  { subject: 'Coberturas', fullMark: 10 },
  { subject: 'Deducibles', fullMark: 10 },
  { subject: 'Exclusiones', fullMark: 10 },
  { subject: 'Costo/Beneficio', fullMark: 10 },
  { subject: 'Sublímites', fullMark: 10 },
  { subject: 'Garantías', fullMark: 10 },
];

const DEFAULT_SCORING = {
  coverage: 5,
  deductibles: 5,
  exclusions: 5,
  priceRatio: 5,
  sublimits: 5,
  warranties: 5,
};

/**
 * ARCH-1: summary-dashboard charts — qualitative radar (scoring dimensions)
 * and price comparison bar chart with the IVA toggle. Extracted from the
 * ComparisonReport shell.
 */
export const ReportCharts: React.FC<ReportChartsProps> = ({ quotes }) => {
  // IVA toggle state
  const [showIva, setShowIva] = useState(false);

  // Data for Bar Chart (Price)
  const priceData = quotes.map((q) => {
    const basePrice = q.priceAnnual || (q.priceMonthly ? q.priceMonthly * 12 : 0);
    return {
      name: (q.insurerName || 'Desconocido').substring(0, 15),
      fullPrice: showIva ? Math.round(basePrice * (1 + IVA_RATE)) : basePrice,
    };
  });

  // Data for Radar Chart (Scoring Dimensions)
  const radarData = RADAR_DIMENSIONS.map((dim, i) => {
    const dataPoint: Record<string, string | number> = { subject: dim.subject, fullMark: 10 };
    quotes.forEach((q) => {
      const bd = q.scoringBreakdown || DEFAULT_SCORING;
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

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Radar Chart: Qualitative Analysis */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col items-center">
        <h3 className="text-lg font-bold text-slate-800 mb-2 w-full flex items-center">
          <Award className="mr-2 text-indigo-600" size={20} />
          Análisis Cualitativo (Radar)
        </h3>
        <div className="h-[300px] w-full min-h-[300px]" style={{ minWidth: '300px' }}>
          {quotes.length > 0 && radarData.some((d) => Object.keys(d).length > 2) ? (
            <DeferredChart>
              <ResponsiveContainer width="100%" height="100%" minWidth={100} minHeight={100}>
                <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData}>
                  <PolarGrid stroke="#e2e8f0" />
                  <PolarAngleAxis dataKey="subject" tick={{ fill: '#64748b', fontSize: 11 }} />
                  <PolarRadiusAxis angle={30} domain={[0, 10]} tick={false} axisLine={false} />
                  {quotes.map((q, i) => (
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
            </DeferredChart>
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
          {priceData.length > 0 && priceData.some((d) => d.fullPrice > 0) ? (
            <DeferredChart>
              <ResponsiveContainer width="100%" height="100%" minWidth={100} minHeight={100}>
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
                    formatter={(value) => [formatCOP(Number(value)), 'Prima Anual']}
                  />
                  <Bar dataKey="fullPrice" name="Precio Anual" radius={[4, 4, 0, 0]} barSize={40}>
                    {priceData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </DeferredChart>
          ) : (
            <div className="flex items-center justify-center h-full text-slate-400">
              No hay datos de precios disponibles
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ReportCharts;
