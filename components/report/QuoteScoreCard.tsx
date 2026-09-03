import React from 'react';
import { formatCOP } from '../../utils/formatCurrency';
import { CorrectionUI } from '../CorrectionUI';
import type { QuoteAnalysis } from '../../types';

export interface QuoteCorrection {
  field: string;
  originalValue: string;
  correctedValue: string;
  reason?: string;
}

interface QuoteScoreCardProps {
  quote: QuoteAnalysis;
  isBest: boolean;
  viewMode: 'technical' | 'client';
  onCorrection: (quote: QuoteAnalysis, correction: QuoteCorrection) => void;
}

/**
 * ARCH-1: per-quote scoring card for the summary dashboard — score, price,
 * verification/extraction confidence and (technical view) corrections.
 */
export const QuoteScoreCard: React.FC<QuoteScoreCardProps> = ({
  quote: q,
  isBest,
  viewMode,
  onCorrection,
}) => {
  return (
    <div
      className={`relative rounded-xl p-6 border transition-all hover:shadow-lg ${isBest ? 'bg-gradient-to-br from-indigo-50 to-white border-indigo-200 shadow-md' : 'bg-white border-slate-200'}`}
    >
      {isBest && (
        <div className="absolute top-0 right-0 bg-indigo-600 text-white text-xs px-2 py-1 rounded-bl-lg rounded-tr-lg font-bold">
          MEJOR OPCIÓN
        </div>
      )}
      <h3 className="text-lg font-bold text-slate-800 mb-2">{q.insurerName}</h3>
      <div className="flex items-end gap-2 mb-4">
        <span className={`text-4xl font-bold ${isBest ? 'text-indigo-600' : 'text-slate-700'}`}>
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
            {q.validationFlags && q.validationFlags.length > 0 && viewMode === 'technical' && (
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
            onCorrection(q, correction);
          }}
        />
      )}
    </div>
  );
};

export default QuoteScoreCard;
