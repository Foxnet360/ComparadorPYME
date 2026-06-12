import { describe, it, expect, vi, beforeEach } from 'vitest';
import { coverageOntology } from '../coverageOntology';
import { coverageGraphService } from '../coverageGraphService';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('../coverageGraphService', () => ({
  coverageGraphService: {
    query: vi.fn(),
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

vi.mock('../vector/embeddingService', () => ({
  embeddingService: {
    generateEmbedding: vi.fn(async () => Array(4).fill(0.1)),
    generateEmbeddingsBatch: vi.fn(async (texts: string[]) =>
      texts.map((text) => ({ text, embedding: Array(4).fill(0.1) }))
    ),
    cosineSimilarity: vi.fn(() => 0.5),
  },
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('coverageOntology graph delegation', () => {
  beforeEach(() => {
    vi.mocked(coverageGraphService.query).mockReset();
  });

  it('delegates to graph when local, DB, and composite patterns miss', async () => {
    vi.mocked(coverageGraphService.query).mockResolvedValue({
      mappings: [{ canonicalId: 'incendio', confidence: 0.85, provenance: 'learned' }],
      composite: false,
    });

    const mapping = await coverageOntology.mapCoverage('XyzzyGraphTest123', 'TEST', 'pyme');

    expect(coverageGraphService.query).toHaveBeenCalledWith('XyzzyGraphTest123', { insurer: 'TEST', domain: 'pyme' });
    expect(mapping.groups).toHaveLength(1);
    expect(mapping.groups[0].groupId).toBe('incendio');
    expect(mapping.groups[0].confidence).toBe(0.85);
    expect(mapping.confidence).toBe(0.85);
  });

  it('uses graph composite components when graph marks coverage as composite', async () => {
    vi.mocked(coverageGraphService.query).mockResolvedValue({
      mappings: [
        { canonicalId: 'incendio', confidence: 0.80, provenance: 'decomposes_to' },
        { canonicalId: 'terremoto', confidence: 0.75, provenance: 'decomposes_to' },
      ],
      composite: true,
      components: ['incendio', 'terremoto'],
    });

    const mapping = await coverageOntology.mapCoverage('CompositeGraphTest999', 'BBVA', 'pyme');

    expect(mapping.isComposite).toBe(true);
    expect(mapping.components).toEqual(['incendio', 'terremoto']);
    expect(mapping.groups).toHaveLength(2);
  });

  it('falls through to consensus when graph returns low-confidence mappings', async () => {
    vi.mocked(coverageGraphService.query).mockResolvedValue({
      mappings: [{ canonicalId: 'incendio', confidence: 0.45, provenance: 'alias' }],
      composite: false,
    });

    const mapping = await coverageOntology.mapCoverage('LowConfidenceGraphTest', 'TEST', 'pyme');

    expect(coverageGraphService.query).toHaveBeenCalled();
    expect(mapping.rawName).toBe('LowConfidenceGraphTest');
  });

  it('falls through to consensus when graph returns no mappings', async () => {
    vi.mocked(coverageGraphService.query).mockResolvedValue({ mappings: [], composite: false });

    const mapping = await coverageOntology.mapCoverage('NoGraphMatchTest', 'TEST', 'pyme');

    expect(coverageGraphService.query).toHaveBeenCalled();
    expect(mapping.rawName).toBe('NoGraphMatchTest');
  });

  it('passes insurer to graph query', async () => {
    vi.mocked(coverageGraphService.query).mockResolvedValue({ mappings: [], composite: false });

    await coverageOntology.mapCoverage('InsurerGraphTest', 'SBS', 'pyme');

    expect(coverageGraphService.query).toHaveBeenCalledWith('InsurerGraphTest', { insurer: 'SBS', domain: 'pyme' });
  });
});
