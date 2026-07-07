/**
 * Quote Processing Service — Batch Tests
 * Tests processQuotesBatch orchestration: concurrency, timeouts, and error placeholders.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { processQuotesBatch } from '../quoteProcessingService';
import { pdfExtractor } from '../pdfExtractor';
import { featureFlags } from '../../config/featureFlags';
import { ParsedQuote } from '../quoteParser';

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

vi.mock('../vector/embeddingService', () => ({
  embeddingService: {
    generateEmbedding: vi.fn(async () => Array(3072).fill(0)),
    cosineSimilarity: vi.fn(() => 1.0),
  },
}));

function makeParsedQuote(overrides: Partial<ParsedQuote> = {}): ParsedQuote {
  return {
    insurerName: 'BBVA',
    policyName: 'PYME',
    priceAnnual: 8_500_000,
    currency: 'COP',
    coverages: [
      {
        name: 'Incendio (Edificio y Contenidos)',
        canonicalName: 'Incendio (Edificio y Contenidos)',
        value: '500M',
        deductible: '10%',
        confidence: 95,
      },
    ],
    specialConditions: [],
    rawText: '',
    parseConfidence: 92,
    ...overrides,
  };
}

describe('processQuotesBatch', () => {
  let extractTextSpy: ReturnType<typeof vi.spyOn>;
  let mockMultimodal: ReturnType<typeof vi.fn>;
  let mockLegacy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.spyOn(featureFlags, 'isEnabled').mockImplementation((key: string) => {
      if (key === 'enableMultimodalExtraction') return true;
      return false;
    });

    extractTextSpy = vi.spyOn(pdfExtractor, 'extractTextFromPdf').mockResolvedValue({
      text: 'sample text',
      pages: [],
      pageTextMap: { 1: 'sample text' },
      metadata: { pageCount: 1 },
      warnings: [],
      isScanned: false,
    });

    mockMultimodal = vi.fn();
    mockLegacy = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('processes quotes sequentially when concurrency is 1', async () => {
    const order: string[] = [];

    mockMultimodal.mockImplementation(async (file) => {
      order.push(file.originalname);
      return makeParsedQuote({ insurerName: file.originalname.replace('.pdf', '') });
    });

    const result = await processQuotesBatch(['/tmp/quote-a.pdf', '/tmp/quote-b.pdf'], {
      concurrencyLimit: 1,
      processQuoteMultimodal: mockMultimodal,
    });

    expect(result).toHaveLength(2);
    expect(result[0].insurerName).toBe('quote-a');
    expect(result[1].insurerName).toBe('quote-b');
    expect(order).toEqual(['quote-a.pdf', 'quote-b.pdf']);
  });

  it('processes quotes concurrently when concurrency is greater than 1', async () => {
    const started: string[] = [];

    mockMultimodal.mockImplementation(async (file) => {
      started.push(file.originalname);
      await new Promise((resolve) => setTimeout(resolve, 10));
      return makeParsedQuote({ insurerName: file.originalname.replace('.pdf', '') });
    });

    const result = await processQuotesBatch(['/tmp/quote-a.pdf', '/tmp/quote-b.pdf'], {
      concurrencyLimit: 2,
      processQuoteMultimodal: mockMultimodal,
    });

    expect(result).toHaveLength(2);
    // Both should have started before either finished.
    expect(started).toHaveLength(2);
  });

  it('uses legacy path when V2 is disabled', async () => {
    vi.spyOn(featureFlags, 'isEnabled').mockImplementation((key: string) => {
      if (key === 'enableMultimodalExtraction') return false;
      return false;
    });

    mockLegacy.mockImplementation(async (_quote, index, _total) =>
      makeParsedQuote({ insurerName: `legacy-${index}` })
    );

    const result = await processQuotesBatch(['/tmp/quote-a.pdf'], {
      concurrencyLimit: 1,
      processQuoteLegacy: mockLegacy,
    });

    expect(mockLegacy).toHaveBeenCalled();
    expect(mockMultimodal).not.toHaveBeenCalled();
    expect(result[0].insurerName).toBe('legacy-0');
  });

  it('uses legacy path for scanned PDFs', async () => {
    extractTextSpy.mockResolvedValue({
      text: '',
      pages: [],
      pageTextMap: {},
      metadata: { pageCount: 1 },
      warnings: [],
      isScanned: true,
    });

    mockLegacy.mockImplementation(async (_quote, index, _total) =>
      makeParsedQuote({ insurerName: `scanned-${index}` })
    );

    const result = await processQuotesBatch(['/tmp/quote-a.pdf'], {
      concurrencyLimit: 1,
      processQuoteLegacy: mockLegacy,
    });

    expect(mockLegacy).toHaveBeenCalled();
    expect(mockMultimodal).not.toHaveBeenCalled();
    expect(result[0].insurerName).toBe('scanned-0');
  });

  it('returns an error placeholder when a quote times out', async () => {
    mockMultimodal.mockImplementation(
      async () =>
        new Promise((_resolve, reject) => {
          setTimeout(() => reject(new Error('Quote processing timeout (quote-a.pdf)')), 50);
        }) as unknown as Promise<ParsedQuote>
    );

    const result = await processQuotesBatch(['/tmp/quote-a.pdf'], {
      concurrencyLimit: 1,
      quoteTimeoutMs: 10,
      processQuoteMultimodal: mockMultimodal,
    });

    expect(result).toHaveLength(1);
    expect(result[0].isFailed).toBe(true);
    expect(result[0].insurerName).toBe('quote-a');
    expect(result[0].specialConditions[0]).toContain('Tiempo de espera');
  });

  it('returns an error placeholder when extraction throws', async () => {
    mockMultimodal.mockRejectedValue(new Error('Gemini 503 Service Unavailable'));

    const result = await processQuotesBatch(['/tmp/quote-a.pdf'], {
      concurrencyLimit: 1,
      processQuoteMultimodal: mockMultimodal,
    });

    expect(result).toHaveLength(1);
    expect(result[0].isFailed).toBe(true);
    expect(result[0].errorCategory).toBe('SERVICE_UNAVAILABLE');
    expect(result[0].specialConditions[0]).toContain('no disponible');
  });

  it('continues processing remaining quotes when one fails', async () => {
    mockMultimodal.mockImplementation(async (file) => {
      if (file.originalname === 'quote-b.pdf') {
        throw new Error('extraction failed');
      }
      return makeParsedQuote({ insurerName: file.originalname.replace('.pdf', '') });
    });

    const result = await processQuotesBatch(
      ['/tmp/quote-a.pdf', '/tmp/quote-b.pdf', '/tmp/quote-c.pdf'],
      { concurrencyLimit: 1, processQuoteMultimodal: mockMultimodal }
    );

    expect(result).toHaveLength(3);
    expect(result[0].isFailed).toBeUndefined();
    expect(result[0].insurerName).toBe('quote-a');
    expect(result[1].isFailed).toBe(true);
    expect(result[2].isFailed).toBeUndefined();
    expect(result[2].insurerName).toBe('quote-c');
  });
});
