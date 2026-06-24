import { describe, it, expect, vi } from 'vitest';
import { validateDeductibleFormat, validateQuote } from '../../server/src/services/quoteValidator';
import { ParsedQuote } from '../../server/src/services/quoteParser';

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

function createMockQuote(overrides: Partial<ParsedQuote> = {}): ParsedQuote {
  return {
    insurerName: 'Test Insurer',
    policyName: 'Test Policy',
    priceAnnual: 5_000_000,
    currency: 'COP',
    coverages: [
      {
        name: 'Incendio (Edificio y Contenidos)',
        canonicalName: 'Incendio (Edificio y Contenidos)',
        value: '500000000',
        deductible: '10%',
        confidence: 95,
        categoryId: null,
        matchConfidence: 0,
        matchMethod: null,
      },
    ],
    specialConditions: [],
    rawText: '',
    parseConfidence: 95,
    ...overrides,
  };
}

describe('quoteValidator deductible structure validation', () => {
  it('accepts valid percentage deductible', () => {
    expect(validateDeductibleFormat('10%')).toBeNull();
  });

  it('accepts valid SMMLV deductible', () => {
    expect(validateDeductibleFormat('5 SMMLV')).toBeNull();
  });

  it('accepts valid compound deductible', () => {
    expect(validateDeductibleFormat('10% / mín. 2 SMMLV')).toBeNull();
  });

  it('accepts "No aplica" as zero deductible', () => {
    expect(validateDeductibleFormat('No aplica')).toBeNull();
  });

  it('flags high percentage deductibles', () => {
    const result = validateDeductibleFormat('60%');

    expect(result).not.toBeNull();
    expect(result?.code).toBe('DEDUCTIBLE_HIGH_PERCENTAGE');
  });

  it('flags unknown deductible formats', () => {
    const result = validateDeductibleFormat('cualquier cosa');

    expect(result).not.toBeNull();
    expect(result?.code).toBe('DEDUCTIBLE_UNRECOGNIZED_FORMAT');
    expect(result?.severity).toBe('INFO');
  });

  it('reports deductible flags per coverage inside validateQuote', () => {
    const quote = createMockQuote({
      coverages: [
        {
          name: 'Incendio (Edificio y Contenidos)',
          canonicalName: 'Incendio (Edificio y Contenidos)',
          value: '500000000',
          deductible: 'cualquier cosa',
          confidence: 95,
        },
      ],
    });

    const result = validateQuote(quote);
    const deductibleFlag = result.flags.find((f) => f.code === 'DEDUCTIBLE_UNRECOGNIZED_FORMAT');

    expect(deductibleFlag).toBeDefined();
    expect(deductibleFlag?.field).toBe('coverage.Incendio (Edificio y Contenidos).deductible');
  });

  it('accepts fixed-amount deductible with currency symbol', () => {
    expect(validateDeductibleFormat('$500.000')).toBeNull();
  });

  it('flags fixed-amount deductibles that look like plain small numbers', () => {
    // Plain "10" is not a recognizable deductible structure.
    const result = validateDeductibleFormat('10');

    expect(result).not.toBeNull();
    expect(result?.code).toBe('DEDUCTIBLE_UNRECOGNIZED_FORMAT');
  });
});
