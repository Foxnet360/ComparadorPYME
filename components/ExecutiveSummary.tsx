import React from 'react';
import {
  Award,
  AlertTriangle,
  TrendingDown,
  ArrowRight,
  BarChart3,
  Scale,
  ShieldAlert,
  ShieldCheck,
  Briefcase,
} from 'lucide-react';
import { QuoteAnalysis } from '../types';
import { formatCOP } from '../utils/formatCurrency';
import { getDomainRegulatoryProfile } from '@shared/domainRegulatoryKnowledge';

export interface ExecutiveSummaryProps {
  quotes: QuoteAnalysis[];
  recommendation: string;
  onNavigate: (tab: 'resumen' | 'coberturas' | 'deducibles' | 'auditoria') => void;
  viewMode?: 'technical' | 'client';
  domain?: string;
}

export const ExecutiveSummary: React.FC<ExecutiveSummaryProps> = ({
  quotes,
  recommendation,
  onNavigate,
  viewMode = 'technical',
  domain = 'pyme',
}) => {
  if (!quotes || quotes.length === 0) return null;

  const regProfile = getDomainRegulatoryProfile(domain);

  // Find best option
  const bestQuote = quotes.reduce((prev, current) =>
    (prev.score || 0) > (current.score || 0) ? prev : current
  );

  // Find cheapest
  const cheapestQuote = quotes
    .filter((q) => q.priceAnnual && q.priceAnnual > 0)
    .reduce(
      (prev, current) =>
        (prev.priceAnnual || Infinity) < (current.priceAnnual || Infinity) ? prev : current,
      quotes[0]!
    );

  // Find highest risk (most critical alerts)
  const highestRiskQuote = quotes.reduce((prev, current) => {
    const prevCriticals = (prev.alerts || []).filter((a) => a.level === 'CRITICAL').length;
    const currCriticals = (current.alerts || []).filter((a) => a.level === 'CRITICAL').length;
    return currCriticals > prevCriticals ? current : prev;
  });

  // Calculate potential savings only when all quotes have a valid price
  const prices = quotes
    .map((q) => q.priceAnnual)
    .filter((p): p is number => typeof p === 'number' && p > 0);
  const hasPrices = prices.length > 1;
  const maxPrice = hasPrices ? Math.max(...prices) : 0;
  const minPrice = hasPrices ? Math.min(...prices) : 0;
  const savings = hasPrices ? maxPrice - minPrice : 0;
  const savingsPercent = hasPrices && maxPrice > 0 ? Math.round((savings / maxPrice) * 100) : 0;

  // Count total alerts
  const totalCriticals = quotes.reduce(
    (sum, q) => sum + (q.alerts || []).filter((a) => a.level === 'CRITICAL').length,
    0
  );
  const totalWarnings = quotes.reduce(
    (sum, q) => sum + (q.alerts || []).filter((a) => a.level === 'WARNING').length,
    0
  );

  const isClientView = viewMode === 'client';
  const competitors = quotes.filter((q) => q.insurerName !== bestQuote.insurerName);

  return (
    <div className="bg-gradient-to-r from-indigo-600 to-indigo-800 rounded-xl shadow-lg overflow-hidden text-white">
      <div className="p-6 md:p-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-2xl font-bold">
                {isClientView ? 'Resumen Ejecutivo de Decisión Comercial' : 'Resumen Ejecutivo'}
              </h2>
              {domain && domain !== 'pyme' && (
                <span className="bg-white/20 text-white text-xs font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                  {regProfile.displayName}
                </span>
              )}
            </div>
            <p className="text-indigo-200 mt-1">
              {isClientView
                ? 'Recomendación estratégica para la toma de decisión del asegurado'
                : 'Insights clave del análisis comparativo'}
            </p>
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
                <p className="text-xs text-indigo-200 uppercase tracking-wide">
                  {isClientView ? 'Opción Recomendada' : 'Mejor Opción'}
                </p>
                <p className="font-bold text-lg">{bestQuote.insurerName}</p>
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold">{bestQuote.score}</span>
              <span className="text-indigo-200">/100</span>
            </div>
            <p className="text-sm text-indigo-200 mt-2">
              {isClientView
                ? 'Mayor solidez técnica y coberturas integrales'
                : 'Score más alto en el análisis integral'}
            </p>
          </div>

          {/* Second Card: Protection Index in Client view, or Highest Risk in Technical view */}
          {isClientView ? (
            <div className="bg-white/10 backdrop-blur rounded-lg p-4 border border-white/20">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-cyan-500/20 flex items-center justify-center">
                  <ShieldCheck className="text-cyan-400" size={20} />
                </div>
                <div>
                  <p className="text-xs text-indigo-200 uppercase tracking-wide">
                    Protección Patrimonial
                  </p>
                  <p className="font-bold text-lg">
                    {bestQuote.coverages?.length || 0} Coberturas
                  </p>
                </div>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-cyan-300">
                  {(bestQuote.quoteAudit?.missingCoverages?.length ?? bestQuote.missingCoverages?.length ?? 0) === 0 ? '100%' : 'Líder'}
                </span>
                <span className="text-indigo-200">amparo</span>
              </div>
              <p className="text-sm text-indigo-200 mt-2">
                Garantiza continuidad operativa ante siniestros
              </p>
            </div>
          ) : (
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
          )}

          {/* Savings Card */}
          <div className="bg-white/10 backdrop-blur rounded-lg p-4 border border-white/20">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
                <TrendingDown className="text-emerald-400" size={20} />
              </div>
              <div>
                <p className="text-xs text-indigo-200 uppercase tracking-wide">Ahorro Potencial</p>
                <p className="font-bold text-lg">
                  {hasPrices ? formatCOP(savings) : 'No disponible'}
                </p>
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span
                className={`text-3xl font-bold ${hasPrices ? 'text-emerald-300' : 'text-indigo-200'}`}
              >
                {hasPrices ? `-${savingsPercent}%` : '-'}
              </span>
              <span className="text-indigo-200">vs más cara</span>
            </div>
            <p className="text-sm text-indigo-200 mt-2">
              {hasPrices && cheapestQuote?.insurerName
                ? `${cheapestQuote.insurerName} es la más económica`
                : 'Prima anual no disponible para comparar'}
            </p>
          </div>
        </div>

        {/* Commercial Executive Pitch (Client View Only) */}
        {isClientView && (
          <div className="bg-white/10 backdrop-blur rounded-lg p-5 border border-white/20 mb-6">
            <div className="flex items-center gap-2 mb-3">
              <Briefcase className="text-amber-300" size={20} />
              <h3 className="font-bold text-lg text-white">
                Propuesta Comercial y Argumentación de Decisión
              </h3>
            </div>
            <p className="text-sm text-indigo-100 mb-4">
              Análisis ejecutivo diseñado para la toma de decisión informada de la gerencia:
            </p>

            {/* 3 Pillars of Decision */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
              <div className="bg-black/20 rounded-lg p-3 border border-white/10">
                <div className="flex items-center gap-2 text-emerald-300 font-semibold text-sm mb-1">
                  <ShieldCheck size={16} />
                  <span>1. Cobertura Integral</span>
                </div>
                <p className="text-xs text-indigo-200">
                  {bestQuote.insurerName} lidera con mayor amplitud en coberturas esenciales para la continuidad operativa de la empresa.
                </p>
              </div>

              <div className="bg-black/20 rounded-lg p-3 border border-white/10">
                <div className="flex items-center gap-2 text-cyan-300 font-semibold text-sm mb-1">
                  <Scale size={16} />
                  <span>2. Deducibles Favorables</span>
                </div>
                <p className="text-xs text-indigo-200">
                  Estructura de deducibles optimizada que minimiza el desembolso directo de la compañía al momento de un siniestro.
                </p>
              </div>

              <div className="bg-black/20 rounded-lg p-3 border border-white/10">
                <div className="flex items-center gap-2 text-amber-300 font-semibold text-sm mb-1">
                  <TrendingDown size={16} />
                  <span>3. Retorno de Inversión</span>
                </div>
                <p className="text-xs text-indigo-200">
                  {hasPrices && bestQuote.priceAnnual
                    ? `Costo competitivo de ${formatCOP(bestQuote.priceAnnual)} que maximiza la relación costo-beneficio.`
                    : 'Excelente balance entre prima cotizada y límites asegurados garantizados.'}
                </p>
              </div>
            </div>

            {/* Competitor Coverage Gaps in Layman Business Terms */}
            {competitors.length > 0 && (
              <div className="pt-3 border-t border-white/15">
                <p className="text-xs font-semibold text-amber-200 uppercase tracking-wide mb-2">
                  Factores Diferenciales frente a Alternativas Competidoras:
                </p>
                <div className="space-y-2">
                  {competitors.map((comp, idx) => {
                    const rawMissing = comp.quoteAudit?.missingCoverages || comp.missingCoverages || [];
                    const missingList = rawMissing
                      .map((m) => {
                        if (typeof m === 'string') return m;
                        if ('categoryName' in m && m.categoryName) return m.categoryName;
                        if ('name' in m && m.name) return m.name;
                        return '';
                      })
                      .filter(Boolean);
                    const missing = missingList.slice(0, 3).join(', ');
                    const critCount = (comp.alerts || []).filter((a) => a.level === 'CRITICAL').length;
                    return (
                      <div
                        key={idx}
                        className="flex flex-col sm:flex-row sm:items-center justify-between text-xs bg-white/5 rounded px-3 py-2 border border-white/10 gap-1"
                      >
                        <span className="font-semibold text-white">
                          {comp.insurerName}:
                        </span>
                        <span className="text-indigo-200">
                          {missing
                            ? `Omite amparos clave (${missing}) que trasladarían riesgo financiero directo al asegurado.`
                            : critCount > 0
                              ? `${critCount} condiciones contractuales restrictivas que limitan la indemnización.`
                              : 'Condiciones de deducible y alcance menos competitivas.'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

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
            Ver Letra Chica y Brechas
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
