import React from 'react';
import { QuoteAnalysis } from '../types';
import { PLANTILLA_ITEMS } from '../constants';
import { Shield, AlertTriangle, TrendingDown, Award } from 'lucide-react';
import { formatCOP } from '../utils/formatCurrency';

interface DeductibleMatrixProps {
  quotes: QuoteAnalysis[];
}

// Helper to parse deductible value for display
const parseDeductible = (
  deductible: string
): {
  percentage: number | null;
  minimum: number | null;
  appliesTo: 'perdida' | 'valor' | null;
  rawText: string;
  isHigh: boolean;
  isUnspecified: boolean;
} => {
  if (!deductible || deductible === 'No aplica' || deductible === 'NO ESPECIFICADO') {
    return {
      percentage: null,
      minimum: null,
      appliesTo: null,
      rawText: deductible || 'N/A',
      isHigh: false,
      isUnspecified: !deductible || deductible === 'NO ESPECIFICADO',
    };
  }

  const lower = deductible.toLowerCase();

  // Extract percentage (handle both dot and comma as decimal separator)
  const percentMatch = deductible.match(/(\d+(?:[.,]\d+)?)\s*%/);
  const percentage = percentMatch ? parseFloat(percentMatch[1].replace(',', '.')) : null;

  // Extract minimum (SMMLV or values)
  const minMatch = deductible.match(
    /(?:m[ií]n\.?|mínimo)\s*:?\s*(\d+(?:\.\d+)?)\s*(?:SMMLV|salarios?)/i
  );
  const minimum = minMatch ? parseFloat(minMatch[1]) : null;

  // Base of application
  let appliesTo: 'perdida' | 'valor' | null = null;
  if (lower.includes('valor') || lower.includes('suma')) {
    appliesTo = 'valor';
  } else if (lower.includes('perdida') || lower.includes('siniestro')) {
    appliesTo = 'perdida';
  }

  return {
    percentage,
    minimum,
    appliesTo,
    rawText: deductible,
    isHigh: percentage ? percentage > 10 : false,
    isUnspecified: false,
  };
};

// Get color based on deductible risk for raw text fallbacks
const getDeductibleColor = (isHigh: boolean, isUnspecified: boolean): string => {
  if (isUnspecified) return 'bg-red-50 text-red-700 border-red-200';
  if (isHigh) return 'bg-amber-50 text-amber-700 border-amber-200';
  return 'bg-green-50 text-green-700 border-green-200';
};

export const DeductibleMatrix: React.FC<DeductibleMatrixProps> = ({ quotes }) => {
  // Calculate best/worst deductible per coverage
  const getDeductibleRanking = (categoryName: string) => {
    const deductibleScores = quotes.map((quote, idx) => {
      const coverage = quote.coverages?.find(
        (c) => c.canonicalName === categoryName || c.name === categoryName
      );

      if (!coverage || !coverage.deductible) return { idx, score: -1, deductible: 'N/A' };

      const parsed = parseDeductible(coverage.deductible);
      let score = 50; // Default

      if (parsed.isUnspecified) score = 0;
      else if (parsed.percentage !== null) {
        // Base score depends on percentage: lower percentage is better
        let pctScore = 100 - parsed.percentage * 5;
        // Applying to Loss (pérdida) is better than applying to Value (valor)
        if (parsed.appliesTo === 'perdida') pctScore += 20;
        else if (parsed.appliesTo === 'valor') pctScore -= 25;
        // Minimum adds risk, penalize slightly based on minimum size
        if (parsed.minimum) pctScore -= parsed.minimum * 2;
        score = Math.max(10, Math.min(95, pctScore));
      } else {
        score = parsed.isHigh ? 30 : 60;
      }

      return { idx, score, deductible: coverage.deductible };
    });

    const validScores = deductibleScores.filter((d) => d.score >= 0);
    if (validScores.length === 0) return { best: null, worst: null };

    const best = validScores.reduce((prev, curr) => (curr.score > prev.score ? curr : prev));
    const worst = validScores.reduce((prev, curr) => (curr.score < prev.score ? curr : prev));

    return { best, worst };
  };

  return (
    <div className="space-y-6">
      {/* Summary Panel */}
      <div className="bg-slate-50 rounded-xl border border-slate-200 p-6">
        <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center">
          <Shield className="mr-2 text-indigo-600" size={20} />
          Resumen de Deducibles
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white rounded-lg p-4 border border-green-200">
            <div className="flex items-center gap-2 mb-2">
              <Award className="text-green-600" size={16} />
              <span className="font-semibold text-green-700">Mejor Opción</span>
            </div>
            <p className="text-sm text-slate-600 font-medium">
              {quotes.length > 0
                ? quotes.reduce((prev, curr) => {
                    const prevScore =
                      prev.coverages?.filter(
                        (c) => c.deductible && c.deductible !== 'NO ESPECIFICADO'
                      ).length || 0;
                    const currScore =
                      curr.coverages?.filter(
                        (c) => c.deductible && c.deductible !== 'NO ESPECIFICADO'
                      ).length || 0;
                    return currScore > prevScore ? curr : prev;
                  }).insurerName
                : 'N/A'}
            </p>
          </div>

          <div className="bg-white rounded-lg p-4 border border-red-200">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="text-red-600" size={16} />
              <span className="font-semibold text-red-700">Requiere Atención</span>
            </div>
            <p className="text-sm text-slate-600 font-medium">
              {
                quotes.filter((q) =>
                  q.coverages?.some((c) => !c.deductible || c.deductible === 'NO ESPECIFICADO')
                ).length
              }{' '}
              aseguradoras con deducibles no especificados
            </p>
          </div>
        </div>
      </div>

      {/* Matrix */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600 uppercase font-bold text-xs border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-left sticky left-0 bg-slate-50 border-r border-slate-100 z-10 w-64">
                  Cobertura
                </th>
                {quotes.map((q, i) => (
                  <th key={i} className="px-4 py-3 text-center min-w-[180px]">
                    {q.insurerName}
                  </th>
                ))}
                <th className="px-4 py-3 text-center bg-amber-50 min-w-[120px]">
                  <TrendingDown size={16} className="inline mr-1" />
                  Mejor
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {PLANTILLA_ITEMS.map((categoryName, idx) => {
                const ranking = getDeductibleRanking(categoryName);

                return (
                  <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-4 py-3 font-semibold text-slate-700 sticky left-0 bg-white border-r border-slate-100 z-10">
                      {categoryName}
                    </td>

                    {quotes.map((quote, qIdx) => {
                      const coverage = quote.coverages?.find(
                        (c) => c.canonicalName === categoryName || c.name === categoryName
                      );

                      const parsed = coverage?.deductible
                        ? parseDeductible(coverage.deductible)
                        : null;
                      const isBest = ranking.best?.idx === qIdx;

                      return (
                        <td
                          key={qIdx}
                          className={`px-4 py-4 text-center transition-colors ${isBest ? 'bg-green-50/40' : ''} border-r border-slate-100`}
                        >
                          {coverage ? (
                            <div className="flex flex-col items-center justify-center space-y-2">
                              {/* Semicolon-delimited list parsing if contains semicolon */}
                              {coverage.deductible && coverage.deductible.includes(';') ? (
                                <div className="flex flex-col gap-2 w-full">
                                  {coverage.deductible.split(';').map((part, pIdx) => {
                                    const trimmed = part.trim();
                                    if (!trimmed) return null;
                                    const partParsed = parseDeductible(trimmed);
                                    return (
                                      <div
                                        key={pIdx}
                                        className="flex flex-col items-center border border-slate-100 p-1.5 rounded bg-slate-50/50"
                                      >
                                        {partParsed.percentage !== null ? (
                                          <div className="flex flex-col items-center">
                                            <span
                                              className={`text-xs font-extrabold ${partParsed.isHigh ? 'text-amber-600' : 'text-slate-800'}`}
                                            >
                                              {partParsed.percentage}%
                                            </span>
                                            {partParsed.minimum !== null && (
                                              <span className="text-[9px] text-slate-500 font-medium">
                                                Mín. {partParsed.minimum} SMMLV
                                              </span>
                                            )}
                                          </div>
                                        ) : (
                                          <div
                                            className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border ${getDeductibleColor(partParsed.isHigh, partParsed.isUnspecified)}`}
                                          >
                                            {partParsed.rawText}
                                          </div>
                                        )}
                                        {partParsed.appliesTo && (
                                          <div
                                            className={`text-[8px] px-1 py-0.2 mt-1 rounded font-semibold border ${partParsed.appliesTo === 'perdida' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-rose-50 text-rose-700 border-rose-200'}`}
                                          >
                                            {partParsed.appliesTo === 'perdida'
                                              ? 'Pérdida'
                                              : 'Valor As.'}
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              ) : (
                                <>
                                  {/* Percentage and Minimum */}
                                  {parsed && parsed.percentage !== null ? (
                                    <div className="flex flex-col items-center">
                                      <span
                                        className={`text-base font-extrabold ${parsed.isHigh ? 'text-amber-600' : 'text-slate-800'}`}
                                      >
                                        {parsed.percentage}%
                                      </span>
                                      {parsed.minimum !== null && (
                                        <span className="text-[10px] text-slate-500 font-medium">
                                          Mín. {parsed.minimum} SMMLV
                                        </span>
                                      )}
                                    </div>
                                  ) : (
                                    <div
                                      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${
                                        parsed
                                          ? getDeductibleColor(parsed.isHigh, parsed.isUnspecified)
                                          : 'bg-gray-100 text-slate-600 border-gray-200'
                                      }`}
                                    >
                                      {parsed?.rawText || 'N/A'}
                                    </div>
                                  )}
                                </>
                              )}

                              {/* Base of Application Badge */}
                              {(!coverage.deductible || !coverage.deductible.includes(';')) &&
                                parsed &&
                                parsed.appliesTo && (
                                  <div
                                    className={`text-[10px] px-1.5 py-0.5 rounded font-semibold border ${
                                      parsed.appliesTo === 'perdida'
                                        ? 'bg-green-50 text-green-700 border-green-200'
                                        : 'bg-rose-50 text-rose-700 border-rose-200'
                                    }`}
                                  >
                                    {parsed.appliesTo === 'perdida'
                                      ? 'Sobre Pérdida'
                                      : 'Sobre Valor As.'}
                                  </div>
                                )}

                              {/* Trophy/Star Indicator for Best option */}
                              {isBest && (
                                <div className="flex items-center gap-1 text-[10px] font-bold text-green-700 bg-green-100/60 px-1.5 py-0.5 rounded border border-green-200">
                                  <Award size={10} className="text-green-600 animate-pulse" />
                                  <span>Mejor Opción</span>
                                </div>
                              )}

                              {/* Sum Insured detail */}
                              {coverage.value &&
                                coverage.value !== 'NO ESPECIFICADO' &&
                                coverage.value !== 'No aplica' && (
                                  <div className="text-[10px] text-slate-400 font-medium">
                                    SA:{' '}
                                    {typeof coverage.value === 'string' &&
                                    /^\d+$/.test(coverage.value)
                                      ? formatCOP(parseFloat(coverage.value))
                                      : coverage.value}
                                  </div>
                                )}

                              {/* Sublimit detail */}
                              {coverage.sublimit && coverage.sublimit !== 'NO ESPECIFICADO' && (
                                <div className="text-[10px] text-indigo-600 font-semibold bg-indigo-50 border border-indigo-100 rounded px-1.5 py-0.5">
                                  Sublímite: {coverage.sublimit}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-300 italic text-xs">No incluida</span>
                          )}
                        </td>
                      );
                    })}

                    <td className="px-4 py-3 text-center bg-amber-50/30">
                      {ranking.best ? (
                        <div className="text-xs font-semibold text-green-700">
                          {quotes[ranking.best.idx].insurerName}
                        </div>
                      ) : (
                        <span className="text-slate-400 text-xs">-</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default DeductibleMatrix;
