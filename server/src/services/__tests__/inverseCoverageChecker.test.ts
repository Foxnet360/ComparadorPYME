import { describe, it, expect, vi } from 'vitest';
import { inverseCoverageChecker } from '../inverseCoverageChecker';
import { mockQuote } from './__fixtures__/mockData';

// Mock Supabase
vi.mock('../../config/database', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn(() => ({
            limit: vi.fn(async () => ({
              data: [
                { coverage_name: 'Sustracción / Hurto', is_mandatory: true, page_number: 15 },
                { coverage_name: 'Equipo Eléctrico', is_mandatory: false, page_number: 18 }
              ],
              error: null
            }))
          }))
        }))
      }))
    }))
  }
}));

describe('inverseCoverageChecker', () => {
  describe('checkMissingCoverages', () => {
    it('should detect coverages in clause but not in quote', async () => {
      const result = await inverseCoverageChecker.checkMissingCoverages(
        mockQuote,
        'Seguros Bolívar'
      );
      
      expect(result.totalClauseCoverages).toBeGreaterThan(0);
      expect(result.results).toBeDefined();
    });

    it('should classify missing coverages correctly', async () => {
      const result = await inverseCoverageChecker.checkMissingCoverages(
        mockQuote,
        'Seguros Bolívar'
      );
      
      for (const item of result.results) {
        expect(item.existsInClause).toBe(true);
        expect(item.existsInQuote).toBe(false);
        
        if (item.isMandatory) {
          expect(item.status).toBe('MANDATORY_MISSING');
          expect(item.alertLevel).toBe('CRITICAL');
        } else {
          expect(item.status).toBe('OPTIONAL_MISSING');
          expect(item.alertLevel).toBe('INFO');
        }
      }
    });

    it('should count mandatory and optional missing separately', async () => {
      const result = await inverseCoverageChecker.checkMissingCoverages(
        mockQuote,
        'Seguros Bolívar'
      );
      
      expect(result.mandatoryMissingCount).toBeGreaterThanOrEqual(0);
      expect(result.optionalMissingCount).toBeGreaterThanOrEqual(0);
      expect(result.mandatoryMissingCount + result.optionalMissingCount)
        .toBe(result.results.length);
    });

    it('should handle quote with all coverages present', async () => {
      const fullQuote = {
        ...mockQuote,
        coverages: [
          ...mockQuote.coverages,
          { name: 'Sustracción / Hurto', value: '50M', deductible: '10%' },
          { name: 'Equipo Eléctrico', value: '30M', deductible: '10%' }
        ]
      };
      
      const result = await inverseCoverageChecker.checkMissingCoverages(
        fullQuote,
        'Seguros Bolívar'
      );
      
      // Should have fewer or no missing coverages
      expect(result.results.length).toBeLessThanOrEqual(2);
    });

    it('should return empty results when all coverages match', async () => {
      const quoteWithAll = {
        ...mockQuote,
        coverages: [
          { name: 'Incendio', value: '500M', deductible: '10%' },
          { name: 'RC', value: '100M', deductible: '5%' },
          { name: 'Lucro Cesante', value: '100M', deductible: 'No aplica' },
          { name: 'Sustracción / Hurto', value: '50M', deductible: '10%' },
          { name: 'Equipo Eléctrico', value: '30M', deductible: '10%' }
        ]
      };
      
      const result = await inverseCoverageChecker.checkMissingCoverages(
        quoteWithAll,
        'Seguros Bolívar'
      );
      
      expect(result.results.length).toBe(0);
      expect(result.mandatoryMissingCount).toBe(0);
      expect(result.optionalMissingCount).toBe(0);
    });

    it('should handle empty quote', async () => {
      const emptyQuote = { ...mockQuote, coverages: [] };
      
      const result = await inverseCoverageChecker.checkMissingCoverages(
        emptyQuote,
        'Seguros Bolívar'
      );
      
      expect(result.results.length).toBeGreaterThan(0);
      expect(result.mandatoryMissingCount).toBeGreaterThan(0);
    });

    it('should return consistent structure', async () => {
      const result = await inverseCoverageChecker.checkMissingCoverages(
        mockQuote,
        'Seguros Bolívar'
      );
      
      expect(result).toHaveProperty('results');
      expect(result).toHaveProperty('mandatoryMissingCount');
      expect(result).toHaveProperty('optionalMissingCount');
      expect(result).toHaveProperty('totalClauseCoverages');
      
      for (const item of result.results) {
        expect(item).toHaveProperty('coverageName');
        expect(item).toHaveProperty('isMandatory');
        expect(item).toHaveProperty('status');
        expect(item).toHaveProperty('alertLevel');
      }
    });
  });
});
