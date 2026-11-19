import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockExtractFromPdfWithVision = vi.fn();
const mockProcessQuoteLegacy = vi.fn();

vi.mock('../../server/src/config/env', () => ({
  env: {
    GEMINI_API_KEY: 'dummy',
    GEMINI_MODEL: 'gemini-3.8-flash',
    GEMINI_CHAT_MODEL: 'gemini-3.8-flash',
    GEMINI_FAST_MODEL: 'gemini-3.5-flash-lite',
    GEMINI_CLAUSE_MODEL: 'gemini-3.8-flash',
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

vi.mock('../../server/src/config/featureFlags', () => ({
  featureFlags: {
    isEnabled: (key: string) => key === 'enableMultimodalExtraction',
  },
}));

vi.mock('../../server/src/services/gemini', () => ({
  geminiService: {
    extractFromPdfWithVision: (...args: unknown[]) => mockExtractFromPdfWithVision(...args),
  },
}));

vi.mock('../../server/src/services/quoteProcessing/legacyPipeline', () => ({
  processQuoteLegacy: (...args: unknown[]) => mockProcessQuoteLegacy(...args),
}));

vi.mock('../../server/src/services/vector/embeddingService', () => ({
  embeddingService: {
    generateEmbedding: vi.fn(async () => Array(3072).fill(0)),
    cosineSimilarity: vi.fn(() => 1.0),
  },
}));

const { processQuoteMultimodal } =
  await import('../../server/src/services/quoteProcessing/multimodalPipeline');

function makeFile(): Express.Multer.File {
  return {
    fieldname: 'quotes',
    originalname: 'scanned-quote.pdf',
    encoding: '7bit',
    mimetype: 'application/pdf',
    size: 2048,
    destination: '/tmp',
    filename: 'scanned-quote.pdf',
    path: '/tmp/scanned-quote.pdf',
    buffer: Buffer.from(''),
  } as Express.Multer.File;
}

describe('processQuoteMultimodal scanned PDF fallback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('skips text-only legacy fallback when nativeText is empty and multimodal fails', async () => {
    mockExtractFromPdfWithVision.mockRejectedValue(new Error('503 Service Unavailable'));

    const result = await processQuoteMultimodal(makeFile(), 0, 1, {
      domain: 'hogar',
      nativeTextResult: {
        text: '',
        pageTextMap: {},
        metadata: { pageCount: 3 },
        isScanned: true,
      },
    });

    expect(mockExtractFromPdfWithVision).toHaveBeenCalledTimes(1);
    expect(mockProcessQuoteLegacy).not.toHaveBeenCalled();
    expect(result.isFailed).toBe(true);
    expect(result.errorCategory).toBe('SERVICE_UNAVAILABLE');
    expect(result.coverages).toEqual([]);
  });

  it('still falls back to legacy when nativeText is non-empty and multimodal returns no coverages', async () => {
    mockExtractFromPdfWithVision.mockResolvedValue({
      insurerName: 'SBS',
      rawCoverages: [],
    });
    mockProcessQuoteLegacy.mockResolvedValue({
      insurerName: 'SBS',
      policyName: 'Hogar',
      priceAnnual: 1200000,
      currency: 'COP',
      coverages: [
        {
          name: 'Incendio',
          canonicalName: 'Incendio',
          value: '$100.000.000',
          deductible: '10%',
          confidence: 90,
        },
      ],
      specialConditions: [],
      rawText: 'COTIZACION SBS',
      parseConfidence: 90,
    });

    const result = await processQuoteMultimodal(makeFile(), 0, 1, {
      domain: 'hogar',
      nativeTextResult: {
        text: 'COTIZACION SBS',
        pageTextMap: { 1: 'COTIZACION SBS' },
        metadata: { pageCount: 1 },
        isScanned: false,
      },
    });

    expect(mockProcessQuoteLegacy).toHaveBeenCalledTimes(1);
    expect(result.insurerName).toBe('SBS');
    expect(result.coverages).toHaveLength(1);
  });
});
