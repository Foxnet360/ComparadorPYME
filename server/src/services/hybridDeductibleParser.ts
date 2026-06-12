import { geminiService } from './gemini';
import { getCachedDeductibleV2, setCachedDeductibleV2 } from './cache/redisCache';
import { DeductibleStructure, normalizeValueToCOP, CurrencyRates } from '../schemas/extractionSchemas';
import { deductibleBenchmarks } from './deductibleBenchmarks';
import { coverageGraphService } from './coverageGraphService';
import { featureFlags } from '../config/featureFlags';
import type { TemplateExtractionHints } from '../schemas/templateRegistrySchema';

const DEFAULT_RATES: CurrencyRates = {
  smmlv: parseInt(process.env.SMMLV_VALUE || '1423500', 10),
  uvt: parseInt(process.env.UVT_VALUE || '42412', 10),
};

// ---------------------------------------------------------------------------
// Telemetry
// ---------------------------------------------------------------------------

interface TelemetryCounters {
  cacheHits: number;
  regexHits: number;
  llmFallbacks: number;
  benchmarkEvaluations: number;
}

let telemetry: TelemetryCounters = {
  cacheHits: 0,
  regexHits: 0,
  llmFallbacks: 0,
  benchmarkEvaluations: 0,
};

export function getHybridParserStats(): TelemetryCounters {
  return { ...telemetry };
}

export function resetHybridParserStats(): void {
  telemetry = {
    cacheHits: 0,
    regexHits: 0,
    llmFallbacks: 0,
    benchmarkEvaluations: 0,
  };
}

function logTelemetry(): void {
  const total = telemetry.cacheHits + telemetry.regexHits + telemetry.llmFallbacks;
  if (total === 0) return;

  const cacheRate = ((telemetry.cacheHits / total) * 100).toFixed(1);
  const regexRate = ((telemetry.regexHits / total) * 100).toFixed(1);
  const fallbackRate = ((telemetry.llmFallbacks / total) * 100).toFixed(1);

  console.log(
    `📊 [HybridDeductibleParser] Telemetry — total:${total} cacheHits:${telemetry.cacheHits}(${cacheRate}%) regexHits:${telemetry.regexHits}(${regexRate}%) llmFallbacks:${telemetry.llmFallbacks}(${fallbackRate}%)`
  );
}

// ---------------------------------------------------------------------------
// Result type (extends Zod schema with computed normalisation)
// ---------------------------------------------------------------------------

export interface HybridDeductibleResult extends DeductibleStructure {
  rawText: string;
  normalized: {
    minAmount: number;
    maxAmount: number;
    percentage: number;
    isPercentageBased: boolean;
  };
  benchmark?: {
    benchmark: string;
    assessment: string;
    notes: string;
  };
  appliesTo?: {
    coverageName: string;
    confidence: number;
  };
}

// ---------------------------------------------------------------------------
// Parse options
// ---------------------------------------------------------------------------

export interface DeductibleParseOptions {
  coverageName?: string;
  insurer?: string;
  domain?: string;
  templateHints?: TemplateExtractionHints;
  useGraph?: boolean;
}

// ---------------------------------------------------------------------------
// Regex patterns (deterministic path)
// ---------------------------------------------------------------------------

const PATTERNS = {
  zero: /^(sin\s+deducible(?:\s+alguno)?|no\s+aplica(?:\s+deducible)?|sin\s+aplicaci[oó]n(?:\s+de\s+deducible)?|incluido|0\s*%|0|n\/a|na)$/i,
  percentage: /(\d+(?:\.\d+)?)\s*%/,
  smmlv: /(\d+)\s*(?:SMMLV|SM)\b/i,
  uvt: /(\d+)\s*(?:UVT)\b/i,
  fixed: /(?:\$?\s*)([\d.,]+)\s*(COP|USD)?/i,
  minClause: /(?:m[ií]n(?:imo|o|\.|\b)?)(?:\s+de)?\s*(?:\$?\s*)(\d+(?:[.,]\d+)*)\s*(smmlv|sm|cop|pesos|uvt)?/i,
  maxClause: /(?:m[aá]x(?:imo|o|\.|\b)?|tope|l[ií]mite)(?:\s+de)?\s*(?:\$?\s*)(\d+(?:[.,]\d+)*)\s*(smmlv|sm|cop|pesos|uvt)?/i,
};

function parseSimple(text: string): DeductibleStructure | null {
  const t = text.trim();

  // Zero deductible
  if (PATTERNS.zero.test(t)) {
    return {
      components: [{ type: 'na', value: 0 }],
      isZero: true,
      hasMinimum: false,
      hasMaximum: false,
      isComposite: false,
    };
  }

  // Pure percentage
  const pctMatch = t.match(PATTERNS.percentage);
  if (pctMatch && !PATTERNS.minClause.test(t) && !PATTERNS.maxClause.test(t)) {
    return {
      components: [{ type: 'percentage', value: parseFloat(pctMatch[1]) }],
      isZero: false,
      hasMinimum: false,
      hasMaximum: false,
      isComposite: false,
    };
  }

  // Pure SMMLV
  const smmlvMatch = t.match(PATTERNS.smmlv);
  if (smmlvMatch && !PATTERNS.percentage.test(t)) {
    return {
      components: [{ type: 'smmlv', value: parseInt(smmlvMatch[1], 10) }],
      isZero: false,
      hasMinimum: false,
      hasMaximum: false,
      isComposite: false,
    };
  }

  // Pure UVT
  const uvtMatch = t.match(PATTERNS.uvt);
  if (uvtMatch && !PATTERNS.percentage.test(t)) {
    return {
      components: [{ type: 'uvt', value: parseInt(uvtMatch[1], 10) }],
      isZero: false,
      hasMinimum: false,
      hasMaximum: false,
      isComposite: false,
    };
  }

  // Pure fixed amount (simple case: only digits and separators)
  const simpleFixed = t.match(/^\$?\s*([\d.,]+)\s*(COP|USD)?$/i);
  if (simpleFixed && !PATTERNS.percentage.test(t) && !PATTERNS.smmlv.test(t) && !PATTERNS.uvt.test(t)) {
    const val = parseFloat(simpleFixed[1].replace(/[.,]/g, ''));
    if (!isNaN(val) && val > 0) {
      return {
        components: [{ type: 'fixed', value: val, currency: simpleFixed[2] || 'COP' }],
        isZero: false,
        hasMinimum: false,
        hasMaximum: false,
        isComposite: false,
      };
    }
  }

  // Compound: percentage + min/max
  const pctCompound = t.match(PATTERNS.percentage);
  const minCompound = t.match(PATTERNS.minClause);
  const maxCompound = t.match(PATTERNS.maxClause);

  if (pctCompound || minCompound || maxCompound) {
    const components: Array<{ type: 'percentage' | 'minimum' | 'maximum' | 'fixed' | 'smmlv' | 'uvt' | 'na'; value: number; currency?: string }> = [];
    let hasMinimum = false;
    let hasMaximum = false;

    if (pctCompound) {
      components.push({ type: 'percentage', value: parseFloat(pctCompound[1]) });
    }

    if (minCompound) {
      hasMinimum = true;
      const val = parseFloat(minCompound[1].replace(/[.,]/g, ''));
      const unit = minCompound[2]?.toUpperCase() || '';
      components.push({ type: 'minimum', value: val, currency: unit || undefined });
    }

    if (maxCompound) {
      hasMaximum = true;
      const val = parseFloat(maxCompound[1].replace(/[.,]/g, ''));
      const unit = maxCompound[2]?.toUpperCase() || '';
      components.push({ type: 'maximum', value: val, currency: unit || undefined });
    }

    if (components.length > 0) {
      return {
        components,
        isZero: false,
        hasMinimum,
        hasMaximum,
        isComposite: components.length > 1,
      };
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Normalisation helpers
// ---------------------------------------------------------------------------

function convertToCOP(value: number, currency?: string | null, rates = DEFAULT_RATES): number {
  if (!currency) return value;
  const upper = currency.toUpperCase();
  if (upper.includes('SMMLV') || upper === 'SM') return value * rates.smmlv;
  if (upper.includes('UVT')) return value * rates.uvt;
  return value;
}

function computeNormalized(structure: DeductibleStructure): HybridDeductibleResult['normalized'] {
  let minAmount = 0;
  let maxAmount = 0;
  let percentage = 0;
  let isPercentageBased = false;

  for (const comp of structure.components) {
    switch (comp.type) {
      case 'percentage':
        percentage = comp.value;
        isPercentageBased = true;
        break;
      case 'minimum':
        minAmount = convertToCOP(comp.value, comp.currency);
        break;
      case 'maximum':
        maxAmount = convertToCOP(comp.value, comp.currency);
        break;
      case 'fixed': {
        const amount = convertToCOP(comp.value, comp.currency);
        if (minAmount === 0) minAmount = amount;
        if (maxAmount === 0) maxAmount = amount;
        break;
      }
      case 'smmlv': {
        const amount = comp.value * DEFAULT_RATES.smmlv;
        if (minAmount === 0) minAmount = amount;
        if (maxAmount === 0) maxAmount = amount;
        break;
      }
      case 'uvt': {
        const amount = comp.value * DEFAULT_RATES.uvt;
        if (minAmount === 0) minAmount = amount;
        if (maxAmount === 0) maxAmount = amount;
        break;
      }
      case 'na':
        minAmount = 0;
        maxAmount = 0;
        percentage = 0;
        isPercentageBased = false;
        break;
    }
  }

  return { minAmount, maxAmount, percentage, isPercentageBased };
}

// ---------------------------------------------------------------------------
// Benchmark evaluation
// ---------------------------------------------------------------------------

function evaluateBenchmark(
  coverageName: string | undefined,
  normalized: HybridDeductibleResult['normalized']
): HybridDeductibleResult['benchmark'] {
  if (!coverageName) return undefined;

  telemetry.benchmarkEvaluations++;

  return deductibleBenchmarks.evaluate(coverageName, {
    percentage: normalized.percentage,
    minAmount: normalized.minAmount > 0 ? normalized.minAmount : undefined,
  });
}

// ---------------------------------------------------------------------------
// LLM fallback
// ---------------------------------------------------------------------------

async function parseWithLLM(text: string): Promise<DeductibleStructure> {
  try {
    const parsed = await geminiService.extractDeductible(text);
    return parsed;
  } catch (error: any) {
    console.error('❌ [HybridDeductibleParser] LLM fallback failed:', error.message);
    // Return a safe "unknown" structure so callers don't crash
    return {
      components: [{ type: 'unknown', value: 0 }],
      isZero: false,
      hasMinimum: false,
      hasMaximum: false,
      isComposite: false,
    };
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export const hybridDeductibleParser = {
  /**
   * Parse deductible text using a cache-first, regex-first, LLM-fallback strategy.
   *
   * Flow:
   *   1. Resolve applicable coverage from explicit argument or graph rules
   *   2. Check Redis/memory cache (key: deductible:v2:<hash>)
   *   3. Try deterministic regex patterns
   *   4. Evaluate against benchmarks (optional, when coverage resolved)
   *   5. Fall back to Gemini structured extraction
   *   6. Cache successful structures
   */
  async parse(
    deductibleText: string,
    coverageNameOrOptions?: string | DeductibleParseOptions,
    maybeOptions?: DeductibleParseOptions
  ): Promise<HybridDeductibleResult> {
    // Backward-compatible signature: parse(text, coverageName, options?) or parse(text, options?)
    let explicitCoverageName: string | undefined;
    let options: DeductibleParseOptions | undefined;

    if (typeof coverageNameOrOptions === 'string') {
      explicitCoverageName = coverageNameOrOptions;
      options = maybeOptions;
    } else {
      options = coverageNameOrOptions;
      explicitCoverageName = options?.coverageName;
    }

    if (!deductibleText || deductibleText.trim().length === 0) {
      return {
        components: [{ type: 'unknown', value: 0 }],
        isZero: false,
        hasMinimum: false,
        hasMaximum: false,
        isComposite: false,
        rawText: deductibleText || '',
        normalized: { minAmount: 0, maxAmount: 0, percentage: 0, isPercentageBased: false },
      };
    }

    const text = deductibleText.trim();
    const domain = options?.domain ?? 'pyme';

    // 1. Resolve applicable coverage from explicit argument or graph rules
    let resolvedCoverage = explicitCoverageName;
    let appliesTo: HybridDeductibleResult['appliesTo'] = undefined;

    if (!resolvedCoverage && options?.useGraph !== false && featureFlags.isEnabled('useTemplateGraphPipeline')) {
      try {
        const links = await coverageGraphService.queryDeductible(text, {
          insurer: options?.insurer,
          domain,
        });

        const best = links[0];
        if (best && best.confidence >= 0.7) {
          resolvedCoverage = best.appliesTo;
          appliesTo = { coverageName: best.appliesTo, confidence: best.confidence };
        }
      } catch (error: any) {
        console.warn(`⚠️ [HybridDeductibleParser] Graph deductible lookup failed: ${error.message}`);
      }
    }

    if (explicitCoverageName && !appliesTo) {
      appliesTo = { coverageName: explicitCoverageName, confidence: 1 };
    }

    // 2. Cache lookup
    const cached = await getCachedDeductibleV2(text);
    if (cached) {
      telemetry.cacheHits++;
      console.log(`⚡ [HybridDeductibleParser] Cache hit for "${text.substring(0, 40)}..."`);
      // Re-hydrate into full result shape
      const structure = cached as DeductibleStructure;
      const normalized = computeNormalized(structure);
      return {
        ...structure,
        rawText: text,
        normalized,
        benchmark: evaluateBenchmark(resolvedCoverage, normalized),
        appliesTo,
      };
    }

    // 3. Regex path
    const regexResult = parseSimple(text);
    if (regexResult) {
      telemetry.regexHits++;
      console.log(`✅ [HybridDeductibleParser] Regex hit for "${text.substring(0, 40)}..."`);
      const normalized = computeNormalized(regexResult);
      const result: HybridDeductibleResult = {
        ...regexResult,
        rawText: text,
        normalized,
        benchmark: evaluateBenchmark(resolvedCoverage, normalized),
        appliesTo,
      };

      // Cache regex results too
      await setCachedDeductibleV2(text, regexResult).catch(() => {});
      return result;
    }

    // 4. LLM fallback
    telemetry.llmFallbacks++;
    console.log(`🤖 [HybridDeductibleParser] LLM fallback for "${text.substring(0, 40)}..."`);
    const llmResult = await parseWithLLM(text);
    const normalized = computeNormalized(llmResult);
    const result: HybridDeductibleResult = {
      ...llmResult,
      rawText: text,
      normalized,
      benchmark: evaluateBenchmark(resolvedCoverage, normalized),
      appliesTo,
    };

    // 5. Cache fallback results
    await setCachedDeductibleV2(text, llmResult).catch(() => {});

    // Periodic telemetry log (every 10 operations)
    const total = telemetry.cacheHits + telemetry.regexHits + telemetry.llmFallbacks;
    if (total % 10 === 0) {
      logTelemetry();
    }

    return result;
  },

  getStats(): TelemetryCounters {
    return getHybridParserStats();
  },

  resetStats(): void {
    resetHybridParserStats();
  },
};

export default hybridDeductibleParser;
