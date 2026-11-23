/**
 * Regulatory Audit Service
 * Evaluates insurance quotes against Colombian domain-specific regulatory frameworks (Co.Co., EOSF, Ley 675, Ley 80, etc.)
 * Server-side source of truth for `perQuoteCompliance` and legal context injection.
 */

import { getDomainRegulatoryProfile } from '../shared/domainRegulatoryKnowledge';
import type { RegulatoryCheckResult } from '../types';

export interface RegulatoryAuditableQuote {
  insurerName: string;
  cumplimientoDetails?: {
    contractStage?: string | null;
    legalRegime?: string | null;
  } | null;
  coverages?: Array<{
    name: string;
    canonicalName?: string;
    value?: string;
    isPositive?: boolean;
  }>;
}

export type CumplimientoContractStage =
  | 'PRECONTRACTUAL_LICITACION'
  | 'CONTRACTUAL_EJECUCION'
  | 'GENERAL';

function normalizeText(value: string): string {
  return (value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

/**
 * Detect whether a Cumplimiento quote corresponds to the Pre-contractual Bid stage
 * (Licitación / Pliego — Seriedad de la Oferta) or the Contractual Execution stage
 * (Minuta del Contrato / Otrosí — Cumplimiento, Salarios, Anticipo, Estabilidad, RCE).
 */
export function detectCumplimientoStage(
  quote: RegulatoryAuditableQuote
): CumplimientoContractStage {
  const explicitStage = normalizeText(quote.cumplimientoDetails?.contractStage || '');
  if (
    explicitStage.includes('precontract') ||
    explicitStage.includes('licitac') ||
    explicitStage.includes('pliego') ||
    explicitStage.includes('seriedad')
  ) {
    return 'PRECONTRACTUAL_LICITACION';
  }
  if (
    explicitStage.includes('contractual') ||
    explicitStage.includes('ejecuc') ||
    explicitStage.includes('contrato') ||
    explicitStage.includes('minuta') ||
    explicitStage.includes('otrosi')
  ) {
    return 'CONTRACTUAL_EJECUCION';
  }

  const activeCoverages = (quote.coverages || []).filter((cov) => {
    const val = normalizeText(String(cov.value || ''));
    return (
      cov.isPositive !== false &&
      val.length > 0 &&
      !['no incluido', 'no incluida', 'no informado', 'excluido', 'no cubre', 'n.c.'].includes(val)
    );
  });

  const hasSeriedad = activeCoverages.some((cov) => {
    const label = normalizeText(`${cov.name || ''} ${cov.canonicalName || ''}`);
    return label.includes('seriedad') || label.includes('oferta') || label.includes('bid bond');
  });

  const hasExecution = activeCoverages.some((cov) => {
    const label = normalizeText(`${cov.name || ''} ${cov.canonicalName || ''}`);
    return (
      label.includes('cumplimiento de contrato') ||
      label.includes('ejecucion del contrato') ||
      label.includes('salarios') ||
      label.includes('prestaciones') ||
      label.includes('estabilidad') ||
      label.includes('anticipo') ||
      label.includes('calidad del bien') ||
      label.includes('calidad del servicio')
    );
  });

  if (hasSeriedad && !hasExecution) {
    return 'PRECONTRACTUAL_LICITACION';
  }
  if (hasExecution && !hasSeriedad) {
    return 'CONTRACTUAL_EJECUCION';
  }
  return 'GENERAL';
}

/**
 * Audit a single quote against the domain's mandatory verification rules.
 */
export function auditQuoteCompliance(
  quote: RegulatoryAuditableQuote,
  domain: string = 'pyme'
): RegulatoryCheckResult[] {
  const profile = getDomainRegulatoryProfile(domain);
  const coverages = quote.coverages || [];
  const cumplimientoStage = domain === 'cumplimiento' ? detectCumplimientoStage(quote) : 'GENERAL';

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

    // Stage-aware compliance rules for Cumplimiento y Fianzas (Licitación vs Contrato)
    if (domain === 'cumplimiento') {
      if (cumplimientoStage === 'PRECONTRACTUAL_LICITACION' && rule.id !== 'cum_seriedad') {
        return {
          ruleId: rule.id,
          title: rule.title,
          legalBasis: rule.legalBasis,
          status: 'COMPLIANT' as const,
          details:
            'Etapa Precontractual (Licitación / Pliego): amparo de ejecución exigible únicamente tras adjudicación del contrato.',
        };
      }

      if (cumplimientoStage === 'CONTRACTUAL_EJECUCION') {
        if (rule.id === 'cum_seriedad') {
          return {
            ruleId: rule.id,
            title: rule.title,
            legalBasis: rule.legalBasis,
            status: 'COMPLIANT' as const,
            details:
              'Etapa Contractual (Minuta / Ejecución): amparo precontractual de seriedad ya superado en fase licitatoria.',
          };
        }
        if (rule.id === 'cum_anticipo') {
          return {
            ruleId: rule.id,
            title: rule.title,
            legalBasis: rule.legalBasis,
            status: 'WARNING' as const,
            details:
              'Verificar en Minuta del Contrato si se pactó Anticipo o Pago Anticipado (100% Art. 2.2.1.2.3.1.10 Decreto 1082/2015).',
          };
        }
      }
    }

    return {
      ruleId: rule.id,
      title: rule.title,
      legalBasis: rule.legalBasis,
      status:
        rule.severityIfMissing === 'CRITICAL' ? ('NON_COMPLIANT' as const) : ('WARNING' as const),
      details: `Requiere verificación expresa en condiciones particulares (${rule.legalBasis}).`,
    };
  });
}

/**
 * Audit all quotes in a report and return perQuoteCompliance map keyed by insurerName.
 */
export function auditReportCompliance(
  quotes: RegulatoryAuditableQuote[],
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
  quotes: RegulatoryAuditableQuote[],
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
  detectCumplimientoStage,
  auditQuoteCompliance,
  auditReportCompliance,
  buildRegulatoryBackingPayload,
  getDomainLegalPromptContext,
};
