import { describe, it, expect } from 'vitest';
import {
  validateQuote,
  validatePremium,
  validateCoverageCompleteness,
  validateDeductibleFormat,
} from '../quoteValidator';
import { ParsedQuote } from '../quoteParser';

describe('quoteValidator', () => {
  const createMockQuote = (overrides: Partial<ParsedQuote> = {}): ParsedQuote => ({
    insurerName: 'Test Insurer',
    policyName: 'Test Policy',
    priceAnnual: 5000000,
    currency: 'COP',
    coverages: [
      {
        name: 'Incendio (Edificio y Contenidos)',
        canonicalName: 'Incendio (Edificio y Contenidos)',
        value: '500000000',
        deductible: '10%',
        confidence: 95,
        categoryId: null,
        matchConfidence: 0,
        matchMethod: null,
      },
      {
        name: 'Responsabilidad Civil (RCE)',
        canonicalName: 'Responsabilidad Civil (RCE)',
        value: '100000000',
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
  });

  describe('validatePremium', () => {
    it('should pass for valid premium', () => {
      const quote = createMockQuote({ priceAnnual: 5000000 });
      const result = validatePremium(quote);
      expect(result).toBeNull();
    });

    it('should flag missing premium', () => {
      const quote = createMockQuote({ priceAnnual: 0 });
      const result = validatePremium(quote);
      expect(result).not.toBeNull();
      expect(result?.code).toBe('PREMIUM_MISSING');
    });

    it('should flag premium too low', () => {
      const quote = createMockQuote({ priceAnnual: 50000 });
      const result = validatePremium(quote);
      expect(result).not.toBeNull();
      expect(result?.code).toBe('PREMIUM_SUSPECT');
    });

    it('should flag premium too high', () => {
      const quote = createMockQuote({ priceAnnual: 600000000 });
      const result = validatePremium(quote);
      expect(result).not.toBeNull();
      expect(result?.code).toBe('PREMIUM_SUSPECT');
    });
  });

  describe('validateCoverageCompleteness', () => {
    it('should flag incomplete coverages', () => {
      const quote = createMockQuote({ coverages: [] });
      const result = validateCoverageCompleteness(quote);
      expect(result).not.toBeNull();
      expect(result?.code).toBe('COVERAGES_INCOMPLETE');
    });

    it('should pass for complete coverages', () => {
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
          {
            name: 'Lucro Cesante',
            canonicalName: 'Lucro Cesante',
            value: '100M',
            deductible: 'No aplica',
            confidence: 95,
            categoryId: null,
            matchConfidence: 0,
            matchMethod: null,
          },
          {
            name: 'Sustracción / Hurto',
            canonicalName: 'Sustracción / Hurto',
            value: '200M',
            deductible: '10%',
            confidence: 95,
            categoryId: null,
            matchConfidence: 0,
            matchMethod: null,
          },
          {
            name: 'Equipo Eléctrico y Electrónico',
            canonicalName: 'Equipo Eléctrico y Electrónico',
            value: '150M',
            deductible: '15%',
            confidence: 95,
            categoryId: null,
            matchConfidence: 0,
            matchMethod: null,
          },
          {
            name: 'Rotura de Maquinaria',
            canonicalName: 'Rotura de Maquinaria',
            value: '100M',
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
          {
            name: 'Vidrios Planos',
            canonicalName: 'Vidrios Planos',
            value: '50M',
            deductible: 'No aplica',
            confidence: 95,
            categoryId: null,
            matchConfidence: 0,
            matchMethod: null,
          },
          {
            name: 'Manejo Global / Infidelidad',
            canonicalName: 'Manejo Global / Infidelidad',
            value: '100M',
            deductible: '10%',
            confidence: 95,
            categoryId: null,
            matchConfidence: 0,
            matchMethod: null,
          },
          {
            name: 'Transporte de Mercancías',
            canonicalName: 'Transporte de Mercancías',
            value: '50M',
            deductible: '10%',
            confidence: 95,
            categoryId: null,
            matchConfidence: 0,
            matchMethod: null,
          },
          {
            name: 'Transporte de Valores',
            canonicalName: 'Transporte de Valores',
            value: '50M',
            deductible: '10%',
            confidence: 95,
            categoryId: null,
            matchConfidence: 0,
            matchMethod: null,
          },
          {
            name: 'Asistencia PYME',
            canonicalName: 'Asistencia PYME',
            value: 'Incluido',
            deductible: 'No aplica',
            confidence: 95,
            categoryId: null,
            matchConfidence: 0,
            matchMethod: null,
          },
          {
            name: 'Asistencia Legal',
            canonicalName: 'Asistencia Legal',
            value: 'Incluido',
            deductible: 'No aplica',
            confidence: 95,
            categoryId: null,
            matchConfidence: 0,
            matchMethod: null,
          },
          {
            name: 'Huelga, Motín, Asonada (HMACC)',
            canonicalName: 'Huelga, Motín, Asonada (HMACC)',
            value: '100M',
            deductible: '10%',
            confidence: 95,
            categoryId: null,
            matchConfidence: 0,
            matchMethod: null,
          },
          {
            name: 'Terremoto y Eventos Catastróficos',
            canonicalName: 'Terremoto y Eventos Catastróficos',
            value: '200M',
            deductible: '20%',
            confidence: 95,
            categoryId: null,
            matchConfidence: 0,
            matchMethod: null,
          },
        ],
      });
      const result = validateCoverageCompleteness(quote);
      expect(result).toBeNull();
    });
  });

  describe('validateDeductibleFormat', () => {
    it('should accept percentage format', () => {
      expect(validateDeductibleFormat('10%')).toBeNull();
    });

    it('should accept SMMLV format', () => {
      expect(validateDeductibleFormat('5 SMMLV')).toBeNull();
    });

    it('should accept "No aplica"', () => {
      expect(validateDeductibleFormat('No aplica')).toBeNull();
    });

    it('should flag high percentage', () => {
      const result = validateDeductibleFormat('60%');
      expect(result).not.toBeNull();
      expect(result?.code).toBe('DEDUCTIBLE_HIGH_PERCENTAGE');
    });

    it('should flag unrecognized format', () => {
      const result = validateDeductibleFormat('cualquier cosa');
      expect(result).not.toBeNull();
      expect(result?.code).toBe('DEDUCTIBLE_UNRECOGNIZED_FORMAT');
    });
  });

  describe('validateQuote', () => {
    it('should return valid result for good quote', () => {
      const quote = createMockQuote();
      const result = validateQuote(quote);
      expect(result.isValid).toBe(true);
      expect(result.coverageCount).toBe(2);
    });

    it('should return invalid result for bad quote', () => {
      const quote = createMockQuote({
        priceAnnual: 0,
        coverages: [],
      });
      const result = validateQuote(quote);
      expect(result.isValid).toBe(false);
      expect(result.flags.length).toBeGreaterThan(0);
    });

    it('should detect missing coverages', () => {
      const quote = createMockQuote({
        coverages: [
          {
            name: 'Incendio (Edificio y Contenidos)',
            canonicalName: 'Incendio (Edificio y Contenidos)',
            value: '500M',
            deductible: '10%',
            confidence: 95,
          },
        ],
      });
      const result = validateQuote(quote);
      const completenessFlag = result.flags.find((f) => f.code === 'COVERAGES_INCOMPLETE');
      expect(completenessFlag).toBeDefined();
    });
  });
});
