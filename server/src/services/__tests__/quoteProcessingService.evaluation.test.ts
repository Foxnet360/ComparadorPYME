import { describe, it, expect, vi, beforeEach } from 'vitest';
import path from 'path';
import { Readable } from 'stream';
import * as fs from 'fs/promises';
import { processQuoteMultimodal } from '../quoteProcessingService';
import { loadGoldenSet, PipelineRunner, PipelineOutput } from '../evaluationHarness';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockExtractTextFromPdf = vi.fn();
const mockExtractFromPdfWithVision = vi.fn();
const mockGraphQuery = vi.fn();
const mockFeatureFlags = { isEnabled: vi.fn(), getFlags: vi.fn(), updateFlag: vi.fn() };
const mockReconcileQuote = vi.fn();

vi.mock('../pdfExtractor', () => ({
  pdfExtractor: {
    extractTextFromPdf: (...args: unknown[]) => mockExtractTextFromPdf(...args),
  },
}));

vi.mock('../gemini', () => ({
  geminiService: {
    extractFromPdfWithVision: (...args: unknown[]) => mockExtractFromPdfWithVision(...args),
    extractDeductible: vi.fn(async () => ({
      components: [{ type: 'percentage', value: 10 }],
      isZero: false,
      hasMinimum: false,
      hasMaximum: false,
      isComposite: false,
    })),
  },
}));

vi.mock('../coverageGraphService', () => ({
  coverageGraphService: {
    query: (...args: unknown[]) => mockGraphQuery(...args),
    queryDeductible: vi.fn(async () => []),
  },
  createCoverageGraphService: vi.fn(() => ({
    query: (...args: unknown[]) => mockGraphQuery(...args),
    queryDeductible: vi.fn(async () => []),
  })),
}));

vi.mock('../../config/featureFlags', () => ({
  featureFlags: {
    isEnabled: (key: string) => mockFeatureFlags.isEnabled(key),
    getFlags: () => mockFeatureFlags.getFlags(),
    updateFlag: (key: string, value: boolean) => mockFeatureFlags.updateFlag(key, value),
  },
}));

vi.mock('../reconciliationService', () => ({
  reconciliationService: {
    reconcileQuote: (...args: unknown[]) => mockReconcileQuote(...args),
  },
}));

vi.mock('../vector/embeddingService', () => ({
  embeddingService: {
    generateEmbedding: vi.fn(async () =>
      Array(3072)
        .fill(0)
        .map((_, i) => i / 3072)
    ),
    generateEmbeddingsBatch: vi.fn(async (texts: string[]) => texts.map(() => Array(3072).fill(0))),
    cosineSimilarity: vi.fn(() => 0.95),
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMulterFile(originalname: string): Express.Multer.File {
  return {
    path: `/tmp/${originalname}`,
    originalname,
    mimetype: 'application/pdf',
    size: 12345,
    fieldname: 'quote',
    filename: originalname,
    destination: '/tmp',
    encoding: 'utf8',
    buffer: Buffer.from(''),
    stream: null as unknown as Readable,
  } as Express.Multer.File;
}

function buildSyntheticExtraction(
  fixture: import('../evaluationHarness').GoldenQuote
): Record<string, unknown> {
  return {
    insurerName: fixture.insurer,
    policyName: `${fixture.insurer} PYME Policy`,
    premium: {
      netPremium: 7000000,
      fees: 500000,
      taxes: 1000000,
      otherCharges: 0,
      totalPayable: 8500000,
      currency: 'COP',
      periodicity: 'anual',
    },
    currency: 'COP',
    validityPeriod: '2024-01-01 - 2024-12-31',
    coverages: fixture.expectedCoverages.map((c) => ({
      rawName: c.canonicalName,
      insuredAmount: c.insuredAmount
        ? `$${c.insuredAmount.toLocaleString('es-CO')}`
        : 'NO ESPECIFICADO',
      deductible: c.deductible || 'No aplica',
      premium: '$0',
      subLimits: [],
    })),
    rawCoverages: fixture.expectedCoverages.map((c) => ({
      rawName: c.canonicalName,
      insuredAmount: c.insuredAmount,
      deductible: c.deductible,
      premium: 0,
    })),
    insuredAssets: [],
    generalDeductibles: [],
    specialConditions: [],
    expectedCoverages: [],
    subLimits: [],
    exclusions: [],
    warranties: [],
  };
}

async function loadFirstFixtureOfInsurer(insurer: string) {
  const fixturesDir = path.resolve(
    __dirname,
    '..',
    '..',
    '..',
    '..',
    'tests',
    'fixtures',
    'golden-set'
  );
  const fixtures = await loadGoldenSet(fixturesDir, {
    readdir: (dir) => fs.readdir(dir),
    readFile: (filePath) => fs.readFile(filePath, 'utf8'),
  });
  const fixture = fixtures.find((f) => f.insurer === insurer);
  if (!fixture) throw new Error(`No fixture found for insurer ${insurer}`);
  return fixture;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('processQuoteMultimodal - golden-set integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFeatureFlags.isEnabled.mockImplementation((key: string) => {
      if (key === 'useTemplateGraphPipeline') return true;
      if (key === 'templateBbvaV1') return true;
      if (key === 'templateSbsV1') return true;
      if (key === 'templateMapfreV1') return true;
      if (key === 'graphLearningEnabled') return false;
      if (key === 'semanticCoverageOntology') return true;
      if (key === 'useLegacyCoverageMatcher') return false;
      return false;
    });
    mockFeatureFlags.getFlags.mockReturnValue({
      useTemplateGraphPipeline: true,
      semanticCoverageOntology: true,
      useLegacyCoverageMatcher: false,
    });
    mockGraphQuery.mockResolvedValue({ mappings: [], composite: false });
    mockReconcileQuote.mockResolvedValue([]);
  });

  it('routes a BBVA fixture through the template path and returns expected coverages', async () => {
    const fixture = await loadFirstFixtureOfInsurer('BBVA');
    mockExtractTextFromPdf.mockResolvedValue({
      text: fixture.pdfText,
      pageTextMap: { 1: fixture.pdfText },
      pageTextItems: fixture.pageTextItems,
      metadata: { pageCount: 1 },
    });
    mockExtractFromPdfWithVision.mockResolvedValue(buildSyntheticExtraction(fixture));

    const result = await processQuoteMultimodal(makeMulterFile(fixture.fileName), 0, 1, {
      domain: 'pyme',
    });

    expect(result.insurerName).toBe('BBVA');
    expect(result.coverages.length).toBeGreaterThan(0);
    for (const expected of fixture.expectedCoverages) {
      const found = result.coverages.find(
        (c) => c.canonicalName === expected.canonicalName || c.name === expected.canonicalName
      );
      expect(found).toBeDefined();
    }
    expect(mockExtractFromPdfWithVision).toHaveBeenCalled();
  });

  it('routes an SBS fixture through the template path and preserves deductibles', async () => {
    const fixture = await loadFirstFixtureOfInsurer('SBS');
    mockExtractTextFromPdf.mockResolvedValue({
      text: fixture.pdfText,
      pageTextMap: { 1: fixture.pdfText },
      pageTextItems: fixture.pageTextItems,
      metadata: { pageCount: 1 },
    });
    mockExtractFromPdfWithVision.mockResolvedValue(buildSyntheticExtraction(fixture));

    const result = await processQuoteMultimodal(makeMulterFile(fixture.fileName), 0, 1, {
      domain: 'pyme',
    });

    expect(result.insurerName).toBe('SBS');
    const firstExpected = fixture.expectedCoverages[0];
    const found = result.coverages.find(
      (c) =>
        c.canonicalName === firstExpected.canonicalName || c.name === firstExpected.canonicalName
    );
    expect(found).toBeDefined();
    expect(found?.deductible).toBe(firstExpected.deductible);
  });

  it('falls back to generic extraction for an unknown/mixed fixture', async () => {
    const fixturesDir = path.resolve(
      __dirname,
      '..',
      '..',
      '..',
      '..',
      'tests',
      'fixtures',
      'golden-set'
    );
    const fixtures = await loadGoldenSet(fixturesDir, {
      readdir: (dir) => fs.readdir(dir),
      readFile: (filePath) => fs.readFile(filePath, 'utf8'),
    });
    const fixture = fixtures.find((f) => f.templateId === null);
    if (!fixture) throw new Error('No mixed/unknown fixture found');

    mockExtractTextFromPdf.mockResolvedValue({
      text: fixture.pdfText,
      pageTextMap: { 1: fixture.pdfText },
      pageTextItems: fixture.pageTextItems || [],
      metadata: { pageCount: 1 },
    });
    mockExtractFromPdfWithVision.mockResolvedValue(buildSyntheticExtraction(fixture));

    const result = await processQuoteMultimodal(makeMulterFile(fixture.fileName), 0, 1, {
      domain: 'pyme',
    });

    expect(result.coverages.length).toBeGreaterThan(0);
    expect(mockExtractFromPdfWithVision).toHaveBeenCalled();
  });
});

describe('golden-set pipeline runner adapter', () => {
  it('can wrap processQuoteMultimodal into a PipelineRunner', async () => {
    const fixture = await loadFirstFixtureOfInsurer('MAPFRE');
    mockExtractTextFromPdf.mockResolvedValue({
      text: fixture.pdfText,
      pageTextMap: { 1: fixture.pdfText },
      pageTextItems: fixture.pageTextItems,
      metadata: { pageCount: 1 },
    });
    mockExtractFromPdfWithVision.mockResolvedValue(buildSyntheticExtraction(fixture));

    const runner: PipelineRunner = async (goldenFixture) => {
      const parsed = await processQuoteMultimodal(makeMulterFile(goldenFixture.fileName), 0, 1, {
        domain: 'pyme',
      });
      return {
        insurerName: parsed.insurerName,
        templateId: goldenFixture.templateId,
        coverages: parsed.coverages.map((c) => ({
          canonicalName: c.canonicalName || c.name,
          insuredAmount:
            c.value !== 'NO ESPECIFICADO' ? parseInt(c.value.replace(/\D/g, ''), 10) || 0 : 0,
          deductible: c.deductible,
          premium: 0,
        })),
        uncategorizedCoverages: (parsed.uncategorizedCoverages || []).map((c) => ({
          canonicalName: c.canonicalName || c.name,
          insuredAmount:
            c.value !== 'NO ESPECIFICADO' ? parseInt(c.value.replace(/\D/g, ''), 10) || 0 : 0,
          deductible: c.deductible,
        })),
        rawCoverageCount: parsed.coverages.length + (parsed.uncategorizedCoverages?.length || 0),
      } as PipelineOutput;
    };

    const output = await runner(fixture);

    expect(output.insurerName).toBe('MAPFRE');
    expect(output.coverages.length).toBeGreaterThan(0);
  });
});
