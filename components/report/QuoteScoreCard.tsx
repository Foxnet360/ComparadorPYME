import React from 'react';
import { formatCOP } from '../../utils/formatCurrency';
import { CorrectionUI } from '../CorrectionUI';
import { InsurerLogo } from '../common/InsurerLogo';
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
      <div className="flex items-center gap-3 mb-3">
        <InsurerLogo insurerName={q.insurerName} size="md" />
        <div>
          <h3 className="text-lg font-bold text-slate-800 leading-tight">{q.insurerName}</h3>
          <p className="text-xs text-slate-400 font-medium">{q.policyName}</p>
        </div>
      </div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
            Calidad de Cobertura
          </span>
          <div className="flex items-baseline gap-1.5">
            <span
              className={`text-4xl font-extrabold ${isBest ? 'text-indigo-600' : 'text-slate-800'}`}
              title="Calificación técnica ponderada de coberturas, deducibles y condiciones comerciales"
            >
              {q.dataQualityScore || q.score}
            </span>
            <span className="text-sm text-slate-400">/ 100</span>
          </div>
        </div>

        {/* Verification Confidence Badge */}
        {q.verificationConfidence !== undefined && q.verificationConfidence > 0 && viewMode === 'technical' && (
          <div className="text-right">
            <span className="text-[10px] text-slate-400 block font-medium">Verificación Cruzada</span>
            <span
              className={`text-xs font-bold px-2.5 py-0.5 rounded-full inline-block border ${
                q.verificationConfidence >= 80
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : q.verificationConfidence >= 50
                    ? 'bg-amber-50 text-amber-700 border-amber-200'
                    : 'bg-rose-50 text-rose-700 border-rose-200'
              }`}
              title="Porcentaje de consistencia entre extracción multimodal y validación cruzada"
            >
              {q.verificationConfidence}% match
            </span>
          </div>
        )}
      </div>

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

        {/* Confidence Indicator: framed as Documental Digitalization Certainty */}
        {q.extractionConfidence !== undefined && (
          <div className="mt-3 pt-3 border-t border-slate-100">
            <div className="flex items-center justify-between mb-1">
              <span
                className="text-xs text-slate-500 flex items-center gap-1 cursor-help"
                title="Certeza de lectura digital: mide la nitidez y legibilidad del texto en el PDF de origen, no la calidad de la póliza"
              >
                <span>Certeza de Lectura Documental</span>
                <span className="text-[10px] text-slate-400 underline decoration-dotted">ℹ️</span>
              </span>
              <span
                className={`text-xs font-bold ${
                  q.extractionConfidence >= 90
                    ? 'text-emerald-600'
                    : q.extractionConfidence >= 75
                      ? 'text-amber-600'
                      : q.extractionConfidence >= 50
                        ? 'text-orange-600'
                        : 'text-rose-600'
                }`}
              >
                {q.extractionConfidence}%
                {q.needsReview && (
                  <span className="ml-1" title="Requiere confirmación visual en el PDF original">
                    ⚠️
                  </span>
                )}
              </span>
            </div>
            <div className="h-1 w-full bg-slate-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${
                  q.extractionConfidence >= 90
                    ? 'bg-emerald-500'
                    : q.extractionConfidence >= 75
                      ? 'bg-amber-400'
                      : q.extractionConfidence >= 50
                        ? 'bg-orange-400'
                        : 'bg-rose-400'
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
