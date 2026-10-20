/**
 * Regulatory Audit Service
 * Evaluates insurance quotes against Colombian domain-specific regulatory frameworks (Co.Co., EOSF, Ley 675, Ley 80, etc.)
 * Server-side source of truth for `perQuoteCompliance` and legal context injection.
 */

import { getDomainRegulatoryProfile } from '../shared/domainRegulatoryKnowledge';
import type { QuoteAnalysis, RegulatoryCheckResult } from '../types';

function normalizeText(value: string): string {
  return (value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

/**
 * Audit a single quote against the domain's mandatory verification rules.
 */
export function auditQuoteCompliance(
  quote: QuoteAnalysis,
  domain: string = 'pyme'
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
        status: 'COMPLIANT' as const,
        details: `Verificado en cotización: ${matchedCov.name} (${matchedCov.value})`,
      };
    }

    return {
      ruleId: rule.id,
      title: rule.title,
      legalBasis: rule.legalBasis,
      status: rule.severityIfMissing === 'CRITICAL' ? ('NON_COMPLIANT' as const) : ('WARNING' as const),
      details: `Requiere verificación expresa en condiciones particulares (${rule.legalBasis}).`,
    };
  });
}

/**
 * Audit all quotes in a report and return perQuoteCompliance map keyed by insurerName.
 */
export function auditReportCompliance(
  quotes: QuoteAnalysis[],
  domain: string = 'pyme'
): Record<string, RegulatoryCheckResult[]> {
  const result: Record<string, RegulatoryCheckResult[]> = {};
  for (const quote of quotes) {
    if (quote && quote.insurerName) {
      result[quote.insurerName] = auditQuoteCompliance(quote, domain);
    }
  }
  return result;
}

/**
 * Build complete regulatory backing object for report payload.
 */
export function buildRegulatoryBackingPayload(
  quotes: QuoteAnalysis[],
  domain: string = 'pyme'
) {
  const profile = getDomainRegulatoryProfile(domain);
  const perQuoteCompliance = auditReportCompliance(quotes, domain);

  return {
    domain: profile.domain,
    displayName: profile.displayName,
    tagline: profile.tagline,
    primaryLaws: profile.primaryLaws,
    thesaurusHighlights: profile.thesaurusHighlights,
    advisoryIntroForClient: profile.advisoryIntroForClient,
    perQuoteCompliance,
  };
}

/**
 * Generate a legal context block for LLM prompts to ground recommendations in Colombian insurance law.
 */
export function getDomainLegalPromptContext(domain: string = 'pyme'): string {
  const profile = getDomainRegulatoryProfile(domain);
  const lawsSummary = profile.primaryLaws
    .map((law) => `- ${law.code}: ${law.title} (${law.summary})`)
    .join('\n');
  const rulesSummary = profile.mandatoryVerificationRules
    .map((rule) => `- Regla Obligatoria [${rule.legalBasis}]: ${rule.title} - ${rule.description}`)
    .join('\n');

  return `
MARCO NORMATIVO Y REGULATORIO APLICABLE EN COLOMBIA (${profile.displayName.toUpperCase()}):
Leyes y Normas Principales:
${lawsSummary}

Amparos de Verificación Mandatoria:
${rulesSummary}
`;
}

export const regulatoryAuditService = {
  auditQuoteCompliance,
  auditReportCompliance,
  buildRegulatoryBackingPayload,
  getDomainLegalPromptContext,
};
