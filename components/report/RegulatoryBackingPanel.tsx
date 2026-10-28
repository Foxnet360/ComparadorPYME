import React, { useState } from 'react';
import {
  Scale,
  BookOpen,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Sparkles,
} from 'lucide-react';
import { getDomainRegulatoryProfile } from '@shared/domainRegulatoryKnowledge';
import { InsurerLogo } from '../common/InsurerLogo';
import type { QuoteAnalysis, RegulatoryCheckResult } from '../../types';

interface RegulatoryBackingPanelProps {
  domain?: string;
  quotes?: QuoteAnalysis[];
  perQuoteCompliance?: Record<string, RegulatoryCheckResult[]>;
  compact?: boolean;
  className?: string;
}

function normalizeText(value: string): string {
  return (value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function evaluateClientSideCompliance(
  quote: QuoteAnalysis,
  domain: string
): RegulatoryCheckResult[] {
  const profile = getDomainRegulatoryProfile(domain);
  const coverages = quote.coverages || [];

  return profile.mandatoryVerificationRules.map((rule) => {
    const matchedCov = coverages.find((cov) => {
      const label = normalizeText(`${cov.name || ''} ${cov.canonicalName || ''}`);
      const val = normalizeText(String(cov.value || ''));
      const isIncluded =
        cov.isPositive !== false &&
        val.length > 0 &&
        !['no incluido', 'no incluida', 'no informado', 'excluido', 'no cubre', 'n.c.'].includes(
          val
        );
      return isIncluded && rule.keywords.some((kw) => label.includes(normalizeText(kw)));
    });

    if (matchedCov) {
      return {
        ruleId: rule.id,
        title: rule.title,
        legalBasis: rule.legalBasis,
        status: 'COMPLIANT',
        details: `Verificado en cotización: ${matchedCov.name} (${matchedCov.value})`,
      };
    }

    return {
      ruleId: rule.id,
      title: rule.title,
      legalBasis: rule.legalBasis,
      status: rule.severityIfMissing === 'CRITICAL' ? 'NON_COMPLIANT' : 'WARNING',
      details: `Requiere verificación expresa en condiciones particulares (${rule.legalBasis}).`,
    };
  });
}

export const RegulatoryBackingPanel: React.FC<RegulatoryBackingPanelProps> = ({
  domain = 'pyme',
  quotes = [],
  perQuoteCompliance,
  compact = false,
  className = '',
}) => {
  const [expanded, setExpanded] = useState(!compact);
  const profile = getDomainRegulatoryProfile(domain);

  return (
    <div
      className={`bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl border border-indigo-500/30 shadow-lg overflow-hidden ${className}`}
    >
      <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-xl bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 shrink-0 mt-0.5">
            <Scale size={20} />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 flex items-center gap-1">
                <Sparkles size={11} />
                Respaldo Normativo y Regulatorio Activo
              </span>
              <span className="text-xs font-semibold text-indigo-300">
                Ramo: {profile.displayName}
              </span>
            </div>
            <h3 className="text-sm sm:text-base font-bold text-white mt-1">
              Análisis Multiramo con Inyección de Tesauros y Verificación Legal en Colombia
            </h3>
            <p className="text-xs text-slate-300 mt-0.5 leading-relaxed">{profile.tagline}</p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          className="self-end sm:self-center inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-xs font-semibold text-indigo-200 transition-colors shrink-0"
        >
          <span>{expanded ? 'Ocultar marco legal' : 'Ver leyes y tesauros'}</span>
          {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </button>
      </div>

      {expanded && (
        <div className="p-4 sm:p-5 space-y-5 bg-slate-900/60">
          {/* Primary Colombian Laws */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-300 mb-2.5 flex items-center gap-1.5">
              <BookOpen size={14} />
              Normativa Colombiana Vigente Inyectada en este Ramo
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {profile.primaryLaws.map((law, idx) => (
                <div
                  key={idx}
                  className="bg-white/5 border border-white/10 rounded-xl p-3 hover:border-indigo-400/40 transition-colors"
                >
                  <div className="text-xs font-extrabold text-amber-300 mb-0.5">{law.code}</div>
                  <div className="text-xs font-semibold text-white mb-1">{law.title}</div>
                  <p className="text-[11px] text-slate-300 leading-relaxed">{law.summary}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Thesaurus Highlights */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-cyan-300 mb-2 flex items-center gap-1.5">
              <ShieldCheck size={14} />
              Tesauro Técnico Específico del Ramo ({profile.thesaurusHighlights.length} ejes canónicos)
            </h4>
            <div className="flex flex-wrap gap-1.5">
              {profile.thesaurusHighlights.map((item, idx) => (
                <span
                  key={idx}
                  className="text-[11px] font-medium px-2.5 py-1 rounded-lg bg-indigo-950/90 border border-indigo-400/25 text-indigo-100"
                >
                  {item}
                </span>
              ))}
            </div>
          </div>

          {/* Per-Quote Automatic Normative Verification */}
          {quotes.length > 0 && (
            <div className="pt-2 border-t border-white/10">
              <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-300 mb-3 flex items-center gap-1.5">
                <CheckCircle2 size={14} />
                Verificación Automática de Cumplimiento Normativo por Aseguradora
              </h4>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {quotes.map((quote, qIdx) => {
                  const checks =
                    perQuoteCompliance?.[quote.insurerName] ||
                    evaluateClientSideCompliance(quote, domain);
                  const compliantCount = checks.filter((c) => c.status === 'COMPLIANT').length;

                  return (
                    <div
                      key={qIdx}
                      className="bg-white/5 border border-white/10 rounded-xl p-3.5 space-y-2.5"
                    >
                      <div className="flex items-center justify-between border-b border-white/10 pb-2">
                        <div className="flex items-center gap-2">
                          <InsurerLogo insurerName={quote.insurerName} size="xs" />
                          <span className="font-bold text-sm text-white">{quote.insurerName}</span>
                        </div>
                        <span
                          className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                            compliantCount === checks.length
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/30'
                              : 'bg-amber-500/20 text-amber-300 border border-amber-400/30'
                          }`}
                        >
                          {compliantCount}/{checks.length} Reglas Normativas Verificadas
                        </span>
                      </div>
                      <div className="space-y-2">
                        {checks.map((check) => (
                          <div
                            key={check.ruleId}
                            className="flex items-start gap-2 text-xs leading-snug"
                          >
                            {check.status === 'COMPLIANT' ? (
                              <CheckCircle2
                                size={14}
                                className="text-emerald-400 shrink-0 mt-0.5"
                              />
                            ) : (
                              <AlertTriangle
                                size={14}
                                className={
                                  check.status === 'NON_COMPLIANT'
                                    ? 'text-red-400 shrink-0 mt-0.5'
                                    : 'text-amber-400 shrink-0 mt-0.5'
                                }
                              />
                            )}
                            <div>
                              <div className="font-semibold text-slate-100">
                                {check.title}{' '}
                                <span className="text-[10px] font-normal text-indigo-300">
                                  ({check.legalBasis})
                                </span>
                              </div>
                              <div className="text-[11px] text-slate-300">{check.details}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default RegulatoryBackingPanel;
