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
  zero: /^(sin\s+deducible|no\s+aplica|sin\s+aplicaci[oó]n|incluido|0\s*%|0)$/i,
  percentage: /^(\d+(?:\.\d+)?)\s*%$/,
  smmlv: /^(\d+)\s*(?:SMMLV|SM)$/i,
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
    
    // If text is short and doesn't match simple patterns, it's likely complex
    if (text.length < 20) {
      return this.createUnknownStructure(text);
    }
    
    return null; // Needs LLM parsing
  },

  /**
   * Parse complex deductible with LLM
   */
  async parseWithLLM(text: string): Promise<DeductibleStructure> {
    try {
      const prompt = `Analiza este deducible de seguro y extrae su estructura:

Texto: "${text}"

Responde ÚNICAMENTE con este JSON:
{
  "components": [
    {"type": "percentage|fixed|smmlv|uvt|minimum|maximum|na", "value": number, "currency": "string|null"}
  ],
  "isZero": boolean,
  "hasMinimum": boolean,
  "hasMaximum": boolean,
  "isComposite": boolean
}`;

      const result = await geminiService.extractText('', prompt);
      
      // Extract JSON from response
      const jsonMatch = result.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in LLM response');
      }
      
      const parsed = JSON.parse(jsonMatch[0]);
      
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
