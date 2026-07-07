import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import analysisRoutes from '../analysis';

// Mock auth middleware to inject a test user
vi.mock('../../middleware/auth', () => ({
  authMiddleware: (req: { user?: { id: string } }, _res: unknown, next: () => void) => {
    req.user = { id: 'test-user-123' };
    next();
  },
  optionalAuthMiddleware: (_req: unknown, _res: unknown, next: () => void) => {
    next();
  },
  AuthenticatedRequest: {},
}));

// Create test app
const app = express();
app.use(express.json());
app.use('/api/analysis', analysisRoutes);

// Mock all services
vi.mock('../../services/clauseCoverageValidator', () => ({
  clauseCoverageValidator: {
    validate: vi.fn(async () => ({
      results: [{ coverageName: 'Incendio', status: 'VERIFIED' }],
      phantomCount: 0,
      mandatoryMissingCount: 0,
      scoreImpact: 0,
      hasClauseDocument: true,
    })),
  },
}));

vi.mock('../../services/deductibleAnalyzer', () => ({
  deductibleAnalyzer: {
    analyze: vi.fn(() => ({
      coverageName: 'Incendio',
      deductibleAmount: 50000000,
      deductibleRatio: 0.1,
      riskLevel: 'LOW',
      score: 85,
    })),
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

vi.mock('../../repositories/analysisRepository', () => ({
  getAnalysisById: vi.fn(async (id: string) => ({
    id,
    user_id: 'test-user-123',
    client_name: 'Test Client',
    analysis_result: {
      quotes: [
        {
          insurerName: 'MAPFRE',
          policyName: 'PYME',
          priceAnnual: 8500000,
          currency: 'COP',
          coverages: [{ name: 'Incendio', value: '500M', deductible: '10%' }],
          alerts: [],
        },
      ],
    },
  })),
}));

vi.mock('../../services/excelGenerator', () => ({
  generateExcelBuffer: vi.fn(async () => Buffer.from('mock-excel')),
}));

describe('Analysis API Endpoints', () => {
  describe('POST /api/analysis/validate-coverages', () => {
    it('should validate coverages successfully', async () => {
      const response = await request(app)
        .post('/api/analysis/validate-coverages')
        .send({
          quote: {
            insurerName: 'Test',
            coverages: [{ name: 'Incendio', value: '500M' }],
          },
          insurerName: 'Test',
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('results');
      expect(response.body.hasClauseDocument).toBe(true);
    });

    it('should return 400 for missing fields', async () => {
      const response = await request(app).post('/api/analysis/validate-coverages').send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Missing required fields');
    });
  });

  describe('POST /api/analysis/deductible-risk', () => {
    it('should analyze deductible risk', async () => {
      const response = await request(app).post('/api/analysis/deductible-risk').send({
        coverageName: 'Incendio',
        quoteDeductible: '10%',
        clauseDeductible: '10%',
        insuredAmount: 500000000,
      });

      expect(response.status).toBe(200);
      expect(response.body.riskLevel).toBe('LOW');
      expect(response.body.score).toBe(85);
    });

    it('should return 400 for missing fields', async () => {
      const response = await request(app).post('/api/analysis/deductible-risk').send({});

      expect(response.status).toBe(400);
    });
  });

  describe('POST /api/analysis/inverse-check', () => {
    it('should check for missing coverages', async () => {
      const response = await request(app)
        .post('/api/analysis/inverse-check')
        .send({
          quote: { coverages: [] },
          insurerName: 'Test',
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('results');
    });
  });

  describe('POST /api/analysis/contextualize', () => {
    it('should contextualize exclusions', async () => {
      const response = await request(app)
        .post('/api/analysis/contextualize')
        .send({
          exclusions: ['No cubre inundación'],
          clientProfile: { industryType: 'manufactura' },
        });

      expect(response.status).toBe(200);
      expect(response.body.criticalCount).toBe(1);
    });
  });

  describe('POST /api/analysis/warranty-compliance', () => {
    it('should analyze warranty compliance', async () => {
      const response = await request(app)
        .post('/api/analysis/warranty-compliance')
        .send({
          conditions: ['Mantener alarma'],
          clientProfile: { employeeCount: 50 },
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('overallRisk');
    });
  });

  describe('GET /api/analysis/:id/export', () => {
    it('should export analysis as Excel for owner', async () => {
      const response = await request(app).get('/api/analysis/test-id/export');

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain(
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      expect(response.headers['content-disposition']).toContain('comparativa_seguros_test-id.xlsx');
    });
  });
});
