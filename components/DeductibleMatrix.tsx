import React from 'react';
import { MatrixRow, QuoteAnalysis, QuoteMetadata } from '../types';
import { Shield, AlertTriangle, Award, Building, Home } from 'lucide-react';
import { DeductibleBadge } from './DeductibleBadge';

interface DeductibleMatrixProps {
  quotes: QuoteAnalysis[];
  matrix?: MatrixRow[];
  metadata?: QuoteMetadata[];
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
    normalized === 'SIN DEDUCIBLE' ||
    normalized.includes('NO COTIZAD')
  );
};

interface ParsedDeductible {
  percentage: number | null;
  minimum: number | null;
  rawText: string;
  isUnspecified: boolean;
  isNotApplicable: boolean;
  isZeroDeductible: boolean;
}

const parseDeductible = (deductible: string): ParsedDeductible => {
  const normalizedDeductible = normalizeDeductibleDisplay(deductible);
  const upper = normalizedDeductible?.toUpperCase().trim() || '';

  if (upper.includes('NO COTIZAD') || (upper.includes('NO APLICA') && upper.includes('COTIZAD'))) {
    return {
      percentage: null,
      minimum: null,
      rawText: normalizedDeductible,
      isUnspecified: true,
      isNotApplicable: true,
      isZeroDeductible: false,
    };
  }

  if (upper === 'SIN DEDUCIBLE' || upper === '0%' || upper === '0 %') {
    return {
      percentage: 0,
      minimum: 0,
      rawText: normalizedDeductible,
      isUnspecified: false,
      isNotApplicable: false,
      isZeroDeductible: true,
    };
  }

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
      isNotApplicable: false,
      isZeroDeductible: false,
    };
  }

  // Extract percentage (handle both dot and comma as decimal separator)
  const percentMatch = normalizedDeductible.match(/(\d+(?:[.,]\d+)?)\s*%/);
  const percentage = percentMatch ? parseFloat(percentMatch[1]!.replace(',', '.')) : null;

  // Extract minimum (SMMLV or salaries)
  const minMatch = normalizedDeductible.match(
    /(?:m[ií]n\.?|mínimo)\s*:?\s*(\d+(?:\.\d+)?)\s*(?:SMMLV|salarios?)/i
  );
  const minimum = minMatch ? parseFloat(minMatch[1]!) : null;

  return {
    percentage,
    minimum,
    rawText: normalizedDeductible,
    isUnspecified: false,
    isNotApplicable: false,
    isZeroDeductible: false,
  };
};

// Lower score = better deductible.
const deductibleScore = (deductible: string): number => {
  const parsed = parseDeductible(deductible);
  if (parsed.isNotApplicable) return 9999;
  if (parsed.isUnspecified) return Infinity;
  if (parsed.isZeroDeductible) return 0;
  if (parsed.percentage !== null && parsed.percentage > 0) return parsed.percentage;
  if (parsed.minimum !== null && parsed.minimum > 0) return parsed.minimum;
  return 0;
};

interface QuoteTypology {
  typology: 'integral' | 'edificio' | 'contenido' | 'general';
  label: string;
  edificioValue?: string;
  contenidoValue?: string;
}

const detectQuoteTypologies = (
  quotes: QuoteAnalysis[],
  matrix?: MatrixRow[],
  metadata?: QuoteMetadata[]
): QuoteTypology[] => {
  return quotes.map((quote, idx) => {
    let edificioVal: string | undefined;
    let contenidoVal: string | undefined;

    if (matrix && matrix.length > 0) {
      for (const row of matrix) {
        if (row.type !== 'data') continue;
        const norm = row.label.toLowerCase();
        if (norm.includes('edificio') || norm.includes('estructura')) {
          const val = row.cells[idx]?.value;
          if (
            val &&
            !val.toLowerCase().includes('no cotizado') &&
            !val.toLowerCase().includes('no informado') &&
            val !== '-'
          ) {
            edificioVal = val;
          }
        }
        if (norm.includes('contenido') || norm.includes('muebles')) {
          const val = row.cells[idx]?.value;
          if (
            val &&
            !val.toLowerCase().includes('no cotizado') &&
            !val.toLowerCase().includes('no informado') &&
            val !== '-'
          ) {
            contenidoVal = val;
          }
        }
      }
    }

    const metaTipo = metadata?.[idx]?.tipoSeguro?.toLowerCase() || '';
    const hasEdificio =
      !!edificioVal || metaTipo.includes('edificio') || metaTipo.includes('estructura');
    const hasContenido = !!contenidoVal || metaTipo.includes('contenido');

    if (hasEdificio && hasContenido) {
      return {
        typology: 'integral',
        label: 'Integral (Edificio + Contenido)',
        edificioValue: edificioVal || 'Cotizado',
        contenidoValue: contenidoVal || 'Cotizado',
      };
    }
    if (hasEdificio) {
      return {
        typology: 'edificio',
        label: 'Solo Edificio / Estructura',
        edificioValue: edificioVal || 'Cotizado',
        contenidoValue: 'No Cotizado',
      };
    }
    if (hasContenido) {
      return {
        typology: 'contenido',
        label: 'Solo Contenidos',
        edificioValue: 'No Cotizado',
        contenidoValue: contenidoVal || 'Cotizado',
      };
    }

    return {
      typology: 'general',
      label: 'Integral / Estándar',
      edificioValue: edificioVal,
      contenidoValue: contenidoVal,
    };
  });
};

interface DeductibleTableRow {
  conceptName: string;
  entries: Array<{ quoteIdx: number; deductible: string }>;
}

export const DeductibleMatrix: React.FC<DeductibleMatrixProps> = ({ quotes, matrix, metadata }) => {
  const typologies = detectQuoteTypologies(quotes, matrix, metadata);

  // Extract deductible rows: prioritize V2 matrix rows when available
  const matrixDeductibleRows: DeductibleTableRow[] = [];

  if (matrix && matrix.length > 0) {
    matrix.forEach((row) => {
      if (row.type !== 'data') return;
      const norm = row.label.toLowerCase();
      const isDeductible = row.sectionId === 50 || norm.includes('deducible');
      if (!isDeductible) return;

      const cleanLabel = row.label.replace(/^deducible\s*(de\s*|por\s*)?/i, '').trim();
      const formattedLabel = cleanLabel.charAt(0).toUpperCase() + cleanLabel.slice(1);

      matrixDeductibleRows.push({
        conceptName: formattedLabel,
        entries: quotes.map((_, qIdx) => ({
          quoteIdx: qIdx,
          deductible: row.cells[qIdx]?.value || 'No informado',
        })),
      });
    });
  }

  // Fallback to quote.coverages for V1
  let finalRows: DeductibleTableRow[] = [];

  if (matrixDeductibleRows.length > 0) {
    finalRows = matrixDeductibleRows;
  } else {
    const deductibleRowsMap = new Map<string, Array<{ quoteIdx: number; deductible: string }>>();
    quotes.forEach((quote, quoteIdx) => {
      quote.coverages.forEach((coverage) => {
        if (!coverage.deductible) return;
        const coverageName = coverage.canonicalName || coverage.name;
        if (!deductibleRowsMap.has(coverageName)) {
          deductibleRowsMap.set(coverageName, []);
        }
        deductibleRowsMap.get(coverageName)!.push({ quoteIdx, deductible: coverage.deductible });
      });
    });

    finalRows = Array.from(deductibleRowsMap.entries())
      .filter(([, entries]) => entries.some((e) => !isUnspecifiedDeductible(e.deductible)))
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([conceptName, entries]) => ({ conceptName, entries }));
  }

  // Summary counts
  const deductibleCounts = quotes.map((_, qIdx) => {
    return finalRows.filter((r) => {
      const entry = r.entries.find((e) => e.quoteIdx === qIdx);
      return entry && !isUnspecifiedDeductible(entry.deductible);
    }).length;
  });

  const bestQuoteIdx =
    deductibleCounts.length > 0
      ? deductibleCounts.reduce((bestIdx, count, idx, arr) =>
          count > arr[bestIdx]! ? idx : bestIdx
        )
      : 0;
  const bestQuote = quotes[bestQuoteIdx];

  const quotesWithUnspecified = quotes.filter((_, qIdx) =>
    finalRows.some((r) => {
      const entry = r.entries.find((e) => e.quoteIdx === qIdx);
      return !entry || isUnspecifiedDeductible(entry.deductible);
    })
  );

  return (
    <div className="space-y-6">
      {/* Panel de Tipología de Cotizaciones (Hogar / Multiriesgo) */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
        <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-3 flex items-center gap-2">
          <Building className="text-indigo-600" size={18} />
          Modalidad de Aseguramiento por Propuesta
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {quotes.map((quote, qIdx) => {
            const typo = typologies[qIdx]!;
            return (
              <div
                key={qIdx}
                className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col justify-between space-y-2.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-slate-800 text-sm truncate">
                    {quote.insurerName}
                  </span>
                  <span
                    className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full whitespace-nowrap ${
                      typo.typology === 'integral'
                        ? 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                        : typo.typology === 'edificio'
                        ? 'bg-amber-100 text-amber-800 border border-amber-200'
                        : typo.typology === 'contenido'
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                        : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {typo.label}
                  </span>
                </div>
                <div className="text-xs text-slate-500 space-y-1 pt-2 border-t border-slate-200/80">
                  <div className="flex justify-between items-center">
                    <span className="flex items-center gap-1.5">
                      <Building size={12} className="text-slate-400" />
                      Edificio / Estructura:
                    </span>
                    <span
                      className={`font-semibold ${
                        typo.edificioValue === 'No Cotizado'
                          ? 'text-slate-400 italic'
                          : 'text-slate-700'
                      }`}
                    >
                      {typo.edificioValue || 'No informado'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="flex items-center gap-1.5">
                      <Home size={12} className="text-slate-400" />
                      Contenidos / Enseres:
                    </span>
                    <span
                      className={`font-semibold ${
                        typo.contenidoValue === 'No Cotizado'
                          ? 'text-slate-400 italic'
                          : 'text-slate-700'
                      }`}
                    >
                      {typo.contenidoValue || 'No informado'}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Summary Panel */}
      <div className="bg-slate-50 rounded-xl border border-slate-200 p-6">
        <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center">
          <Shield className="mr-2 text-indigo-600" size={20} />
          Resumen Comparativo de Deducibles
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white rounded-lg p-4 border border-green-200">
            <div className="flex items-center gap-2 mb-2">
              <Award className="text-green-600" size={16} />
              <span className="font-semibold text-green-700">Mayor Claridad de Copagos</span>
            </div>
            <p className="text-sm text-slate-600 font-medium">
              {bestQuote ? bestQuote.insurerName : 'N/A'}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              {bestQuote
                ? `${deductibleCounts[bestQuoteIdx]} deducibles con condiciones claras`
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
                ? 'Todas las aseguradoras cuentan con deducibles especificados'
                : `${quotesWithUnspecified.length} aseguradora${
                    quotesWithUnspecified.length > 1 ? 's' : ''
                  } con deducibles sujetos a verificación o no informados`}
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
                <th className="px-4 py-3.5 text-left sticky left-0 bg-slate-50 border-r border-slate-100 z-10 w-72">
                  Amparo / Concepto de Deducible
                </th>
                {quotes.map((q, i) => {
                  const typo = typologies[i]!;
                  return (
                    <th key={i} className="px-4 py-3 text-center min-w-[200px]">
                      <div className="flex flex-col items-center gap-1">
                        <span className="font-bold text-slate-800">{q.insurerName}</span>
                        <span
                          className={`text-[10px] font-normal px-2 py-0.5 rounded-full ${
                            typo.typology === 'integral'
                              ? 'bg-indigo-100 text-indigo-700'
                              : typo.typology === 'edificio'
                              ? 'bg-amber-100 text-amber-700'
                              : typo.typology === 'contenido'
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {typo.label}
                        </span>
                      </div>
                    </th>
                  );
                })}
                <th className="px-4 py-3 text-center bg-amber-50/70 min-w-[130px]">
                  <Award size={16} className="inline mr-1 text-amber-600" />
                  Condición Favorable
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {finalRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={quotes.length + 2}
                    className="px-6 py-8 text-center text-slate-400 italic"
                  >
                    No se encontraron deducibles detallados en las cotizaciones analizadas.
                  </td>
                </tr>
              ) : (
                finalRows.map((row) => {
                  const validEntries = row.entries.filter(
                    (e) => !isUnspecifiedDeductible(e.deductible)
                  );
                  const bestEntry =
                    validEntries.length > 0
                      ? validEntries.reduce((best, e) =>
                          deductibleScore(e.deductible) < deductibleScore(best.deductible)
                            ? e
                            : best
                        )
                      : null;

                  return (
                    <tr key={row.conceptName} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-4 py-3.5 font-semibold text-slate-800 sticky left-0 bg-white border-r border-slate-100 z-10">
                        {row.conceptName}
                      </td>

                      {quotes.map((quote, qIdx) => {
                        const entry = row.entries.find((e) => e.quoteIdx === qIdx);
                        const isBest =
                          bestEntry &&
                          entry &&
                          entry.quoteIdx === bestEntry.quoteIdx &&
                          deductibleScore(entry.deductible) < 9999;

                        return (
                          <td
                            key={qIdx}
                            className={`px-4 py-3.5 text-center transition-colors ${
                              isBest ? 'bg-green-50/40' : ''
                            } border-r border-slate-100`}
                          >
                            {entry ? (
                              <div className="flex flex-col items-center justify-center gap-1">
                                <DeductibleBadge deductible={entry.deductible} />
                                {isBest && (
                                  <div className="flex items-center gap-1 text-[10px] font-bold text-green-700 bg-green-100/70 px-2 py-0.5 rounded border border-green-300">
                                    <Award size={10} className="text-green-600" />
                                    <span>Menor deducible</span>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="text-slate-300 italic text-xs">No especificado</span>
                            )}
                          </td>
                        );
                      })}

                      <td className="px-4 py-3.5 text-center bg-amber-50/30">
                        {bestEntry && deductibleScore(bestEntry.deductible) < 9999 ? (
                          <div className="text-xs font-semibold text-green-700">
                            {quotes[bestEntry.quoteIdx]!.insurerName}
                          </div>
                        ) : (
                          <span className="text-slate-400 text-xs">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default DeductibleMatrix;
