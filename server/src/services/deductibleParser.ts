import { geminiService } from './gemini';
import { getDomainConstants, resolveValueToCOP } from '../config/domainConstants';
import { hybridDeductibleParser, HybridDeductibleResult } from './hybridDeductibleParser';

export interface DeductibleComponent {
  type: 'percentage' | 'fixed' | 'smmlv' | 'uvt' | 'minimum' | 'maximum' | 'na' | 'unknown';
  value: number;
  currency?: string;
}

export interface DeductibleStructure {
  components: DeductibleComponent[];
  semantics: {
    isZero: boolean;
    hasMinimum: boolean;
    hasMaximum: boolean;
    isComposite: boolean;
    appliesTo?: string[];
  };
  normalized: {
    minAmount: number;
    maxAmount: number;
    percentage: number;
    isPercentageBased: boolean;
  };
  rawText: string;
}

/**
 * @deprecated This module is a backward-compatible proxy to the canonical
 * `hybridDeductibleParser`. New code should import `hybridDeductibleParser`
 * directly or use `deductibleFormatter` helpers.
 */
function toLegacyStructure(result: HybridDeductibleResult): DeductibleStructure {
  return {
    components: result.components.map((c) => ({
      type: c.type,
      value: c.value,
      currency: c.currency ? String(c.currency) : undefined,
    })) as DeductibleComponent[],
    semantics: {
      isZero: result.isZero,
      hasMinimum: result.hasMinimum,
      hasMaximum: result.hasMaximum,
      isComposite: result.isComposite,
      appliesTo: result.appliesTo ? [result.appliesTo.coverageName] : undefined,
    },
    normalized: {
      minAmount: result.normalized.minAmount,
      maxAmount: result.normalized.maxAmount,
      percentage: result.normalized.percentage,
      isPercentageBased: result.normalized.isPercentageBased,
    },
    rawText: result.rawText,
  };
}

/**
 * @deprecated Use `hybridDeductibleParser` directly.
 */
export const deductibleParser = {
  /**
   * Parse deductible text to structured format (backward-compatible proxy).
   */
  async parse(deductibleText: string): Promise<DeductibleStructure> {
    const result = await hybridDeductibleParser.parse(deductibleText);
    return toLegacyStructure(result);
  },

  /**
   * Parse simple deductible patterns with regex (backward-compatible proxy).
   * Returns null when the deterministic parser cannot produce a known structure.
   */
  parseSimple(text: string): DeductibleStructure | null {
    const result = hybridDeductibleParser.parseSync(text);
    if (result.components.some((c) => c.type === 'unknown')) {
      return null;
    }
    return toLegacyStructure(result);
  },

  /**
   * Parse complex deductible with LLM using Gemini Structured Outputs
   * (backward-compatible proxy).
   */
  async parseWithLLM(text: string): Promise<DeductibleStructure> {
    try {
      const parsed = await geminiService.extractDeductible(text);
      return this.buildStructureFromParsed(parsed, text);
    } catch (error) {
      console.error('❌ [DeductibleParser] LLM parsing failed:', error);
      return this.createUnknownStructure(text);
    }
  },

  /**
   * Build structured deductible from parsed JSON (backward-compatible shape).
   */
  buildStructureFromParsed(parsed: Record<string, unknown>, rawText: string): DeductibleStructure {
    const components: DeductibleComponent[] = (
      (parsed.components || []) as Array<{
        type: string;
        value: unknown;
        currency?: unknown;
      }>
    ).map((c) => ({
      type: c.type as DeductibleComponent['type'],
      value: typeof c.value === 'number' ? c.value : Number(c.value) || 0,
      currency: c.currency ? String(c.currency) : undefined,
    }));

    // Calculate normalized values
    let minAmount = 0;
    let maxAmount = 0;
    let percentage = 0;
    let isPercentageBased = false;

    for (const comp of components) {
      switch (comp.type) {
        case 'percentage':
          percentage = comp.value;
          isPercentageBased = true;
          break;
        case 'minimum':
          minAmount = this.convertToCOP(comp.value, comp.currency);
          break;
        case 'maximum':
          maxAmount = this.convertToCOP(comp.value, comp.currency);
          break;
        case 'fixed':
          minAmount = this.convertToCOP(comp.value, comp.currency);
          maxAmount = minAmount;
          break;
        case 'smmlv':
          minAmount = comp.value * getDomainConstants().smmlv;
          maxAmount = minAmount;
          break;
        case 'uvt':
          minAmount = comp.value * getDomainConstants().uvt;
          maxAmount = minAmount;
          break;
        case 'na':
          minAmount = 0;
          maxAmount = 0;
          percentage = 0;
          break;
      }
    }

    return {
      components,
      semantics: {
        isZero: Boolean(parsed.isZero),
        hasMinimum: Boolean(parsed.hasMinimum),
        hasMaximum: Boolean(parsed.hasMaximum),
        isComposite: Boolean(parsed.isComposite),
      },
      normalized: {
        minAmount,
        maxAmount: maxAmount === Infinity ? 0 : maxAmount,
        percentage,
        isPercentageBased,
      },
      rawText,
    };
  },

  /**
   * Convert value to COP based on currency (backward-compatible proxy).
   */
  convertToCOP(value: number, currency?: string): number {
    return resolveValueToCOP(value, (currency as 'SMMLV' | 'UVT' | 'COP' | null) || null) ?? value;
  },

  /**
   * Create structure for unknown deductible.
   */
  createUnknownStructure(rawText: string): DeductibleStructure {
    return {
      components: [{ type: 'unknown', value: 0 }],
      semantics: { isZero: false, hasMinimum: false, hasMaximum: false, isComposite: false },
      normalized: { minAmount: 0, maxAmount: 0, percentage: 0, isPercentageBased: false },
      rawText,
    };
  },

  /**
   * Validate deductible structure.
   */
  validate(structure: DeductibleStructure): { isValid: boolean; issues: string[] } {
    const issues: string[] = [];

    // Check percentage range
    if (structure.normalized.percentage < 0 || structure.normalized.percentage > 100) {
      issues.push(`Invalid percentage: ${structure.normalized.percentage}%`);
    }

    // Check min < max
    if (
      structure.normalized.minAmount > structure.normalized.maxAmount &&
      structure.normalized.maxAmount > 0
    ) {
      issues.push(
        `Minimum (${structure.normalized.minAmount}) exceeds maximum (${structure.normalized.maxAmount})`
      );
    }

    // Check for negative values
    if (structure.normalized.minAmount < 0 || structure.normalized.maxAmount < 0) {
      issues.push('Negative amounts found');
    }

    return {
      isValid: issues.length === 0,
      issues,
    };
  },
};

export default deductibleParser;
