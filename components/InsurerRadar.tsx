import React, { useState } from 'react';
import { QuoteAnalysis } from '../types';
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Legend,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import DeferredChart from './DeferredChart';
import { X, Radar as RadarIcon } from 'lucide-react';

interface InsurerRadarProps {
  quotes: QuoteAnalysis[];
  isOpen: boolean;
  onClose: () => void;
  selectedInsurers?: string[];
}

interface RadarDataPoint {
  subject: string;
  fullMark: number;
  [key: string]: number | string;
}

const CHART_COLORS = ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export const InsurerRadar: React.FC<InsurerRadarProps> = ({
  quotes,
  isOpen,
  onClose,
  selectedInsurers,
}) => {
  const [selected, setSelected] = useState<Set<string>>(
    new Set(selectedInsurers || quotes.map((q) => q.insurerName))
  );

  if (!isOpen) return null;

  // Calculate scores for each insurer across 5 dimensions
  const calculateScores = (
    quote: QuoteAnalysis
  ): { price: number; coverage: number; deductibles: number; clauses: number; risk: number } => {
    const bd = quote.scoringBreakdown || {
      coverage: 5,
      deductibles: 5,
      exclusions: 5,
      priceRatio: 5,
      sublimits: 5,
      warranties: 5,
    };

    // Price score (inverse - lower price is better)
    const prices = quotes.map((q) => q.priceAnnual || (q.priceMonthly ? q.priceMonthly * 12 : 0));
    const maxPrice = Math.max(...prices, 1);
    const priceScore = Math.round((1 - (quote.priceAnnual || 0) / maxPrice) * 10);

    // Coverage score
    const coverageCount = quote.coverages?.length || 0;
    const coverageScore = Math.min(Math.round((coverageCount / 14) * 10), 10);

    // Deductible score (lower deductibles are better)
    const deductibleTexts = (quote.coverages || [])
      .map((c) => c.deductible?.toUpperCase() || '')
      .filter((d) => d && d !== 'NO ESPECIFICADO' && d !== 'N/A');

    let deductibleScore = 5;
    if (deductibleTexts.length > 0) {
      const hasUnspecified = deductibleTexts.some((d) => d.includes('NO ESPECIFICADO'));
      const hasHigh = deductibleTexts.some((d) => {
        const match = d.match(/(\d+)%/);
        return match && parseInt(match[1]!) > 10;
      });

      if (hasUnspecified) deductibleScore = 3;
      else if (hasHigh) deductibleScore = 5;
      else deductibleScore = 8;
    }

    // Clauses score (based on alerts)
    const alertCount = quote.alerts?.length || 0;
    const criticalCount = quote.alerts?.filter((a) => a.level === 'CRITICAL').length || 0;
    const clausesScore = Math.max(10 - alertCount - criticalCount * 2, 0);

    // Risk score (inverse of overall risk)
    const riskScore = Math.round(
      (bd.coverage + bd.deductibles + bd.exclusions + bd.warranties) / 4
    );

    return {
      price: Math.max(0, Math.min(10, priceScore)),
      coverage: Math.max(0, Math.min(10, coverageScore)),
      deductibles: Math.max(0, Math.min(10, deductibleScore)),
      clauses: Math.max(0, Math.min(10, clausesScore)),
      risk: Math.max(0, Math.min(10, riskScore)),
    };
  };

  // Build radar data
  const radarData: RadarDataPoint[] = [
    { subject: 'Precio', fullMark: 10 },
    { subject: 'Cobertura', fullMark: 10 },
    { subject: 'Deducibles', fullMark: 10 },
    { subject: 'Cláusulas', fullMark: 10 },
    { subject: 'Riesgo', fullMark: 10 },
  ];

  quotes.forEach((quote, _idx) => {
    const scores = calculateScores(quote);
    radarData[0]![quote.insurerName] = scores.price;
    radarData[1]![quote.insurerName] = scores.coverage;
    radarData[2]![quote.insurerName] = scores.deductibles;
    radarData[3]![quote.insurerName] = scores.clauses;
    radarData[4]![quote.insurerName] = scores.risk;
  });

  const toggleInsurer = (insurerName: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(insurerName)) {
        if (next.size > 1) next.delete(insurerName);
      } else {
        next.add(insurerName);
      }
      return next;
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-auto">
        <div className="p-6 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <RadarIcon className="text-indigo-600" size={24} />
            <h2 className="text-xl font-bold text-slate-800">Comparación Multidimensional</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
            <X size={20} className="text-slate-500" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Insurer Selection */}
          <div className="flex flex-wrap gap-2">
            {quotes.map((quote, idx) => (
              <button
                key={idx}
                onClick={() => toggleInsurer(quote.insurerName)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                  selected.has(quote.insurerName)
                    ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                    : 'bg-slate-50 text-slate-500 border border-slate-200'
                }`}
              >
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: CHART_COLORS[idx % CHART_COLORS.length] }}
                />
                {quote.insurerName}
              </button>
            ))}
          </div>

          {/* Radar Chart */}
          <div className="h-[400px] w-full">
            <DeferredChart>
              <ResponsiveContainer width="100%" height="100%" minWidth={100} minHeight={100}>
                <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData}>
                  <PolarGrid stroke="#e2e8f0" />
                  <PolarAngleAxis dataKey="subject" tick={{ fill: '#64748b', fontSize: 12 }} />
                  <PolarRadiusAxis angle={30} domain={[0, 10]} tick={false} axisLine={false} />
                  {quotes.map(
                    (quote, idx) =>
                      selected.has(quote.insurerName) && (
                        <Radar
                          key={idx}
                          name={quote.insurerName}
                          dataKey={quote.insurerName}
                          stroke={CHART_COLORS[idx % CHART_COLORS.length]}
                          fill={CHART_COLORS[idx % CHART_COLORS.length]}
                          fillOpacity={0.2}
                          strokeWidth={2}
                        />
                      )
                  )}
                  <Legend
                    wrapperStyle={{ fontSize: '10px', paddingTop: '10px' }}
                    formatter={(value: string) => {
                      // Truncate long insurer names
                      const maxLength = 15;
                      return value.length > maxLength ? value.substring(0, maxLength) + '...' : value;
                    }}
                  />
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
          </div>

          {/* Score Explanation */}
          <div className="bg-slate-50 rounded-lg p-4 text-sm text-slate-600">
            <p className="font-medium text-slate-700 mb-2">Dimensiones del Análisis:</p>
            <ul className="space-y-1 list-disc list-inside">
              <li>
                <strong>Precio:</strong> Valor relativo (menor es mejor)
              </li>
              <li>
                <strong>Cobertura:</strong> Cantidad de coberturas incluidas
              </li>
              <li>
                <strong>Deducibles:</strong> Nivel de deducibles (menor es mejor)
              </li>
              <li>
                <strong>Cláusulas:</strong> Ausencia de exclusiones críticas
              </li>
              <li>
                <strong>Riesgo:</strong> Calificación general de riesgo
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InsurerRadar;
