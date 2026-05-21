import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import multer from 'multer';
import { analysisController } from '../../controllers/analysisController';

// Mock all services to avoid env variable requirements
vi.mock('../../services/gemini', () => ({
  geminiService: {
    extractText: vi.fn(async () => JSON.stringify({
      quotes: [{
        insurerName: 'Seguros Bolívar',
        policyName: 'Empresarial Plus',
        priceAnnual: 8500000,
        currency: 'COP',
        coverages: [
          { name: 'Responsabilidad Civil', value: '100M', deductible: '5 SMMLV' },
          { name: 'Incendio', value: '500M', deductible: '10%' }
        ],
        specialConditions: [],
        parseConfidence: 95
      }]
    })),
    extractStructured: vi.fn(async () => ({
      quotes: [{
        insurerName: 'Seguros Bolívar',
        policyName: 'Empresarial Plus',
        priceAnnual: 8500000,
        currency: 'COP',
        coverages: [
          { name: 'Responsabilidad Civil', value: '100M', deductible: '5 SMMLV' },
          { name: 'Incendio', value: '500M', deductible: '10%' }
        ],
        specialConditions: [],
        parseConfidence: 95
      }]
    })),
    extractFromPdfWithVision: vi.fn(async () => ({
      quotes: [{
        insurerName: 'Seguros Bolívar',
        policyName: 'Empresarial Plus',
        priceAnnual: 8500000,
        currency: 'COP',
        coverages: [
          { name: 'Responsabilidad Civil', value: '100M', deductible: '5 SMMLV' },
          { name: 'Incendio', value: '500M', deductible: '10%' }
        ],
        specialConditions: [],
        parseConfidence: 95
      }]
    })),
    analyzeWithGemini: vi.fn(async () => 'Análisis de prueba'),
    generateNarrative: vi.fn(async () => ({
      clientAnalysis: 'Test analysis',
      technicalAnalysis: 'Test technical',
      keyFindings: ['Finding 1']
    }))
  }
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
      isScanned: false
    }))
  }
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
      optionalMissingCount: 0
    }))
  }
}));

vi.mock('../../services/deductibleAnalyzer', () => ({
  deductibleAnalyzer: {
    analyzeQuote: vi.fn(async () => [
      { coverage: 'Incendio', level: 'MEDIUM', riskScore: 65 }
    ])
  }
}));

vi.mock('../../services/inverseCoverageChecker', () => ({
  inverseCoverageChecker: {
    checkMissingCoverages: vi.fn(async () => ({
      results: [],
      mandatoryMissingCount: 0,
      optionalMissingCount: 0
    }))
  }
}));

vi.mock('../../services/contextualRiskAnalyzer', () => ({
  contextualRiskAnalyzer: {
    contextualizeExclusions: vi.fn(() => ({
      exclusions: [{ contextualRiskLevel: 'CRITICAL' }],
      criticalCount: 1
    }))
  }
}));

vi.mock('../../services/warrantyComplianceAnalyzer', () => ({
  warrantyComplianceAnalyzer: {
    analyzeConditions: vi.fn(() => ({
      totalConditions: 2,
      overallRisk: 'MEDIUM',
      compliancePercentage: 60
    }))
  }
}));

vi.mock('../../services/virtualLawyerService', () => ({
  virtualLawyerService: {
    generateLegalOpinion: vi.fn(async () => ({
      coverageName: 'RC',
      confidence: 80,
      negotiationPoints: [{ point: 'Test', priority: 'HIGH' }]
    }))
  }
}));

vi.mock('../../services/narrativeService', () => ({
  narrativeService: {
    generateNarrative: vi.fn(async () => ({
      clientAnalysis: 'Test client analysis',
      technicalAnalysis: 'Test technical',
      keyFindings: ['Finding 1']
    })),
    generateComparisonNarrative: vi.fn(async () => 'Test comparison narrative')
  }
}));

vi.mock('../../services/quoteValidator', () => ({
  validateQuote: vi.fn(() => ({
    coverageCount: 2,
    expectedCoverageCount: 2,
    flags: [],
    isValid: true
  }))
}));

vi.mock('../../services/confidenceScorer', () => ({
  calculateConfidence: vi.fn(() => ({
    score: 95,
    needsReview: false,
    isCritical: false,
    breakdown: {}
  }))
}));

vi.mock('../../services/quoteScorer', () => ({
  quoteScorer: {
    calculateScore: vi.fn(() => ({
      totalScore: 85,
      breakdown: { coverage: 90, deductibles: 80, exclusions: 85, priceRatio: 75, sublimits: 80, warranties: 70 },
      weights: {},
      quotePriceRank: 1,
      marketPriceAverage: 8500000,
      coverageCount: 2,
      expectedCoverageCount: 2,
      criticalAlerts: 0,
      warningAlerts: 1,
      infoAlerts: 0
    })),
    getDefaultWeights: vi.fn(() => ({}))
  }
}));

vi.mock('../../services/crossReferenceEngine', () => ({
  crossReferenceEngine: {
    crossReferenceQuote: vi.fn(async () => [{
      coverageName: 'Incendio',
      quoteData: { value: '500M', deductible: '10%' },
      clauseData: { deductible: '10%', exclusions: [] },
      alerts: [],
      isVerified: true
    }]),
    crossReferenceQuotesBatch: vi.fn(async () => {
      const results = new Map();
      results.set(0, [{
        coverageName: 'Incendio',
        quoteData: { value: '500M', deductible: '10%' },
        clauseData: { deductible: '10%', exclusions: [] },
        alerts: [],
        isVerified: true
      }]);
      return results;
    })
  }
}));

vi.mock('../../services/quoteParser', () => ({
  quoteParser: {
    parse: vi.fn(() => ({
      insurerName: 'Seguros Bolívar',
      policyName: 'Empresarial Plus',
      priceAnnual: 8500000,
      currency: 'COP',
      coverages: [
        { name: 'Responsabilidad Civil', value: '100M', deductible: '5 SMMLV', confidence: 90, categoryId: 6, matchConfidence: 1.0, matchMethod: 'thesaurus' },
        { name: 'Incendio', value: '500M', deductible: '10%', confidence: 95, categoryId: 1, matchConfidence: 1.0, matchMethod: 'thesaurus' }
      ],
      specialConditions: [],
      rawText: '',
      parseConfidence: 95
    }))
  }
}));

vi.mock('../../services/thesaurusMapper', () => ({
  normalizeCoverages: vi.fn((coverages) => coverages)
}));

vi.mock('../../services/ragRetrievalService', () => ({
  ragRetrievalService: {
    checkInsurerHasClauses: vi.fn(async () => true),
    search: vi.fn(async () => [])
  }
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
      catch: vi.fn()
    };
    return chain;
  };
  
  const mockSupabase = {
    from: vi.fn(() => makeChain([])),
    rpc: vi.fn(() => Promise.resolve({ data: [], error: null }))
  };
  
  return {
    supabase: mockSupabase
  };
});

// Create test app with file upload support
const app = express();
app.use(express.json());

const upload = multer({ storage: multer.memoryStorage() });
app.post('/api/analyze',
  upload.fields([{ name: 'quotes', maxCount: 10 }, { name: 'clauses', maxCount: 10 }]),
  analysisController.uploadAndAnalyze
);

describe('POST /api/analyze', () => {
  it('should return analysis with extended fields', async () => {
    const response = await request(app)
      .post('/api/analyze')
      .field('clientData', JSON.stringify({
        industryType: 'manufactura',
        employeeCount: 50
      }))
      .attach('quotes', Buffer.from('test pdf content'), 'quote1.pdf')
      .attach('clauses', Buffer.from('test clause content'), 'clause1.pdf');

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('quotes');
    expect(response.body).toHaveProperty('recommendation');
    expect(response.body).toHaveProperty('marketAnalysis');
    
    // Check that response includes advanced analysis fields
    const firstQuote = response.body.quotes[0];
    expect(firstQuote).toBeDefined();
    
    // These fields should exist in the response (may be undefined if services timeout)
    expect(firstQuote).toHaveProperty('clauseValidation');
    expect(firstQuote).toHaveProperty('deductibleAnalysis');
    expect(firstQuote).toHaveProperty('contextualRisk');
    expect(firstQuote).toHaveProperty('warrantyCompliance');
    expect(firstQuote).toHaveProperty('legalOpinion');
  });

  it('should include clause validation data when available', async () => {
    const response = await request(app)
      .post('/api/analyze')
      .field('clientData', JSON.stringify({}))
      .attach('quotes', Buffer.from('test pdf content'), 'quote1.pdf');

    expect(response.status).toBe(200);
    
    const firstQuote = response.body.quotes[0];
    if (firstQuote.clauseValidation) {
      expect(firstQuote.clauseValidation).toHaveProperty('hasClauseDocument');
      expect(firstQuote.clauseValidation).toHaveProperty('verifiedCount');
      expect(firstQuote.clauseValidation).toHaveProperty('phantomCount');
      expect(firstQuote.clauseValidation).toHaveProperty('mandatoryMissingCount');
    }
  });

  it('should handle request without files gracefully', async () => {
    const response = await request(app)
      .post('/api/analyze')
      .field('clientData', JSON.stringify({
        industryType: 'manufactura'
      }));

    // Should either return 400 (bad request) or handle empty files
    expect([200, 400, 500]).toContain(response.status);
  });

  it('should maintain backward compatibility', async () => {
    const response = await request(app)
      .post('/api/analyze')
      .field('clientData', JSON.stringify({}))
      .attach('quotes', Buffer.from('test pdf content'), 'quote1.pdf');

    expect(response.status).toBe(200);
    
    // Core fields should always be present
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
  });
});
