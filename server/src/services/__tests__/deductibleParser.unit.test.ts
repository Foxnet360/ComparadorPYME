import { describe, it, expect, vi } from 'vitest';
import { deductibleParser, DeductibleStructure } from '../deductibleParser';
import { getDomainConstants } from '../../config/domainConstants';

// Mock gemini service for LLM parsing tests
vi.mock('../gemini', () => ({
  geminiService: {
    extractDeductible: vi.fn((text: string) => {
      // Simulate LLM responses for compound deductibles
      if (text.includes('10% con mínimo')) {
        return Promise.resolve({
          components: [
            { type: 'percentage', value: 10 },
            { type: 'minimum', value: 5, currency: 'SMMLV' },
            { type: 'maximum', value: 50, currency: 'SMMLV' },
          ],
          isZero: false,
          hasMinimum: true,
          hasMaximum: true,
          isComposite: true,
        });
      }
      if (text.includes('sin aplicación')) {
        return Promise.resolve({
          components: [{ type: 'na', value: 0 }],
          isZero: true,
          hasMinimum: false,
          hasMaximum: false,
          isComposite: false,
        });
      }
      if (text.includes('15% con tope')) {
        return Promise.resolve({
          components: [
            { type: 'percentage', value: 15 },
            { type: 'maximum', value: 100, currency: 'SMMLV' },
          ],
          isZero: false,
          hasMinimum: false,
          hasMaximum: true,
          isComposite: true,
        });
      }
      // Default fallback
      return Promise.resolve({
        components: [{ type: 'unknown', value: 0 }],
        isZero: false,
        hasMinimum: false,
        hasMaximum: false,
        isComposite: false,
      });
    }),
  },
}));

describe('deductibleParser - Unit Tests', () => {
  describe('parseSimple', () => {
    it('should parse simple percentage', async () => {
      const result = await deductibleParser.parse('10%');
      expect(result.normalized.percentage).toBe(10);
      expect(result.semantics.isComposite).toBe(false);
    });

    it('should parse zero deductible variations', async () => {
      const variations = ['sin deducible', 'no aplica', 'incluido', '0%'];
      for (const variant of variations) {
        const result = await deductibleParser.parse(variant);
        expect(result.semantics.isZero).toBe(true);
        expect(result.normalized.minAmount).toBe(0);
      }
    });

    it('should parse SMMLV format', async () => {
      const result = await deductibleParser.parse('5 SMMLV');
      expect(result.normalized.minAmount).toBe(5 * getDomainConstants().smmlv);
    });

    it('should parse dotted SMMLV formats to SMMLV', async () => {
      const result1 = await deductibleParser.parse('5 S.M.M.L.V');
      expect(result1.normalized.minAmount).toBe(5 * getDomainConstants().smmlv);

      const result2 = await deductibleParser.parse('5 S.M.M.L.V.');
      expect(result2.normalized.minAmount).toBe(5 * getDomainConstants().smmlv);

      const result3 = await deductibleParser.parse('10 s.m.m.l.v.');
      expect(result3.normalized.minAmount).toBe(10 * getDomainConstants().smmlv);
    });

    it('should parse fixed amount', async () => {
      const result = await deductibleParser.parse('$500,000');
      expect(result.normalized.minAmount).toBe(500000);
    });
  });

  describe('parse compound structures', () => {
    it('should handle compound deductible via LLM fallback', async () => {
      // For complex structures that regex can't parse, it falls back to LLM
      const result = await deductibleParser.parse('10% con mínimo de 5 SMMLV y tope de 50 SMMLV');
      // The structure should be parsed (either by regex or LLM)
      expect(result).toBeDefined();
      expect(result.rawText).toBe('10% con mínimo de 5 SMMLV y tope de 50 SMMLV');
    });

    it('should handle "sin aplicación de deducible"', async () => {
      const result = await deductibleParser.parse('sin aplicación de deducible');
      expect(result.semantics.isZero).toBe(true);
      expect(result.normalized.minAmount).toBe(0);
    });

    it('should handle minimum-only deductible', async () => {
      const result = await deductibleParser.parse('Mínimo 5 SMMLV');
      expect(result).toBeDefined();
      expect(result.rawText).toBe('Mínimo 5 SMMLV');
    });
  });

  describe('validation', () => {
    it('should validate valid percentage', () => {
      const structure = {
        components: [{ type: 'percentage' as const, value: 10 }],
        semantics: { isZero: false, hasMinimum: false, hasMaximum: false, isComposite: false },
        normalized: { minAmount: 0, maxAmount: 0, percentage: 10, isPercentageBased: true },
        rawText: '10%',
      } as unknown as DeductibleStructure;

      const validation = deductibleParser.validate(structure);
      expect(validation.isValid).toBe(true);
      expect(validation.issues).toHaveLength(0);
    });

    it('should detect invalid percentage > 100', () => {
      const structure = {
        components: [{ type: 'percentage' as const, value: 150 }],
        semantics: { isZero: false, hasMinimum: false, hasMaximum: false, isComposite: false },
        normalized: { minAmount: 0, maxAmount: 0, percentage: 150, isPercentageBased: true },
        rawText: '150%',
      } as unknown as DeductibleStructure;

      const validation = deductibleParser.validate(structure);
      expect(validation.isValid).toBe(false);
      expect(validation.issues.length).toBeGreaterThan(0);
    });

    it('should detect negative amounts', () => {
      const structure = {
        components: [{ type: 'fixed' as const, value: -100 }],
        semantics: { isZero: false, hasMinimum: false, hasMaximum: false, isComposite: false },
        normalized: { minAmount: -100, maxAmount: 0, percentage: 0, isPercentageBased: false },
        rawText: '-100',
      } as unknown as DeductibleStructure;

      const validation = deductibleParser.validate(structure);
      expect(validation.isValid).toBe(false);
    });

    it('should detect min > max', () => {
      const structure = {
        components: [
          { type: 'minimum' as const, value: 100 },
          { type: 'maximum' as const, value: 50 },
        ],
        semantics: { isZero: false, hasMinimum: true, hasMaximum: true, isComposite: true },
        normalized: { minAmount: 100, maxAmount: 50, percentage: 0, isPercentageBased: false },
        rawText: 'min 100 max 50',
      } as unknown as DeductibleStructure;

      const validation = deductibleParser.validate(structure);
      expect(validation.isValid).toBe(false);
    });
  });

  describe('convertToCOP', () => {
    it('should convert SMMLV to COP', () => {
      const result = deductibleParser.convertToCOP(5, 'SMMLV');
      expect(result).toBe(5 * getDomainConstants().smmlv);
    });

    it('should convert UVT to COP', () => {
      const result = deductibleParser.convertToCOP(10, 'UVT');
      expect(result).toBe(424120);
    });

    it('should return value when no currency', () => {
      const result = deductibleParser.convertToCOP(500000, undefined);
      expect(result).toBe(500000);
    });
  });

  describe('edge cases', () => {
    it('should handle empty string', async () => {
      const result = await deductibleParser.parse('');
      expect(result.components[0].type).toBe('unknown');
    });

    it('should handle whitespace-only input', async () => {
      const result = await deductibleParser.parse('   ');
      expect(result.components[0].type).toBe('unknown');
    });

    it('should handle very long deductible text', async () => {
      const longText =
        '10% con mínimo de 5 SMMLV y tope de 50 SMMLV aplicable solo a daños mayores a 1 SMMLV con excepción de rotura de maquinaria';
      const result = await deductibleParser.parse(longText);
      expect(result).toBeDefined();
      expect(result.rawText).toBe(longText);
    });
  });
});
