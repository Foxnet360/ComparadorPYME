import { describe, it, expect, vi, beforeEach } from 'vitest';
import { learningEngine, UserCorrection } from '../learningEngine';

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

const mockFrom = vi.fn();
const mockUpsert = vi.fn();
const mockSelect = vi.fn();

vi.mock('../../config/database', () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

mockFrom.mockReturnValue({
  upsert: (...args: unknown[]) => mockUpsert(...args),
  select: (...args: unknown[]) => mockSelect(...args),
});

mockUpsert.mockReturnValue({
  select: () => ({ single: () => Promise.resolve({ data: { id: 'corr-1' }, error: null }) }),
});

vi.mock('../vector/embeddingService', () => ({
  embeddingService: {
    generateEmbedding: vi.fn().mockResolvedValue([0.1, 0.2, 0.3]),
    cosineSimilarity: vi.fn().mockReturnValue(0.9),
  },
}));

vi.mock('../cache/redisCache', () => ({
  getCacheValue: vi.fn().mockResolvedValue(null),
  setCacheValue: vi.fn().mockResolvedValue(undefined),
  deleteCacheValue: vi.fn().mockResolvedValue(undefined),
  getCacheKeys: vi.fn().mockResolvedValue([]),
}));

const mockLearnCorrection = vi.fn();
const mockAddEdge = vi.fn();

vi.mock('../coverageGraphService', () => ({
  coverageGraphService: {
    learnCorrection: (...args: unknown[]) => mockLearnCorrection(...args),
    addEdge: (...args: unknown[]) => mockAddEdge(...args),
  },
}));

const mockIsEnabled = vi.fn();

vi.mock('../../config/featureFlags', () => ({
  featureFlags: {
    isEnabled: (flag: string) => mockIsEnabled(flag),
  },
}));

// Mock coverageOntology to avoid side effects
vi.mock('../coverageOntology', () => ({
  default: {
    saveMapping: vi.fn().mockResolvedValue(undefined),
  },
}));

describe('learningEngine graph integration', () => {
  beforeEach(() => {
    mockLearnCorrection.mockReset().mockResolvedValue(undefined);
    mockAddEdge.mockReset().mockResolvedValue(undefined);
    mockIsEnabled.mockReset().mockImplementation((flag: string) => flag === 'graphLearningEnabled');
  });

  it('writes learned graph edge for coverage_mapping correction', async () => {
    const correction: UserCorrection = {
      rawName: 'AMPARO BASICO XYZ',
      insurerName: 'SBS',
      systemMapping: 'incendio',
      userCorrection: 'incendio',
      correctionType: 'coverage_mapping',
    };

    await learningEngine.applyCorrection(correction);

    expect(mockLearnCorrection).toHaveBeenCalledWith(
      'amparo basico xyz',
      'incendio',
      'SBS',
      'pyme'
    );
    expect(mockAddEdge).not.toHaveBeenCalled();
  });

  it('writes deductible_for graph edge for deductible correction', async () => {
    const correction: UserCorrection = {
      rawName: '10% con minimo de 5 SMMLV',
      insurerName: 'BBVA',
      systemMapping: 'incendio',
      userCorrection: 'incendio',
      correctionType: 'deductible',
    };

    await learningEngine.applyCorrection(correction);

    expect(mockAddEdge).toHaveBeenCalledWith(
      expect.objectContaining({
        from: '10 con minimo de 5 smmlv',
        to: 'incendio',
        type: 'deductible_for',
        weight: 0.9,
        insurer: 'BBVA',
        domain: 'pyme',
      })
    );
    expect(mockLearnCorrection).not.toHaveBeenCalled();
  });

  it('writes excludes graph edge for exclusion correction', async () => {
    const correction: UserCorrection = {
      rawName: 'dano moral',
      insurerName: 'MAPFRE',
      systemMapping: 'rce',
      userCorrection: 'rce',
      correctionType: 'exclusion',
    };

    await learningEngine.applyCorrection(correction);

    expect(mockAddEdge).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'dano moral',
        to: 'rce',
        type: 'excludes',
        weight: 0.9,
        insurer: 'MAPFRE',
        domain: 'pyme',
      })
    );
  });

  it('writes learned graph edge for coverage_mapping correction when graphLearningEnabled is true', async () => {
    mockIsEnabled.mockImplementation((flag: string) => flag === 'graphLearningEnabled');

    const correction: UserCorrection = {
      rawName: 'AMPARO BASICO XYZ',
      insurerName: 'SBS',
      systemMapping: 'incendio',
      userCorrection: 'incendio',
      correctionType: 'coverage_mapping',
    };

    await learningEngine.applyCorrection(correction);

    expect(mockLearnCorrection).toHaveBeenCalledWith(
      'amparo basico xyz',
      'incendio',
      'SBS',
      'pyme'
    );
    expect(mockAddEdge).not.toHaveBeenCalled();
  });

  it('skips graph learning for coverage_mapping correction when graphLearningEnabled is false', async () => {
    mockIsEnabled.mockImplementation((flag: string) => flag !== 'graphLearningEnabled');

    const correction: UserCorrection = {
      rawName: 'AMPARO BASICO XYZ',
      insurerName: 'SBS',
      systemMapping: 'incendio',
      userCorrection: 'incendio',
      correctionType: 'coverage_mapping',
    };

    await learningEngine.applyCorrection(correction);

    expect(mockLearnCorrection).not.toHaveBeenCalled();
    expect(mockAddEdge).not.toHaveBeenCalled();
  });

  it('skips graph update for value corrections', async () => {
    const correction: UserCorrection = {
      rawName: 'some value',
      insurerName: 'SBS',
      systemMapping: '1000000',
      userCorrection: '2000000',
      correctionType: 'value',
    };

    await learningEngine.applyCorrection(correction);

    expect(mockLearnCorrection).not.toHaveBeenCalled();
    expect(mockAddEdge).not.toHaveBeenCalled();
  });

  it('normalizes raw names before writing graph edges', async () => {
    const correction: UserCorrection = {
      rawName: '  AMPARO   BÁSICO  ',
      insurerName: 'SBS',
      systemMapping: 'incendio',
      userCorrection: 'incendio',
      correctionType: 'coverage_mapping',
    };

    await learningEngine.applyCorrection(correction);

    expect(mockLearnCorrection).toHaveBeenCalledWith('amparo basico', 'incendio', 'SBS', 'pyme');
  });
});
