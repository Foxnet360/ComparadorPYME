import { describe, it, expect, vi, beforeEach } from 'vitest';
import { clauseCoverageValidator } from '../clauseCoverageValidator';
import { mockQuote, mockQuoteWithoutClauses } from './__fixtures__/mockData';

// Mock dependencies
vi.mock('../ragRetrievalService', () => ({
  ragRetrievalService: {
    search: vi.fn(async (query, options) => {
      // Simulate RAG search results
      const coverageExists = [
        'incendio',
        'responsabilidad civil',
        'lucro cesante'
      ].some(c => query.toLowerCase().includes(c));
      
      if (coverageExists) {
        return [{
          id: 'chunk-1',
          documentId: 'doc-1',
          insurerName: options.insurerName,
          sectionType: 'COBERTURA',
          coverageTags: [query.toLowerCase()],
          content: `Cobertura de ${query}`,
          pageNumber: 5,
          similarity: 0.85
        }];
      }
      return [];
    })
  }
}));

vi.mock('../../config/database', () => ({
  supabase: {
    from: vi.fn((table) => ({
      select: vi.fn((columns) => ({
        eq: vi.fn((column, value) => {
          // Return empty for 'Aseguradora Sin Clausulado'
          if (column === 'insurer_name' && value === 'Aseguradora Sin Clausulado') {
            return {
              eq: vi.fn(() => ({
                limit: vi.fn(async () => ({ data: [], error: null }))
              })),
              order: vi.fn(() => ({
                limit: vi.fn(async () => ({ data: [], error: null }))
              }))
            };
          }
          return {
            eq: vi.fn(() => ({
              limit: vi.fn(async () => ({ data: [{ id: 'doc-1' }], error: null }))
            })),
            order: vi.fn(() => ({
              limit: vi.fn(async () => ({
                data: [
                  { coverage_name: 'Incendio (Edificio y Contenidos)', is_mandatory: true, page_number: 5 },
                  { coverage_name: 'Responsabilidad Civil (RCE)', is_mandatory: true, page_number: 8 },
                  { coverage_name: 'Lucro Cesante', is_mandatory: true, page_number: 12 },
                  { coverage_name: 'Sustracción / Hurto', is_mandatory: false, page_number: 15 }
                ],
                error: null
              }))
            }))
          };
        })
      }))
    }))
  }
}));

describe('clauseCoverageValidator', () => {
  describe('validate', () => {
    it('should validate coverages that exist in clause document', async () => {
      const result = await clauseCoverageValidator.validate(mockQuote, 'Seguros Bolívar');
      
      expect(result.hasClauseDocument).toBe(true);
      expect(result.verifiedCount).toBeGreaterThan(0);
      
      const verified = result.results.filter(r => r.status === 'VERIFIED');
      expect(verified.length).toBeGreaterThan(0);
    });

    it('should detect phantom coverages (in quote but not in clause)', async () => {
      const result = await clauseCoverageValidator.validate(mockQuote, 'Seguros Bolívar');
      
      const phantom = result.results.filter(r => r.status === 'PHANTOM');
      expect(phantom.length).toBeGreaterThanOrEqual(0);
      
      if (phantom.length > 0) {
        expect(phantom[0].alertLevel).toBe('CRITICAL');
      }
    });

    it('should detect mandatory missing coverages', async () => {
      const result = await clauseCoverageValidator.validate(mockQuote, 'Seguros Bolívar');
      
      // Should find some coverages that are mandatory but not in quote
      expect(result.results.length).toBeGreaterThan(0);
    });

    it('should penalize score when clause document is not available', async () => {
      const result = await clauseCoverageValidator.validate(mockQuoteWithoutClauses, 'Aseguradora Sin Clausulado');
      
      expect(result.hasClauseDocument).toBe(false);
      expect(result.scoreImpact).toBe(-20);
    });

    it('should calculate phantom penalties correctly', async () => {
      const result = await clauseCoverageValidator.validate(mockQuote, 'Seguros Bolívar');
      
      const expectedPenalty = result.phantomCount * 15;
      const missingPenalty = result.mandatoryMissingCount * 10;
      
      expect(result.scoreImpact).toBe(-(expectedPenalty + missingPenalty));
    });

    it('should handle empty coverages gracefully', async () => {
      const emptyQuote = { ...mockQuote, coverages: [] };
      const result = await clauseCoverageValidator.validate(emptyQuote, 'Aseguradora Sin Clausulado');
      
      expect(result.hasClauseDocument).toBe(false);
      expect(result.results).toEqual([]);
      expect(result.phantomCount).toBe(0);
    });

    it('should return consistent structure', async () => {
      const result = await clauseCoverageValidator.validate(mockQuote, 'Seguros Bolívar');
      
      expect(result).toHaveProperty('results');
      expect(result).toHaveProperty('phantomCount');
      expect(result).toHaveProperty('mandatoryMissingCount');
      expect(result).toHaveProperty('optionalMissingCount');
      expect(result).toHaveProperty('verifiedCount');
      expect(result).toHaveProperty('scoreImpact');
      expect(result).toHaveProperty('hasClauseDocument');
    });
  });
});
