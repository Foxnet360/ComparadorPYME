import React, { useState, useMemo } from 'react';
import { HelpCircle, Check, ShieldQuestion, Sparkles, CheckCircle2, ChevronRight } from 'lucide-react';
import type { QuoteAnalysis, CoverageItem } from '../../types';

interface DisambiguationCandidate {
  rawName: string;
  insurerName: string;
  suggestedCanonicalName: string;
  suggestedGroupId: string;
  confidence: number;
  justification?: string;
}

interface DisambiguationCardProps {
  quotes: QuoteAnalysis[];
  onDisambiguate?: (
    rawName: string,
    insurerName: string,
    canonicalGroupId: string,
    action: 'confirm' | 'keep_autonomous'
  ) => Promise<void>;
}

export const DisambiguationCard: React.FC<DisambiguationCardProps> = ({ quotes, onDisambiguate }) => {
  // Collect candidate coverages that have ambiguous confidence (50% - 84%) or needsHumanReview
  const candidates: DisambiguationCandidate[] = useMemo(() => {
    const list: DisambiguationCandidate[] = [];
    const seen = new Set<string>();

    for (const q of quotes) {
      for (const cov of q.coverages || []) {
        const conf = cov.matchConfidence ?? 0;
        const isAmbiguous = (conf >= 0.5 && conf < 0.85) || cov.needsHumanReview;

        if (isAmbiguous && cov.name && cov.canonicalName) {
          const key = `${q.insurerName}::${cov.name}`;
          if (!seen.has(key)) {
            seen.add(key);
            list.push({
              rawName: cov.name,
              insurerName: q.insurerName,
              suggestedCanonicalName: cov.canonicalName,
              suggestedGroupId: cov.canonicalName,
              confidence: Math.round(conf * 100),
              justification: cov.justification || 'Correspondencia semántica tentativa detectada en el documento.',
            });
          }
        }
      }
    }

    // Limit to max 3 items to avoid cognitive fatigue
    return list.slice(0, 3);
  }, [quotes]);

  const [resolvedState, setResolvedState] = useState<Record<string, { action: string; label: string }>>({});
  const [loadingKey, setLoadingKey] = useState<string | null>(null);

  if (candidates.length === 0) {
    return null;
  }

  const handleAction = async (
    candidate: DisambiguationCandidate,
    action: 'confirm' | 'keep_autonomous'
  ) => {
    const key = `${candidate.insurerName}::${candidate.rawName}`;
    setLoadingKey(key);

    try {
      if (onDisambiguate) {
        await onDisambiguate(
          candidate.rawName,
          candidate.insurerName,
          candidate.suggestedGroupId,
          action
        );
      } else {
        // Default API invocation
        await fetch('/api/analysis/disambiguate-coverage', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            rawName: candidate.rawName,
            insurerName: candidate.insurerName,
            canonicalGroupId: candidate.suggestedGroupId,
            action,
          }),
        });
      }

      setResolvedState((prev) => ({
        ...prev,
        [key]: {
          action,
          label:
            action === 'confirm'
              ? `Asociada a "${candidate.suggestedCanonicalName}"`
              : 'Preservada como amparo independiente',
        },
      }));
    } catch (err) {
      console.error('Error disambiguating coverage:', err);
    } finally {
      setLoadingKey(null);
    }
  };

  return (
    <div className="bg-gradient-to-r from-amber-50/70 via-indigo-50/30 to-white rounded-xl border border-amber-200/90 shadow-sm p-5 space-y-4 mb-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-amber-100 text-amber-800 rounded-lg">
            <HelpCircle size={18} />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              Validación Activa de Ontología (1 Clic)
              <span className="text-[11px] bg-amber-200/80 text-amber-900 font-semibold px-2 py-0.5 rounded-full">
                {candidates.length} sugerencia{candidates.length > 1 ? 's' : ''}
              </span>
            </h4>
            <p className="text-xs text-slate-500">
              Detectamos términos con confianza intermedia. Tu validación entrena al motor para futuras cotizaciones.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {candidates.map((cand) => {
          const key = `${cand.insurerName}::${cand.rawName}`;
          const isResolved = !!resolvedState[key];
          const isLoading = loadingKey === key;

          if (isResolved) {
            return (
              <div
                key={key}
                className="bg-emerald-50/90 border border-emerald-300 rounded-xl p-3 flex items-center gap-2.5 text-xs text-emerald-800 animate-in fade-in duration-300"
              >
                <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
                <div>
                  <span className="font-bold">{cand.insurerName}</span>: {cand.rawName}
                  <div className="text-[11px] text-emerald-700">
                    ✅ {resolvedState[key]?.label}
                  </div>
                </div>
              </div>
            );
          }

          return (
            <div
              key={key}
              className="bg-white rounded-xl border border-slate-200 p-3.5 flex flex-col justify-between shadow-xs space-y-3"
            >
              <div>
                <div className="flex justify-between items-start gap-2 mb-1.5">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                    {cand.insurerName}
                  </span>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 bg-amber-100 text-amber-800 rounded">
                    {cand.confidence}% certeza
                  </span>
                </div>
                <div className="font-bold text-slate-900 text-xs mb-1">
                  "{cand.rawName}"
                </div>
                <div className="text-[11px] text-slate-600 flex items-center gap-1">
                  <span className="text-slate-400">¿Asociar a:</span>
                  <span className="font-semibold text-indigo-700 underline decoration-indigo-300">
                    {cand.suggestedCanonicalName}
                  </span>
                  <span className="text-slate-400">?</span>
                </div>
                {cand.justification && (
                  <p className="text-[10px] text-slate-400 italic mt-1 line-clamp-2">
                    {cand.justification}
                  </p>
                )}
              </div>

              <div className="flex gap-2 pt-1 border-t border-slate-100">
                <button
                  disabled={isLoading}
                  onClick={() => handleAction(cand, 'confirm')}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-[11px] py-1 px-2 rounded-lg transition-colors flex items-center justify-center gap-1 shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  <Check size={13} />
                  <span>Confirmar</span>
                </button>
                <button
                  disabled={isLoading}
                  onClick={() => handleAction(cand, 'keep_autonomous')}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] py-1 px-2 rounded-lg transition-colors font-medium disabled:opacity-50 cursor-pointer"
                  title="Conservar amparo autónomo sin asociar a ninguna categoría"
                >
                  Independiente
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default DisambiguationCard;
