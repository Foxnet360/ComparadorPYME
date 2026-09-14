import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import multer from 'multer';
import { analysisController } from '../../controllers/analysisController';
import { comparisonEngineAdapter } from '../../services/unifiedComparison/comparisonEngineAdapter';
import { AuthenticatedRequest } from '../../middleware/auth';

vi.mock('../../services/unifiedComparison/comparisonEngineAdapter', () => ({
  comparisonEngineAdapter: {
    generateComparison: vi.fn(async () => ({
      matrix: [
        {
          type: 'header',
          id: 'client_info',
          label: 'Cotizaciones PYME - Seguros Bolívar',
          sectionId: 0,
          cells: [{ value: '', isExcluded: false, isWinner: false }],
        },
        {
          type: 'header',
          id: 'section_0',
          label: 'INFORMACIÓN GENERAL',
          sectionId: 1,
          cells: [{ value: '', isExcluded: false, isWinner: false }],
        },
        {
          type: 'data',
          id: 'section_0_row_0',
          label: 'Responsabilidad Civil',
          sectionId: 1,
          cells: [
            { value: '100M', isExcluded: false, isWinner: false, notes: '5 SMMLV', confidence: 95 },
          ],
        },
        {
          type: 'header',
          id: 'financials',
          label: 'PRIMAS Y COSTOS',
          sectionId: 999,
          cells: [{ value: '', isExcluded: false, isWinner: false }],
        },
        {
          type: 'data',
          id: 'premium_total',
          label: 'TOTAL A PAGAR',
          sectionId: 999,
          cells: [{ value: '$8.500.000', isExcluded: false, isWinner: false }],
        },
      ],
      engine: 'unified',
      correlationId: 'test-correlation-id',
    })),
  },
}));

// Mock all services
vi.mock('../../services/gemini', () => ({
  geminiService: {
    extractText: vi.fn(async () =>
      JSON.stringify({
        quotes: [
          {
            insurerName: 'Seguros Bolívar',
            policyName: 'Empresarial Plus',
            priceAnnual: 8500000,
            currency: 'COP',
            coverages: [{ name: 'Responsabilidad Civil', value: '100M', deductible: '5 SMMLV' }],
            specialConditions: [],
            parseConfidence: 95,
          },
        ],
      })
    ),
    extractStructured: vi.fn(async () => ({
      quotes: [
        {
          insurerName: 'Seguros Bolívar',
          policyName: 'Empresarial Plus',
          priceAnnual: 8500000,
          currency: 'COP',
          coverages: [{ name: 'Responsabilidad Civil', value: '100M', deductible: '5 SMMLV' }],
          specialConditions: [],
          parseConfidence: 95,
        },
      ],
    })),
    extractFromPdfWithVision: vi.fn(async () => ({
      quotes: [
        {
          insurerName: 'Seguros Bolívar',
          policyName: 'Empresarial Plus',
          priceAnnual: 8500000,
          currency: 'COP',
          coverages: [{ name: 'Responsabilidad Civil', value: '100M', deductible: '5 SMMLV' }],
          specialConditions: [],
          parseConfidence: 95,
        },
      ],
    })),
    analyzeWithGemini: vi.fn(async () => 'Análisis de prueba'),
    generateNarrative: vi.fn(async () => ({
      clientAnalysis: 'Test analysis',
      technicalAnalysis: 'Test technical',
      keyFindings: ['Finding 1'],
    })),
  },
}));

vi.mock('../../services/pdfExtractor', () => ({
  pdfExtractor: {
    extractText: vi.fn(async () => 'Texto de prueba'),
    processMultiplePdfs: vi.fn(async () => ['Texto de prueba']),
    extractTextFromPdf: vi.fn(async () => ({
      text: 'Texto de prueba',
      pages: [{ number: 1, text: 'Texto de prueba' }],
      metadata: {},
      warnings: [],
      isScanned: false,
    })),
  },
}));

vi.mock('../../services/clauseCoverageValidator', () => ({
  clauseCoverageValidator: {
    validate: vi.fn(async () => ({
      results: [{ coverageName: 'Incendio', status: 'VERIFIED' }],
      phantomCount: 0,
      mandatoryMissingCount: 0,
      scoreImpact: 0,
      hasClauseDocument: true,
      verifiedCount: 2,
      optionalMissingCount: 0,
    })),
  },
}));

vi.mock('../../services/deductibleAnalyzer', () => ({
  deductibleAnalyzer: {
    analyzeQuote: vi.fn(async () => [{ coverage: 'Incendio', level: 'LOW', riskScore: 65 }]),
  },
}));

vi.mock('../../services/inverseCoverageChecker', () => ({
  inverseCoverageChecker: {
    checkMissingCoverages: vi.fn(async () => ({
      results: [],
      mandatoryMissingCount: 0,
      optionalMissingCount: 0,
    })),
  },
}));

vi.mock('../../services/contextualRiskAnalyzer', () => ({
  contextualRiskAnalyzer: {
    contextualizeExclusions: vi.fn(() => ({
      exclusions: [{ contextualRiskLevel: 'CRITICAL' }],
      criticalCount: 1,
    })),
  },
}));

vi.mock('../../services/warrantyComplianceAnalyzer', () => ({
  warrantyComplianceAnalyzer: {
    analyzeConditions: vi.fn(() => ({
      totalConditions: 2,
      overallRisk: 'MEDIUM',
      compliancePercentage: 60,
    })),
  },
}));

vi.mock('../../services/virtualLawyerService', () => ({
  virtualLawyerService: {
    generateLegalOpinion: vi.fn(async () => ({
      coverageName: 'RC',
      confidence: 80,
      negotiationPoints: [{ point: 'Test', priority: 'HIGH' }],
    })),
  },
}));

vi.mock('../../services/narrativeService', () => ({
  narrativeService: {
    generateNarrative: vi.fn(async () => ({
      clientAnalysis: 'Test client analysis',
      technicalAnalysis: 'Test technical',
      keyFindings: ['Finding 1'],
    })),
    generateComparisonNarrative: vi.fn(async () => 'Test comparison narrative'),
  },
}));

vi.mock('../../services/quoteValidator', () => ({
  validateQuote: vi.fn(() => ({
    coverageCount: 1,
    expectedCoverageCount: 1,
    flags: [],
    isValid: true,
  })),
}));

vi.mock('../../services/confidenceScorer', () => ({
  calculateConfidence: vi.fn(() => ({
    score: 95,
    needsReview: false,
    isCritical: false,
    breakdown: {},
  })),
}));

vi.mock('../../services/quoteScorer', () => ({
  quoteScorer: {
    calculateScore: vi.fn(() => ({
      totalScore: 85,
      breakdown: {
        coverage: 90,
        deductibles: 80,
        exclusions: 85,
        priceRatio: 75,
        sublimits: 80,
        warranties: 70,
      },
      weights: {},
      quotePriceRank: 1,
      marketPriceAverage: 8500000,
      coverageCount: 1,
      expectedCoverageCount: 1,
      criticalAlerts: 0,
      warningAlerts: 0,
      infoAlerts: 0,
    })),
    getDefaultWeights: vi.fn(() => ({})),
  },
}));

vi.mock('../../services/crossReferenceEngine', () => ({
  crossReferenceEngine: {
    crossReferenceQuote: vi.fn(async () => [
      {
        coverageName: 'Responsabilidad Civil',
        quoteData: { value: '100M', deductible: '5 SMMLV' },
        clauseData: { deductible: '5 SMMLV', exclusions: [] },
        alerts: [],
        isVerified: true,
      },
    ]),
    crossReferenceQuotesBatch: vi.fn(async () => {
      const results = new Map();
      results.set(0, [
        {
          coverageName: 'Responsabilidad Civil',
          quoteData: { value: '100M', deductible: '5 SMMLV' },
          clauseData: { deductible: '5 SMMLV', exclusions: [] },
          alerts: [],
          isVerified: true,
        },
      ]);
      return results;
    }),
  },
}));

vi.mock('../../services/quoteParser', () => ({
  quoteParser: {
    parse: vi.fn(() => ({
      insurerName: 'Seguros Bolívar',
      policyName: 'Empresarial Plus',
      priceAnnual: 8500000,
      currency: 'COP',
      coverages: [
        {
          name: 'Responsabilidad Civil',
          value: '100M',
          deductible: '5 SMMLV',
          confidence: 90,
          categoryId: 6,
          matchConfidence: 1.0,
          matchMethod: 'thesaurus',
        },
      ],
      specialConditions: [],
      rawText: '',
      parseConfidence: 95,
    })),
  },
}));

vi.mock('../../services/thesaurusMapper', () => ({
  normalizeCoverages: vi.fn((coverages) => coverages),
}));

vi.mock('../../services/ragRetrievalService', () => ({
  ragRetrievalService: {
    checkInsurerHasClauses: vi.fn(async () => true),
    search: vi.fn(async () => []),
  },
}));

vi.mock('../../config/database', () => {
  const makeChain = (val) => {
    const chain = {
      select: vi.fn(() => chain),
      insert: vi.fn(() => chain),
      update: vi.fn(() => chain),
      eq: vi.fn(() => chain),
      neq: vi.fn(() => chain),
      gt: vi.fn(() => chain),
      lt: vi.fn(() => chain),
      gte: vi.fn(() => chain),
      lte: vi.fn(() => chain),
      in: vi.fn(() => chain),
      like: vi.fn(() => chain),
      ilike: vi.fn(() => chain),
      order: vi.fn(() => chain),
      limit: vi.fn(() => chain),
      single: vi.fn(() => Promise.resolve({ data: val, error: null })),
      then: vi.fn((resolve) => resolve({ data: Array.isArray(val) ? val : [val], error: null })),
      catch: vi.fn(),
    };
    return chain;
  };

  const mockSupabase = {
    from: vi.fn(() => makeChain([])),
    rpc: vi.fn(() => Promise.resolve({ data: [], error: null })),
  };

  return {
    supabase: mockSupabase,
  };
});

// Create test app with file upload support
const app = express();
app.use(express.json());

// Mock auth middleware for testing
app.use((req, res, next) => {
  (req as AuthenticatedRequest).user = { id: 'test-user-123' };
  next();
});

const upload = multer({ storage: multer.memoryStorage() });
app.post(
  '/api/analyze',
  upload.fields([
    { name: 'quotes', maxCount: 10 },
    { name: 'clauses', maxCount: 10 },
  ]),
  analysisController.uploadAndAnalyze
);

describe('Backward Compatibility', () => {
  it('should return 200 with all expected fields for old clients', async () => {
    const response = await request(app)
      .post('/api/analyze')
      .field('clientData', JSON.stringify({}))
      .attach('quotes', Buffer.from('test pdf content'), 'quote1.pdf');

    expect(response.status).toBe(200);

    // Core fields that old clients expect
    expect(response.body).toHaveProperty('quotes');
    expect(response.body).toHaveProperty('recommendation');
    expect(response.body).toHaveProperty('marketAnalysis');
    expect(response.body).toHaveProperty('timestamp');
    expect(response.body).toHaveProperty('analysisVersion');

    // Each quote should have basic fields
    const firstQuote = response.body.quotes[0];
    expect(firstQuote).toHaveProperty('insurerName');
    expect(firstQuote).toHaveProperty('score');
    expect(firstQuote).toHaveProperty('coverages');
    expect(firstQuote).toHaveProperty('alerts');
    expect(firstQuote).toHaveProperty('crossReferenceSummary');
  });

  it('should include new fields without breaking old clients', async () => {
    const response = await request(app)
      .post('/api/analyze')
      .field('clientData', JSON.stringify({}))
      .attach('quotes', Buffer.from('test pdf content'), 'quote1.pdf');

    expect(response.status).toBe(200);

    const firstQuote = response.body.quotes[0];

    // New fields should be present (optional)
    expect(firstQuote).toHaveProperty('clauseValidation');
    expect(firstQuote).toHaveProperty('deductibleAnalysis');
    expect(firstQuote).toHaveProperty('contextualRisk');
    expect(firstQuote).toHaveProperty('warrantyCompliance');
    expect(firstQuote).toHaveProperty('legalOpinion');

    // Old clients can safely ignore these fields
    // They won't cause parsing errors since they're optional
  });

  it('should maintain same response structure when feature is disabled', async () => {
    // Even with advanced analysis data, the structure should be consistent
    const response = await request(app)
      .post('/api/analyze')
      .field('clientData', JSON.stringify({}))
      .attach('quotes', Buffer.from('test pdf content'), 'quote1.pdf');

    expect(response.status).toBe(200);

    // Response should always have these top-level fields
    const requiredFields = [
      'quotes',
      'recommendation',
      'marketAnalysis',
      'timestamp',
      'analysisVersion',
    ];
    requiredFields.forEach((field) => {
      expect(response.body).toHaveProperty(field);
    });
  });

  it('should handle quotes array consistently', async () => {
    const response = await request(app)
      .post('/api/analyze')
      .field('clientData', JSON.stringify({}))
      .attach('quotes', Buffer.from('test pdf content'), 'quote1.pdf');

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body.quotes)).toBe(true);
    expect(response.body.quotes.length).toBeGreaterThan(0);

    // Each quote should have consistent structure
    response.body.quotes.forEach((quote: Record<string, unknown>) => {
      expect(quote).toHaveProperty('insurerName');
      expect(quote).toHaveProperty('priceAnnual');
      expect(quote).toHaveProperty('coverages');
      expect(Array.isArray(quote.coverages)).toBe(true);
    });
  });

  it('treats an omitted analysis_type as new mode (NULL semantics, R5.1/R5.4/XC-3)', async () => {
    const adapterMock = vi.mocked(comparisonEngineAdapter.generateComparison);
    adapterMock.mockClear();

    const response = await request(app)
      .post('/api/analyze')
      .field('clientData', JSON.stringify({}))
      .attach('quotes', Buffer.from('test pdf content'), 'quote1.pdf');

    expect(response.status).toBe(200);

    // The adapter is called without an analysisType: the engine resolves it
    // as 'new' (R5.4 NULL semantics) and never emits schemaVersion 3.
    const options = adapterMock.mock.calls[0]![1];
    expect(options).toBeDefined();
    expect((options as Record<string, unknown>).analysisType).toBeUndefined();
    expect((options as Record<string, unknown>).referenceQuote).toBeUndefined();

    // No renewal artifacts leak into the NEW-mode response (XC-3).
    const serialized = JSON.stringify(response.body);
    expect(serialized).not.toContain('isBaseline');
    expect(serialized).not.toContain('baseline_column');
    expect(serialized).not.toContain('renewalAnalytics');
  });

  it('ignores an explicit analysis_type=new body field exactly like an omitted one', async () => {
    const adapterMock = vi.mocked(comparisonEngineAdapter.generateComparison);
    adapterMock.mockClear();

    const response = await request(app)
      .post('/api/analyze')
      .field('clientData', JSON.stringify({}))
      .field('analysis_type', 'new')
      .attach('quotes', Buffer.from('test pdf content'), 'quote1.pdf');

    expect(response.status).toBe(200);
    const serialized = JSON.stringify(response.body);
    expect(serialized).not.toContain('isBaseline');
    expect(serialized).not.toContain('renewalAnalytics');
  });

  it('forwards analysis_type=renewal, policy_id, and renewal_id to adapter options', async () => {
    const adapterMock = vi.mocked(comparisonEngineAdapter.generateComparison);
    adapterMock.mockClear();

    const response = await request(app)
      .post('/api/analyze')
      .field('clientData', JSON.stringify({}))
      .field('analysis_type', 'renewal')
      .field('policy_id', '11111111-1111-1111-1111-111111111111')
      .field('renewal_id', '22222222-2222-2222-2222-222222222222')
      .attach('quotes', Buffer.from('test pdf content'), 'quote1.pdf');

    expect(response.status).toBe(200);
    const options = adapterMock.mock.calls[0]![1];
    expect(options).toBeDefined();
    expect((options as Record<string, unknown>).analysisType).toBe('renewal');
    expect((options as Record<string, unknown>).policyId).toBe(
      '11111111-1111-1111-1111-111111111111'
    );
    expect((options as Record<string, unknown>).renewalId).toBe(
      '22222222-2222-2222-2222-222222222222'
    );
  });

  it('forwards camelCase analysisType=renewal, policyId, and renewalId from frontend', async () => {
    const adapterMock = vi.mocked(comparisonEngineAdapter.generateComparison);
    adapterMock.mockClear();

    const response = await request(app)
      .post('/api/analyze')
      .field('clientData', JSON.stringify({}))
      .field('analysisType', 'renewal')
      .field('policyId', '33333333-3333-3333-3333-333333333333')
      .field('renewalId', '44444444-4444-4444-4444-444444444444')
      .attach('quotes', Buffer.from('test pdf content'), 'quote1.pdf');

    expect(response.status).toBe(200);
    const options = adapterMock.mock.calls[0]![1];
    expect(options).toBeDefined();
    expect((options as Record<string, unknown>).analysisType).toBe('renewal');
    expect((options as Record<string, unknown>).policyId).toBe(
      '33333333-3333-3333-3333-333333333333'
    );
    expect((options as Record<string, unknown>).renewalId).toBe(
      '44444444-4444-4444-4444-444444444444'
    );
  });
});
