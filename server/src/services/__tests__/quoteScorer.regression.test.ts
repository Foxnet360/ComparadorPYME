import { describe, it, expect } from 'vitest';
import { quoteScorer } from '../quoteScorer';

describe('quoteScorer - Regression Tests', () => {
  const mockQuote = {
    insurerName: 'Seguros Bolívar',
    policyName: 'Empresarial Plus',
    priceAnnual: 8500000,
    currency: 'COP',
    coverages: [
      { name: 'Incendio (Edificio y Contenidos)', canonicalName: 'Incendio (Edificio y Contenidos)', value: '500000000', deductible: '10%', confidence: 95 },
      { name: 'Lucro Cesante', canonicalName: 'Lucro Cesante', value: '100000000', deductible: 'No aplica', confidence: 95 },
      { name: 'Sustracción / Hurto', canonicalName: 'Sustracción / Hurto', value: '50000000', deductible: '10%', confidence: 95 },
      { name: 'Responsabilidad Civil (RCE)', canonicalName: 'Responsabilidad Civil (RCE)', value: '100000000', deductible: '5 SMMLV', confidence: 95 }
    ],
    specialConditions: [],
    rawText: 'Mock quote',
    parseConfidence: 95
  };

  const emptyCrossRefs: any[] = [];
  const allQuotes = [mockQuote];

  describe('Scoring with clause validation', () => {
    it('should calculate base coverage score correctly', () => {
      const result = quoteScorer.calculateScore(mockQuote, emptyCrossRefs, allQuotes);
      
      expect(result.breakdown.coverage).toBeGreaterThan(0);
      expect(result.breakdown.coverage).toBeLessThanOrEqual(100);
    });

    it('should apply phantom coverage penalty', () => {
      const clauseValidation = [
        { coverageName: 'Incendio', status: 'VERIFIED' as const },
        { coverageName: 'Phantom Coverage', status: 'PHANTOM' as const }
      ];
      
      const resultWithPenalty = quoteScorer.calculateScore(
        mockQuote,
        emptyCrossRefs,
        allQuotes,
        undefined,
        clauseValidation as any
      );
      
      const resultWithoutPenalty = quoteScorer.calculateScore(
        mockQuote,
        emptyCrossRefs,
        allQuotes
      );
      
      expect(resultWithPenalty.breakdown.coverage).toBeLessThan(resultWithoutPenalty.breakdown.coverage);
    });

    it('should apply mandatory missing penalty', () => {
      const clauseValidation = [
        { coverageName: 'Incendio', status: 'VERIFIED' as const },
        { coverageName: 'RC Obligatoria', status: 'MANDATORY_MISSING' as const }
      ];
      
      const result = quoteScorer.calculateScore(
        mockQuote,
        emptyCrossRefs,
        allQuotes,
        undefined,
        clauseValidation as any
      );
      
      expect(result.breakdown.coverage).toBeLessThan(100);
    });

    it('should penalize absence of clause document', () => {
      const result = quoteScorer.calculateScore(mockQuote, emptyCrossRefs, allQuotes);
      
      // When no cross refs (no clause document), deductible score should be 30 not 50
      expect(result.breakdown.deductibles).toBe(30);
      expect(result.breakdown.exclusions).toBe(30);
    });

    it('should maintain total score within 0-100 range', () => {
      const result = quoteScorer.calculateScore(mockQuote, emptyCrossRefs, allQuotes);
      
      expect(result.totalScore).toBeGreaterThanOrEqual(0);
      expect(result.totalScore).toBeLessThanOrEqual(100);
    });

    it('should handle empty quote gracefully', () => {
      const emptyQuote = { ...mockQuote, coverages: [] };
      
      const result = quoteScorer.calculateScore(emptyQuote, emptyCrossRefs, [emptyQuote]);
      
      expect(result.totalScore).toBeGreaterThanOrEqual(0);
      expect(result.breakdown.coverage).toBe(0);
    });

    it('should not break with phantom penalties exceeding base score', () => {
      const manyPhantoms = Array(10).fill(null).map((_, i) => ({
        coverageName: `Phantom ${i}`,
        status: 'PHANTOM' as const
      }));
      
      const result = quoteScorer.calculateScore(
        mockQuote,
        emptyCrossRefs,
        allQuotes,
        undefined,
        manyPhantoms as any
      );
      
      expect(result.breakdown.coverage).toBe(0); // Should clamp to 0, not negative
      expect(result.totalScore).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Score consistency', () => {
    it('should return consistent results for same inputs', () => {
      const result1 = quoteScorer.calculateScore(mockQuote, emptyCrossRefs, allQuotes);
      const result2 = quoteScorer.calculateScore(mockQuote, emptyCrossRefs, allQuotes);
      
      expect(result1.totalScore).toBe(result2.totalScore);
      expect(result1.breakdown).toEqual(result2.breakdown);
    });

    it('should handle cross-reference results', () => {
      const crossRefs = [
        {
          coverageName: 'Incendio',
          quoteData: { value: '500M', deductible: '10%' },
          clauseData: { deductible: '10%', exclusions: ['Exclusión 1'], conditions: [] },
          alerts: [],
          isVerified: true
        }
      ];
      
      const result = quoteScorer.calculateScore(mockQuote, crossRefs as any, allQuotes);
      
      expect(result.breakdown.deductibles).toBeGreaterThan(30); // Should be better than default
    });
  });

  describe('Edge cases', () => {
    it('should handle zero price', () => {
      const zeroPriceQuote = { ...mockQuote, priceAnnual: 0 };
      
      const result = quoteScorer.calculateScore(zeroPriceQuote, emptyCrossRefs, [zeroPriceQuote]);
      
      expect(result.breakdown.priceRatio).toBe(50); // Default for invalid price
    });

    it('should handle single quote comparison', () => {
      const result = quoteScorer.calculateScore(mockQuote, emptyCrossRefs, [mockQuote]);
      
      expect(result).toBeDefined();
      expect(result.quotePriceRank).toBe(1);
    });
  });
});
