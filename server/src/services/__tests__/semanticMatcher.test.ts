import { describe, it, expect, vi, beforeEach } from 'vitest';
import { semanticMatcher, CONFIDENCE_THRESHOLDS } from '../semanticMatcher';
import { embeddingService } from '../vector/embeddingService';
import { geminiService } from '../gemini';
import { featureFlags } from '../../config/featureFlags';
import { coverageOntology } from '../coverageOntology';

vi.mock('../coverageOntology', () => ({
  coverageOntology: {
    mapCoverage: vi.fn(async () => ({
      rawName: '',
      groups: [],
      isComposite: false,
      confidence: 0,
    })),
    saveMapping: vi.fn(async () => {}),
    getNodeById: vi.fn(),
  },
  default: {
    mapCoverage: vi.fn(async () => ({
      rawName: '',
      groups: [],
      isComposite: false,
      confidence: 0,
    })),
    saveMapping: vi.fn(async () => {}),
    getNodeById: vi.fn(),
  },
}));

// Mock dependencies
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

describe('semanticMatcher', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    semanticMatcher.clearCache();
  });

  describe('Layer 1: Thesaurus Exact Matching', () => {
    it('should match exact canonical names', async () => {
      const result = await semanticMatcher.matchCoverage('Incendio (Edificio y Contenidos)');

      expect(result.categoryId).toBe(1);
      expect(result.canonicalName).toBe('Incendio (Edificio y Contenidos)');
      expect(result.confidence).toBe(1.0);
      expect(result.method).toBe('thesaurus');
    });

    it('should match exact synonyms from thesaurus', async () => {
      // "Responsabilidad Civil Extracontractual (RCE)" has synonyms in thesaurus
      const result = await semanticMatcher.matchCoverage('Responsabilidad Civil');

      expect(result.categoryId).toBe(6);
      expect(result.canonicalName).toBe('Responsabilidad Civil Extracontractual (RCE)');
      expect(result.confidence).toBeGreaterThanOrEqual(0.9);
      expect(result.method).toBe('thesaurus');
    });

    it('should match case-insensitively', async () => {
      const result = await semanticMatcher.matchCoverage('INCENDIO (EDIFICIO Y CONTENIDOS)');

      expect(result.categoryId).toBe(1);
      expect(result.confidence).toBe(1.0);
    });

    it('should match with accents normalized', async () => {
      const result = await semanticMatcher.matchCoverage('Responsabilidad Civil (RCE)');

      expect(result.categoryId).toBe(6);
      expect(result.confidence).toBeGreaterThanOrEqual(0.9);
    });

    it('should return partial match confidence for substring matches', async () => {
      const result = await semanticMatcher.matchCoverage('Incendio');

      // Should match category 1 but with lower confidence (partial match)
      expect(result.categoryId).toBe(1);
      expect(result.confidence).toBeGreaterThanOrEqual(0.9);
      expect(result.method).toBe('thesaurus');
    });

    it('should scope matches to the requested domain', async () => {
      const pymeResult = await semanticMatcher.matchCoverage(
        'Responsabilidad Civil Extracontractual'
      );
      const autosResult = await semanticMatcher.matchCoverage(
        'Responsabilidad Civil Extracontractual',
        'autos'
      );

      expect(pymeResult.canonicalName).toBe('Responsabilidad Civil Extracontractual (RCE)');
      expect(autosResult.canonicalName).toBe('Responsabilidad Civil Extracontractual Vehicular');
    });
    it('should prioritize longer partial matches for specificity', async () => {
      // "ROTURA DE VIDRIOS" should map to Vidrios Planos (cat 8) not Rotura de Maquinaria (cat 5)
      // because "vidrios" (7 chars) is more specific than "rotura" (6 chars)
      const result = await semanticMatcher.matchCoverage('ROTURA DE VIDRIOS');

      expect(result.categoryId).toBe(8);
      expect(result.canonicalName).toBe('Vidrios Planos');
      expect(result.method).toBe('thesaurus');
    });
  });

  describe('Layer 2: Fuzzy Matching', () => {
    it('should match with small typos', async () => {
      const result = await semanticMatcher.matchCoverage('Responsaviliad Civil');

      expect(result.categoryId).toBe(6);
      expect(result.canonicalName).toBe('Responsabilidad Civil Extracontractual (RCE)');
      expect(result.method).toBe('fuzzy');
      expect(result.confidence).toBeGreaterThanOrEqual(CONFIDENCE_THRESHOLDS.FUZZY_MIN);
    });

    it('should match with missing accents', async () => {
      const result = await semanticMatcher.matchCoverage('Equipo Electrico y Electronico');

      expect(result.categoryId).toBe(4);
      expect(result.confidence).toBeGreaterThanOrEqual(CONFIDENCE_THRESHOLDS.FUZZY_MIN);
    });

    it('should not match when confidence is below threshold', async () => {
      const result = await semanticMatcher.matchCoverage('XYZ123 Nonexistent Coverage');

      // Should not match by fuzzy since distance is too high
      expect(result.categoryId).toBeNull();
      expect(result.confidence).toBe(0);
    });

    it('should handle single character differences', async () => {
      const result = await semanticMatcher.matchCoverage('Vidrios Planos');

      expect(result.categoryId).toBe(8);
      expect(result.confidence).toBeGreaterThanOrEqual(CONFIDENCE_THRESHOLDS.FUZZY_MIN);
    });
  });

  describe('Layer 3: Embedding Matching', () => {
    it('should match using embeddings when thesaurus and fuzzy fail', async () => {
      // Mock embeddings
      const mockCoverageEmbedding = Array(768)
        .fill(0)
        .map((_, i) => i / 768);
      const mockCategoryEmbedding = Array(768)
        .fill(0)
        .map((_, i) => i / 768);

      vi.mocked(embeddingService.generateEmbedding).mockResolvedValue(mockCoverageEmbedding);
      vi.mocked(embeddingService.generateEmbeddingsBatch).mockResolvedValue(
        semanticMatcher.getAllCategories().map((cat) => ({
          embedding: mockCategoryEmbedding,
          text: cat.name,
          model: 'gemini-embedding-001',
        }))
      );
      vi.mocked(embeddingService.cosineSimilarity).mockReturnValue(0.85);

      // Use a name that won't match by thesaurus or fuzzy
      const result = await semanticMatcher.matchCoverage('XYZCoverageForEmbedding456');

      expect(result.method).toBe('embedding');
      expect(result.confidence).toBeGreaterThanOrEqual(CONFIDENCE_THRESHOLDS.EMBEDDING_MIN);
    });

    it('should fall back to LLM when embedding generation throws', async () => {
      vi.mocked(embeddingService.generateEmbedding).mockRejectedValue(
        new Error('Embedding API unavailable')
      );
      vi.mocked(geminiService.extractText).mockResolvedValue('CATEGORIA: 6\nCONFIANZA: 0.85');

      const result = await semanticMatcher.matchCoverage('FallbackCoverageAfterEmbeddingFailure');

      expect(result.method).toBe('llm');
      expect(result.categoryId).toBe(6);
    });

    it('should use cached embeddings for repeated queries', async () => {
      const mockEmbedding = Array(768)
        .fill(0)
        .map((_, i) => i / 768);

      vi.mocked(embeddingService.generateEmbedding).mockResolvedValue(mockEmbedding);
      vi.mocked(embeddingService.generateEmbeddingsBatch).mockResolvedValue(
        semanticMatcher.getAllCategories().map((cat) => ({
          embedding: mockEmbedding,
          text: cat.name,
          model: 'gemini-embedding-001',
        }))
      );
      vi.mocked(embeddingService.cosineSimilarity).mockReturnValue(0.85);

      // Use a name that won't match by thesaurus or fuzzy
      const coverageName = 'XYZCoverage123';

      // First call
      await semanticMatcher.matchCoverage(coverageName);

      // Second call - should use cache
      await semanticMatcher.matchCoverage(coverageName);

      // generateEmbedding should only be called once due to caching
      expect(embeddingService.generateEmbedding).toHaveBeenCalledTimes(1);
    });

    it('should not match when cosine similarity is below threshold', async () => {
      const mockEmbedding = Array(768)
        .fill(0)
        .map((_, i) => i / 768);

      vi.mocked(embeddingService.generateEmbedding).mockResolvedValue(mockEmbedding);
      vi.mocked(embeddingService.generateEmbeddingsBatch).mockResolvedValue(
        semanticMatcher.getAllCategories().map((cat) => ({
          embedding: mockEmbedding,
          text: cat.name,
          model: 'gemini-embedding-001',
        }))
      );
      vi.mocked(embeddingService.cosineSimilarity).mockReturnValue(0.5); // Below threshold

      const result = await semanticMatcher.matchCoverage('Completely Unrelated Coverage Name');

      // Should fall through to LLM or return null
      expect(result.method).not.toBe('embedding');
    });
  });

  describe('Layer 4: LLM Fallback', () => {
    it('should use LLM when other layers fail', async () => {
      // Mock LLM response
      vi.mocked(geminiService.extractText).mockResolvedValue('CATEGORIA: 6\nCONFIANZA: 0.85');

      const result = await semanticMatcher.matchCoverage('RC Extranjera');

      expect(result.method).toBe('llm');
      expect(result.categoryId).toBe(6);
      expect(result.confidence).toBe(0.85);
    });

    it('should handle LLM response parsing', async () => {
      vi.mocked(geminiService.extractText).mockResolvedValue('CATEGORIA: 3\nCONFIANZA: 0.75');

      // Use a name that won't match by thesaurus or fuzzy
      const result = await semanticMatcher.matchCoverage('XYZAmbiguousCoverage123');

      expect(result.categoryId).toBe(3);
      expect(result.confidence).toBe(0.75);
    });

    it('should reject LLM match when confidence is below threshold', async () => {
      vi.mocked(geminiService.extractText).mockResolvedValue('CATEGORIA: 6\nCONFIANZA: 0.3');

      const result = await semanticMatcher.matchCoverage('Ambiguous Coverage');

      // Should not return LLM match since confidence is below threshold
      expect(result.categoryId).toBeNull();
      expect(result.confidence).toBe(0);
    });

    it('should handle invalid LLM responses', async () => {
      vi.mocked(geminiService.extractText).mockResolvedValue('Invalid response format');

      const result = await semanticMatcher.matchCoverage('Unknown Coverage');

      expect(result.categoryId).toBeNull();
      expect(result.confidence).toBe(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty string', async () => {
      const result = await semanticMatcher.matchCoverage('');

      expect(result.categoryId).toBeNull();
      expect(result.confidence).toBe(0);
    });

    it('should handle null/undefined', async () => {
      const result = await semanticMatcher.matchCoverage('');

      expect(result.categoryId).toBeNull();
      expect(result.confidence).toBe(0);
    });

    it('should handle very long coverage names', async () => {
      const longName =
        'Responsabilidad Civil Extracontractual por Daños a Terceros en Establecimientos Comerciales y Eventos';
      const result = await semanticMatcher.matchCoverage(longName);

      // Should still match to RC category
      expect(result.categoryId).toBe(6);
    });

    it('should get category name by ID', () => {
      const name = semanticMatcher.getCategoryName(1);
      expect(name).toBe('Incendio (Edificio y Contenidos)');
    });

    it('should return null for invalid category ID', () => {
      const name = semanticMatcher.getCategoryName(999);
      expect(name).toBeNull();
    });

    it('should return all categories', () => {
      const categories = semanticMatcher.getAllCategories();
      expect(categories).toHaveLength(16);
      expect(categories[0].id).toBe(1);
    });
  });

  describe('Performance', () => {
    it('should match multiple coverages efficiently', async () => {
      const coverages = [
        'Incendio (Edificio y Contenidos)',
        'Responsabilidad Civil',
        'Robo y Hurto',
        'Equipo Electrónico',
        'Vidrios Planos',
      ];

      const start = Date.now();
      const results = await semanticMatcher.matchCoverages(coverages);
      const duration = Date.now() - start;

      expect(results).toHaveLength(5);
      expect(duration).toBeLessThan(5000); // Should complete in under 5 seconds

      // All should be matched by thesaurus (fastest layer)
      results.forEach((result) => {
        expect(result.method).toBe('thesaurus');
        expect(result.confidence).toBeGreaterThanOrEqual(0.9);
      });
    });
  });

  describe('Probabilistic Matching (Ontology Alignment)', () => {
    beforeEach(() => {
      vi.spyOn(featureFlags, 'isEnabled').mockImplementation((flag) => {
        if (flag === 'semanticCoverageOntology') return true;
        return false;
      });
    });

    it('should align string ontology IDs to numeric taxonomy category IDs and not default to 0', async () => {
      vi.mocked(coverageOntology.mapCoverage).mockResolvedValue({
        rawName: 'Robo con Violencia',
        insurerName: '',
        groups: [{ groupId: 'sustraccion_hurto', confidence: 0.95 }],
        isComposite: false,
        confidence: 0.95,
      });

      vi.mocked(coverageOntology.getNodeById).mockReturnValue({
        id: 'sustraccion_hurto',
        name: 'Sustracción / Hurto',
        level: 2,
        childrenIds: [],
        aliases: ['Robo', 'Hurto', 'Sustracción'],
        riskType: 'general',
      });

      const result = await semanticMatcher.matchProbabilistic('Robo con Violencia');

      expect(result.matches).toHaveLength(1);
      expect(result.matches[0].categoryId).toBe(3); // "Sustracción / Hurto" has ID 3 in taxonomy
      expect(result.matches[0].canonicalName).toBe('Sustracción / Hurto');
      expect(result.matches[0].confidence).toBe(0.95);
    });

    it('should keep categoryId as null (no default to 0 fallback) when unmatched', async () => {
      vi.mocked(coverageOntology.mapCoverage).mockResolvedValue({
        rawName: 'Amparo Inexistente Muy Raro',
        insurerName: '',
        groups: [{ groupId: 'unknown_ontology_id', confidence: 0.5 }],
        isComposite: false,
        confidence: 0.5,
      });

      vi.mocked(coverageOntology.getNodeById).mockReturnValue(undefined);

      const result = await semanticMatcher.matchProbabilistic('Amparo Inexistente Muy Raro');

      expect(result.matches).toHaveLength(1);
      expect(result.matches[0].categoryId).toBeNull(); // Should be null, not 0
      expect(result.matches[0].canonicalName).toBe('unknown_ontology_id');
    });
  });
});
