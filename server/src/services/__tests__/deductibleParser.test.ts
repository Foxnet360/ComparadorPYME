import { describe, it, expect, vi } from 'vitest';
import { deductibleParser } from '../deductibleParser';

// Mock gemini service for LLM parsing tests
vi.mock('../gemini', () => ({
  geminiService: {
    extractText: vi.fn((text: string, prompt: string) => {
      // Simulate LLM responses for compound deductibles
      if (prompt.includes('10% con mínimo')) {
        return Promise.resolve(JSON.stringify({
          components: [
            { type: 'percentage', value: 10 },
            { type: 'minimum', value: 5, currency: 'SMMLV' },
            { type: 'maximum', value: 50, currency: 'SMMLV' }
          ],
          isZero: false,
          hasMinimum: true,
          hasMaximum: true,
          isComposite: true
        }));
      }
      if (prompt.includes('sin aplicación')) {
        return Promise.resolve(JSON.stringify({
          components: [{ type: 'na', value: 0 }],
          isZero: true,
          hasMinimum: false,
          hasMaximum: false,
          isComposite: false
        }));
      }
      if (prompt.includes('15% con tope')) {
        return Promise.resolve(JSON.stringify({
          components: [
            { type: 'percentage', value: 15 },
            { type: 'maximum', value: 100, currency: 'SMMLV' }
          ],
          isZero: false,
          hasMinimum: false,
          hasMaximum: true,
          isComposite: true
        }));
      }
      // Default fallback
      return Promise.resolve(JSON.stringify({
        components: [{ type: 'unknown', value: 0 }],
        isZero: false,
        hasMinimum: false,
        hasMaximum: false,
        isComposite: false
      }));
    })
  }
}));

describe('deductibleParser', () => {
  describe('parseSimple', () => {
    it('should parse zero deductible', async () => {
      const result = await deductibleParser.parse('sin deducible');
      expect(result.semantics.isZero).toBe(true);
      expect(result.normalized.minAmount).toBe(0);
    });

    it('should parse percentage deductible', async () => {
      const result = await deductibleParser.parse('10%');
      expect(result.normalized.percentage).toBe(10);
      expect(result.semantics.isComposite).toBe(false);
    });

    it('should parse SMMLV deductible', async () => {
      const result = await deductibleParser.parse('5 SMMLV');
      expect(result.normalized.minAmount).toBe(6500000); // 5 * 1.3M
    });

    it('should parse fixed amount deductible', async () => {
      const result = await deductibleParser.parse('$500,000');
      expect(result.normalized.minAmount).toBe(500000);
    });
  });

  describe('parse compound structures', () => {
    it('should parse compound deductible with min and max', async () => {
      const result = await deductibleParser.parse('10% con mínimo de 5 SMMLV y tope de 50 SMMLV');
      expect(result.components).toHaveLength(3);
      expect(result.normalized.percentage).toBe(10);
      expect(result.normalized.minAmount).toBe(6500000);
      expect(result.normalized.maxAmount).toBe(65000000);
      expect(result.semantics.isComposite).toBe(true);
      expect(result.semantics.hasMinimum).toBe(true);
      expect(result.semantics.hasMaximum).toBe(true);
    });

    it('should parse percentage with maximum only', async () => {
      const result = await deductibleParser.parse('15% con tope de 100 SMMLV');
      expect(result.components).toHaveLength(2);
      expect(result.normalized.percentage).toBe(15);
      expect(result.normalized.maxAmount).toBe(130000000); // 100 * 1.3M
      expect(result.semantics.isComposite).toBe(true);
    });

    it('should parse "sin aplicación de deducible"', async () => {
      const result = await deductibleParser.parse('sin aplicación de deducible');
      expect(result.semantics.isZero).toBe(true);
      expect(result.normalized.minAmount).toBe(0);
    });

    it('should parse UVT format', async () => {
      const result = await deductibleParser.parse('10 UVT');
      expect(result.normalized.minAmount).toBe(424120); // 10 * 42,412
    });

    it('should handle complex compound with multiple conditions', async () => {
      const result = await deductibleParser.parse('10% con mínimo de 5 SMMLV, tope de 50 SMMLV y aplicable solo a daños mayores a 1 SMMLV');
      expect(result.semantics.isComposite).toBe(true);
      expect(result.components.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('edge cases', () => {
    it('should handle empty string', async () => {
      const result = await deductibleParser.parse('');
      expect(result.components[0].type).toBe('unknown');
    });

    it('should handle null/undefined', async () => {
      const result = await deductibleParser.parse('');
      expect(result.components[0].type).toBe('unknown');
    });

    it('should parse "No aplica" variations', async () => {
      const variations = ['No aplica', 'NO APLICA', 'no aplica deducible', 'Incluido'];
      for (const variant of variations) {
        const result = await deductibleParser.parse(variant);
        expect(result.semantics.isZero).toBe(true);
      }
    });

    it('should handle unknown formats gracefully', async () => {
      const result = await deductibleParser.parse('Mínimo');
      expect(result.components[0].type).toBe('unknown');
      expect(result.semantics.isComposite).toBe(false);
    });
  });

  describe('validation', () => {
    it('should validate valid structure', () => {
      const structure = {
        components: [{ type: 'percentage', value: 10 }],
        semantics: { isZero: false, hasMinimum: false, hasMaximum: false, isComposite: false },
        normalized: { minAmount: 0, maxAmount: 0, percentage: 10, isPercentageBased: true },
        rawText: '10%'
      };
      
      const validation = deductibleParser.validate(structure as any);
      expect(validation.isValid).toBe(true);
      expect(validation.issues).toHaveLength(0);
    });

    it('should detect invalid percentage', () => {
      const structure = {
        components: [{ type: 'percentage', value: 150 }],
        semantics: { isZero: false, hasMinimum: false, hasMaximum: false, isComposite: false },
        normalized: { minAmount: 0, maxAmount: 0, percentage: 150, isPercentageBased: true },
        rawText: '150%'
      };
      
      const validation = deductibleParser.validate(structure as any);
      expect(validation.isValid).toBe(false);
      expect(validation.issues.length).toBeGreaterThan(0);
    });

    it('should detect negative values', () => {
      const structure = {
        components: [{ type: 'fixed', value: -100 }],
        semantics: { isZero: false, hasMinimum: false, hasMaximum: false, isComposite: false },
        normalized: { minAmount: -100, maxAmount: 0, percentage: 0, isPercentageBased: false },
        rawText: '-100'
      };
      
      const validation = deductibleParser.validate(structure as any);
      expect(validation.isValid).toBe(false);
      expect(validation.issues.some(i => i.includes('Negative'))).toBe(true);
    });

    it('should detect min > max', () => {
      const structure = {
        components: [
          { type: 'minimum', value: 100 },
          { type: 'maximum', value: 50 }
        ],
        semantics: { isZero: false, hasMinimum: true, hasMaximum: true, isComposite: true },
        normalized: { minAmount: 100, maxAmount: 50, percentage: 0, isPercentageBased: false },
        rawText: 'min 100 max 50'
      };
      
      const validation = deductibleParser.validate(structure as any);
      expect(validation.isValid).toBe(false);
      expect(validation.issues.some(i => i.includes('exceeds'))).toBe(true);
    });
  });

  describe('convertToCOP', () => {
    it('should convert SMMLV to COP', () => {
      const result = (deductibleParser as any).convertToCOP(5, 'SMMLV');
      expect(result).toBe(6500000);
    });

    it('should convert UVT to COP', () => {
      const result = (deductibleParser as any).convertToCOP(10, 'UVT');
      expect(result).toBe(424120);
    });

    it('should return value when no currency', () => {
      const result = (deductibleParser as any).convertToCOP(500000, undefined);
      expect(result).toBe(500000);
    });
  });
});