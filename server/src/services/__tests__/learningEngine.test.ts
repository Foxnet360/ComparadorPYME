import { describe, it, expect, vi, beforeEach } from 'vitest';
import { learningEngine } from '../learningEngine';
import { embeddingService } from '../vector/embeddingService';

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
  },
}));

vi.mock('../../config/featureFlags', () => ({
  featureFlags: {
    isEnabled: vi.fn(() => false),
  },
}));

vi.mock('../coverageOntology', () => ({
  default: {
    saveMapping: vi.fn().mockResolvedValue(undefined),
  },
}));

describe('learningEngine embedding retrieval and fallback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockReturnValue({
      select: () => ({
        eq: () => ({
          limit: () => Promise.resolve({ data: [], error: null })
        })
      })
    });
  });

  it('uses DB embeddings and in-memory cosine similarity when embeddings exist in DB', async () => {
    const mockDbCorrections = [
      { id: '1', raw_name: 'Robo y Asalto', embedding: [0.1, 0.2, 0.3], user_corrected: true }
    ];

    mockFrom.mockReturnValue({
      select: () => ({
        eq: () => ({
          limit: () => Promise.resolve({ data: mockDbCorrections, error: null })
        })
      })
    });

    vi.mocked(embeddingService.generateEmbedding).mockResolvedValue([0.1, 0.2, 0.3]);
    vi.mocked(embeddingService.cosineSimilarity).mockReturnValue(0.95);

    const results = await learningEngine.getSimilarCorrections('Robo con Violencia');

    expect(results).toHaveLength(1);
    expect(results[0].raw_name).toBe('Robo y Asalto');
    expect(embeddingService.cosineSimilarity).toHaveBeenCalledWith([0.1, 0.2, 0.3], [0.1, 0.2, 0.3]);
  });

  it('falls back to local Sørensen-Dice similarity matching when db embeddings are missing', async () => {
    const mockDbCorrections = [
      { id: '1', raw_name: 'Robo y Asalto', embedding: null, user_corrected: true }
    ];

    mockFrom.mockReturnValue({
      select: () => ({
        eq: () => ({
          limit: () => Promise.resolve({ data: mockDbCorrections, error: null })
        })
      })
    });

    vi.mocked(embeddingService.generateEmbedding).mockResolvedValue([0.1, 0.2, 0.3]);

    const results = await learningEngine.getSimilarCorrections('Robo y Asalto');

    expect(results).toHaveLength(1);
    expect(results[0].raw_name).toBe('Robo y Asalto');
    expect(embeddingService.cosineSimilarity).not.toHaveBeenCalled();
  });
});
