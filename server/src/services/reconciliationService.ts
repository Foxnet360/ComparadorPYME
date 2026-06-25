import {
  DeductibleStructure,
  ReconciliationResult,
  ReconciliationStatus,
  ReconciliationThresholdConfig,
} from '../schemas/extractionSchemas';
import { hybridDeductibleParser, HybridDeductibleResult } from './hybridDeductibleParser';
import { deductibleEquals } from './deductibleFormatter';
import { structuredClauseExtractor, StructuredClause, ExtractedCoverage } from './structuredClauseExtractor';
import { insurerNameNormalizer } from './insurerNameNormalizer';
import { ParsedQuote} from './quoteParser';
import { env } from '../config/env';

// ---------------------------------------------------------------------------
// Threshold configuration
// ---------------------------------------------------------------------------

interface ThresholdRegistry {
  default: ReconciliationThresholdConfig;
  insurers: Record<string, ReconciliationThresholdConfig>;
}

function loadThresholdRegistry(): ThresholdRegistry {
  const raw = process.env.RECONCILIATION_THRESHOLDS;
  if (!raw) {
    return {
      default: { default: 0.05 },
      insurers: {},
    };
  }
  try {
    const parsed = JSON.parse(raw) as ThresholdRegistry;
    return {
      default: parsed.default || { default: 0.05 },
      insurers: parsed.insurers || {},
    };
  } catch {
    console.warn('⚠️ [ReconciliationService] Invalid RECONCILIATION_THRESHOLDS JSON; using defaults');
    return {
      default: { default: 0.05 },
      insurers: {},
    };
  }
}

const thresholdRegistry = loadThresholdRegistry();

export function getThreshold(insurerName: string, coverageName: string): number {
  const insurerKey = Object.keys(thresholdRegistry.insurers).find(
    k => k.toLowerCase() === insurerName.toLowerCase()
  );
  const config = insurerKey ? thresholdRegistry.insurers[insurerKey] : thresholdRegistry.default;
  const override = config.coverageOverrides?.[coverageName];
  return override ?? config.default;
}

// ---------------------------------------------------------------------------
// Deductible structure builders
// ---------------------------------------------------------------------------

function buildDeductibleStructureFromClause(
  clauseCoverage: ExtractedCoverage
): DeductibleStructure | null {
  const ded = clauseCoverage.deductible;
  if (!ded || !ded.components || ded.components.length === 0) {
    return null;
  }

  const components = ded.components.map(c => ({
    type: c.type as DeductibleStructure['components'][number]['type'],
    value: c.value,
    currency: c.currency ?? undefined,
  }));

  const hasMinimum = components.some(c => c.type === 'minimum');
  const hasMaximum = components.some(c => c.type === 'maximum');
  const isZero = components.length === 1 && components[0].type === 'na';
  const isComposite = components.length > 1;

  return {
    components,
    compoundOperator: 'none',
    isZero,
    hasMinimum,
    hasMaximum,
    isComposite,
    rawText: ded.rawText || '',
  };
}

// ---------------------------------------------------------------------------
// Normalization helpers (convert everything to comparable numeric values)
// ---------------------------------------------------------------------------

interface NormalizedDeductible {
  percentage: number;
  minAmount: number;
  maxAmount: number;
  isPercentageBased: boolean;
  isZero: boolean;
  isUnknown: boolean;
}

function normalizeDeductible(structure: DeductibleStructure): NormalizedDeductible {
  const result: NormalizedDeductible = {
    percentage: 0,
    minAmount: 0,
    maxAmount: 0,
    isPercentageBased: false,
    isZero: structure.isZero,
    isUnknown: structure.components.some(c => c.type === 'unknown'),
  };

  if (structure.isZero) {
    return result;
  }

  for (const comp of structure.components) {
    switch (comp.type) {
      case 'percentage':
        result.percentage = comp.value;
        result.isPercentageBased = true;
        break;
      case 'minimum':
        result.minAmount = comp.value;
        break;
      case 'maximum':
        result.maxAmount = comp.value;
        break;
      case 'fixed':
        result.minAmount = comp.value;
        result.maxAmount = comp.value;
        break;
      case 'smmlv': {
        result.minAmount = comp.value * env.SMMLV_VALUE;
        result.maxAmount = comp.value * env.SMMLV_VALUE;
        break;
      }
      case 'uvt': {
        result.minAmount = comp.value * env.UVT_VALUE;
        result.maxAmount = comp.value * env.UVT_VALUE;
        break;
      }
      case 'na':
        result.isZero = true;
        break;
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Comparison logic
// ---------------------------------------------------------------------------

function compareDeductibles(
  quote: NormalizedDeductible,
  clause: NormalizedDeductible,
  threshold: number
): { status: ReconciliationStatus; confidence: number; details: string[] } {
  const details: string[] = [];

  // Unknown handling
  if (quote.isUnknown || clause.isUnknown) {
    details.push('Deducible con datos insuficientes para comparación');
    return { status: 'PENDING', confidence: 0.55, details };
  }

  // Both zero/NA → MATCH
  if (quote.isZero && clause.isZero) {
    return { status: 'MATCH', confidence: 0.98, details };
  }

  // One zero, other not → MISMATCH
  if (quote.isZero !== clause.isZero) {
    const zeroSide = quote.isZero ? 'cotización' : 'clausulado';
    details.push(`Deducible 0/NA en ${zeroSide} pero con valor en el otro`);
    return { status: 'MISMATCH', confidence: 0.88, details };
  }

  // Both percentage-based
  if (quote.isPercentageBased && clause.isPercentageBased) {
    const diff = Math.abs(quote.percentage - clause.percentage);
    if (diff <= threshold * 100) {
      const confidence = 0.90 + (0.10 * (1 - diff / (threshold * 100 || 1)));
      return { status: 'MATCH', confidence: Math.min(confidence, 0.99), details };
    }
    details.push(`Diferencia porcentual: ${diff.toFixed(1)}% (umbral: ${(threshold * 100).toFixed(1)}%)`);
    return { status: 'MISMATCH', confidence: 0.82, details };
  }

  // One percentage, other fixed → MISMATCH
  if (quote.isPercentageBased !== clause.isPercentageBased) {
    details.push('Tipo de deducible diferente (porcentaje vs monto fijo)');
    return { status: 'MISMATCH', confidence: 0.85, details };
  }

  // Both fixed amounts
  const minDiff = Math.abs(quote.minAmount - clause.minAmount);
  const avgAmount = (quote.minAmount + clause.minAmount) / 2 || 1;
  const relativeDiff = minDiff / avgAmount;

  if (relativeDiff <= threshold) {
    const confidence = 0.90 + (0.10 * (1 - relativeDiff / threshold));
    return { status: 'MATCH', confidence: Math.min(confidence, 0.99), details };
  }

  details.push(`Diferencia en monto: ${minDiff.toLocaleString('es-CO')} COP (relativa: ${(relativeDiff * 100).toFixed(1)}%, umbral: ${(threshold * 100).toFixed(1)}%)`);
  return { status: 'MISMATCH', confidence: 0.80, details };
}

// ---------------------------------------------------------------------------
// Coverage name matching
// ---------------------------------------------------------------------------

function findClauseCoverage(
  clause: StructuredClause | null,
  coverageName: string
): ExtractedCoverage | null {
  if (!clause || !clause.coverages || clause.coverages.length === 0) {
    return null;
  }

  // Exact match first
  const exact = clause.coverages.find(
    c => c.name.toLowerCase() === coverageName.toLowerCase()
  );
  if (exact) return exact;

  // Substring match
  const lowerCoverage = coverageName.toLowerCase();
  const substring = clause.coverages.find(c => {
    const lower = c.name.toLowerCase();
    return lower.includes(lowerCoverage) || lowerCoverage.includes(lower);
  });
  if (substring) return substring;

  return null;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface ReconcileQuoteOptions {
  insurerName?: string;
  productName?: string;
  domain?: string;
}

export const reconciliationService = {
  /**
   * Reconcile a parsed quote against stored clause data.
   *
   * For each coverage in the quote:
   *   1. Search for matching clause by insurer + coverage name
   *   2. Parse both quote and clause deductibles into structured form
   *   3. Compare with per-insurer/product configurable thresholds
   *   4. Return status: MATCH | MISMATCH | MISSING_CLAUSE | PENDING
   */
  async reconcileQuote(
    quote: ParsedQuote,
    options: ReconcileQuoteOptions = {}
  ): Promise<ReconciliationResult[]> {
    const rawInsurerName = options.insurerName || quote.insurerName;
    if (!rawInsurerName || rawInsurerName === 'NO ESPECIFICADO') {
      console.warn('⚠️ [ReconciliationService] Cannot reconcile quote without insurer name');
      return [];
    }

    // Normalize insurer name before searching
    const normalizedInsurerName = insurerNameNormalizer.normalize(rawInsurerName);
    const insurerName = normalizedInsurerName || rawInsurerName;

    // Telemetry: log unmapped insurer names (only when no mapping exists and it's not already a known canonical name)
    const knownCanonicalNames = insurerNameNormalizer.getKnownInsurers();
    const isAlreadyCanonical = knownCanonicalNames.some(
      known => known.toUpperCase() === rawInsurerName.toUpperCase()
    );
    if (normalizedInsurerName === rawInsurerName && !isAlreadyCanonical) {
      console.warn(`⚠️ [ReconciliationService] Unmapped insurer name encountered: "${rawInsurerName}"`);
    }

    const results: ReconciliationResult[] = [];

    // Fetch clause once per insurer (not per coverage)
    let clause: StructuredClause | null = null;
    try {
      clause = await structuredClauseExtractor.searchClause(insurerName);
    } catch (err: unknown) {
      console.warn(`⚠️ [ReconciliationService] Clause search failed for ${insurerName}:`, err instanceof Error ? err.message : String(err));
    }

    const coveragesToReconcile = quote.coverages || [];

    for (const coverage of coveragesToReconcile) {
      const coverageName = coverage.canonicalName || coverage.name;
      if (!coverageName) continue;

      // Parse quote deductible
      let quoteDedResult: HybridDeductibleResult;
      try {
        quoteDedResult = await hybridDeductibleParser.parse(
          coverage.deductible || '',
          coverageName
        );
      } catch (err: unknown) {
        console.warn(`⚠️ [ReconciliationService] Failed to parse quote deductible for ${coverageName}:`, err instanceof Error ? err.message : String(err));
        quoteDedResult = {
          components: [{ type: 'unknown', value: 0 }],
          compoundOperator: 'none',
          isZero: false,
          hasMinimum: false,
          hasMaximum: false,
          isComposite: false,
          rawText: coverage.deductible || '',
          normalized: {
            minAmount: 0,
            minAmountCOP: 0,
            maxAmount: 0,
            maxAmountCOP: 0,
            percentage: 0,
            isPercentageBased: false,
          },
          parseMethod: 'empty',
        };
      }

      // Find matching clause coverage
      const clauseCoverage = clause ? findClauseCoverage(clause, coverageName) : null;
      const clauseDedStructure = clauseCoverage
        ? buildDeductibleStructureFromClause(clauseCoverage)
        : null;

      const threshold = getThreshold(insurerName, coverageName);

      let status: ReconciliationStatus;
      let confidence: number;
      let details: string[] = [];

      if (!clause) {
        status = 'MISSING_CLAUSE';
        confidence = 0.40;
        details.push(`No se encontró clausulado para aseguradora: ${insurerName}`);
      } else if (!clauseCoverage) {
        status = 'MISSING_CLAUSE';
        confidence = 0.45;
        details.push(`Cobertura "${coverageName}" no encontrada en clausulado`);
      } else if (!clauseDedStructure) {
        status = 'PENDING';
        confidence = 0.60;
        details.push(`Clausulado no especifica deducible para "${coverageName}"`);
      } else if (!coverage.deductible || coverage.deductible.trim() === '' || coverage.deductible === 'NO ESPECIFICADO') {
        status = 'PENDING';
        confidence = 0.55;
        details.push(`Cotización no especifica deducible para "${coverageName}"`);
      } else {
        // Short-circuit exact semantic equality via the formatter helper.
        if (deductibleEquals(quoteDedResult, clauseDedStructure)) {
          status = 'MATCH';
          confidence = 0.99;
        } else {
          const quoteNormalized = normalizeDeductible(quoteDedResult);
          const clauseNormalized = normalizeDeductible(clauseDedStructure);
          const comparison = compareDeductibles(quoteNormalized, clauseNormalized, threshold);
          status = comparison.status;
          confidence = comparison.confidence;
          details = comparison.details;
        }
      }

      results.push({
        coverageName,
        quoteDeductible: {
          components: quoteDedResult.components,
          compoundOperator: quoteDedResult.compoundOperator,
          isZero: quoteDedResult.isZero,
          hasMinimum: quoteDedResult.hasMinimum,
          hasMaximum: quoteDedResult.hasMaximum,
          isComposite: quoteDedResult.isComposite,
          rawText: quoteDedResult.rawText,
        },
        clauseDeductible: clauseDedStructure,
        status,
        confidence,
        discrepancyDetails: details.length > 0 ? details : undefined,
      });
    }

    const mismatchCount = results.filter(r => r.status === 'MISMATCH').length;
    const missingCount = results.filter(r => r.status === 'MISSING_CLAUSE').length;
    const pendingCount = results.filter(r => r.status === 'PENDING').length;

    console.log(
      `🔍 [ReconciliationService] Reconciled ${results.length} coverages for ${insurerName}: ` +
      `${results.filter(r => r.status === 'MATCH').length} MATCH, ` +
      `${mismatchCount} MISMATCH, ${missingCount} MISSING_CLAUSE, ${pendingCount} PENDING`
    );

    return results;
  },

  /**
   * Get current threshold configuration for debugging/auditing
   */
  getThresholdConfig(): ThresholdRegistry {
    return { ...thresholdRegistry };
  },

  /**
   * Expose internal helpers for testing
   */
  __testHelpers: {
    buildDeductibleStructureFromClause,
    normalizeDeductible,
    compareDeductibles,
    findClauseCoverage,
    getThreshold,
  },
};

export default reconciliationService;
