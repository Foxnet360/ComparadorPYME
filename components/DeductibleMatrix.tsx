import React from 'react';
import { QuoteAnalysis } from '../types';
import { Shield, AlertTriangle, Award } from 'lucide-react';
import { DeductibleBadge } from './DeductibleBadge';

interface DeductibleMatrixProps {
  quotes: QuoteAnalysis[];
}

// Normaliza variaciones puntuadas de S.M.M.L.V. a SMMLV para presentación y parseo
const normalizeDeductibleDisplay = (text: string): string => {
  if (!text) return text;
  return text.replace(/\bS\.?\s*M\.?\s*M\.?\s*L\.?\s*V\.?\b/gi, 'SMMLV');
};

const isUnspecifiedDeductible = (value: string | undefined): boolean => {
  if (!value) return true;
  const normalized = normalizeDeductibleDisplay(value).toUpperCase().trim();
  return (
    normalized === 'NO ESPECIFICADO' ||
    normalized === 'NO ESPECIFICADA' ||
    normalized === 'NO APLICA' ||
    normalized === 'N/A' ||
    normalized === 'SIN DEDUCIBLE'
  );
};

interface ParsedDeductible {
  percentage: number | null;
  minimum: number | null;
  rawText: string;
  isUnspecified: boolean;
}

const parseDeductible = (deductible: string): ParsedDeductible => {
  const normalizedDeductible = normalizeDeductibleDisplay(deductible);

  if (
    !normalizedDeductible ||
    normalizedDeductible === 'No aplica' ||
    isUnspecifiedDeductible(normalizedDeductible)
  ) {
    return {
      percentage: null,
      minimum: null,
      rawText: normalizedDeductible || 'N/A',
      isUnspecified: true,
    };
  }

  // Extract percentage (handle both dot and comma as decimal separator)
  const percentMatch = normalizedDeductible.match(/(\d+(?:[.,]\d+)?)\s*%/);
  const percentage = percentMatch ? parseFloat(percentMatch[1].replace(',', '.')) : null;

  // Extract minimum (SMMLV or salaries)
  const minMatch = normalizedDeductible.match(
    /(?:m[ií]n\.?|mínimo)\s*:?\s*(\d+(?:\.\d+)?)\s*(?:SMMLV|salarios?)/i
  );
  const minimum = minMatch ? parseFloat(minMatch[1]) : null;

  return {
    percentage,
    minimum,
    rawText: normalizedDeductible,
    isUnspecified: false,
  };
};

// Lower score = better deductible. Mixed units (percentage vs. SMMLV) are compared
// heuristically; this is acceptable for a visual "best" indicator, not a financial decision.
const deductibleScore = (deductible: string): number => {
  const parsed = parseDeductible(deductible);
  if (parsed.isUnspecified) return Infinity;
  if (parsed.percentage !== null && parsed.percentage > 0) return parsed.percentage;
  if (parsed.minimum !== null && parsed.minimum > 0) return parsed.minimum;
  return 0;
};

export const DeductibleMatrix: React.FC<DeductibleMatrixProps> = ({ quotes }) => {
  // Build a row for every coverage that has a deductible in at least one quote.
  const deductibleRows = new Map<
    string,
    Array<{ quoteIdx: number; deductible: string }>
  >();

  quotes.forEach((quote, quoteIdx) => {
    quote.coverages.forEach((coverage) => {
      if (!coverage.deductible) return;
      const coverageName = coverage.canonicalName || coverage.name;
      if (!deductibleRows.has(coverageName)) {
        deductibleRows.set(coverageName, []);
      }
      deductibleRows.get(coverageName)!.push({ quoteIdx, deductible: coverage.deductible });
    });
  });

  const sortedRows = Array.from(deductibleRows.entries())
    .filter(([, entries]) => entries.some((e) => !isUnspecifiedDeductible(e.deductible)))
    .sort(([a], [b]) => a.localeCompare(b));

  // Summary: quote with the most specified deductibles is considered the best option
  const deductibleCounts = quotes.map(
    (q) => q.coverages.filter((c) => c.deductible && !isUnspecifiedDeductible(c.deductible)).length
  );
  const bestQuoteIdx =
    deductibleCounts.length > 0
      ? deductibleCounts.reduce((bestIdx, count, idx, arr) =>
          count > arr[bestIdx] ? idx : bestIdx
        )
      : 0;
  const bestQuote = quotes[bestQuoteIdx];

  const quotesWithUnspecified = quotes.filter((q) =>
    q.coverages.some((c) => !c.deductible || isUnspecifiedDeductible(c.deductible))
  );

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
              {bestQuote ? bestQuote.insurerName : 'N/A'}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              {bestQuote
                ? `${deductibleCounts[bestQuoteIdx]} deducibles especificados`
                : 'Sin datos'}
            </p>
          </div>

          <div className="bg-white rounded-lg p-4 border border-red-200">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="text-red-600" size={16} />
              <span className="font-semibold text-red-700">Requiere Atención</span>
            </div>
            <p className="text-sm text-slate-600 font-medium">
              {quotesWithUnspecified.length === 0
                ? 'Ninguna aseguradora tiene deducibles no especificados'
                : `${quotesWithUnspecified.length} aseguradora${
                    quotesWithUnspecified.length > 1 ? 's' : ''
                  } con deducibles no especificados`}
            </p>
          </div>
        </div>
      </div>

      {/* Deductible-only Grid */}
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
                  <Award size={16} className="inline mr-1" />
                  Mejor
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sortedRows.map(([coverageName, entries]) => {
                const validEntries = entries.filter(
                  (e) => !isUnspecifiedDeductible(e.deductible)
                );
                const bestEntry =
                  validEntries.length > 0
                    ? validEntries.reduce((best, e) =>
                        deductibleScore(e.deductible) < deductibleScore(best.deductible) ? e : best
                      )
                    : null;

                return (
                  <tr key={coverageName} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-4 py-3 font-semibold text-slate-700 sticky left-0 bg-white border-r border-slate-100 z-10">
                      {coverageName}
                    </td>

                    {quotes.map((quote, qIdx) => {
                      const entry = entries.find((e) => e.quoteIdx === qIdx);
                      const isBest = bestEntry && entry && entry.quoteIdx === bestEntry.quoteIdx;

                      return (
                        <td
                          key={qIdx}
                          className={`px-4 py-4 text-center transition-colors ${
                            isBest ? 'bg-green-50/40' : ''
                          } border-r border-slate-100`}
                        >
                          {entry ? (
                            <div className="flex flex-col items-center justify-center gap-1">
                              <DeductibleBadge deductible={entry.deductible} />
                              {isBest && (
                                <div className="flex items-center gap-1 text-[10px] font-bold text-green-700 bg-green-100/60 px-1.5 py-0.5 rounded border border-green-200">
                                  <Award size={10} className="text-green-600" />
                                  <span>Mejor</span>
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-300 italic text-xs">No especificado</span>
                          )}
                        </td>
                      );
                    })}

                    <td className="px-4 py-3 text-center bg-amber-50/30">
                      {bestEntry ? (
                        <div className="text-xs font-semibold text-green-700">
                          {quotes[bestEntry.quoteIdx].insurerName}
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
