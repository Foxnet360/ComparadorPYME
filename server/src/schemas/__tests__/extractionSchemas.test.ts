import { describe, it, expect } from 'vitest';
import {
  QuoteExtractionSchemaV2,
  QuoteExtractionSchema,
  DeductibleStructureSchema,
  StructuredClauseSchema,
  validateQuoteExtractionV2,
  validateQuoteExtraction,
  validateDeductibleStructure,
  validateStructuredClause,
  normalizeCurrency,
  parseNumeric,
  normalizeValueToCOP,
} from '../extractionSchemas';

describe('extractionSchemas', () => {
  describe('QuoteExtractionSchemaV2', () => {
    const validV2 = {
      insurerName: 'Aseguradora Test',
      policyName: 'Póliza Test',
      premium: {
        netPremium: 1000000,
        fees: 0,
        taxes: 190000,
        otherCharges: 0,
        totalPayable: 1190000,
        currency: 'COP',
        periodicity: 'ANUAL',
      },
      rawCoverages: [
        {
          rawName: 'Incendio',
          insuredAmount: 500000000,
          deductible: '10%',
          rawTextSnippet: 'Incendio cubre 500M con deducible 10%',
          pageNumber: 1,
        },
      ],
    };

    it('accepts a valid V2 extraction', () => {
      const result = validateQuoteExtractionV2(validV2);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.insurerName).toBe('Aseguradora Test');
        expect(result.data.rawCoverages).toHaveLength(1);
      }
    });

    it('rejects negative totalPayable', () => {
      const invalid = {
        ...validV2,
        premium: { ...validV2.premium, totalPayable: -1 },
      };
      const result = validateQuoteExtractionV2(invalid);
      expect(result.success).toBe(false);
    });

    it('rejects missing rawCoverages', () => {
      const invalid = { ...validV2, rawCoverages: undefined };
      const result = validateQuoteExtractionV2(invalid);
      expect(result.success).toBe(false);
    });

    it('allows extra keys via passthrough', () => {
      const extra = { ...validV2, unknownField: 'allowed' };
      const result = validateQuoteExtractionV2(extra);
      expect(result.success).toBe(true);
    });
  });

  describe('QuoteExtractionSchema (legacy)', () => {
    const validLegacy = {
      insurerName: 'Aseguradora Test',
      policyName: 'Póliza Test',
      priceAnnual: 1190000,
      currency: 'COP',
      coverages: [{ name: 'Incendio', value: '500M', deductible: '10%' }],
      expectedCoverages: [{ name: 'Incendio', status: 'present' }],
    };

    it('accepts a valid legacy extraction', () => {
      const result = validateQuoteExtraction(validLegacy);
      expect(result.success).toBe(true);
    });

    it('rejects negative priceAnnual', () => {
      const invalid = { ...validLegacy, priceAnnual: -100 };
      const result = validateQuoteExtraction(invalid);
      expect(result.success).toBe(false);
    });
  });

  describe('DeductibleStructureSchema', () => {
    const valid = {
      components: [
        { type: 'percentage', value: 10 },
        { type: 'minimum', value: 5, currency: 'SMMLV' },
      ],
      compoundOperator: 'greater_of',
      isZero: false,
      hasMinimum: true,
      hasMaximum: false,
      isComposite: true,
      rawText: '10% / mín. 5 SMMLV',
    };

    it('accepts a valid deductible structure', () => {
      const result = validateDeductibleStructure(valid);
      expect(result.success).toBe(true);
    });

    it('rejects invalid component type', () => {
      const invalid = {
        ...valid,
        components: [{ type: 'not-a-type', value: 10 }],
      };
      const result = validateDeductibleStructure(invalid);
      expect(result.success).toBe(false);
    });
  });

  describe('StructuredClauseSchema', () => {
    const validClause = {
      insurer: 'Aseguradora Test',
      product: 'Producto Test',
      documentType: 'CLAUSULADO_GENERAL',
      coverages: [
        {
          name: 'Incendio',
          description: 'Cubre incendio',
          sourcePage: 1,
        },
      ],
    };

    it('accepts a valid structured clause', () => {
      const result = validateStructuredClause(validClause);
      expect(result.success).toBe(true);
    });

    it('rejects missing required coverage fields', () => {
      const invalid = {
        ...validClause,
        coverages: [{ description: 'Falta nombre', sourcePage: 1 }],
      };
      const result = validateStructuredClause(invalid);
      expect(result.success).toBe(false);
    });
  });

  describe('normalization helpers', () => {
    it('normalizes currency variants to COP', () => {
      expect(normalizeCurrency('cop')).toBe('COP');
      expect(normalizeCurrency('$')).toBe('COP');
      expect(normalizeCurrency('usd')).toBe('USD');
      expect(normalizeCurrency(null)).toBe('COP');
    });

    it('parses Colombian numeric strings', () => {
      expect(parseNumeric('$500.000.000')).toBe(500000000);
      expect(parseNumeric('1.500,50')).toBe(1500.5);
      expect(parseNumeric('abc')).toBeNull();
    });

    it('converts SMMLV/UVT values to COP', () => {
      const rates = { smmlv: 1_500_000, uvt: 50_000 };
      expect(normalizeValueToCOP(5, 'SMMLV', rates)).toBe(7_500_000);
      expect(normalizeValueToCOP(10, 'UVT', rates)).toBe(500_000);
      expect(normalizeValueToCOP('1.000.000', 'COP', rates)).toBe(1000000);
    });
  });
});
