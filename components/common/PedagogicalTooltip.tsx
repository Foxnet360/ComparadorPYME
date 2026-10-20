import React, { useState } from 'react';
import { HelpCircle, ShieldCheck, Scale, Sparkles, BookOpen } from 'lucide-react';
import { findPedagogicalExplanation } from '@shared/domainRegulatoryKnowledge';

interface PedagogicalTooltipProps {
  label: string;
  valueOrDeductible?: string | null;
  category?: 'coverage' | 'deductible';
  className?: string;
}

export const PedagogicalTooltip: React.FC<PedagogicalTooltipProps> = ({
  label,
  valueOrDeductible,
  category = 'coverage',
  className = '',
}) => {
  const [open, setOpen] = useState(false);
  const explanation = findPedagogicalExplanation(label, valueOrDeductible, category);

  return (
    <div
      className={`relative inline-flex items-center ${className}`}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((prev) => !prev);
        }}
        aria-label={`Explicación técnica de ${label}`}
        className="text-slate-400 hover:text-indigo-600 focus:text-indigo-600 transition-colors p-0.5 rounded-full hover:bg-indigo-50 focus:outline-none"
      >
        <HelpCircle size={14} />
      </button>

      {open && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute left-0 bottom-full mb-2 w-80 sm:w-96 p-3.5 bg-slate-900 text-white rounded-xl shadow-2xl border border-slate-700 z-50 text-left font-normal normal-case tracking-normal animate-in fade-in zoom-in-95 duration-150"
        >
          <div className="flex items-start justify-between gap-2 border-b border-slate-700/80 pb-2 mb-2.5">
            <div className="font-bold text-xs text-indigo-300 leading-snug">
              {explanation.title}
            </div>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-200 border border-indigo-400/30 shrink-0">
              {category === 'deductible' ? 'Guía Deducible' : 'Guía Cobertura'}
            </span>
          </div>

          <div className="space-y-2 text-[11px] leading-relaxed">
            <div>
              <span className="font-bold text-emerald-300 inline-flex items-center gap-1">
                <ShieldCheck size={12} /> Qué significa:
              </span>{' '}
              <span className="text-slate-200">{explanation.whatItCovers}</span>
            </div>

            <div>
              <span className="font-bold text-amber-300 inline-flex items-center gap-1">
                <Scale size={12} /> Impacto en siniestro:
              </span>{' '}
              <span className="text-slate-200">{explanation.claimImpact}</span>
            </div>

            <div>
              <span className="font-bold text-cyan-300 inline-flex items-center gap-1">
                <Sparkles size={12} /> Clave al comparar:
              </span>{' '}
              <span className="text-slate-200">{explanation.comparisonTip}</span>
            </div>

            {explanation.legalReference && (
              <div className="pt-1.5 mt-1.5 border-t border-slate-800 text-[10px] text-slate-400 flex items-center gap-1">
                <BookOpen size={11} className="text-indigo-400 shrink-0" />
                <span>Respaldo legal: {explanation.legalReference}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default PedagogicalTooltip;
