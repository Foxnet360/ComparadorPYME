import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { deductibleAnalyzer } from '../../server/src/services/deductibleAnalyzer';

vi.mock('../../server/src/config/env', () => ({
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

vi.mock('../../server/src/services/cache/redisCache', () => ({
  getCachedDeductibleV2: vi.fn().mockResolvedValue(null),
  setCachedDeductibleV2: vi.fn().mockResolvedValue(undefined),
  getCacheValue: vi.fn().mockResolvedValue(null),
  setCacheValue: vi.fn().mockResolvedValue(undefined),
  deleteCacheValue: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../server/src/services/gemini', () => ({
  geminiService: {
    extractDeductible: vi.fn().mockResolvedValue({
      components: [{ type: 'unknown', value: 0 }],
      isZero: false,
      hasMinimum: false,
      hasMaximum: false,
      isComposite: false,
    }),
  },
}));

describe('deductibleAnalyzer integration with canonical parser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('uses parser output for percentage deductibles', async () => {
    const result = await deductibleAnalyzer.analyze('Test', '10%', '10%', 500_000_000);

    expect(result.deductibleAmount).toBe(50_000_000);
    expect(result.deductibleRatio).toBe(0.1);
  });

  it('uses parser output for SMMLV deductibles', async () => {
    const result = await deductibleAnalyzer.analyze('RC', '5 SMMLV', '5 SMMLV', 100_000_000);

    expect(result.deductibleAmount).toBe(5 * 1_423_500);
  });

  it('applies cap from compound deductible structure', async () => {
    const result = await deductibleAnalyzer.analyze(
      'Test',
      '10%',
      '10% / Máx. 500 SMMLV',
      10_000_000_000
    );

    expect(result.hasCap).toBe(true);
    expect(result.capAmount).toBe(500 * 1_423_500);
    expect(result.deductibleAmount).toBeLessThanOrEqual(result.insuredAmount * 0.1);
  });

  it('handles compound greater_of deductible', async () => {
    const result = await deductibleAnalyzer.analyze(
      'Test',
      '10% y 5 SMMLV',
      '10% y 5 SMMLV',
      100_000_000
    );

    // 10% of 100M = 10M; 5 SMMLV = 7.1175M → greater_of yields 10M
    expect(result.deductibleAmount).toBe(10_000_000);
  });

  it('treats "No aplica" as zero deductible', async () => {
    const result = await deductibleAnalyzer.analyze('Test', 'No aplica', 'No aplica', 100_000_000);

    expect(result.deductibleAmount).toBe(0);
    expect(result.deductibleRatio).toBe(0);
  });
});
