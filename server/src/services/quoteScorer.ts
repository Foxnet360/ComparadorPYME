/**
 * Rule-Based Scoring Engine
 * Deterministic scoring system for insurance quote analysis
 * Scores 6 dimensions on a 0-100 scale
 */

import { ParsedQuote } from './quoteParser';
import { CrossReferenceResult } from './crossReferenceEngine';
import { formatNumber } from '../utils/formatCurrency';
import { CoverageExistenceResult } from './clauseCoverageValidator';

import { hybridDeductibleParser } from './hybridDeductibleParser';
import { featureFlags } from '../config/featureFlags';
import { getCanonicalCoverageNames } from '../config/domainConstants';
import { InsuranceDomain } from '../types/domain';

export interface ScoreWeights {
  coverage: number;
  deductibles: number;
  exclusions: number;
  priceRatio: number;
  sublimits: number;
  warranties: number;
}

export interface ScoreBreakdown {
  coverage: number;
  deductibles: number;
  exclusions: number;
  priceRatio: number;
  sublimits: number;
  warranties: number;
}

export interface ScoringResult {
  totalScore: number;
  dataQualityScore: number;
  verificationConfidence: number;
  breakdown: ScoreBreakdown;
  weights: ScoreWeights;
  quotePriceRank: number;
  marketPriceAverage: number;
  coverageCount: number;
  expectedCoverageCount: number;
  criticalAlerts: number;
  warningAlerts: number;
  infoAlerts: number;
}

// Default weights (must sum to 1.0)
const DEFAULT_WEIGHTS: ScoreWeights = {
  coverage: 0.25,
  deductibles: 0.2,
  exclusions: 0.2,
  priceRatio: 0.15,
  sublimits: 0.1,
  warranties: 0.1,
};

// Expected coverages are resolved per-domain so autos and future ramos use
// their own taxonomy while pyme stays byte-identical.
function getExpectedCoverages(domain: InsuranceDomain = 'pyme'): string[] {
  return getCanonicalCoverageNames(domain).map((name) => name.toLowerCase());
}

// Market price benchmarks (in COP, annual)
// Used when no other quotes are available for comparison
const MARKET_PRICE_BENCHMARKS: Record<InsuranceDomain, number> = {
  pyme: 8_500_000,
  autos: 2_500_000,
  copropiedades: 15_000_000,
  vida_grupo: 450_000,
  salud: 350_000,
  cumplimiento: 5_000_000,
};

// Autos scoring thresholds (COP)
const AUTOS_RCE_ADEQUATE = 1_500_000_000;
const AUTOS_RCE_LOW = 1_000_000_000;

// Autos coverage modifiers (percentage points added to coverage score)
const AUTOS_RCE_ADEQUATE_BONUS = 10;
const AUTOS_RCE_LOW_PENALTY = -15;
const AUTOS_RCE_MODERATE_PENALTY = -5;
const AUTOS_CARRO_TALLER_BONUS = 5;
const AUTOS_ASISTENCIA_BONUS = 5;

// Autos deductible modifiers
const AUTOS_DEDUCTIBLE_CLEAR_BONUS_HIGH = 5;
const AUTOS_DEDUCTIBLE_CLEAR_BONUS_LOW = 2;

export const quoteScorer = {
  /**
   * Calculate complete score for a quote
   * Uses variable comparison engine when enabled
   */
  calculateScore: (
    quote: ParsedQuote,
    crossRefResults: CrossReferenceResult[],
    allQuotes: ParsedQuote[] = [],
    customWeights?: Partial<ScoreWeights>,
    clauseValidation?: CoverageExistenceResult[],
    domain: InsuranceDomain = 'pyme'
  ): Promise<ScoringResult> | ScoringResult => {
    console.log(
      `📊 [quoteScorer] Calculating score for ${quote.insurerName} (domain=${domain})...`
    );

    // Use variable comparison engine when enabled
    if (featureFlags.isEnabled('variableComparisonEngine') && allQuotes.length > 1) {
      return quoteScorer.calculateScoreWithVariables(
        quote,
        crossRefResults,
        allQuotes,
        customWeights,
        clauseValidation,
        domain
      );
    }

    const weights = { ...DEFAULT_WEIGHTS, ...customWeights };
    normalizeWeights(weights);

    const breakdown: ScoreBreakdown = {
      coverage: calculateCoverageScore(quote, clauseValidation, domain),
      deductibles: calculateDeductibleScore(crossRefResults, domain),
      exclusions: calculateExclusionScore(crossRefResults),
      priceRatio: calculatePriceScore(quote, allQuotes, domain),
      sublimits: calculateSubLimitScore(crossRefResults),
      warranties: calculateWarrantyScore(crossRefResults),
    };

    // Calculate Data Quality Score (always calculable)
    const dataQualityWeights = {
      coverage: 0.35,
      deductibles: 0.25,
      priceRatio: 0.4,
      exclusions: 0,
      sublimits: 0,
      warranties: 0,
    };
    const dataQualityScore = Math.round(
      breakdown.coverage * dataQualityWeights.coverage +
        breakdown.deductibles * dataQualityWeights.deductibles +
        breakdown.priceRatio * dataQualityWeights.priceRatio
    );

    // Calculate Verification Confidence (requires RAG)
    const hasRagData = crossRefResults.length > 0;
    const verificationWeights = {
      exclusions: 0.4,
      sublimits: 0.3,
      warranties: 0.3,
      coverage: 0,
      deductibles: 0,
      priceRatio: 0,
    };
    const verificationConfidence = hasRagData
      ? Math.round(
          breakdown.exclusions * verificationWeights.exclusions +
            breakdown.sublimits * verificationWeights.sublimits +
            breakdown.warranties * verificationWeights.warranties
        )
      : 0;

    // Calculate weighted total (legacy total score for backwards compatibility)
    const totalScore = Math.round(
      breakdown.coverage * weights.coverage +
        breakdown.deductibles * weights.deductibles +
        breakdown.exclusions * weights.exclusions +
        breakdown.priceRatio * weights.priceRatio +
        breakdown.sublimits * weights.sublimits +
        breakdown.warranties * weights.warranties
    );

    // Count alerts by level
    const alertCounts = countAlerts(crossRefResults);

    // Calculate price rank
    const { rank, average } = calculatePriceRank(quote, allQuotes, domain);

    const result: ScoringResult = {
      totalScore: clamp(totalScore, 0, 100),
      dataQualityScore: clamp(dataQualityScore, 0, 100),
      verificationConfidence: clamp(verificationConfidence, 0, 100),
      breakdown,
      weights,
      quotePriceRank: rank,
      marketPriceAverage: average,
      coverageCount: quote.coverages.length,
      expectedCoverageCount: getExpectedCoverages(domain).length,
      ...alertCounts,
    };

    console.log(`✅ [quoteScorer] Score for ${quote.insurerName}: ${result.totalScore}/100`);
    return result;
  },

  /**
   * Calculate score using variable comparison engine
   * Provides more granular scoring based on direct variable comparison
   */
  calculateScoreWithVariables: async (
    quote: ParsedQuote,
    crossRefResults: CrossReferenceResult[],
    allQuotes: ParsedQuote[],
    customWeights?: Partial<ScoreWeights>,
    _clauseValidation?: CoverageExistenceResult[],
    domain: InsuranceDomain = 'pyme'
  ): Promise<ScoringResult> => {
    console.log(`📊 [quoteScorer] Calculating variable-based score for ${quote.insurerName}...`);

    const weights = { ...DEFAULT_WEIGHTS, ...customWeights };
    normalizeWeights(weights);

    // Calculate variable-based scores
    const variableScores = await calculateVariableBasedScores(
      quote,
      allQuotes,
      crossRefResults,
      domain
    );

    const breakdown: ScoreBreakdown = {
      coverage: variableScores.coverageScore,
      deductibles: variableScores.deductibleScore,
      exclusions: calculateExclusionScore(crossRefResults),
      priceRatio: calculatePriceScore(quote, allQuotes, domain),
      sublimits: calculateSubLimitScore(crossRefResults),
      warranties: calculateWarrantyScore(crossRefResults),
    };

    // Calculate data quality score
    const dataQualityScore = Math.round(
      breakdown.coverage * 0.35 + breakdown.deductibles * 0.25 + breakdown.priceRatio * 0.4
    );

    // Calculate verification confidence
    const hasRagData = crossRefResults.length > 0;
    const verificationConfidence = hasRagData
      ? Math.round(
          breakdown.exclusions * 0.4 + breakdown.sublimits * 0.3 + breakdown.warranties * 0.3
        )
      : 0;

    // Calculate weighted total
    const totalScore = Math.round(
      breakdown.coverage * weights.coverage +
        breakdown.deductibles * weights.deductibles +
        breakdown.exclusions * weights.exclusions +
        breakdown.priceRatio * weights.priceRatio +
        breakdown.sublimits * weights.sublimits +
        breakdown.warranties * weights.warranties
    );

    const alertCounts = countAlerts(crossRefResults);
    const { rank, average } = calculatePriceRank(quote, allQuotes, domain);

    const result: ScoringResult = {
      totalScore: clamp(totalScore, 0, 100),
      dataQualityScore: clamp(dataQualityScore, 0, 100),
      verificationConfidence: clamp(verificationConfidence, 0, 100),
      breakdown,
      weights,
      quotePriceRank: rank,
      marketPriceAverage: average,
      coverageCount: quote.coverages.length,
      expectedCoverageCount: getExpectedCoverages(domain).length,
      ...alertCounts,
    };

    console.log(
      `✅ [quoteScorer] Variable-based score for ${quote.insurerName}: ${result.totalScore}/100`
    );
    return result;
  },

  /**
   * Get default weights
   */
  getDefaultWeights: (): ScoreWeights => ({ ...DEFAULT_WEIGHTS }),

  /**
   * Validate custom weights
   */
  validateWeights: (weights: Partial<ScoreWeights>): { valid: boolean; errors: string[] } => {
    const errors: string[] = [];
    const values = Object.values(weights).filter((v) => v !== undefined);

    if (values.length > 0) {
      const sum = values.reduce((a, b) => a + b, 0);
      if (Math.abs(sum - 1.0) > 0.001) {
        errors.push(`Weights must sum to 1.0, got ${formatNumber(sum, 3)}`);
      }
    }

    for (const [key, value] of Object.entries(weights)) {
      if (value !== undefined && (value < 0 || value > 1)) {
        errors.push(`Weight ${key} must be between 0 and 1, got ${value}`);
      }
    }

    return { valid: errors.length === 0, errors };
  },
};

// ====================
// Individual Score Calculators
// ====================

function calculateCoverageScore(
  quote: ParsedQuote,
  clauseValidation?: CoverageExistenceResult[],
  domain: InsuranceDomain = 'pyme'
): number {
  if (quote.coverages.length === 0) return 0;

  const expectedCoverages = getExpectedCoverages(domain);

  // Count how many expected coverages are present
  const foundCoverages = new Set<string>();
  for (const coverage of quote.coverages) {
    const canonical = (coverage.canonicalName || coverage.name).toLowerCase();
    for (const expected of expectedCoverages) {
      if (canonical.includes(expected) || expected.includes(canonical)) {
        foundCoverages.add(expected);
      }
    }
  }

  const coverageRatio = foundCoverages.size / expectedCoverages.length;
  let score = coverageRatio * 100;

  // Bonus for extra coverages (up to 100)
  const extraCoverages = Math.max(0, quote.coverages.length - expectedCoverages.length);
  score = Math.min(100, score + extraCoverages * 3);

  // Apply clause validation penalties
  if (clauseValidation && clauseValidation.length > 0) {
    const phantomCount = clauseValidation.filter((v) => v.status === 'PHANTOM').length;
    const mandatoryMissingCount = clauseValidation.filter(
      (v) => v.status === 'MANDATORY_MISSING'
    ).length;

    // Penalty for phantom coverages: -15 each
    score -= phantomCount * 15;

    // Penalty for mandatory missing coverages: -10 each
    score -= mandatoryMissingCount * 10;
  }

  // Autos-specific modifiers
  if (domain === 'autos') {
    score += calculateAutosCoverageModifiers(quote);
  }

  return Math.round(clamp(score, 0, 100));
}

/**
 * Autos-specific coverage modifiers.
 * - Reward adequate RCE limits (>= 1.5B COP).
 * - Reward presence of Carro Taller and Asistencia en Viaje.
 * - Penalize low RCE limits.
 */
function calculateAutosCoverageModifiers(quote: ParsedQuote): number {
  let modifier = 0;

  const rceCoverage = quote.coverages.find((c) => {
    const canonical = (c.canonicalName || c.name).toLowerCase();
    return canonical.includes('responsabilidad civil extracontractual vehicular');
  });

  if (rceCoverage) {
    const rceValue = parseMonetaryValue(rceCoverage.value);
    if (rceValue != null) {
      if (rceValue >= AUTOS_RCE_ADEQUATE) {
        modifier += AUTOS_RCE_ADEQUATE_BONUS;
      } else if (rceValue < AUTOS_RCE_LOW) {
        modifier += AUTOS_RCE_LOW_PENALTY;
      } else {
        modifier += AUTOS_RCE_MODERATE_PENALTY;
      }
    }
  }

  const hasCarroTaller = quote.coverages.some((c) => {
    const canonical = (c.canonicalName || c.name).toLowerCase();
    return canonical.includes('carro taller') || canonical.includes('vehiculo de reemplazo');
  });
  if (hasCarroTaller) modifier += AUTOS_CARRO_TALLER_BONUS;

  const hasAsistencia = quote.coverages.some((c) => {
    const canonical = (c.canonicalName || c.name).toLowerCase();
    return (
      canonical.includes('asistencia en viaje') || canonical.includes('asistencia en carretera')
    );
  });
  if (hasAsistencia) modifier += AUTOS_ASISTENCIA_BONUS;

  return modifier;
}

/**
 * Parse a monetary string such as "1.500M", "2.000.000", "$1.5B" into COP.
 * Returns null when the value cannot be parsed.
 */
function parseMonetaryValue(value: string): number | null {
  if (!value) return null;
  const normalized = value.toLowerCase().replace(/\$/g, '').replace(/\s/g, '').replace(/,/g, '.');

  // Billones (B)
  const billionsMatch = normalized.match(/([\d.]+)\s*b/);
  if (billionsMatch) {
    const num = parseFloat(billionsMatch[1]);
    return isNaN(num) ? null : num * 1_000_000_000;
  }

  // Millones (M)
  const millionsMatch = normalized.match(/([\d.]+)\s*m/);
  if (millionsMatch) {
    const num = parseFloat(millionsMatch[1]);
    return isNaN(num) ? null : num * 1_000_000;
  }

  // Miles (K)
  const thousandsMatch = normalized.match(/([\d.]+)\s*k/);
  if (thousandsMatch) {
    const num = parseFloat(thousandsMatch[1]);
    return isNaN(num) ? null : num * 1_000;
  }

  // Plain number with optional thousands separators
  const plainMatch = normalized.match(/([\d.]+)/);
  if (plainMatch) {
    const raw = plainMatch[1];
    const num =
      raw.includes('.') && raw.split('.').slice(-1)[0].length === 3
        ? parseFloat(raw.replace(/\./g, ''))
        : parseFloat(raw.replace(/\./g, '').replace(',', '.'));
    return isNaN(num) ? null : num;
  }

  return null;
}

function calculateDeductibleScore(
  crossRefResults: CrossReferenceResult[],
  domain: InsuranceDomain = 'pyme'
): number {
  if (crossRefResults.length === 0) return 60; // Neutral score when no RAG data available

  let totalScore = 0;
  let count = 0;

  for (const result of crossRefResults) {
    if (!result.isVerified) continue;

    const quoteDed = parseDeductibleValue(result.quoteData.deductible);
    const clauseDed = result.clauseData.deductible
      ? parseDeductibleValue(result.clauseData.deductible)
      : null;

    if (quoteDed === null) continue;

    count++;

    if (clauseDed === null) {
      // No clause data to compare, neutral
      totalScore += 70;
    } else if (quoteDed < clauseDed) {
      // Quote deductible is BETTER (lower) than clause - suspicious
      totalScore += 40;
    } else if (quoteDed > clauseDed) {
      // Quote deductible is HIGHER than clause - unfavorable
      totalScore += 60;
    } else {
      // Match - good
      totalScore += 90;
    }
  }

  const baseScore = count > 0 ? Math.round(totalScore / count) : 50;

  if (domain === 'autos') {
    return Math.round(clamp(baseScore + calculateAutosDeductibleBonus(crossRefResults), 0, 100));
  }

  return baseScore;
}

/**
 * Autos-specific deductible bonus: reward quotes where all verified deductibles
 * are expressed as clear percentages or fixed SMMLV amounts.
 */
function calculateAutosDeductibleBonus(crossRefResults: CrossReferenceResult[]): number {
  if (crossRefResults.length === 0) return 0;

  let clearCount = 0;
  let verifiedCount = 0;

  for (const result of crossRefResults) {
    if (!result.isVerified) continue;
    verifiedCount++;
    const dedText = result.quoteData.deductible || '';
    if (
      /%/.test(dedText) ||
      /smmlv|salarios?|smlv|ums/i.test(dedText) ||
      /dias?\s*de\s*inmovilizacion/i.test(dedText)
    ) {
      clearCount++;
    }
  }

  if (verifiedCount === 0) return 0;
  const ratio = clearCount / verifiedCount;
  return ratio >= 0.75
    ? AUTOS_DEDUCTIBLE_CLEAR_BONUS_HIGH
    : ratio >= 0.5
      ? AUTOS_DEDUCTIBLE_CLEAR_BONUS_LOW
      : 0;
}

function calculateExclusionScore(crossRefResults: CrossReferenceResult[]): number {
  if (crossRefResults.length === 0) return 60; // Neutral score when no RAG data available

  let totalExclusions = 0;
  let verifiedCount = 0;

  for (const result of crossRefResults) {
    if (!result.isVerified) continue;
    verifiedCount++;

    const exclusionCount = result.clauseData.exclusions?.length || 0;
    totalExclusions += exclusionCount;
  }

  if (verifiedCount === 0) return 60; // Neutral score when no RAG data available

  const avgExclusions = totalExclusions / verifiedCount;

  // More exclusions = lower score
  // 0 exclusions = 100, 5+ exclusions = 0
  let score = 100 - avgExclusions * 20;
  return Math.round(clamp(score, 0, 100));
}

function calculatePriceScore(
  quote: ParsedQuote,
  allQuotes: ParsedQuote[],
  domain: InsuranceDomain = 'pyme'
): number {
  if (quote.priceAnnual <= 0) return 50;

  let benchmark: number;
  let comparisonBasis: string;

  if (allQuotes.length > 1) {
    // Use average of all quotes as benchmark
    const total = allQuotes.reduce((sum, q) => sum + q.priceAnnual, 0);
    benchmark = total / allQuotes.length;
    comparisonBasis = 'market';
  } else {
    // Use domain-specific benchmark
    benchmark = MARKET_PRICE_BENCHMARKS[domain] ?? MARKET_PRICE_BENCHMARKS.pyme;
    comparisonBasis = 'benchmark';
  }

  const ratio = quote.priceAnnual / benchmark;

  // Ratio scoring:
  // 0.5x = 100 (very cheap)
  // 0.8x = 90 (cheap)
  // 1.0x = 80 (fair)
  // 1.3x = 60 (expensive)
  // 1.5x = 40 (very expensive)
  // 2.0x = 0 (extremely expensive)
  let score: number;
  if (ratio <= 0.5) score = 100;
  else if (ratio <= 0.8) score = 90 - ((ratio - 0.5) / 0.3) * 10;
  else if (ratio <= 1.0) score = 80 - ((ratio - 0.8) / 0.2) * 10;
  else if (ratio <= 1.3) score = 70 - ((ratio - 1.0) / 0.3) * 20;
  else if (ratio <= 1.5) score = 50 - ((ratio - 1.3) / 0.2) * 20;
  else if (ratio <= 2.0) score = 30 - ((ratio - 1.5) / 0.5) * 30;
  else score = 0;

  console.log(
    `💰 [quoteScorer] Price score for ${quote.insurerName}: ${Math.round(score)}/100 (ratio: ${formatNumber(ratio, 2)}, basis: ${comparisonBasis})`
  );

  return Math.round(clamp(score, 0, 100));
}

function calculateSubLimitScore(crossRefResults: CrossReferenceResult[]): number {
  if (crossRefResults.length === 0) return 60; // Neutral score when no RAG data available

  let restrictiveCount = 0;
  let verifiedCount = 0;

  for (const result of crossRefResults) {
    if (!result.isVerified) continue;
    verifiedCount++;

    // Check for sub-limit mentions in conditions
    const conditions = result.clauseData.conditions || [];
    for (const condition of conditions) {
      const lower = condition.toLowerCase();
      if (lower.includes('sub') && lower.includes('limite')) {
        restrictiveCount++;
      }
      if (lower.includes('tope') || lower.includes('maximo')) {
        restrictiveCount++;
      }
    }

    // Check for critical alerts about discrepancies
    for (const alert of result.alerts) {
      if (alert.level === 'CRITICAL' && alert.title.includes('Discrepancia')) {
        restrictiveCount += 0.5;
      }
    }
  }

  if (verifiedCount === 0) return 60; // Neutral score when no RAG data available

  const avgRestrictive = restrictiveCount / verifiedCount;
  let score = 100 - avgRestrictive * 25;
  return Math.round(clamp(score, 0, 100));
}

function calculateWarrantyScore(crossRefResults: CrossReferenceResult[]): number {
  if (crossRefResults.length === 0) return 60; // Neutral score when no RAG data available

  let totalConditions = 0;
  let verifiedCount = 0;

  for (const result of crossRefResults) {
    if (!result.isVerified) continue;
    verifiedCount++;

    const conditionCount = result.clauseData.conditions?.length || 0;
    totalConditions += conditionCount;
  }

  if (verifiedCount === 0) return 60; // Neutral score when no RAG data available

  const avgConditions = totalConditions / verifiedCount;

  // More conditions/warranties = lower score
  // 0 conditions = 100, 10+ conditions = 0
  let score = 100 - avgConditions * 10;
  return Math.round(clamp(score, 0, 100));
}

// ====================
// Helper Functions
// ====================

function parseDeductibleValue(deducibleText: string): number | null {
  if (
    !deducibleText ||
    deducibleText === 'No aplica' ||
    deducibleText === 'NO ESPECIFICADO' ||
    deducibleText === 'N/A'
  ) {
    return null;
  }

  const structure = hybridDeductibleParser.parseSync(deducibleText);
  if (structure.components.some((c) => c.type === 'unknown')) {
    return null;
  }

  if (structure.normalized.isPercentageBased && structure.normalized.percentage > 0) {
    return structure.normalized.percentage;
  }
  if (structure.normalized.minAmount > 0) {
    return structure.normalized.minAmount;
  }

  return null;
}

function countAlerts(crossRefResults: CrossReferenceResult[]): {
  criticalAlerts: number;
  warningAlerts: number;
  infoAlerts: number;
} {
  let critical = 0;
  let warning = 0;
  let info = 0;

  for (const result of crossRefResults) {
    for (const alert of result.alerts) {
      switch (alert.level) {
        case 'CRITICAL':
          critical++;
          break;
        case 'WARNING':
          warning++;
          break;
        case 'INFO':
          info++;
          break;
      }
    }
  }

  return { criticalAlerts: critical, warningAlerts: warning, infoAlerts: info };
}

function calculatePriceRank(
  quote: ParsedQuote,
  allQuotes: ParsedQuote[],
  domain: InsuranceDomain = 'pyme'
): {
  rank: number;
  average: number;
} {
  if (allQuotes.length === 0 || quote.priceAnnual <= 0) {
    return { rank: 0, average: MARKET_PRICE_BENCHMARKS[domain] ?? MARKET_PRICE_BENCHMARKS.pyme };
  }

  const sorted = [...allQuotes].sort((a, b) => a.priceAnnual - b.priceAnnual);
  const rank = sorted.findIndex((q) => q.insurerName === quote.insurerName) + 1;
  const average = sorted.reduce((sum, q) => sum + q.priceAnnual, 0) / sorted.length;

  return { rank, average };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function normalizeWeights(weights: ScoreWeights): void {
  const sum = Object.values(weights).reduce((a, b) => a + b, 0);
  if (sum > 0 && Math.abs(sum - 1.0) > 0.001) {
    for (const key of Object.keys(weights) as Array<keyof ScoreWeights>) {
      weights[key] = weights[key] / sum;
    }
  }
}

/**
 * Calculate scores based on direct variable comparison between quotes
 */
async function calculateVariableBasedScores(
  quote: ParsedQuote,
  allQuotes: ParsedQuote[],
  crossRefResults: CrossReferenceResult[],
  domain: InsuranceDomain = 'pyme'
): Promise<{ coverageScore: number; deductibleScore: number }> {
  // Coverage score: compare number and breadth of coverages
  const maxCoverages = Math.max(...allQuotes.map((q) => q.coverages.length));
  let coverageScore =
    maxCoverages > 0 ? Math.round((quote.coverages.length / maxCoverages) * 100) : 50;

  if (domain === 'autos') {
    coverageScore = Math.round(
      clamp(coverageScore + calculateAutosCoverageModifiers(quote), 0, 100)
    );
  }

  // Deductible score: compare deductibles using semantic parser
  let deductibleScore = 70; // Default neutral

  if (crossRefResults.length > 0) {
    let totalDedScore = 0;
    let dedCount = 0;

    for (const result of crossRefResults) {
      if (!result.quoteData.deductible || result.quoteData.deductible === 'No aplica') continue;

      try {
        const quoteDed = await hybridDeductibleParser.parse(result.quoteData.deductible);

        // Find best deductible among all quotes for this coverage
        const coverageName = result.coverageName;
        const allDeds = allQuotes.flatMap((q) =>
          q.coverages
            .filter((c) => (c.canonicalName || c.name) === coverageName)
            .map((c) => c.deductible)
            .filter((d): d is string => !!d && d !== 'No aplica')
        );

        if (allDeds.length > 1) {
          const parsedDeds = await Promise.all(allDeds.map((d) => hybridDeductibleParser.parse(d)));
          const minDed = Math.min(
            ...parsedDeds.map((d) => d.normalized.minAmount || d.normalized.percentage || Infinity)
          );
          const quoteMin =
            quoteDed.normalized.minAmount || quoteDed.normalized.percentage || Infinity;

          if (quoteMin === minDed) {
            totalDedScore += 100; // Best deductible
          } else if (quoteMin <= minDed * 1.2) {
            totalDedScore += 80; // Within 20%
          } else if (quoteMin <= minDed * 1.5) {
            totalDedScore += 60; // Within 50%
          } else {
            totalDedScore += 40; // Much worse
          }
          dedCount++;
        }
      } catch (_error) {
        console.warn(`⚠️ [quoteScorer] Failed to parse deductible: ${result.quoteData.deductible}`);
      }
    }

    if (dedCount > 0) {
      deductibleScore = Math.round(totalDedScore / dedCount);
    }
  }

  return { coverageScore, deductibleScore };
}
