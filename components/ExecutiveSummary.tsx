import React from 'react';
import { Award, AlertTriangle, TrendingDown, ArrowRight, BarChart3, Scale, ShieldAlert } from 'lucide-react';
import { QuoteAnalysis } from '../types';
import { formatCOP } from '../utils/formatCurrency';

interface ExecutiveSummaryProps {
  quotes: QuoteAnalysis[];
  recommendation: string;
  onNavigate: (tab: 'resumen' | 'coberturas' | 'deducibles' | 'auditoria') => void;
}

export const ExecutiveSummary: React.FC<ExecutiveSummaryProps> = ({ quotes, recommendation, onNavigate }) => {
  if (!quotes || quotes.length === 0) return null;
  
  // Find best option
  const bestQuote = quotes.reduce((prev, current) => 
    ((prev.score || 0) > (current.score || 0)) ? prev : current
  );
  
  // Find cheapest
  const cheapestQuote = quotes
    .filter(q => q.priceAnnual && q.priceAnnual > 0)
    .reduce((prev, current) => 
      ((prev.priceAnnual || Infinity) < (current.priceAnnual || Infinity)) ? prev : current
    , quotes[0]);
  
  // Find highest risk (most critical alerts)
  const highestRiskQuote = quotes.reduce((prev, current) => {
    const prevCriticals = (prev.alerts || []).filter(a => a.level === 'CRITICAL').length;
    const currCriticals = (current.alerts || []).filter(a => a.level === 'CRITICAL').length;
    return currCriticals > prevCriticals ? current : prev;
  });
  
  // Calculate potential savings
  const prices = quotes.map(q => q.priceAnnual).filter(Boolean);
  const maxPrice = Math.max(...prices);
  const minPrice = Math.min(...prices);
  const savings = maxPrice - minPrice;
  const savingsPercent = maxPrice > 0 ? Math.round((savings / maxPrice) * 100) : 0;
  
  // Count total alerts
  const totalCriticals = quotes.reduce((sum, q) => sum + (q.alerts || []).filter(a => a.level === 'CRITICAL').length, 0);
  const totalWarnings = quotes.reduce((sum, q) => sum + (q.alerts || []).filter(a => a.level === 'WARNING').length, 0);
  
  return (
    <div className="bg-gradient-to-r from-indigo-600 to-indigo-800 rounded-xl shadow-lg overflow-hidden text-white">
      <div className="p-6 md:p-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold">Resumen Ejecutivo</h2>
            <p className="text-indigo-200 mt-1">Insights clave del análisis comparativo</p>
          </div>
          <div className="hidden md:flex items-center gap-2 bg-white/10 rounded-lg px-4 py-2">
            <span className="text-sm font-medium">{quotes.length} cotizaciones analizadas</span>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {/* Best Option Card */}
          <div className="bg-white/10 backdrop-blur rounded-lg p-4 border border-white/20">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                <Award className="text-green-400" size={20} />
              </div>
              <div>
                <p className="text-xs text-indigo-200 uppercase tracking-wide">Mejor Opción</p>
                <p className="font-bold text-lg">{bestQuote.insurerName}</p>
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold">{bestQuote.score}</span>
              <span className="text-indigo-200">/100</span>
            </div>
            <p className="text-sm text-indigo-200 mt-2">
              Score más alto en el análisis integral
            </p>
          </div>
          
          {/* Highest Risk Card */}
          <div className="bg-white/10 backdrop-blur rounded-lg p-4 border border-white/20">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
                <AlertTriangle className="text-red-400" size={20} />
              </div>
              <div>
                <p className="text-xs text-indigo-200 uppercase tracking-wide">Mayor Riesgo</p>
                <p className="font-bold text-lg">{highestRiskQuote.insurerName}</p>
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-red-300">{totalCriticals}</span>
              <span className="text-indigo-200">críticos</span>
            </div>
            <p className="text-sm text-indigo-200 mt-2">
              {totalWarnings} advertencias adicionales detectadas
            </p>
          </div>
          
          {/* Savings Card */}
          <div className="bg-white/10 backdrop-blur rounded-lg p-4 border border-white/20">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
                <TrendingDown className="text-emerald-400" size={20} />
              </div>
              <div>
                <p className="text-xs text-indigo-200 uppercase tracking-wide">Ahorro Potencial</p>
                <p className="font-bold text-lg">{formatCOP(savings)}</p>
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-emerald-300">-{savingsPercent}%</span>
              <span className="text-indigo-200">vs más cara</span>
            </div>
            <p className="text-sm text-indigo-200 mt-2">
              {cheapestQuote?.insurerName} es la más económica
            </p>
          </div>
        </div>
        
        {/* Quick Actions */}
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => onNavigate('coberturas')}
            className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors text-sm font-medium"
          >
            <BarChart3 size={16} />
            Ver Matriz
            <ArrowRight size={14} />
          </button>
          
          <button
            onClick={() => onNavigate('deducibles')}
            className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors text-sm font-medium"
          >
            <Scale size={16} />
            Ver Deducibles
            <ArrowRight size={14} />
          </button>
          
          <button
            onClick={() => onNavigate('auditoria')}
            className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors text-sm font-medium"
          >
            <ShieldAlert size={16} />
            Ver Riesgos
            <ArrowRight size={14} />
          </button>
        </div>
        
        {/* Recommendation */}
        {recommendation && (
          <div className="mt-6 pt-6 border-t border-white/20">
            <p className="text-sm text-indigo-200 leading-relaxed">{recommendation}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ExecutiveSummary;
