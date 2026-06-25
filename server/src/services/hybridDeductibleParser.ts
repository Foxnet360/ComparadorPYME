import { geminiService } from './gemini';
import { getCachedDeductibleV2, setCachedDeductibleV2 } from './cache/redisCache';
import { DeductibleStructure, CurrencyRates } from '../schemas/extractionSchemas';
import { deductibleBenchmarks } from './deductibleBenchmarks';
import { coverageGraphService } from './coverageGraphService';
import { featureFlags } from '../config/featureFlags';
import { getDomainConstants } from '../config/domainConstants';
import type { TemplateExtractionHints } from '../schemas/templateRegistrySchema';

function getDefaultRates(): CurrencyRates {
  const constants = getDomainConstants();
  return {
    smmlv: constants.smmlv,
    uvt: constants.uvt,
  };
}

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
  normalized: {
    minAmount: number;
    minAmountCOP: number;
    maxAmount: number;
    maxAmountCOP: number;
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
  parseMethod: 'cache' | 'regex' | 'llm' | 'empty';
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

type DeductibleComponentType =
  | 'percentage'
  | 'fixed'
  | 'smmlv'
  | 'uvt'
  | 'minimum'
  | 'maximum'
  | 'na'
  | 'unknown';

type CompoundOperator = 'none' | 'greater_of' | 'lesser_of' | 'sum' | 'and';

interface ParsedDeductibleComponents {
  components: Array<{ type: DeductibleComponentType; value: number; currency?: string }>;
  compoundOperator: CompoundOperator;
  isZero: boolean;
  hasMinimum: boolean;
  hasMaximum: boolean;
  isComposite: boolean;
}

const PATTERNS = {
  zero: /^(sin\s+deducible(?:\s+alguno)?|no\s+aplica(?:\s+deducible)?|sin\s+aplicaci[oó]n(?:\s+de\s+deducible)?|incluido|0\s*%|0|n\/a|na)$/i,
  percentage: /(\d+(?:[.,]\d+)?)\s*%/,
  smmlv: /(\d+)\s*(?:SMMLV|SM)\b/i,
  uvt: /(\d+)\s*(?:UVT)\b/i,
  fixed: /(?:\$?\s*)([\d.,]+)\s*(COP|USD)?/i,
  minClause: /(?:m[ií]n(?:imo|o|\.|\b)?)(?:\s+de)?\s*(?:\$?\s*)(\d+(?:[.,]\d+)*)\s*(smmlv|sm|cop|pesos|uvt)?/i,
  maxClause: /(?:m[aá]x(?:imo|o|\.|\b)?|tope|l[ií]mite)(?:\s+de)?\s*(?:\$?\s*)(\d+(?:[.,]\d+)*)\s*(smmlv|sm|cop|pesos|uvt)?/i,
};

function inferCompoundOperator(
  text: string,
  components: Array<{ type: DeductibleComponentType; value: number; currency?: string }>
): CompoundOperator {
  const lower = text.toLowerCase();

  // Explicit lesser-of language or a cap/maximum clause → lesser_of
  if (
    /menor\s+(entre|de)/.test(lower) ||
    /m[aá]x(?:imo|o|\.\b)?|tope|l[ií]mite/.test(lower) ||
    (components.some((c) => c.type === 'maximum') && components.length > 1)
  ) {
    return 'lesser_of';
  }

  // Explicit greater-of language or a minimum clause → greater_of
  if (
    /mayor\s+(entre|de)/.test(lower) ||
    /m[ií]n(?:imo|o|\.\b)?\b/.test(lower) ||
    (components.some((c) => c.type === 'minimum') && components.length > 1)
  ) {
    return 'greater_of';
  }

  // Sum operator
  if (/\+\s*\d/.test(text) || /\bsuma\s+de\b/i.test(text)) {
    return 'sum';
  }

  // Two or more components joined by "y" (e.g. "10% y 5 SMMLV")
  if (/\s+y\s+/.test(lower) && components.length > 1) {
    return 'greater_of';
  }

  return 'none';
}

function parseNumericSegment(segment: string): { value: number; currency?: string } | null {
  const fixedMatch = segment.match(/(?:\$?\s*)([\d.,]+)\s*(COP|USD)?/i);
  if (fixedMatch) {
    const val = parseFloat(fixedMatch[1].replace(/[.,]/g, ''));
    if (!isNaN(val) && val >= 0) {
      return { value: val, currency: fixedMatch[2] || undefined };
    }
  }
  return null;
}

function parseCompoundJoin(text: string): ParsedDeductibleComponents | null {
  const lower = text.toLowerCase();

  // Avoid double-parsing forms that already include min/max clauses.
  if (PATTERNS.minClause.test(text) || PATTERNS.maxClause.test(text)) {
    return null;
  }

  // Allow explicit qualifiers such as "mayor entre 10% y 5 SMMLV" or
  // "menor entre 10% y $500.000" to appear before the percentage.
  const explicitQualifierMatch = text.match(
    /^\s*(mayor\s+entre|mayor\s+de|menor\s+entre|menor\s+de)\s+/i
  );
  const qualifier = explicitQualifierMatch ? explicitQualifierMatch[1].toLowerCase() : null;
  const textAfterQualifier = qualifier
    ? text.substring(explicitQualifierMatch![0].length)
    : text;

  const pctMatch = textAfterQualifier.match(/^\s*(\d+(?:[.,]\d+)?)\s*%/);
  if (!pctMatch) return null;

  const percentage = parseFloat(pctMatch[1].replace(',', '.'));
  const afterPct = textAfterQualifier.substring(pctMatch[0].length);

  // Detect operator between percentage and second component.
  const operatorMatch = afterPct.match(
    /^\s*(?:\s+y\s+|\s*\+\s+|\s*\/\s+)/i
  );
  if (!operatorMatch) return null;

  const rest = afterPct.substring(operatorMatch[0].length).trim();
  if (!rest) return null;

  const components: ParsedDeductibleComponents['components'] = [
    { type: 'percentage', value: percentage },
  ];

  // Second component: SMMLV, UVT, or fixed amount.
  const smmlvMatch = rest.match(PATTERNS.smmlv);
  if (smmlvMatch) {
    components.push({ type: 'smmlv', value: parseInt(smmlvMatch[1], 10) });
  } else {
    const uvtMatch = rest.match(PATTERNS.uvt);
    if (uvtMatch) {
      components.push({ type: 'uvt', value: parseInt(uvtMatch[1], 10) });
    } else {
      const fixed = parseNumericSegment(rest);
      if (fixed) {
        components.push({
          type: 'fixed',
          value: fixed.value,
          currency: fixed.currency || (rest.includes('$') ? 'COP' : undefined),
        });
      } else {
        return null;
      }
    }
  }

  let compoundOperator: CompoundOperator = 'and';
  if (qualifier && /menor/.test(qualifier)) compoundOperator = 'lesser_of';
  else if (qualifier && /mayor/.test(qualifier)) compoundOperator = 'greater_of';
  else if (/\+\s*\d/.test(text) || /\bsuma\s+de\b/i.test(text)) compoundOperator = 'sum';
  else compoundOperator = 'greater_of';

  return {
    components,
    compoundOperator,
    isZero: false,
    hasMinimum: false,
    hasMaximum: false,
    isComposite: true,
  };
}

function parseSimple(text: string): ParsedDeductibleComponents | null {
  const t = text.trim();

  // Zero deductible
  if (PATTERNS.zero.test(t)) {
    return {
      components: [{ type: 'na', value: 0 }],
      compoundOperator: 'none',
      isZero: true,
      hasMinimum: false,
      hasMaximum: false,
      isComposite: false,
    };
  }

  // Compound joined by "y", "+", "mayor entre", "menor entre", etc.
  const compoundJoin = parseCompoundJoin(t);
  if (compoundJoin) {
    return compoundJoin;
  }

  // Pure percentage
  const pctMatch = t.match(PATTERNS.percentage);
  if (pctMatch && !PATTERNS.minClause.test(t) && !PATTERNS.maxClause.test(t)) {
    return {
      components: [{ type: 'percentage', value: parseFloat(pctMatch[1].replace(',', '.')) }],
      compoundOperator: 'none',
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
      compoundOperator: 'none',
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
      compoundOperator: 'none',
      isZero: false,
      hasMinimum: false,
      hasMaximum: false,
      isComposite: false,
    };
  }

  // Pure fixed amount (simple case: only digits and separators).
  // Require a currency symbol/suffix OR a value large enough that it is
  // unlikely to be a percentage plain number (e.g. "$500", "500000", "$500 COP").
  const simpleFixed = t.match(/^\$?\s*([\d.,]+)\s*(COP|USD)?$/i);
  if (simpleFixed && !PATTERNS.percentage.test(t) && !PATTERNS.smmlv.test(t) && !PATTERNS.uvt.test(t)) {
    const val = parseFloat(simpleFixed[1].replace(/[.,]/g, ''));
    const hasCurrency = !!simpleFixed[2] || /^\$/.test(t);
    if (!isNaN(val) && val > 0 && (hasCurrency || val >= 10000)) {
      return {
        components: [{ type: 'fixed', value: val, currency: simpleFixed[2] || 'COP' }],
        compoundOperator: 'none',
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
    const components: ParsedDeductibleComponents['components'] = [];
    let hasMinimum = false;
    let hasMaximum = false;

    if (pctCompound) {
      components.push({ type: 'percentage', value: parseFloat(pctCompound[1]) });
    }

    if (minCompound) {
      hasMinimum = true;
      const val = parseFloat(minCompound[1].replace(/[.,]/g, ''));
      const unit = minCompound[2]?.toUpperCase() || '';
      components.push({
        type: 'minimum',
        value: val,
        currency: unit || (minCompound[0].includes('$') ? 'COP' : undefined),
      });
    }

    if (maxCompound) {
      hasMaximum = true;
      const val = parseFloat(maxCompound[1].replace(/[.,]/g, ''));
      const unit = maxCompound[2]?.toUpperCase() || '';
      components.push({
        type: 'maximum',
        value: val,
        currency: unit || (maxCompound[0].includes('$') ? 'COP' : undefined),
      });
    }

    if (components.length > 0) {
      const compoundOperator = inferCompoundOperator(t, components);
      return {
        components,
        compoundOperator,
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

function convertToCOP(value: number, currency?: string | null, rates = getDefaultRates()): number {
  if (!currency) return value;
  const upper = currency.toUpperCase();
  if (upper.includes('SMMLV') || upper === 'SM') return value * rates.smmlv;
  if (upper.includes('UVT')) return value * rates.uvt;
  return value;
}

interface ComponentInput {
  type: string;
  value: number;
  currency?: string | null;
}

function computeNormalized(input: {
  components: ComponentInput[];
  compoundOperator: CompoundOperator;
}): HybridDeductibleResult['normalized'] {
  let percentage = 0;
  let isPercentageBased = false;
  const floorValues: number[] = [];
  const capValues: number[] = [];

  const operator = input.compoundOperator;

  for (const comp of input.components) {
    switch (comp.type) {
      case 'percentage':
        percentage = comp.value;
        isPercentageBased = true;
        break;
      case 'minimum':
        floorValues.push(convertToCOP(comp.value, comp.currency));
        break;
      case 'maximum':
        capValues.push(convertToCOP(comp.value, comp.currency));
        break;
      case 'fixed': {
        const amount = convertToCOP(comp.value, comp.currency);
        // In a lesser_of compound a fixed amount acts as a cap; in greater_of / sum
        // it acts as a floor. For standalone fixed amounts it is both min and max.
        if (operator === 'lesser_of') {
          capValues.push(amount);
        } else if (operator === 'greater_of' || operator === 'sum') {
          floorValues.push(amount);
        } else {
          floorValues.push(amount);
          capValues.push(amount);
        }
        break;
      }
      case 'smmlv': {
        const rates = getDefaultRates();
        const amount = comp.value * rates.smmlv;
        if (operator === 'lesser_of') {
          capValues.push(amount);
        } else if (operator === 'greater_of' || operator === 'sum') {
          floorValues.push(amount);
        } else {
          floorValues.push(amount);
          capValues.push(amount);
        }
        break;
      }
      case 'uvt': {
        const rates = getDefaultRates();
        const amount = comp.value * rates.uvt;
        if (operator === 'lesser_of') {
          capValues.push(amount);
        } else if (operator === 'greater_of' || operator === 'sum') {
          floorValues.push(amount);
        } else {
          floorValues.push(amount);
          capValues.push(amount);
        }
        break;
      }
      case 'na':
        percentage = 0;
        isPercentageBased = false;
        break;
    }
  }

  let minAmount = 0;
  let maxAmount = 0;

  if (operator === 'sum') {
    minAmount = floorValues.reduce((a, b) => a + b, 0);
    maxAmount = capValues.reduce((a, b) => a + b, 0);
  } else if (operator === 'lesser_of' && capValues.length > 0) {
    maxAmount = Math.min(...capValues);
    minAmount = floorValues.length > 0 ? Math.max(...floorValues) : 0;
  } else if (floorValues.length > 0) {
    // greater_of, and, none with floors
    minAmount = Math.max(...floorValues);
    maxAmount = capValues.length > 0 ? Math.max(...capValues) : 0;
  } else if (capValues.length > 0) {
    // Cap-only compound
    maxAmount = Math.max(...capValues);
    minAmount = 0;
  }

  return {
    minAmount,
    minAmountCOP: minAmount,
    maxAmount,
    maxAmountCOP: maxAmount,
    percentage,
    isPercentageBased,
  };
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
    const components: ComponentInput[] = (parsed.components || []).map((c: Record<string, unknown>) => ({
      type: c.type as DeductibleComponentType,
      value: Number(c.value) || 0,
      currency: c.currency ? String(c.currency) : undefined,
    }));
    return {
      components: components as DeductibleStructure['components'],
      compoundOperator: (parsed.compoundOperator as CompoundOperator) || 'none',
      isZero: parsed.isZero || false,
      hasMinimum: parsed.hasMinimum || false,
      hasMaximum: parsed.hasMaximum || false,
      isComposite: parsed.isComposite || false,
      rawText: text,
    };
  } catch (error: unknown) {
    console.error('❌ [HybridDeductibleParser] LLM fallback failed:', error instanceof Error ? error.message : String(error));
    // Return a safe "unknown" structure so callers don't crash
    return {
      components: [{ type: 'unknown', value: 0 }],
      compoundOperator: 'none',
      isZero: false,
      hasMinimum: false,
      hasMaximum: false,
      isComposite: false,
      rawText: text,
    };
  }
}

// ---------------------------------------------------------------------------
// Internal result builder shared by async parse and parseSync
// ---------------------------------------------------------------------------

function buildEmptyResult(text: string): HybridDeductibleResult {
  return {
    components: [{ type: 'unknown', value: 0 }],
    compoundOperator: 'none',
    isZero: false,
    hasMinimum: false,
    hasMaximum: false,
    isComposite: false,
    rawText: text,
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

function buildResult(
  text: string,
  parsed: ParsedDeductibleComponents,
  resolvedCoverage: string | undefined,
  parseMethod: 'regex' | 'llm'
): HybridDeductibleResult {
  const normalized = computeNormalized(parsed);
  const result: HybridDeductibleResult = {
    ...parsed,
    rawText: text,
    normalized,
    benchmark: evaluateBenchmark(resolvedCoverage, normalized),
    parseMethod,
  };
  return result;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export const hybridDeductibleParser = {
  /**
   * Synchronous deterministic parse (cache-free, LLM-free).
   * Intended for validation and display formatting where async I/O is not
   * acceptable. Returns an "unknown" structure when regex cannot parse the text.
   */
  parseSync(
    deductibleText: string,
    coverageNameOrOptions?: string | DeductibleParseOptions,
    maybeOptions?: DeductibleParseOptions
  ): HybridDeductibleResult {
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
      return buildEmptyResult(deductibleText || '');
    }

    const text = deductibleText.trim();
    const regexResult = parseSimple(text);
    if (regexResult) {
      return buildResult(text, regexResult, explicitCoverageName, 'regex');
    }

    return buildEmptyResult(text);
  },

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
      return buildEmptyResult(deductibleText || '');
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
      } catch (error: unknown) {
        console.warn(`⚠️ [HybridDeductibleParser] Graph deductible lookup failed: ${error instanceof Error ? error.message : String(error)}`);
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
      const normalized = computeNormalized({
        components: cached.components,
        compoundOperator: cached.compoundOperator ?? 'none',
      });
      return {
        ...cached,
        rawText: text,
        normalized,
        benchmark: evaluateBenchmark(resolvedCoverage, normalized),
        appliesTo,
        parseMethod: 'cache',
      };
    }

    // 3. Regex path
    const regexResult = parseSimple(text);
    if (regexResult) {
      telemetry.regexHits++;
      console.log(`✅ [HybridDeductibleParser] Regex hit for "${text.substring(0, 40)}..."`);
      const result = buildResult(text, regexResult, resolvedCoverage, 'regex');
      result.appliesTo = appliesTo;

      // Cache regex results too
      await setCachedDeductibleV2(text, {
        components: regexResult.components,
        compoundOperator: regexResult.compoundOperator,
        isZero: regexResult.isZero,
        hasMinimum: regexResult.hasMinimum,
        hasMaximum: regexResult.hasMaximum,
        isComposite: regexResult.isComposite,
      }).catch(() => {});
      return result;
    }

    // 4. LLM fallback
    telemetry.llmFallbacks++;
    console.log(`🤖 [HybridDeductibleParser] LLM fallback for "${text.substring(0, 40)}..."`);
    const llmResult = await parseWithLLM(text);
    const normalized = computeNormalized({
      components: llmResult.components,
      compoundOperator: llmResult.compoundOperator ?? 'none',
    });
    const result: HybridDeductibleResult = {
      ...llmResult,
      rawText: text,
      normalized,
      benchmark: evaluateBenchmark(resolvedCoverage, normalized),
      appliesTo,
      parseMethod: 'llm',
    };

    // 5. Cache fallback results
    await setCachedDeductibleV2(text, {
      components: llmResult.components,
      compoundOperator: llmResult.compoundOperator ?? 'none',
      isZero: llmResult.isZero,
      hasMinimum: llmResult.hasMinimum,
      hasMaximum: llmResult.hasMaximum,
      isComposite: llmResult.isComposite,
    }).catch(() => {});

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
