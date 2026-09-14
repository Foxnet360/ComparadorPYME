/**
 * Renewal Analytics (spec R2.3/R2.4/R2.5)
 *
 * Pure functions comparing candidate quotes against the incumbent baseline:
 * gap analysis (coverages lost/gained, deductible worsening, new
 * exclusions), premium delta, and the per-ramo switching-friction registry.
 * No I/O, no env — safe to use from any layer.
 */

export interface RenewalCoverageEntry {
  name: string;
  value?: string | null;
  deductible?: string | null;
  exclusions?: string[];
}

/** Minimal quote shape; ParsedQuote and matrix projections both satisfy it. */
export interface RenewalQuoteShape {
  insurerName: string;
  priceAnnual?: number | null;
  coverages: RenewalCoverageEntry[];
}

export interface RenewalGapAnalysisResult {
  coveragesLost: string[];
  coveragesGained: string[];
  deductibleWorsening: string[];
  newExclusions: string[];
}

export interface RenewalPremiumDeltaResult {
  absolute: number | null;
  percentage: number | null;
  direction: 'increase' | 'decrease' | 'equal' | 'unknown';
}

export interface CandidateRenewalAnalyticsResult {
  insurer: string;
  gaps: RenewalGapAnalysisResult;
  premiumDelta: RenewalPremiumDeltaResult;
  friction: string[];
}

/**
 * Switching-friction registry per ramo (R2.5). Static notes; friction data
 * sources are the ramo-specific policy fields captured at promotion.
 */
export const FRICTION_REGISTRY: Record<string, string[]> = {
  salud: [
    'Carencias: los períodos de carencia reinician al cambiar de aseguradora.',
    'Preexistencias: condiciones preexistentes pueden quedar excluidas o restringidas.',
  ],
  autos: [
    'Siniestralidad: el historial de siniestros puede no trasladarse a la nueva aseguradora.',
    'Bonificación: la continuidad del descuento por no siniestralidad (no-claims) no está garantizada.',
  ],
  pyme: [
    'Suma asegurada: verifique que los valores asegurados se actualicen con IPC para evitar subaseguro.',
  ],
  vida_grupo: [
    'Renovación garantizada: confirme si la póliza actual tiene renovación garantizada antes de cambiar.',
  ],
  copropiedades: [
    'Indexación: los valores asegurados deben ajustarse por índices de costos de construcción.',
  ],
};

const GENERIC_FRICTION_NOTE =
  'Fricción de cambio: revise condiciones de continuidad y requisitos de suscripción antes de cambiar de aseguradora.';

export function getFrictionNotes(ramo: string): string[] {
  return FRICTION_REGISTRY[ramo] ?? [GENERIC_FRICTION_NOTE];
}

// ---------------------------------------------------------------------------
// Gap analysis (R2.3)
// ---------------------------------------------------------------------------

function normalizeName(name: string): string {
  return name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
}

const ABSENT_VALUES = new Set(['', 'excluido', 'no informado', 'no especificado', 'no incluido']);

function isPresent(entry: RenewalCoverageEntry): boolean {
  const value = (entry.value ?? '').trim().toLowerCase();
  return !ABSENT_VALUES.has(value);
}

function parseDeductiblePercentage(deductible?: string | null): number | null {
  if (!deductible) return null;
  const match = deductible.match(/(\d+(?:[.,]\d+)?)\s*%/);
  if (!match) return null;
  return parseFloat(match[1]!.replace(',', '.'));
}

export function computeGapAnalysis(
  baseline: RenewalQuoteShape,
  candidate: RenewalQuoteShape
): RenewalGapAnalysisResult {
  const baselineByName = new Map(baseline.coverages.map((c) => [normalizeName(c.name), c]));
  const candidateByName = new Map(candidate.coverages.map((c) => [normalizeName(c.name), c]));

  const coveragesLost: string[] = [];
  const coveragesGained: string[] = [];
  const deductibleWorsening: string[] = [];
  const newExclusions: string[] = [];

  for (const [name, baseCoverage] of baselineByName) {
    if (!isPresent(baseCoverage)) continue;
    const candidateCoverage = candidateByName.get(name);
    if (!candidateCoverage || !isPresent(candidateCoverage)) {
      coveragesLost.push(baseCoverage.name);
      continue;
    }

    const basePct = parseDeductiblePercentage(baseCoverage.deductible);
    const candidatePct = parseDeductiblePercentage(candidateCoverage.deductible);
    if (basePct !== null && candidatePct !== null && candidatePct > basePct) {
      deductibleWorsening.push(candidateCoverage.name);
    }

    const baseExclusions = new Set((baseCoverage.exclusions ?? []).map(normalizeName));
    for (const exclusion of candidateCoverage.exclusions ?? []) {
      if (!baseExclusions.has(normalizeName(exclusion))) {
        newExclusions.push(exclusion);
      }
    }
  }

  for (const [name, candidateCoverage] of candidateByName) {
    if (!isPresent(candidateCoverage)) continue;
    const baseCoverage = baselineByName.get(name);
    if (!baseCoverage || !isPresent(baseCoverage)) {
      coveragesGained.push(candidateCoverage.name);
    }
  }

  return { coveragesLost, coveragesGained, deductibleWorsening, newExclusions };
}

// ---------------------------------------------------------------------------
// Premium delta (R2.4)
// ---------------------------------------------------------------------------

export function computePremiumDelta(
  baselinePremium: number | null | undefined,
  candidatePremium: number | null | undefined
): RenewalPremiumDeltaResult {
  if (
    baselinePremium === null ||
    baselinePremium === undefined ||
    candidatePremium === null ||
    candidatePremium === undefined ||
    baselinePremium <= 0 ||
    candidatePremium <= 0
  ) {
    return { absolute: null, percentage: null, direction: 'unknown' };
  }

  const absolute = candidatePremium - baselinePremium;
  const percentage = Math.round((absolute / baselinePremium) * 10000) / 100;
  const direction = absolute > 0 ? 'increase' : absolute < 0 ? 'decrease' : 'equal';
  return { absolute, percentage, direction };
}

// ---------------------------------------------------------------------------
// Combined per-candidate analytics (R2.3 + R2.4 + R2.5)
// ---------------------------------------------------------------------------

export function computeRenewalAnalytics(
  baseline: RenewalQuoteShape,
  candidates: RenewalQuoteShape[],
  ramo: string
): CandidateRenewalAnalyticsResult[] {
  const friction = getFrictionNotes(ramo);
  return candidates.map((candidate) => ({
    insurer: candidate.insurerName,
    gaps: computeGapAnalysis(baseline, candidate),
    premiumDelta: computePremiumDelta(baseline.priceAnnual, candidate.priceAnnual),
    friction,
  }));
}
