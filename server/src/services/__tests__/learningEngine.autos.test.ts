import { describe, it, expect, vi, beforeEach } from 'vitest';
import { learningEngine } from '../learningEngine';
import { embeddingService } from '../vector/embeddingService';
import { coverageGraphService } from '../coverageGraphService';

const mockFrom = vi.fn();

vi.mock('../../config/database', () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

vi.mock('../vector/embeddingService', () => ({
  embeddingService: {
    generateEmbedding: vi.fn(),
    cosineSimilarity: vi.fn(),
  },
}));

vi.mock('../cache/redisCache', () => ({
  getCacheValue: vi.fn().mockResolvedValue(null),
  setCacheValue: vi.fn().mockResolvedValue(undefined),
  deleteCacheValue: vi.fn().mockResolvedValue(undefined),
  getCacheKeys: vi.fn().mockResolvedValue([]),
}));

vi.mock('../coverageGraphService', () => ({
  coverageGraphService: {
    learnCorrection: vi.fn().mockResolvedValue(undefined),
    addEdge: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../../config/featureFlags', () => ({
  featureFlags: {
    isEnabled: vi.fn(() => true),
  },
}));

vi.mock('../coverageOntology', () => ({
  default: {
    saveMapping: vi.fn().mockResolvedValue(undefined),
  },
}));

describe('learningEngine - domain isolation for autos vs pyme', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getSimilarCorrections', () => {
    it('queries coverage_mappings with eq("domain", "autos") when domain is "autos"', async () => {
      const mockEqDomain = vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue({
          data: [
            {
              id: '1',
              raw_name: 'Responsabilidad Civil Lucas',
              canonical_name: 'responsabilidad_civil',
              domain: 'autos',
              user_corrected: true,
            },
          ],
          error: null,
        }),
      });

      const mockEqUserCorrected = vi.fn().mockReturnValue({
        eq: mockEqDomain,
      });

      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: mockEqUserCorrected,
        }),
      });

      vi.mocked(embeddingService.generateEmbedding).mockResolvedValue([0.1, 0.2]);

      const results = await learningEngine.getSimilarCorrections('RC Autos', 'autos');

      expect(mockFrom).toHaveBeenCalledWith('coverage_mappings');
      expect(mockEqUserCorrected).toHaveBeenCalledWith('user_corrected', true);
      expect(mockEqDomain).toHaveBeenCalledWith('domain', 'autos');
      expect(results).toHaveLength(1);
      expect(results[0].domain).toBe('autos');
    });

    it('defaults to domain "pyme" when domain argument is omitted', async () => {
      const mockEqDomain = vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue({ data: [], error: null }),
      });

      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: mockEqDomain,
          }),
        }),
      });

      await learningEngine.getSimilarCorrections('Incendio Pyme');

      expect(mockEqDomain).toHaveBeenCalledWith('domain', 'pyme');
    });
  });

  describe('saveCorrection & applyCorrection', () => {
    it('persists correction with domain "autos" and passes domain to coverageGraphService', async () => {
      const mockUpsert = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { id: 'autos-corr-1' }, error: null }),
        }),
      });

      mockFrom.mockReturnValue({
        upsert: mockUpsert,
      });

      vi.mocked(embeddingService.generateEmbedding).mockResolvedValue([0.5, 0.5]);

      const correctionId = await learningEngine.saveCorrection({
        rawName: 'Cobertura Parcial Daños',
        insurerName: 'Sura',
        systemMapping: 'daños_materiales',
        userCorrection: 'danos_parciales',
        correctionType: 'coverage_mapping',
        domain: 'autos',
      });

      expect(correctionId).toBe('autos-corr-1');

      // Verify Supabase upsert payload contained domain: 'autos'
      expect(mockUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          raw_name: 'Cobertura Parcial Daños',
          canonical_name: 'danos_parciales',
          domain: 'autos',
        })
      );

      // Verify graph service receives domain 'autos'
      expect(coverageGraphService.learnCorrection).toHaveBeenCalledWith(
        'cobertura parcial danos',
        'danos_parciales',
        'Sura',
        'autos'
      );
    });
  });

  describe('getMetrics', () => {
    it('filters metrics by domain "autos" without affecting "pyme"', async () => {
      const recordedEqCalls: Array<[string, unknown]> = [];

      const createQueryMock = (cols: string, opts?: { count?: string }) => {
        const query: Record<string, unknown> = {};
        query.eq = vi.fn().mockImplementation((field: string, val: unknown) => {
          recordedEqCalls.push([field, val]);
          return query;
        });
        query.order = vi.fn().mockReturnValue(query);
        query.limit = vi.fn().mockImplementation(() =>
          Promise.resolve({
            data: [{ raw_name: 'RC Autos', correction_count: 3 }],
            error: null,
          })
        );
        query.then = (resolve: (val: unknown) => unknown) => {
          if (opts?.count === 'exact') {
            return Promise.resolve({ count: 5, error: null }).then(resolve);
          }
          if (cols === 'canonical_name') {
            return Promise.resolve({
              data: [{ canonical_name: 'danos_parciales' }],
              error: null,
            }).then(resolve);
          }
          if (cols === 'created_at, correction_count') {
            return Promise.resolve({
              data: [{ created_at: '2026-07-01T00:00:00Z', correction_count: 2 }],
              error: null,
            }).then(resolve);
          }
          return Promise.resolve({ data: [], error: null }).then(resolve);
        };
        return query;
      };

      mockFrom.mockImplementation((table: string) => {
        if (table === 'coverage_mappings') {
          return {
            select: vi.fn().mockImplementation(createQueryMock),
          };
        }
        return {};
      });

      const metrics = await learningEngine.getMetrics('autos');

      expect(metrics.totalCorrections).toBe(5);
      expect(recordedEqCalls).toContainEqual(['domain', 'autos']);
      expect(recordedEqCalls).not.toContainEqual(['domain', 'pyme']);
    });
  });
});
