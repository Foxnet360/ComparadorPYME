import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildCanonicalCoverages } from '../coverageNormalizer';
import { featureFlags } from '../../config/featureFlags';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

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

vi.mock('../../config/database', () => {
  const mockSupabase = {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue({ data: [], error: null }),
    upsert: vi.fn().mockResolvedValue({ data: { id: 'mocked-id' }, error: null }),
    single: vi.fn().mockResolvedValue({ data: { id: 'mocked-id' }, error: null }),
  };
  return { supabase: mockSupabase };
});

vi.mock('@google/genai', () => {
  class MockGoogleGenAI {
    models = {
      generateContent: vi.fn().mockResolvedValue({
        text: JSON.stringify({
          proposedGroupId: 'incendio',
          justification: 'Mocked justification',
          approved: true,
          alternativeGroupId: null,
          reason: 'Mocked critic reason',
        }),
      }),
    };
  }
  return {
    Type: {
      STRING: 'string',
      NUMBER: 'number',
      ARRAY: 'array',
      OBJECT: 'object',
      BOOLEAN: 'boolean',
    },
    GoogleGenAI: MockGoogleGenAI,
  };
});

vi.mock('../vector/embeddingService', () => ({
  embeddingService: {
    generateEmbedding: vi.fn(async () => Array(3072).fill(0)),
    generateEmbeddingsBatch: vi.fn(async (texts: string[]) =>
      texts.map((text) => ({ text, embedding: Array(3072).fill(0) }))
    ),
    cosineSimilarity: vi.fn(() => 1.0),
  },
}));

vi.mock('../coverageGraphService', () => ({
  coverageGraphService: {
    query: vi.fn(async () => ({ mappings: [], composite: false })),
  },
}));

vi.mock('../../config/featureFlags', () => ({
  featureFlags: {
    isEnabled: vi.fn(),
    updateFlag: vi.fn(),
  },
}));

vi.mock('../semanticMatcher', () => ({
  semanticMatcher: {
    getAllCategories: vi.fn(() => [
      { id: 'incendio', name: 'Incendio (Edificio y Contenidos)' },
      { id: 'terremoto', name: 'Terremoto y Eventos Catastróficos' },
      { id: 'sustraccion', name: 'Sustracción / Hurto' },
      { id: 'hmacc', name: 'Huelga, Motín, Asonada (HMACC)' },
      { id: 'equipo-electronico', name: 'Equipo Eléctrico y Electrónico' },
      { id: 'rotura-maquinaria', name: 'Rotura de Maquinaria' },
      { id: 'rce', name: 'Responsabilidad Civil (RCE)' },
      { id: 'lucro-cesante', name: 'Lucro Cesante' },
      { id: 'vidrios', name: 'Vidrios Planos' },
      { id: 'manejo', name: 'Manejo Global / Infidelidad' },
      { id: 'transporte-mercancias', name: 'Transporte de Mercancías' },
      { id: 'transporte-valores', name: 'Transporte de Valores' },
      { id: 'asistencia-pyme', name: 'Asistencia PYME' },
      { id: 'asistencia-legal', name: 'Asistencia Legal' },
    ]),
    normalizeBatch: vi.fn(async (names: string[]) =>
      names.map(() => ({ canonicalName: null, confidence: 0, method: null }))
    ),
    matchCoverage: vi.fn(async () => ({ canonicalName: null, confidence: 0 })),
    getCategoryName: vi.fn((id: string | number) => String(id)),
  },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRawCoverage(rawName: string, overrides: Record<string, unknown> = {}) {
  return {
    rawName,
    rawTextSnippet: `text snippet for ${rawName}`,
    pageNumber: 1,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Regression tests
// ---------------------------------------------------------------------------

describe('coverageNormalizer insurer-aware regression', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(featureFlags.isEnabled).mockImplementation((flag: string) => {
      if (flag === 'semanticCoverageOntology') return true;
      if (flag === 'useLegacyCoverageMatcher') return false;
      if (flag === 'useTemplateGraphPipeline') return false;
      return false;
    });
  });

  it('SBS SECTIONS: AMPARO BASICO resolves to Incendio', async () => {
    const result = await buildCanonicalCoverages(
      [
        makeRawCoverage('AMPARO BASICO - TODO RIESGO DANO MATERIAL', {
          section: 'SECCION PRIMERA',
          insuredAmount: 119600000,
        }),
      ],
      [],
      [],
      {},
      'pyme',
      'SBS'
    );

    const incendio = result.canonicalCoverages.find(
      (c) => c.name === 'Incendio (Edificio y Contenidos)'
    );
    expect(incendio).toBeDefined();
    expect(incendio?.status).toBe('present');
    expect(incendio?.rawNames).toContain('AMPARO BASICO - TODO RIESGO DANO MATERIAL');
  });

  it('HDI TABLE-INTEGRATED: AMPARO BÁSICO resolves to Incendio', async () => {
    const result = await buildCanonicalCoverages(
      [
        makeRawCoverage('AMPARO BÁSICO TODO RIESGO DE PÉRDIDA O DAÑO MATERIAL', {
          insuredAmount: 50000000,
        }),
      ],
      [],
      [],
      {},
      'pyme',
      'HDI'
    );

    const incendio = result.canonicalCoverages.find(
      (c) => c.name === 'Incendio (Edificio y Contenidos)'
    );
    expect(incendio).toBeDefined();
    expect(incendio?.status).toBe('present');
    expect(incendio?.rawNames).toContain('AMPARO BÁSICO TODO RIESGO DE PÉRDIDA O DAÑO MATERIAL');
  });
});
