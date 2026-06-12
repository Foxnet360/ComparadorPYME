import { describe, it, expect, vi, beforeEach } from 'vitest';
import { coverageOntology, CoverageMapping } from '../coverageOntology';

// Mock environment variables so env.ts does not call process.exit
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

// Mock Supabase database calls
vi.mock('../../config/database', () => {
  const mockSupabase = {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue({ data: [], error: null }),
    upsert: vi.fn().mockResolvedValue({ data: { id: 'mocked-id' }, error: null }),
    single: vi.fn().mockResolvedValue({ data: { id: 'mocked-id' }, error: null })
  };
  return {
    supabase: mockSupabase
  };
});

// Mock GoogleGenAI class
vi.mock('@google/genai', () => {
  class MockGoogleGenAI {
    models = {
      generateContent: vi.fn().mockResolvedValue({
        text: JSON.stringify({
          proposedGroupId: 'incendio',
          justification: 'Mocked justification',
          approved: true,
          alternativeGroupId: null,
          reason: 'Mocked critic reason'
        })
      })
    };
  }
  return {
    GoogleGenAI: MockGoogleGenAI
  };
});

// Mock embedding service
vi.mock('../vector/embeddingService', () => {
  const generateEmbeddingMock = vi.fn((text: string) => {
    // Return deterministic mock embeddings based on text
    const mockEmbeddings: Record<string, number[]> = {
      'AMPARO BASICO': [0.9, 0.8, 0.7, 0.6],
      'TODO RIESGO': [0.85, 0.75, 0.65, 0.55],
      'DAÑO MATERIAL': [0.8, 0.7, 0.6, 0.5],
      'Incendio': [0.7, 0.6, 0.5, 0.4],
      'Edificios y Contenidos': [0.75, 0.65, 0.55, 0.45],
      'Equipos y Maquinaria': [0.6, 0.5, 0.4, 0.3],
      'Rotura de Maquinaria': [0.55, 0.45, 0.35, 0.25],
      'Responsabilidad Civil': [0.5, 0.4, 0.3, 0.2],
      'Terremoto': [0.4, 0.3, 0.2, 0.1]
    };
    return Promise.resolve(mockEmbeddings[text] || [0.1, 0.1, 0.1, 0.1]);
  });

  return {
    embeddingService: {
      generateEmbedding: generateEmbeddingMock,
      generateEmbeddingsBatch: vi.fn((texts: string[]) => {
        return Promise.resolve(texts.map(text => {
          const mockEmbeddings: Record<string, number[]> = {
            'AMPARO BASICO': [0.9, 0.8, 0.7, 0.6],
            'TODO RIESGO': [0.85, 0.75, 0.65, 0.55],
            'DAÑO MATERIAL': [0.8, 0.7, 0.6, 0.5],
            'Incendio': [0.7, 0.6, 0.5, 0.4],
            'Edificios y Contenidos': [0.75, 0.65, 0.55, 0.45],
            'Equipos y Maquinaria': [0.6, 0.5, 0.4, 0.3],
            'Rotura de Maquinaria': [0.55, 0.45, 0.35, 0.25],
            'Responsabilidad Civil': [0.5, 0.4, 0.3, 0.2],
            'Terremoto': [0.4, 0.3, 0.2, 0.1]
          };
          return {
            text,
            embedding: mockEmbeddings[text] || [0.1, 0.1, 0.1, 0.1]
          };
        }));
      }),
      cosineSimilarity: vi.fn((a: number[], b: number[]) => {
        // Simple dot product for testing
        let dot = 0;
        let normA = 0;
        let normB = 0;
        for (let i = 0; i < Math.min(a.length, b.length); i++) {
          dot += a[i] * b[i];
          normA += a[i] * a[i];
          normB += b[i] * b[i];
        }
        return dot / (Math.sqrt(normA) * Math.sqrt(normB) + 0.001);
      })
    }
  };
});

describe('coverageOntology', () => {
  describe('getNodes', () => {
    it('should return all ontology nodes', () => {
      const nodes = coverageOntology.getNodes();
      expect(nodes.length).toBeGreaterThan(0);
      expect(nodes.some(n => n.level === 1)).toBe(true);
      expect(nodes.some(n => n.level === 2)).toBe(true);
    });
  });

  describe('getNodeById', () => {
    it('should find node by ID', () => {
      const node = coverageOntology.getNodeById('patrimoniales');
      expect(node).toBeDefined();
      expect(node?.name).toBe('Patrimoniales');
    });

    it('should return undefined for unknown ID', () => {
      const node = coverageOntology.getNodeById('unknown');
      expect(node).toBeUndefined();
    });
  });

  describe('findNodesByName', () => {
    it('should find nodes by name or alias', () => {
      const nodes = coverageOntology.findNodesByName('Incendio');
      expect(nodes.length).toBeGreaterThan(0);
    });

    it('should return empty array for unknown term', () => {
      const nodes = coverageOntology.findNodesByName('xyz-unknown');
      expect(nodes).toHaveLength(0);
    });
  });

  describe('mapCoverage', () => {
    it('should detect composite coverages', async () => {
      const mapping = await coverageOntology.mapCoverage('TODO RIESGO AMPARO BASICO');
      
      expect(mapping.isComposite).toBe(true);
      expect(mapping.components).toBeDefined();
      expect(mapping.components?.length).toBeGreaterThan(0);
      expect(mapping.confidence).toBeGreaterThan(0.5);
    });

    it('should map simple coverage names', async () => {
      const mapping = await coverageOntology.mapCoverage('Incendio Edificio');
      
      expect(mapping.groups.length).toBeGreaterThan(0);
      expect(mapping.confidence).toBeGreaterThan(0);
    });

    it('should handle unknown coverage names', async () => {
      const mapping = await coverageOntology.mapCoverage('xyz-unknown-coverage');
      
      // Should still return a result, possibly with low confidence
      expect(mapping).toBeDefined();
      expect(mapping.rawName).toBe('xyz-unknown-coverage');
    });
  });

  describe('groupCoverages', () => {
    it('should group coverages by semantic similarity', async () => {
      const coverages = [
        { name: 'AMPARO BASICO', insurerName: 'MAPFRE' },
        { name: 'TODO RIESGO', insurerName: 'CHUBB' },
        { name: 'Responsabilidad Civil', insurerName: 'BBVA' }
      ];

      const groups = await coverageOntology.groupCoverages(coverages);
      
      expect(groups.length).toBeGreaterThan(0);
      // At least one group should have multiple coverages (AMPARO BASICO and TODO RIESGO are similar)
      expect(groups.some(g => g.coverages.length > 1)).toBe(true);
    });

    it('should handle empty input', async () => {
      const groups = await coverageOntology.groupCoverages([]);
      expect(groups).toHaveLength(0);
    });
  });

  describe('getTypicalDeductible', () => {
    it('should return typical deductible for known groups', () => {
      const ded = coverageOntology.getTypicalDeductible('incendio');
      expect(ded).toBeDefined();
    });

    it('should return undefined for unknown groups', () => {
      const ded = coverageOntology.getTypicalDeductible('unknown');
      expect(ded).toBeUndefined();
    });
  });

  describe('saveMapping', () => {
    it('should save mapping without errors', async () => {
      const mapping: CoverageMapping = {
        rawName: 'Test Coverage',
        insurerName: 'TEST',
        groups: [{ groupId: 'incendio', confidence: 0.9 }],
        isComposite: false,
        confidence: 0.9
      };

      // Should not throw
      await expect(coverageOntology.saveMapping(mapping)).resolves.not.toThrow();
    });
  });
});