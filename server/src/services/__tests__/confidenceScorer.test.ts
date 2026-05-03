import { describe, it, expect } from 'vitest';
import { calculateConfidence, getConfidenceLabel, getConfidenceColor, formatConfidence } from '../confidenceScorer';
import { ParsedQuote } from '../quoteParser';
import { ValidationResult } from '../quoteValidator';

describe('confidenceScorer', () => {
  const createMockQuote = (overrides: Partial<ParsedQuote> = {}): ParsedQuote => ({
    insurerName: 'Test Insurer',
    policyName: 'Test Policy',
    priceAnnual: 5000000,
    currency: 'COP',
    coverages: [
      { name: 'Incendio (Edificio y Contenidos)', canonicalName: 'Incendio (Edificio y Contenidos)', value: '500000000', deductible: '10%', confidence: 95, categoryId: null, matchConfidence: 0, matchMethod: null },
      { name: 'Responsabilidad Civil (RCE)', canonicalName: 'Responsabilidad Civil (RCE)', value: '100000000', deductible: '5 SMMLV', confidence: 95, categoryId: null, matchConfidence: 0, matchMethod: null },
    ],
    specialConditions: [],
    rawText: '',
    parseConfidence: 95,
    ...overrides
  });

  const createMockValidation = (overrides: Partial<ValidationResult> = {}): ValidationResult => ({
    isValid: true,
    flags: [],
    coverageCount: 14,
    expectedCoverageCount: 14,
    numericParseSuccess: true,
    ...overrides
  });

  describe('calculateConfidence', () => {
    it('should return high confidence for perfect extraction', () => {
      const quote = createMockQuote({
        coverages: Array(14).fill(null).map((_, i) => ({
          name: `Coverage ${i}`,
          canonicalName: `Coverage ${i}`,
          value: '1000000',
          deductible: '10%',
          confidence: 95
        }))
      });
      const validation = createMockValidation();
      const result = calculateConfidence(quote, validation, true);
      
      expect(result.score).toBeGreaterThanOrEqual(80);
      expect(result.needsReview).toBe(false);
      expect(result.isCritical).toBe(false);
    });

    it('should return low confidence for poor extraction', () => {
      const quote = createMockQuote({
        priceAnnual: 0,
        coverages: []
      });
      const validation = createMockValidation({
        isValid: false,
        flags: [
          { field: 'priceAnnual', severity: 'WARNING', message: 'Missing premium', code: 'PREMIUM_MISSING' }
        ],
        coverageCount: 0,
        numericParseSuccess: false
      });
      const result = calculateConfidence(quote, validation, false);
      
      expect(result.score).toBeLessThan(50);
      expect(result.needsReview).toBe(true);
      expect(result.isCritical).toBe(true);
    });

    it('should give bonus for structured extraction', () => {
      const quote = createMockQuote();
      const validation = createMockValidation();
      
      const structuredResult = calculateConfidence(quote, validation, true);
      const unstructuredResult = calculateConfidence(quote, validation, false);
      
      expect(structuredResult.score).toBeGreaterThanOrEqual(unstructuredResult.score);
    });

    it('should include breakdown', () => {
      const quote = createMockQuote();
      const validation = createMockValidation();
      const result = calculateConfidence(quote, validation, true);
      
      expect(result.breakdown.coverageCompleteness).toBeDefined();
      expect(result.breakdown.numericParseSuccess).toBeDefined();
      expect(result.breakdown.validationPassRate).toBeDefined();
      expect(result.breakdown.schemaCompliance).toBeDefined();
    });
  });

  describe('getConfidenceLabel', () => {
    it('should return "Alta" for high scores', () => {
      expect(getConfidenceLabel(95)).toBe('Alta');
    });

    it('should return "Media" for medium scores', () => {
      expect(getConfidenceLabel(80)).toBe('Media');
    });

    it('should return "Baja" for low scores', () => {
      expect(getConfidenceLabel(60)).toBe('Baja');
    });

    it('should return "Crítica" for very low scores', () => {
      expect(getConfidenceLabel(30)).toBe('Crítica');
    });
  });

  describe('getConfidenceColor', () => {
    it('should return green for high scores', () => {
      expect(getConfidenceColor(95)).toBe('green');
    });

    it('should return yellow for medium scores', () => {
      expect(getConfidenceColor(80)).toBe('yellow');
    });

    it('should return orange for low scores', () => {
      expect(getConfidenceColor(60)).toBe('orange');
    });

    it('should return red for very low scores', () => {
      expect(getConfidenceColor(30)).toBe('red');
    });
  });

  describe('formatConfidence', () => {
    it('should format high confidence correctly', () => {
      const quote = createMockQuote({
        coverages: Array(14).fill(null).map((_, i) => ({
          name: `Coverage ${i}`,
          canonicalName: `Coverage ${i}`,
          value: '1000000',
          deductible: '10%',
          confidence: 95
        }))
      });
      const result = calculateConfidence(quote, createMockValidation(), true);
      const formatted = formatConfidence(result);
      expect(formatted).toContain('/100');
      expect(formatted).toContain('Alta');
    });

    it('should include review flag when needed', () => {
      const result = calculateConfidence(
        createMockQuote({ priceAnnual: 0, coverages: [] }),
        createMockValidation({ isValid: false, coverageCount: 0 }),
        false
      );
      const formatted = formatConfidence(result);
      expect(formatted).toContain('Revisar');
    });
  });
});
