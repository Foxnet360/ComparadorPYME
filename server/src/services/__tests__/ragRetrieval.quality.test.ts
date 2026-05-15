import { describe, it, expect, vi } from 'vitest';
import { ragRetrievalService, RetrievedClause } from '../ragRetrievalService';

// Mock dependencies
vi.mock('../config/database', () => ({
  supabase: {
    rpc: vi.fn((procedure: string, params: any) => {
      // Mock responses for different RPC calls
      if (procedure === 'match_chunks_hybrid') {
        return Promise.resolve({
          data: [
            {
              id: 'chunk-1',
              document_id: 'doc-1',
              insurer_name: 'MAPFRE',
              section_type: 'AMPARO_BASICO',
              coverage_tags: ['Incendio', 'Daño Material'],
              content: 'Deducible del 10% con mínimo de 5 SMMLV para cobertura de incendio',
              page_number: 5,
              combined_score: 0.92
            },
            {
              id: 'chunk-2',
              document_id: 'doc-1',
              insurer_name: 'MAPFRE',
              section_type: 'AMPARO_BASICO',
              coverage_tags: ['Incendio'],
              content: 'La cobertura de incendio aplica a edificios y contenidos con deducible del 10%',
              page_number: 6,
              combined_score: 0.88
            }
          ],
          error: null
        });
      }
      
      if (procedure === 'get_parent_chunks') {
        return Promise.resolve({
          data: [
            {
              id: 'parent-1',
              document_id: params.document_id,
              insurer_name: 'MAPFRE',
              section_type: 'CONDICIONES_GENERALES',
              coverage_tags: ['General'],
              content: 'Condiciones generales del seguro PYME para pequeñas y medianas empresas',
              page_number: 1,
              similarity: 0.85
            }
          ],
          error: null
        });
      }
      
      return Promise.resolve({ data: [], error: null });
    })
  }
}));

vi.mock('../vector/embeddingService', () => ({
  embeddingService: {
    generateEmbedding: vi.fn(() => Promise.resolve([0.1, 0.2, 0.3, 0.4])),
    cosineSimilarity: vi.fn(() => 0.85)
  }
}));

vi.mock('../cache/redisCache', () => ({
  redis: {
    get: vi.fn(() => Promise.resolve(null)),
    setex: vi.fn(() => Promise.resolve('OK')),
    del: vi.fn(() => Promise.resolve(1)),
    keys: vi.fn(() => Promise.resolve([]))
  }
}));

describe('ragRetrievalService - Search Quality', () => {
  describe('searchWithExpansion', () => {
    it('should expand query and return relevant results', async () => {
      const results = await ragRetrievalService.searchWithExpansion('deducible incendio', {
        insurerName: 'MAPFRE',
        limit: 5
      });

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].insurerName).toBe('MAPFRE');
      expect(results[0].similarity).toBeGreaterThan(0.5);
    });

    it('should deduplicate results from multiple query variants', async () => {
      const results = await ragRetrievalService.searchWithExpansion('deducible incendio', {
        insurerName: 'MAPFRE',
        limit: 10
      });

      const ids = results.map(r => r.id);
      const uniqueIds = [...new Set(ids)];
      expect(uniqueIds.length).toBe(ids.length); // No duplicates
    });

    it('should filter by minimum similarity', async () => {
      const results = await ragRetrievalService.searchWithExpansion('deducible incendio', {
        insurerName: 'MAPFRE',
        minSimilarity: 0.9,
        limit: 10
      });

      for (const result of results) {
        expect(result.similarity).toBeGreaterThanOrEqual(0.9);
      }
    });
  });

  describe('searchWithParentContext', () => {
    it('should include parent chunks for context', async () => {
      const results = await ragRetrievalService.searchWithParentContext('deducible incendio', {
        insurerName: 'MAPFRE',
        limit: 5
      });

      expect(results.length).toBeGreaterThan(0);
      
      // Should have parent context marked
      const hasParentContext = results.some(r => 
        r.content.includes('[CONTEXTO GENERAL]')
      );
      expect(hasParentContext).toBe(true);
    });

    it('should prioritize child chunks over parent chunks', async () => {
      const results = await ragRetrievalService.searchWithParentContext('deducible incendio', {
        insurerName: 'MAPFRE',
        limit: 5
      });

      // First results should be child chunks (higher similarity)
      if (results.length > 1) {
        expect(results[0].similarity).toBeGreaterThanOrEqual(results[results.length - 1].similarity);
      }
    });
  });

  describe('reRankResults', () => {
    it('should re-rank results by relevance', async () => {
      const mockResults: RetrievedClause[] = [
        {
          id: 'chunk-1',
          documentId: 'doc-1',
          insurerName: 'MAPFRE',
          sectionType: 'AMPARO_BASICO',
          coverageTags: ['Incendio'],
          content: 'Deducible del 10% para incendio',
          pageNumber: 5,
          similarity: 0.85
        },
        {
          id: 'chunk-2',
          documentId: 'doc-1',
          insurerName: 'MAPFRE',
          sectionType: 'AMPARO_BASICO',
          coverageTags: ['Terremoto'],
          content: 'Deducible del 15% para terremoto',
          pageNumber: 8,
          similarity: 0.75
        }
      ];

      const ranked = await ragRetrievalService.reRankResults('deducible incendio', mockResults, {
        topK: 2
      });

      expect(ranked.length).toBe(2);
      // After re-ranking, the incendio chunk should be first
      expect(ranked[0].coverageTags).toContain('Incendio');
    });

    it('should handle empty results', async () => {
      const ranked = await ragRetrievalService.reRankResults('query', []);
      expect(ranked).toHaveLength(0);
    });

    it('should handle single result', async () => {
      const singleResult: RetrievedClause[] = [{
        id: 'chunk-1',
        documentId: 'doc-1',
        insurerName: 'MAPFRE',
        sectionType: 'AMPARO_BASICO',
        coverageTags: ['Incendio'],
        content: 'Test content',
        pageNumber: 1,
        similarity: 0.9
      }];

      const ranked = await ragRetrievalService.reRankResults('query', singleResult);
      expect(ranked).toHaveLength(1);
      expect(ranked[0].id).toBe('chunk-1');
    });
  });

  describe('Performance', () => {
    it('should complete search within reasonable time', async () => {
      const start = Date.now();
      await ragRetrievalService.searchWithExpansion('deducible incendio MAPFRE', {
        insurerName: 'MAPFRE',
        limit: 5
      });
      const duration = Date.now() - start;
      
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
    });
  });
});