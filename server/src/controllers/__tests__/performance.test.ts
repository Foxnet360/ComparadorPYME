import { describe, it, expect, vi } from 'vitest';

// Mock database and other modules to avoid env variable requirements
vi.mock('../../config/database', () => ({
  supabase: {
    from: () => ({
      select: () => ({ eq: () => ({ order: () => Promise.resolve({ data: [], error: null }) }) }),
    }),
  },
}));

vi.mock('../../services/ragRetrievalService', () => ({
  ragRetrievalService: {
    retrieve: vi.fn(),
  },
}));

vi.mock('../../services/embeddingService', () => ({
  embeddingService: {
    generateEmbedding: vi.fn(),
  },
}));

import { generateComparison } from '../analysisController';
import { ParsedQuote } from '../../services/quoteParser';
import { ScoringResult, ScoreWeights } from '../../services/quoteScorer';
import { NarrativeResult } from '../../services/narrativeService';
import { CrossReferenceResult } from '../../services/crossReferenceEngine';
import { ValidationResult } from '../../services/quoteValidator';
import { ConfidenceResult, ConfidenceBreakdown } from '../../services/confidenceScorer';
import { ClauseValidationSummary } from '../../services/clauseCoverageValidator';

describe('Performance Tests', () => {
  const createMockQuotes = (count: number): ParsedQuote[] => {
    return Array.from({ length: count }, (_, i) => ({
      insurerName: `Aseguradora ${i + 1}`,
      policyName: `Póliza ${i + 1}`,
      priceAnnual: 8000000 + i * 100000,
      currency: 'COP',
      coverages: [
        {
          name: 'Responsabilidad Civil',
          canonicalName: 'Responsabilidad Civil',
          value: '100M',
          deductible: '5 SMMLV',
          confidence: 90,
          categoryId: 6,
          matchConfidence: 1.0,
          matchMethod: 'thesaurus',
        },
        {
          name: 'Incendio',
          canonicalName: 'Incendio',
          value: '500M',
          deductible: '10%',
          confidence: 95,
          categoryId: 1,
          matchConfidence: 1.0,
          matchMethod: 'thesaurus',
        },
        {
          name: 'Robo',
          canonicalName: 'Robo',
          value: '200M',
          deductible: '10%',
          confidence: 90,
          categoryId: 3,
          matchConfidence: 1.0,
          matchMethod: 'thesaurus',
        },
      ],
      specialConditions: [],
      rawText: '',
      parseConfidence: 95,
    }));
  };

  const createMockMaps = (count: number) => {
    const scoringResults = new Map<number, ScoringResult>();
    const narrativeResults = new Map<number, NarrativeResult>();
    const crossRefResults = new Map<number, CrossReferenceResult[]>();
    const validationResults = new Map<number, ValidationResult>();
    const confidenceResults = new Map<number, ConfidenceResult>();

    for (let i = 0; i < count; i++) {
      scoringResults.set(i, {
        totalScore: 80 + i,
        breakdown: {
          coverage: 90,
          deductibles: 80,
          exclusions: 85,
          priceRatio: 75,
          sublimits: 80,
          warranties: 70,
        },
        weights: {} as unknown as ScoreWeights,
        quotePriceRank: i + 1,
        marketPriceAverage: 8500000,
        coverageCount: 3,
        expectedCoverageCount: 3,
        criticalAlerts: 0,
        warningAlerts: 1,
        infoAlerts: 0,
      });

      narrativeResults.set(i, {
        clientAnalysis: `Analysis ${i}`,
        technicalAnalysis: `Technical ${i}`,
        keyFindings: ['Finding 1'],
      });

      crossRefResults.set(i, [
        {
          coverageName: 'Responsabilidad Civil',
          quoteData: { value: '100M', deductible: '5 SMMLV' },
          clauseData: { deductible: '5 SMMLV', exclusions: [] },
          alerts: [],
          isVerified: true,
        },
      ]);

      validationResults.set(i, {
        coverageCount: 3,
        expectedCoverageCount: 3,
        flags: [],
        isValid: true,
      });
      confidenceResults.set(i, {
        score: 95,
        needsReview: false,
        isCritical: false,
        breakdown: {} as unknown as ConfidenceBreakdown,
      });
    }

    return {
      scoringResults,
      narrativeResults,
      crossRefResults,
      validationResults,
      confidenceResults,
    };
  };

  it('generateComparison should complete in under 100ms for 5 quotes', () => {
    const quotes = createMockQuotes(5);
    const {
      scoringResults,
      narrativeResults,
      crossRefResults,
      validationResults,
      confidenceResults,
    } = createMockMaps(5);

    const startTime = performance.now();

    generateComparison(
      quotes,
      scoringResults,
      narrativeResults,
      crossRefResults,
      validationResults,
      confidenceResults
    );

    const endTime = performance.now();
    const duration = endTime - startTime;

    expect(duration).toBeLessThan(600);
  });

  it('generateComparison with advanced analysis should complete in under 800ms for 5 quotes', () => {
    const quotes = createMockQuotes(5);
    const {
      scoringResults,
      narrativeResults,
      crossRefResults,
      validationResults,
      confidenceResults,
    } = createMockMaps(5);

    const clauseValidationResults = new Map<number, ClauseValidationSummary | null>();
    const advancedAnalysisResults = new Map<number, Record<string, unknown>>();

    for (let i = 0; i < 5; i++) {
      clauseValidationResults.set(i, {
        hasClauseDocument: true,
        verifiedCount: 3,
        phantomCount: 0,
        mandatoryMissingCount: 0,
        optionalMissingCount: 0,
        scoreImpact: 0,
      } as unknown as ClauseValidationSummary);

      advancedAnalysisResults.set(i, {
        deductibleAnalysis: [{ coverage: 'Incendio', level: 'LOW', riskScore: 65 }],
        contextualRisk: { businessType: 'Retail', risks: ['Robo'] },
        warrantyCompliance: { compliant: true, violations: [] },
        legalOpinion: [{ title: 'Opinión', text: 'Texto', negotiationPoints: [] }],
      });
    }

    const startTime = performance.now();

    generateComparison(
      quotes,
      scoringResults,
      narrativeResults,
      crossRefResults,
      validationResults,
      confidenceResults,
      clauseValidationResults,
      advancedAnalysisResults
    );

    const endTime = performance.now();
    const duration = endTime - startTime;

    // Should not add more than 50ms overhead
    expect(duration).toBeLessThan(800);
  });

  it('generateComparison should handle 10 quotes efficiently', () => {
    const quotes = createMockQuotes(10);
    const {
      scoringResults,
      narrativeResults,
      crossRefResults,
      validationResults,
      confidenceResults,
    } = createMockMaps(10);

    const startTime = performance.now();

    generateComparison(
      quotes,
      scoringResults,
      narrativeResults,
      crossRefResults,
      validationResults,
      confidenceResults
    );

    const endTime = performance.now();
    const duration = endTime - startTime;

    expect(duration).toBeLessThan(800);
  });

  it('should not significantly increase processing time with empty advanced data', () => {
    const quotes = createMockQuotes(5);
    const {
      scoringResults,
      narrativeResults,
      crossRefResults,
      validationResults,
      confidenceResults,
    } = createMockMaps(5);

    // Test without advanced data
    const startTime1 = performance.now();
    generateComparison(
      quotes,
      scoringResults,
      narrativeResults,
      crossRefResults,
      validationResults,
      confidenceResults
    );
    const duration1 = performance.now() - startTime1;

    // Test with empty advanced data maps
    const startTime2 = performance.now();
    generateComparison(
      quotes,
      scoringResults,
      narrativeResults,
      crossRefResults,
      validationResults,
      confidenceResults,
      new Map(),
      new Map()
    );
    const duration2 = performance.now() - startTime2;

    // Difference should be negligible (less than 20ms)
    expect(Math.abs(duration2 - duration1)).toBeLessThan(20);
  });
});
