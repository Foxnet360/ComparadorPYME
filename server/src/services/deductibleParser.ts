import { geminiService } from './gemini';

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

// Simple regex patterns for common cases
const SIMPLE_PATTERNS = {
  zero: /^(sin\s+deducible(?:\s+alguno)?|no\s+aplica(?:\s+deducible)?|sin\s+aplicaci[oó]n(?:\s+de\s+deducible)?|incluido|0\s*%|0)$/i,
  percentage: /^(\d+(?:\.\d+)?)\s*%$/,
  smmlv: /^(\d+)\s*(?:SMMLV|SM)$/i,
  uvt: /^(\d+)\s*(?:UVT)$/i,
  fixed: /^(?:\$?\s*)([\d.,]+)$/
};

const SMMLV_VALUE = 1300000; // 1.3M COP
const UVT_VALUE = 42412; // 2024

export const deductibleParser = {
  /**
   * Parse deductible text to structured format
   */
  async parse(deductibleText: string): Promise<DeductibleStructure> {
    if (!deductibleText || deductibleText.trim().length === 0) {
      return this.createUnknownStructure('');
    }

    const text = deductibleText.trim();
    
    // Try simple regex first for performance
    const simpleResult = this.parseSimple(text);
    if (simpleResult) {
      return simpleResult;
    }
    
    // For complex cases, use LLM
    return this.parseWithLLM(text);
  },

  /**
   * Parse simple deductible patterns with regex
   */
  parseSimple(text: string): DeductibleStructure | null {
    // Zero deductible
    if (SIMPLE_PATTERNS.zero.test(text)) {
      return {
        components: [{ type: 'na', value: 0 }],
        semantics: { isZero: true, hasMinimum: false, hasMaximum: false, isComposite: false },
        normalized: { minAmount: 0, maxAmount: 0, percentage: 0, isPercentageBased: false },
        rawText: text
      };
    }
    
    // Pure percentage
    const percentMatch = text.match(SIMPLE_PATTERNS.percentage);
    if (percentMatch) {
      const percentage = parseFloat(percentMatch[1]);
      return {
        components: [{ type: 'percentage', value: percentage }],
        semantics: { isZero: false, hasMinimum: false, hasMaximum: false, isComposite: false },
        normalized: { minAmount: 0, maxAmount: Infinity, percentage, isPercentageBased: true },
        rawText: text
      };
    }
    
    // Pure SMMLV
    const smmlvMatch = text.match(SIMPLE_PATTERNS.smmlv);
    if (smmlvMatch) {
      const smmlv = parseInt(smmlvMatch[1]);
      const amount = smmlv * SMMLV_VALUE;
      return {
        components: [{ type: 'smmlv', value: smmlv, currency: 'SMMLV' }],
        semantics: { isZero: false, hasMinimum: false, hasMaximum: false, isComposite: false },
        normalized: { minAmount: amount, maxAmount: amount, percentage: 0, isPercentageBased: false },
        rawText: text
      };
    }

    // Pure Fixed
    const fixedMatch = text.match(SIMPLE_PATTERNS.fixed);
    if (fixedMatch) {
      const valStr = fixedMatch[1].replace(/,/g, '');
      const value = parseFloat(valStr);
      return {
        components: [{ type: 'fixed', value }],
        semantics: { isZero: false, hasMinimum: false, hasMaximum: false, isComposite: false },
        normalized: { minAmount: value, maxAmount: value, percentage: 0, isPercentageBased: false },
        rawText: text
      };
    }

    // Pure UVT
    const uvtMatch = text.match(SIMPLE_PATTERNS.uvt);
    if (uvtMatch) {
      const uvt = parseInt(uvtMatch[1]);
      const amount = uvt * UVT_VALUE;
      return {
        components: [{ type: 'fixed', value: uvt, currency: 'UVT' }],
        semantics: { isZero: false, hasMinimum: false, hasMaximum: false, isComposite: false },
        normalized: { minAmount: amount, maxAmount: amount, percentage: 0, isPercentageBased: false },
        rawText: text
      };
    }

    // Colombian Compound Deductibles (Percentage + Min/Max in SMMLV/COP/UVT)
    const pctMatch = text.match(/(\d+(?:\.\d+)?)\s*%/);
    const hasMinWord = /m[ií]n/i.test(text);
    const hasMaxWord = /m[aá]x|tope|l[ií]mite/i.test(text);
    
    if (pctMatch || hasMinWord || hasMaxWord) {
      const percentage = pctMatch ? parseFloat(pctMatch[1]) : 0;
      const isPercentageBased = percentage > 0;
      
      let minAmount = 0;
      let hasMinimum = false;
      const minMatch = text.match(/(?:m[ií]n(?:imo|o|\.|\b)?)(?:\s+de)?\s*(?:\$?\s*)(\d+(?:[.,]\d+)*)\s*(smmlv|sm|cop|pesos|uvt)?/i);
      if (minMatch) {
        hasMinimum = true;
        const val = parseFloat(minMatch[1].replace(/[.,]/g, ''));
        const unit = minMatch[2]?.toLowerCase() || '';
        if (unit.startsWith('sm')) {
          minAmount = val * SMMLV_VALUE;
        } else if (unit.startsWith('uvt')) {
          minAmount = val * UVT_VALUE;
        } else {
          if (val < 50 && isPercentageBased) {
            minAmount = val * SMMLV_VALUE;
          } else {
            minAmount = val;
          }
        }
      }
      
      let maxAmount = 0;
      let hasMaximum = false;
      const maxMatch = text.match(/(?:m[aá]x(?:imo|o|\.|\b)?|tope|l[ií]mite)(?:\s+de)?\s*(?:\$?\s*)(\d+(?:[.,]\d+)*)\s*(smmlv|sm|cop|pesos|uvt)?/i);
      if (maxMatch) {
        hasMaximum = true;
        const val = parseFloat(maxMatch[1].replace(/[.,]/g, ''));
        const unit = maxMatch[2]?.toLowerCase() || '';
        if (unit.startsWith('sm')) {
          maxAmount = val * SMMLV_VALUE;
        } else if (unit.startsWith('uvt')) {
          maxAmount = val * UVT_VALUE;
        } else {
          if (val < 500 && isPercentageBased) {
            maxAmount = val * SMMLV_VALUE;
          } else {
            maxAmount = val;
          }
        }
      }
      
      // If we matched at least a percentage or a min/max, we can construct the structure
      if (isPercentageBased || hasMinimum || hasMaximum) {
        const components: DeductibleComponent[] = [];
        if (isPercentageBased) {
          components.push({ type: 'percentage', value: percentage });
        }
        if (hasMinimum) {
          components.push({ type: 'minimum', value: minAmount });
        }
        if (hasMaximum) {
          components.push({ type: 'maximum', value: maxAmount });
        }
        
        return {
          components,
          semantics: {
            isZero: false,
            hasMinimum,
            hasMaximum,
            isComposite: components.length > 1
          },
          normalized: {
            minAmount,
            maxAmount,
            percentage,
            isPercentageBased
          },
          rawText: text
        };
      }
    }
    
    // If text is short, doesn't match simple patterns, and contains no numbers or key terms, it's likely garbage/unparseable
    const hasNumbers = /\d/.test(text);
    const hasKeywords = /smmlv|uvt|%|deducible|aplica/i.test(text);
    if (text.length < 20 && !hasNumbers && !hasKeywords) {
      return this.createUnknownStructure(text);
    }
    
    return null; // Needs LLM parsing
  },

  /**
   * Parse complex deductible with LLM using Gemini Structured Outputs
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
   * Build structured deductible from parsed JSON
   */
  buildStructureFromParsed(parsed: any, rawText: string): DeductibleStructure {
    const components: DeductibleComponent[] = parsed.components || [];
    
    // Calculate normalized values
    let minAmount = 0;
    let maxAmount = Infinity;
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
          minAmount = comp.value * SMMLV_VALUE;
          maxAmount = minAmount;
          break;
        case 'uvt':
          minAmount = comp.value * UVT_VALUE;
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
        isZero: parsed.isZero || false,
        hasMinimum: parsed.hasMinimum || false,
        hasMaximum: parsed.hasMaximum || false,
        isComposite: parsed.isComposite || false
      },
      normalized: {
        minAmount,
        maxAmount: maxAmount === Infinity ? 0 : maxAmount,
        percentage,
        isPercentageBased
      },
      rawText
    };
  },

  /**
   * Convert value to COP based on currency
   */
  convertToCOP(value: number, currency?: string): number {
    if (!currency) return value;
    
    const upper = currency.toUpperCase();
    if (upper.includes('SMMLV') || upper === 'SM') {
      return value * SMMLV_VALUE;
    }
    if (upper.includes('UVT')) {
      return value * UVT_VALUE;
    }
    
    return value;
  },

  /**
   * Create structure for unknown deductible
   */
  createUnknownStructure(rawText: string): DeductibleStructure {
    return {
      components: [{ type: 'unknown', value: 0 }],
      semantics: { isZero: false, hasMinimum: false, hasMaximum: false, isComposite: false },
      normalized: { minAmount: 0, maxAmount: 0, percentage: 0, isPercentageBased: false },
      rawText
    };
  },

  /**
   * Validate deductible structure
   */
  validate(structure: DeductibleStructure): { isValid: boolean; issues: string[] } {
    const issues: string[] = [];
    
    // Check percentage range
    if (structure.normalized.percentage < 0 || structure.normalized.percentage > 100) {
      issues.push(`Invalid percentage: ${structure.normalized.percentage}%`);
    }
    
    // Check min < max
    if (structure.normalized.minAmount > structure.normalized.maxAmount && structure.normalized.maxAmount > 0) {
      issues.push(`Minimum (${structure.normalized.minAmount}) exceeds maximum (${structure.normalized.maxAmount})`);
    }
    
    // Check for negative values
    if (structure.normalized.minAmount < 0 || structure.normalized.maxAmount < 0) {
      issues.push('Negative amounts found');
    }
    
    return {
      isValid: issues.length === 0,
      issues
    };
  }
};

export default deductibleParser;
