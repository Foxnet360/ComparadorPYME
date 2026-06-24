import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import multer from 'multer';

const processQuoteMultimodal = vi.fn();
const processQuoteLegacy = vi.fn();
const isMultimodalEnabled = vi.fn(() => true);
const shouldUseV2 = vi.fn((_file, nativeTextResult) => {
  if (!isMultimodalEnabled()) return false;
  return !nativeTextResult.isScanned;
});

vi.mock('../../server/src/services/quoteProcessingService', () => ({
  processQuoteMultimodal: (...args: any[]) => processQuoteMultimodal(...args),
  processQuoteLegacy: (...args: any[]) => processQuoteLegacy(...args),
  createDefaultScoringResult: vi.fn(() => ({
    totalScore: 0,
    dataQualityScore: 0,
    verificationConfidence: 0,
    breakdown: {},
    weights: {},
    quotePriceRank: 0,
    marketPriceAverage: 0,
    coverageCount: 0,
    expectedCoverageCount: 0,
    criticalAlerts: 0,
    warningAlerts: 0,
    infoAlerts: 0,
  })),
  isMultimodalEnabled: () => isMultimodalEnabled(),
  shouldUseV2: (_file: any, nativeTextResult: any) => shouldUseV2(_file, nativeTextResult),
}));

vi.mock('../../server/src/services/pdfExtractor', () => ({
  pdfExtractor: {
    extractTextFromPdf: vi.fn(async () => ({
      text: 'Texto de prueba',
      pages: [{ pageNumber: 1, text: 'Texto de prueba', wordCount: 3, hasContent: true }],
      pageTextMap: { 1: 'Texto de prueba' },
      metadata: { pageCount: 1 },
      warnings: [],
      isScanned: false,
    })),
  },
}));

vi.mock('../../server/src/services/insurerProfileService', () => ({
  insurerProfileService: {
    detectInsurer: vi.fn(() => 'SBS'),
    getProfile: vi.fn(() => ({
      displayName: 'SBS Seguros',
      promptTemplate: '',
      fewShotExamples: [],
    })),
    getDisplayName: vi.fn(() => 'SBS Seguros'),
    getSupportedInsurers: vi.fn(() => ['SBS']),
  },
}));

vi.mock('../../server/src/services/quoteValidator', () => ({
  validateQuote: vi.fn(() => ({
    coverageCount: 1,
    expectedCoverageCount: 14,
    flags: [],
    isValid: true,
    numericParseSuccess: true,
  })),
}));

vi.mock('../../server/src/services/confidenceScorer', () => ({
  calculateConfidence: vi.fn(() => ({
    score: 95,
    needsReview: false,
    isCritical: false,
    breakdown: {},
  })),
}));

vi.mock('../../server/src/services/quoteScorer', () => ({
  quoteScorer: {
    calculateScore: vi.fn(() => ({
      totalScore: 85,
      breakdown: {},
      weights: {},
      quotePriceRank: 1,
      marketPriceAverage: 0,
      coverageCount: 1,
      expectedCoverageCount: 14,
      criticalAlerts: 0,
      warningAlerts: 0,
      infoAlerts: 0,
    })),
    getDefaultWeights: vi.fn(() => ({})),
  },
}));

vi.mock('../../server/src/services/narrativeService', () => ({
  narrativeService: {
    generateNarrative: vi.fn(async () => ({
      clientAnalysis: 'Test',
      technicalAnalysis: '',
      keyFindings: [],
    })),
  },
}));

vi.mock('../../server/src/services/ragRetrievalService', () => ({
  ragRetrievalService: {
    checkInsurerHasClauses: vi.fn(async () => false),
    search: vi.fn(async () => []),
  },
}));

vi.mock('../../server/src/services/crossReferenceEngine', () => ({
  crossReferenceEngine: {
    crossReferenceQuotesBatch: vi.fn(async () => new Map()),
  },
}));

vi.mock('../../server/src/services/deductibleAnalyzer', () => ({
  deductibleAnalyzer: {
    analyzeQuote: vi.fn(async () => []),
  },
}));

vi.mock('../../server/src/services/inverseCoverageChecker', () => ({
  inverseCoverageChecker: {
    checkMissingCoverages: vi.fn(async () => ({ results: [] })),
  },
}));

vi.mock('../../server/src/services/contextualRiskAnalyzer', () => ({
  contextualRiskAnalyzer: {
    contextualizeExclusions: vi.fn(() => ({ exclusions: [] })),
  },
}));

vi.mock('../../server/src/services/warrantyComplianceAnalyzer', () => ({
  warrantyComplianceAnalyzer: {
    analyzeConditions: vi.fn(() => ({ totalConditions: 0 })),
  },
}));

vi.mock('../../server/src/services/virtualLawyerService', () => ({
  virtualLawyerService: {
    generateOpinions: vi.fn(async () => []),
  },
}));

vi.mock('../../server/src/services/coverageValueValidator', () => ({
  validateCoverageValues: vi.fn(() => []),
}));

vi.mock('../../server/src/services/valueValidationService', () => ({
  validateCoverageValues: vi.fn(() => []),
}));

vi.mock('../../server/src/services/dualExtractionService', () => ({
  dualExtractionService: {
    validateCriticalCoverages: vi.fn(async () => []),
  },
}));

vi.mock('../../server/src/repositories/analysisRepository', () => ({
  saveAnalysisHistory: vi.fn(async () => null),
  getAnalysisHistoryByUser: vi.fn(async () => []),
}));

vi.mock('../../server/src/services/quoteBasedAuditor', () => ({
  default: {
    auditQuote: vi.fn(() => ({
      deductibleRisks: [],
      missingCoverages: [],
      specialConditions: [],
      negotiationPoints: [],
      competitiveAdvantages: [],
      overallRiskScore: 0,
      summary: '',
    })),
  },
}));

const { analysisController } = await import(
  '../../server/src/controllers/analysisController'
);
const { pdfExtractor } = await import('../../server/src/services/pdfExtractor');

const app = express();
app.use(express.json());
const upload = multer({ storage: multer.memoryStorage() });
app.post(
  '/api/analyze',
  upload.fields([{ name: 'quotes', maxCount: 10 }]),
  analysisController.uploadAndAnalyze
);

const makeParsedQuote = (overrides: any = {}): any => ({
  insurerName: 'SBS',
  policyName: 'PYME',
  priceAnnual: 5_000_000,
  currency: 'COP',
  coverages: [{ name: 'Incendio', value: '100M', deductible: '10%', canonicalName: 'Incendio' }],
  specialConditions: [],
  rawText: '',
  parseConfidence: 95,
  ...overrides,
});

describe('analysisController path selection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isMultimodalEnabled.mockReturnValue(true);
    processQuoteMultimodal.mockResolvedValue(makeParsedQuote());
    processQuoteLegacy.mockResolvedValue(makeParsedQuote());
  });

  it('uses V2 for non-scanned PDFs by default', async () => {
    (pdfExtractor.extractTextFromPdf as any).mockResolvedValue({
      text: 'Texto de prueba',
      pages: [{ pageNumber: 1, text: 'Texto de prueba', wordCount: 3, hasContent: true }],
      pageTextMap: { 1: 'Texto de prueba' },
      metadata: { pageCount: 1 },
      warnings: [],
      isScanned: false,
    });

    const response = await request(app)
      .post('/api/analyze')
      .attach('quotes', Buffer.from('test pdf content'), 'quote-sbs.pdf');

    expect(response.status).toBe(200);
    expect(processQuoteMultimodal).toHaveBeenCalledTimes(1);
    expect(processQuoteLegacy).not.toHaveBeenCalled();
  });

  it('uses legacy path for scanned PDFs', async () => {
    (pdfExtractor.extractTextFromPdf as any).mockResolvedValue({
      text: '',
      pages: [{ pageNumber: 1, text: '', wordCount: 0, hasContent: false }],
      pageTextMap: {},
      metadata: { pageCount: 1 },
      warnings: [],
      isScanned: true,
    });

    const response = await request(app)
      .post('/api/analyze')
      .attach('quotes', Buffer.from('scanned pdf content'), 'quote-scanned.pdf');

    expect(response.status).toBe(200);
    expect(processQuoteLegacy).toHaveBeenCalledTimes(1);
    expect(processQuoteMultimodal).not.toHaveBeenCalled();
  });

  it('falls back to legacy when V2 is disabled via feature flag', async () => {
    isMultimodalEnabled.mockReturnValue(false);
    (pdfExtractor.extractTextFromPdf as any).mockResolvedValue({
      text: 'Texto de prueba',
      pages: [{ pageNumber: 1, text: 'Texto de prueba', wordCount: 3, hasContent: true }],
      pageTextMap: { 1: 'Texto de prueba' },
      metadata: { pageCount: 1 },
      warnings: [],
      isScanned: false,
    });

    const response = await request(app)
      .post('/api/analyze')
      .attach('quotes', Buffer.from('test pdf content'), 'quote-sbs.pdf');

    expect(response.status).toBe(200);
    expect(processQuoteLegacy).toHaveBeenCalledTimes(1);
    expect(processQuoteMultimodal).not.toHaveBeenCalled();
  });
});
