import { describe, it, expect, vi, beforeEach } from 'vitest';
import { semanticMatcher } from '../semanticMatcher';
import { coverageGraphService } from '../coverageGraphService';
import { embeddingService } from '../vector/embeddingService';
import { geminiService } from '../gemini';
import { featureFlags } from '../../config/featureFlags';

vi.mock('../coverageGraphService', () => ({
  coverageGraphService: {
    query: vi.fn(async () => ({ mappings: [], composite: false })),
  },
}));

vi.mock('../vector/embeddingService', () => ({
  embeddingService: {
    generateEmbedding: vi.fn(),
    generateEmbeddingsBatch: vi.fn(),
    cosineSimilarity: vi.fn(),
  },
}));

vi.mock('../gemini', () => ({
  geminiService: {
    extractText: vi.fn(),
  },
}));

vi.mock('../../config/featureFlags', () => ({
  featureFlags: {
    isEnabled: vi.fn((flag: string) => flag === 'useTemplateGraphPipeline'),
    getFlags: vi.fn(() => ({})),
  },
}));

vi.mock('../../config/env', () => ({
  env: {
    GEMINI_API_KEY: 'dummy',
    GEMINI_MODEL: 'gemini-3.5-flash',
    GEMINI_CHAT_MODEL: 'gemini-2.5-flash-lite',
    GEMINI_CLAUSE_MODEL: 'gemini-3.5-flash',
    GEMINI_EMBEDDING_MODEL: 'gemini-embedding-2',
    SUPABASE_URL: 'https://test.supabase.co',
    SUPABASE_ANON_KEY: 'dummy',
    SUPABASE_SERVICE_ROLE_KEY: 'dummy',
    SUPABASE_JWT_SECRET: 'dummy',
    PORT: 8080,
    NODE_ENV: 'test',
    REGION: 'CO',
    SMMLV_VALUE: 1423500,
    UVT_VALUE: 42412,
    CURRENCY: 'COP',
    CLAUSE_PAGES_BUCKET: 'clause-pages',
    MAX_FILE_SIZE: 52428800,
    MAX_PAGES_LIMIT: 100,
    UPLOAD_TIMEOUT: 300000,
    LOG_LEVEL: 'info',
  },
}));

vi.mock('../../config/database', () => ({
  supabase: {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue({ data: [], error: null }),
    upsert: vi.fn().mockResolvedValue({ data: { id: 'mocked-id' }, error: null }),
    single: vi.fn().mockResolvedValue({ data: { id: 'mocked-id' }, error: null }),
  },
}));

vi.mock('../cache/redisCache', () => ({
  getCachedCoverageMapping: vi.fn().mockResolvedValue(null),
  setCachedCoverageMapping: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@google/genai', () => ({
  GoogleGenAI: class {
    models = {
      generateContent: vi.fn().mockResolvedValue({
        text: JSON.stringify({
          proposedGroupId: 'incendio',
          justification: 'Mocked justification',
        }),
      }),
    };
  },
}));

describe('semanticMatcher graph integration', () => {
  const mockEmbedding = Array(768)
    .fill(0)
    .map((_, i) => i / 768);

  beforeEach(() => {
    vi.clearAllMocks();
    semanticMatcher.clearCache();
    vi.mocked(coverageGraphService.query).mockResolvedValue({ mappings: [], composite: false });
    vi.mocked(featureFlags.isEnabled).mockImplementation(
      (flag: string) => flag === 'useTemplateGraphPipeline'
    );
    vi.mocked(embeddingService.generateEmbedding).mockResolvedValue(mockEmbedding);
    vi.mocked(embeddingService.generateEmbeddingsBatch).mockResolvedValue(
      semanticMatcher.getAllCategories().map((cat) => ({
        embedding: mockEmbedding,
        text: cat.name,
        model: 'gemini-embedding-001',
      }))
    );
    vi.mocked(embeddingService.cosineSimilarity).mockReturnValue(0.5);
    vi.mocked(geminiService.extractText).mockResolvedValue('Invalid LLM response');
  });

  describe('matchCoverage', () => {
    it('returns graph match when all other layers fail', async () => {
      vi.mocked(coverageGraphService.query).mockResolvedValue({
        mappings: [{ canonicalId: '1', confidence: 0.88, provenance: 'maps_to' }],
        composite: false,
      });

      const result = await semanticMatcher.matchCoverage(
        'Daño Material Global Desconocido',
        'pyme'
      );

      expect(result.method).toBe('graph');
      expect(result.categoryId).toBe(1);
      expect(result.canonicalName).toBe('Incendio (Edificio y Contenidos)');
      expect(result.confidence).toBe(0.88);
    });

    it('resolves string canonicalId to category name', async () => {
      vi.mocked(coverageGraphService.query).mockResolvedValue({
        mappings: [
          {
            canonicalId: 'Incendio (Edificio y Contenidos)',
            confidence: 0.82,
            provenance: 'maps_to',
          },
        ],
        composite: false,
      });

      const result = await semanticMatcher.matchCoverage('Otra Cobertura Desconocida', 'pyme');

      expect(result.method).toBe('graph');
      expect(result.categoryId).toBe(1);
      expect(result.canonicalName).toBe('Incendio (Edificio y Contenidos)');
      expect(result.confidence).toBe(0.82);
    });

    it('skips graph fallback when pipeline flag is disabled', async () => {
      vi.mocked(featureFlags.isEnabled).mockReturnValue(false);
      vi.mocked(coverageGraphService.query).mockResolvedValue({
        mappings: [{ canonicalId: '1', confidence: 0.88, provenance: 'maps_to' }],
        composite: false,
      });

      const result = await semanticMatcher.matchCoverage('XYZABC123NoMatch', 'pyme');

      expect(result.method).toBeNull();
      expect(result.categoryId).toBeNull();
      expect(coverageGraphService.query).not.toHaveBeenCalled();
    });

    it('does not use graph when an earlier layer succeeds', async () => {
      vi.mocked(embeddingService.cosineSimilarity).mockReturnValue(0.9);
      vi.mocked(coverageGraphService.query).mockResolvedValue({
        mappings: [{ canonicalId: '1', confidence: 0.88, provenance: 'maps_to' }],
        composite: false,
      });

      const result = await semanticMatcher.matchCoverage(
        'Nombre Que Falla En Thesaurus Fuzzy',
        'pyme'
      );

      expect(result.method).toBe('embedding');
      expect(coverageGraphService.query).not.toHaveBeenCalled();
    });

    it('ignores graph mappings below confidence threshold', async () => {
      vi.mocked(coverageGraphService.query).mockResolvedValue({
        mappings: [{ canonicalId: '1', confidence: 0.45, provenance: 'maps_to' }],
        composite: false,
      });

      const result = await semanticMatcher.matchCoverage('Cobertura Con Baja Confianza', 'pyme');

      expect(result.method).toBeNull();
      expect(result.categoryId).toBeNull();
    });
  });
});
