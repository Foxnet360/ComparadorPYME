import { describe, it, expect } from 'vitest';
import { validateCoverageCompleteness } from '../quoteValidator';
import { calculateConfidence } from '../confidenceScorer';
import { ParsedQuote } from '../quoteParser';

describe('expectedCoverages schema', () => {
  const createMockQuote = (overrides: Partial<ParsedQuote> = {}): ParsedQuote =>
    ({
      insurerName: 'Test Insurer',
      policyName: 'Test Policy',
      priceAnnual: 5000000,
      currency: 'COP',
      coverages: [
        {
          name: 'Incendio (Edificio y Contenidos)',
          canonicalName: 'Incendio (Edificio y Contenidos)',
          value: '500M',
          deductible: '10%',
          confidence: 95,
          categoryId: null,
          matchConfidence: 0,
          matchMethod: null,
        },
        {
          name: 'Responsabilidad Civil (RCE)',
          canonicalName: 'Responsabilidad Civil (RCE)',
          value: '100M',
          deductible: '5 SMMLV',
          confidence: 95,
          categoryId: null,
          matchConfidence: 0,
          matchMethod: null,
        },
      ],
      specialConditions: [],
      rawText: '',
      parseConfidence: 95,
      ...overrides,
    }) as ParsedQuote;

  describe('validateCoverageCompleteness with expectedCoverages', () => {
    it('should validate using expectedCoverages when available', () => {
      const quote = createMockQuote({
        expectedCoverages: [
          {
            name: 'Incendio (Edificio y Contenidos)',
            status: 'present',
            value: '500M',
            deductible: '10%',
          },
          { name: 'Lucro Cesante', status: 'missing', value: null, deductible: null },
          { name: 'Sustracción / Hurto', status: 'present', value: '100M', deductible: '10%' },
        ],
      });

      const result = validateCoverageCompleteness(quote);
      expect(result).not.toBeNull();
      expect(result?.code).toBe('COVERAGES_INCOMPLETE');
      expect(result?.message).toContain('Faltan 1 coberturas');
    });

    it('should pass when all coverages are present', () => {
      const quote = createMockQuote({
        expectedCoverages: [
          {
            name: 'Incendio (Edificio y Contenidos)',
            status: 'present',
            value: '500M',
            deductible: '10%',
          },
          { name: 'Lucro Cesante', status: 'present', value: '100M', deductible: '10%' },
          { name: 'Sustracción / Hurto', status: 'present', value: '100M', deductible: '10%' },
        ],
      });

      const result = validateCoverageCompleteness(quote);
      expect(result).toBeNull();
    });

    it('should count excluded coverages as not missing', () => {
      const quote = createMockQuote({
        expectedCoverages: [
          {
            name: 'Incendio (Edificio y Contenidos)',
            status: 'present',
            value: '500M',
            deductible: '10%',
          },
          { name: 'Lucro Cesante', status: 'excluded', value: 'No contratado', deductible: null },
        ],
      });

      const result = validateCoverageCompleteness(quote);
      expect(result).toBeNull();
    });

    it('should fallback to legacy validation when expectedCoverages not available', () => {
      const quote = createMockQuote({
        coverages: [
          {
            name: 'Incendio (Edificio y Contenidos)',
            canonicalName: 'Incendio (Edificio y Contenidos)',
            value: '500M',
            deductible: '10%',
            confidence: 95,
            categoryId: null,
            matchConfidence: 0,
            matchMethod: null,
          },
        ],
      });

      const result = validateCoverageCompleteness(quote);
      expect(result).not.toBeNull();
      expect(result?.code).toBe('COVERAGES_INCOMPLETE');
    });
  });

  describe('calculateConfidence with expectedCoverages', () => {
    it('should calculate completeness using expectedCoverages', () => {
      const quote = createMockQuote({
        expectedCoverages: [
          { name: 'Incendio', status: 'present', value: '500M', deductible: '10%' },
          { name: 'Lucro Cesante', status: 'present', value: '100M', deductible: '10%' },
          { name: 'Sustracción', status: 'missing', value: null, deductible: null },
          { name: 'Equipo', status: 'missing', value: null, deductible: null },
        ],
      });

      const validation = {
        isValid: true,
        flags: [],
        coverageCount: 2,
        expectedCoverageCount: 14,
        numericParseSuccess: true,
      };

      const result = calculateConfidence(quote, validation, true);
      // 2 present out of 4 expected = 50% completeness
      // Score should be reasonable but not perfect
      expect(result.score).toBeGreaterThanOrEqual(30);
      expect(result.score).toBeLessThanOrEqual(90);
    });

    it('should give perfect score when all expectedCoverages are present', () => {
      const allPresent = Array(14)
        .fill(null)
        .map((_, i) => ({
          name: `Coverage ${i}`,
          status: 'present' as const,
          value: '100M',
          deductible: '10%',
        }));

      const quote = createMockQuote({ expectedCoverages: allPresent });
      const validation = {
        isValid: true,
        flags: [],
        coverageCount: 14,
        expectedCoverageCount: 14,
        numericParseSuccess: true,
      };

      const result = calculateConfidence(quote, validation, true);
      expect(result.score).toBeGreaterThanOrEqual(80);
    });
  });
});
