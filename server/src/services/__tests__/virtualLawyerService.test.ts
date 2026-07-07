import { describe, it, expect, vi } from 'vitest';
import { virtualLawyerService } from '../virtualLawyerService';
import { mockClientProfile } from './__fixtures__/mockData';

// Mock Gemini service
vi.mock('../gemini', () => ({
  geminiService: {
    extractText: vi.fn(
      async () => `
=== ESCENARIO DE RIESGO ===
Riesgo de responsabilidad civil para manufacturero con 150 empleados

=== INTERPRETACIÓN DEL CLAUSULADO ===
El clausulado establece cobertura básica

=== RECOMENDACIÓN ===
Aumentar límite de cobertura

=== PUNTOS DE NEGOCIACIÓN ===
1. Aumentar límite a $1.000M - El cliente tiene 150 empleados - Mayor protección - ALTA

=== CONFIANZA ===
85
    `
    ),
  },
}));

// Mock RAG retrieval
vi.mock('../ragRetrievalService', () => ({
  ragRetrievalService: {
    search: vi.fn(async () => [
      {
        id: 'chunk-1',
        content: 'Artículo 5: Responsabilidad Civil',
        sectionType: 'COBERTURA',
        pageNumber: 10,
        similarity: 0.9,
      },
    ]),
  },
}));

describe('virtualLawyerService', () => {
  const mockQuote = {
    insurerName: 'Seguros Bolívar',
    coverageName: 'Responsabilidad Civil',
    value: '500M',
    deductible: '5%',
    exclusions: [],
  };

  describe('generateLegalOpinion', () => {
    it('should generate legal opinion', async () => {
      const opinion = await virtualLawyerService.generateLegalOpinion(
        mockQuote,
        mockClientProfile,
        'Seguros Bolívar'
      );

      expect(opinion).toBeDefined();
      expect(opinion.coverageName).toBe('Responsabilidad Civil');
      expect(opinion.confidence).toBeGreaterThan(0);
    });

    it('should include risk scenario', async () => {
      const opinion = await virtualLawyerService.generateLegalOpinion(
        mockQuote,
        mockClientProfile,
        'Seguros Bolívar'
      );

      expect(opinion.riskScenario).toBeDefined();
      expect(opinion.riskScenario.length).toBeGreaterThan(0);
    });

    it('should include recommendation', async () => {
      const opinion = await virtualLawyerService.generateLegalOpinion(
        mockQuote,
        mockClientProfile,
        'Seguros Bolívar'
      );

      expect(opinion.recommendation).toBeDefined();
      expect(opinion.recommendation.length).toBeGreaterThan(0);
    });

    it('should include negotiation points', async () => {
      const opinion = await virtualLawyerService.generateLegalOpinion(
        mockQuote,
        mockClientProfile,
        'Seguros Bolívar'
      );

      expect(opinion.negotiationPoints).toBeDefined();
      expect(opinion.negotiationPoints.length).toBeGreaterThan(0);
    });

    it('should include citations', async () => {
      const opinion = await virtualLawyerService.generateLegalOpinion(
        mockQuote,
        mockClientProfile,
        'Seguros Bolívar'
      );

      expect(opinion.citations).toBeDefined();
      expect(opinion.citations.length).toBeGreaterThan(0);
    });

    it('should handle errors gracefully', async () => {
      // Force error by passing invalid data
      const opinion = await virtualLawyerService.generateLegalOpinion(
        { ...mockQuote, coverageName: '' },
        mockClientProfile,
        'Seguros Bolívar'
      );

      expect(opinion).toBeDefined();
      expect(opinion.confidence).toBeLessThan(100);
    });
  });

  describe('generateOpinions', () => {
    it('should generate opinions for multiple coverages', async () => {
      const quotes = [mockQuote, { ...mockQuote, coverageName: 'Incendio' }];

      const opinions = await virtualLawyerService.generateOpinions(
        quotes,
        mockClientProfile,
        'Seguros Bolívar'
      );

      expect(opinions).toHaveLength(2);
      expect(opinions[0].coverageName).toBe('Responsabilidad Civil');
      expect(opinions[1].coverageName).toBe('Incendio');
    });
  });

  describe('identifyNegotiationPoints', () => {
    it('should sort points by priority', () => {
      const opinions = [
        {
          coverageName: 'Test',
          riskScenario: '',
          clauseInterpretation: '',
          recommendation: '',
          citations: [],
          confidence: 80,
          negotiationPoints: [
            { point: 'Point 2', rationale: '', expectedOutcome: '', priority: 'MEDIUM' as const },
            { point: 'Point 1', rationale: '', expectedOutcome: '', priority: 'HIGH' as const },
            { point: 'Point 3', rationale: '', expectedOutcome: '', priority: 'LOW' as const },
          ],
        },
      ];

      const points = virtualLawyerService.identifyNegotiationPoints(opinions);

      expect(points[0].priority).toBe('HIGH');
      expect(points[1].priority).toBe('MEDIUM');
      expect(points[2].priority).toBe('LOW');
    });
  });
});
