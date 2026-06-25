import { describe, it, expect, vi, beforeEach } from 'vitest';

const extractFromPdfWithVision = vi.fn();
const extractTextFromPdf = vi.fn();
const buildCanonicalCoverages = vi.fn();
const extractPremiumBreakdown = vi.fn();
const extractPerCoveragePremiums = vi.fn();
const validatePremiumBreakdown = vi.fn(() => ({ warnings: [] }));

vi.mock('../../server/src/services/gemini', () => ({
  geminiService: {
    extractFromPdfWithVision: (...args: unknown[]) => extractFromPdfWithVision(...args),
    extractStructured: vi.fn(async () => ({
      insurerName: 'SBS',
      policyName: 'PYME',
      priceAnnual: 5_000_000,
      currency: 'COP',
      coverages: [{ name: 'Incendio', value: '100M', deductible: '10%' }],
    })),
  },
}));

vi.mock('../../server/src/services/pdfExtractor', () => ({
  pdfExtractor: {
    extractTextFromPdf: (...args: unknown[]) => extractTextFromPdf(...args),
  },
}));

vi.mock('../../server/src/services/coverageNormalizer', () => ({
  buildCanonicalCoverages: (...args: unknown[]) => buildCanonicalCoverages(...args),
}));

vi.mock('../../server/src/services/premiumExtractor', () => ({
  extractPremiumBreakdown: (...args: unknown[]) => extractPremiumBreakdown(...args),
  extractPerCoveragePremiums: (...args: unknown[]) => extractPerCoveragePremiums(...args),
  validatePremiumBreakdown: (...args: unknown[]) => validatePremiumBreakdown(...args),
  normalizeCurrency: vi.fn(() => 'COP'),
}));

vi.mock('../../server/src/services/deductibleResolver', () => ({
  getDeductibleFallback: vi.fn(() => 'NO ESPECIFICADO'),
}));

vi.mock('../../server/src/services/insurerProfileService', () => ({
  insurerProfileService: {
    detectInsurer: vi.fn(() => 'SBS'),
    getProfile: vi.fn(() => ({
      displayName: 'SBS Seguros',
      promptTemplate: '',
      fewShotExamples: [],
    })),
  },
}));

vi.mock('../../server/src/services/reconciliationService', () => ({
  reconciliationService: {
    reconcileQuote: vi.fn(async () => []),
  },
}));

vi.mock('../../server/src/services/templateRegistryService', () => ({
  templateRegistryService: {
    getTemplate: vi.fn(async () => undefined),
    validatePayload: vi.fn(() => ({ valid: true })),
  },
  PageTextItems: [],
}));

vi.mock('../../server/src/services/layoutParser', () => ({
  extractTables: vi.fn(() => ({ tables: [], regions: [], rotatedPages: [], failed: false })),
}));

vi.mock('../../server/src/config/featureFlags', () => ({
  featureFlags: {
    isEnabled: vi.fn(() => false),
  },
}));

vi.mock('../../server/src/utils/structuredLogger', () => ({
  createStructuredLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
  globalMetrics: {
    increment: vi.fn(),
  },
}));

const { processQuoteMultimodal } = await import(
  '../../server/src/services/quoteProcessingService'
);
const { createExtractionMetricsEmitter } = await import(
  '../../server/src/services/extractionMetrics'
);

describe('processQuoteMultimodal metrics and formatFamily', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    extractTextFromPdf.mockResolvedValue({
      text: 'COTIZACION SBS PYME Integral AMPAROS BASICOS DEDUCIBLES QUE APLICAN',
      pages: [{ pageNumber: 1, text: 'COTIZACION SBS PYME Integral AMPAROS BASICOS DEDUCIBLES QUE APLICAN', wordCount: 4, hasContent: true }],
      pageTextMap: { 1: 'COTIZACION SBS PYME Integral AMPAROS BASICOS DEDUCIBLES QUE APLICAN' },
      metadata: { pageCount: 1 },
      warnings: [],
      isScanned: false,
    });

    extractFromPdfWithVision.mockResolvedValue({
      insurerName: 'SBS',
      policyName: 'PYME Integral',
      formatFamily: 'TABLE-DOUBLE',
      premium: { totalPayable: 5_000_000, currency: 'COP' },
      rawCoverages: [
        {
          rawName: 'Incendio',
          rawTextSnippet: 'Incendio y Riesgos Aliados con suma asegurada de 100 millones',
          pageNumber: 1,
          insuredAmount: 100_000_000,
          deductible: '10%',
        },
      ],
    });

    buildCanonicalCoverages.mockResolvedValue({
      canonicalCoverages: [
        {
          name: 'Incendio (Edificio y Contenidos)',
          insuredAmount: 100_000_000,
          deductible: '10%',
          confidence: 95,
          status: 'present',
          rawTextSnippet: 'Incendio y Riesgos Aliados con suma asegurada de 100 millones',
          pageNumber: 1,
        },
      ],
      uncategorizedCoverages: [],
      totalConfidence: 95,
      needsReview: false,
      generalDeductibles: [],
    });

    extractPremiumBreakdown.mockReturnValue({
      netPremium: 4_000_000,
      fees: 0,
      taxes: 1_000_000,
      otherCharges: 0,
      totalPayable: 5_000_000,
      currency: 'COP',
      periodicity: 'ANUAL',
    });

    extractPerCoveragePremiums.mockReturnValue([]);
  });

  it('propagates formatFamily into metrics and parsed quote', async () => {
    const metrics = createExtractionMetricsEmitter();
    const file = { path: '/tmp/quote.pdf', originalname: 'quote-sbs.pdf' } as unknown as Express.Multer.File;

    const parsed = await processQuoteMultimodal(file, 0, 1, {
      domain: 'pyme',
      quoteId: 'quote-1',
      metrics,
    });

    expect(parsed.insurerName).toBe('SBS');

    const snapshot = metrics.snapshot();
    expect(snapshot).toHaveLength(1);
    expect(snapshot[0].formatFamily).toBe('TABLE-DOUBLE');
    expect(snapshot[0].path).toBe('v2');
    expect(snapshot[0].result).toBe('success');
    expect(snapshot[0].quoteId).toBe('quote-1');
  });

  it('emits repair metric when JSON repair is used', async () => {
    extractFromPdfWithVision.mockImplementation(async (_path, _prompt, _name, _text, options: { onRepairUsed?: (reason: string) => void }) => {
      if (options?.onRepairUsed) {
        options.onRepairUsed('trailing_comma');
      }
      return {
        insurerName: 'SBS',
        policyName: 'PYME Integral',
        formatFamily: 'TABLE-DOUBLE',
        premium: { totalPayable: 5_000_000, currency: 'COP' },
        rawCoverages: [
          {
            rawName: 'Incendio',
            rawTextSnippet: 'Incendio y Riesgos Aliados con suma asegurada de 100 millones',
            pageNumber: 1,
            insuredAmount: 100_000_000,
            deductible: '10%',
          },
        ],
      };
    });

    const metrics = createExtractionMetricsEmitter();
    const file = { path: '/tmp/quote.pdf', originalname: 'quote-sbs.pdf' } as unknown as Express.Multer.File;

    await processQuoteMultimodal(file, 0, 1, {
      domain: 'pyme',
      quoteId: 'quote-repair',
      metrics,
    });

    const snapshot = metrics.snapshot();
    expect(snapshot[0].result).toBe('success_after_repair');
    expect(snapshot[0].repairAttempts).toBe(1);
  });

  it('falls back to legacy and emits extraction.v2.legacy_fallback on V2 failure', async () => {
    extractFromPdfWithVision.mockRejectedValue(new Error('Gemini service unavailable (503)'));

    const metrics = createExtractionMetricsEmitter();
    const file = { path: '/tmp/quote.pdf', originalname: 'quote-sbs.pdf' } as unknown as Express.Multer.File;

    const parsed = await processQuoteMultimodal(file, 0, 1, {
      domain: 'pyme',
      quoteId: 'quote-fallback',
      metrics,
    });

    expect(parsed.insurerName).toBe('SBS');

    const snapshot = metrics.snapshot();
    expect(snapshot[0].result).toBe('legacy_fallback');
    expect(snapshot[0].path).toBe('legacy');
    expect(snapshot[0].legacyFallback).toBe(true);
  });
});
