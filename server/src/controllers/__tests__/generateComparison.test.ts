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

describe('generateComparison', () => {
  const mockQuotes: ParsedQuote[] = [
    {
      insurerName: 'Seguros Bolívar',
      policyName: 'Empresarial Plus',
      priceAnnual: 8500000,
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
      ],
      specialConditions: [],
      rawText: '',
      parseConfidence: 95,
    },
    {
      insurerName: 'Seguros del Estado',
      policyName: 'PYME Protegida',
      priceAnnual: 9200000,
      currency: 'COP',
      coverages: [
        {
          name: 'Responsabilidad Civil',
          canonicalName: 'Responsabilidad Civil',
          value: '150M',
          deductible: '5 SMMLV',
          confidence: 92,
          categoryId: 6,
          matchConfidence: 1.0,
          matchMethod: 'thesaurus',
        },
        {
          name: 'Incendio',
          canonicalName: 'Incendio',
          value: '400M',
          deductible: '15%',
          confidence: 88,
          categoryId: 1,
          matchConfidence: 1.0,
          matchMethod: 'thesaurus',
        },
      ],
      specialConditions: [],
      rawText: '',
      parseConfidence: 88,
    },
  ];

  const mockScoringResults = new Map<number, ScoringResult>([
    [
      0,
      {
        totalScore: 85,
        breakdown: {
          coverage: 90,
          deductibles: 80,
          exclusions: 85,
          priceRatio: 75,
          sublimits: 80,
          warranties: 70,
        },
        weights: {} as unknown as ScoreWeights,
        quotePriceRank: 1,
        marketPriceAverage: 8850000,
        coverageCount: 2,
        expectedCoverageCount: 2,
        criticalAlerts: 0,
        warningAlerts: 1,
        infoAlerts: 0,
      },
    ],
    [
      1,
      {
        totalScore: 78,
        breakdown: {
          coverage: 85,
          deductibles: 70,
          exclusions: 80,
          priceRatio: 65,
          sublimits: 75,
          warranties: 70,
        },
        weights: {} as unknown as ScoreWeights,
        quotePriceRank: 2,
        marketPriceAverage: 8850000,
        coverageCount: 2,
        expectedCoverageCount: 2,
        criticalAlerts: 0,
        warningAlerts: 2,
        infoAlerts: 1,
      },
    ],
  ]);

  const mockNarrativeResults = new Map<number, NarrativeResult>([
    [
      0,
      {
        clientAnalysis: 'Excelente cobertura de RC con deducible competitivo',
        technicalAnalysis: 'Coberturas completas con deducibles estándar',
        keyFindings: ['Buena relación precio/cobertura'],
      },
    ],
    [
      1,
      {
        clientAnalysis: 'Mayor cobertura de RC pero deducible más alto',
        technicalAnalysis: 'RC superior pero incendio con deducible elevado',
        keyFindings: ['Mejor RC, peor deducible incendio'],
      },
    ],
  ]);

  const mockCrossRefResults = new Map<number, CrossReferenceResult[]>([
    [
      0,
      [
        {
          coverageName: 'Responsabilidad Civil',
          quoteData: { value: '100M', deductible: '5 SMMLV' },
          clauseData: { deductible: '5 SMMLV', exclusions: [] },
          alerts: [],
          isVerified: true,
        },
        {
          coverageName: 'Incendio',
          quoteData: { value: '500M', deductible: '10%' },
          clauseData: { deductible: '10%', exclusions: ['Terremotos no cubiertos'] },
          alerts: [
            {
              level: 'WARNING',
              coverageName: 'Incendio',
              title: 'Exclusiones',
              description: 'Terremotos excluidos',
              quoteValue: '500M',
              clauseValue: 'Terremotos no cubiertos',
              isFallback: false,
            },
          ],
          isVerified: true,
        },
      ],
    ],
    [
      1,
      [
        {
          coverageName: 'Responsabilidad Civil',
          quoteData: { value: '150M', deductible: '5 SMMLV' },
          clauseData: { deductible: '5 SMMLV', exclusions: [] },
          alerts: [],
          isVerified: true,
        },
        {
          coverageName: 'Incendio',
          quoteData: { value: '400M', deductible: '15%' },
          clauseData: { deductible: '15%', exclusions: [] },
          alerts: [
            {
              level: 'WARNING',
              coverageName: 'Incendio',
              title: 'Deducible alto',
              description: 'Deducible mayor al estándar',
              quoteValue: '400M',
              clauseValue: '15%',
              isFallback: false,
            },
          ],
          isVerified: true,
        },
      ],
    ],
  ]);

  const mockValidationResults = new Map<number, ValidationResult>([
    [0, { coverageCount: 2, expectedCoverageCount: 2, flags: [], isValid: true }],
    [1, { coverageCount: 2, expectedCoverageCount: 2, flags: [], isValid: true }],
  ]);

  const mockConfidenceResults = new Map<number, ConfidenceResult>([
    [
      0,
      {
        score: 95,
        needsReview: false,
        isCritical: false,
        breakdown: {} as unknown as ConfidenceBreakdown,
      },
    ],
    [
      1,
      {
        score: 88,
        needsReview: false,
        isCritical: false,
        breakdown: {} as unknown as ConfidenceBreakdown,
      },
    ],
  ]);

  it('should generate comparison with basic data', () => {
    const result = generateComparison(
      mockQuotes,
      mockScoringResults,
      mockNarrativeResults,
      mockCrossRefResults,
      mockValidationResults,
      mockConfidenceResults
    );

    expect(result.quotes).toHaveLength(2);
    expect(result.quotes[0].insurerName).toBe('Seguros Bolívar');
    expect(result.quotes[0].score).toBe(85);
    expect(result.recommendation).toContain('Seguros Bolívar');
  });

  it('should sort quotes by score descending', () => {
    const result = generateComparison(
      mockQuotes,
      mockScoringResults,
      mockNarrativeResults,
      mockCrossRefResults,
      mockValidationResults,
      mockConfidenceResults
    );

    expect(result.quotes[0].score).toBeGreaterThanOrEqual(result.quotes[1].score);
  });

  it('should include clause validation data when provided', () => {
    const clauseValidationResults = new Map<number, ClauseValidationSummary | null>([
      [
        0,
        {
          hasClauseDocument: true,
          verifiedCount: 2,
          phantomCount: 0,
          mandatoryMissingCount: 0,
          optionalMissingCount: 0,
          scoreImpact: 0,
        } as unknown as ClauseValidationSummary,
      ],
      [
        1,
        {
          hasClauseDocument: true,
          verifiedCount: 2,
          phantomCount: 0,
          mandatoryMissingCount: 0,
          optionalMissingCount: 1,
          scoreImpact: -5,
        } as unknown as ClauseValidationSummary,
      ],
    ]);

    const result = generateComparison(
      mockQuotes,
      mockScoringResults,
      mockNarrativeResults,
      mockCrossRefResults,
      mockValidationResults,
      mockConfidenceResults,
      clauseValidationResults
    );

    expect(result.quotes[0].clauseValidation).toBeDefined();
    expect(result.quotes[0].clauseValidation?.hasClauseDocument).toBe(true);
    expect(result.quotes[0].clauseValidation?.verifiedCount).toBe(2);
    expect(result.quotes[1].clauseValidation?.optionalMissingCount).toBe(1);
  });

  it('should include advanced analysis data when provided', () => {
    const advancedAnalysisResults = new Map<number, Record<string, unknown>>([
      [
        0,
        {
          deductibleAnalysis: [{ coverage: 'Incendio', level: 'MEDIUM', riskScore: 65 }],
          contextualRisk: {
            businessType: 'Retail',
            risks: ['Robo nocturno'],
          },
          warrantyCompliance: {
            compliant: true,
            violations: [],
          },
          legalOpinion: [{ title: 'Opinión RC', text: 'Cobertura adecuada' }],
        },
      ],
      [
        1,
        {
          deductibleAnalysis: [{ coverage: 'Incendio', level: 'HIGH', riskScore: 85 }],
          contextualRisk: {
            businessType: 'Retail',
            risks: ['Robo nocturno', 'Inundación'],
          },
          warrantyCompliance: {
            compliant: false,
            violations: ['Falta sistema alarmas'],
          },
          legalOpinion: [],
        },
      ],
    ]);

    const result = generateComparison(
      mockQuotes,
      mockScoringResults,
      mockNarrativeResults,
      mockCrossRefResults,
      mockValidationResults,
      mockConfidenceResults,
      undefined,
      advancedAnalysisResults
    );

    expect(result.quotes[0].deductibleAnalysis).toBeDefined();
    expect(result.quotes[0].deductibleAnalysis).toHaveLength(1);
    expect(result.quotes[0].contextualRisk?.businessType).toBe('Retail');
    expect(result.quotes[0].warrantyCompliance?.compliant).toBe(true);
    expect(result.quotes[0].legalOpinion).toHaveLength(1);

    expect(result.quotes[1].deductibleAnalysis[0].level).toBe('HIGH');
    expect(result.quotes[1].warrantyCompliance?.compliant).toBe(false);
    expect(result.quotes[1].legalOpinion).toHaveLength(0);
  });

  it('should handle empty quotes array', () => {
    const result = generateComparison([], new Map(), new Map(), new Map(), new Map(), new Map());

    expect(result.quotes).toHaveLength(0);
    expect(result.recommendation).toContain('No se pudieron analizar');
  });

  it('should calculate cross-reference summary correctly', () => {
    const result = generateComparison(
      mockQuotes,
      mockScoringResults,
      mockNarrativeResults,
      mockCrossRefResults,
      mockValidationResults,
      mockConfidenceResults
    );

    expect(result.quotes[0].crossReferenceSummary.verifiedCoverages).toBe(2);
    expect(result.quotes[0].crossReferenceSummary.totalCoverages).toBe(2);
    expect(result.quotes[0].crossReferenceSummary.warningAlerts).toBe(1);
    expect(result.quotes[0].crossReferenceSummary.criticalAlerts).toBe(0);
  });

  it('should include deductible comparison', () => {
    const result = generateComparison(
      mockQuotes,
      mockScoringResults,
      mockNarrativeResults,
      mockCrossRefResults,
      mockValidationResults,
      mockConfidenceResults
    );

    expect(result.deductibleComparison).toHaveLength(2);
    expect(result.deductibleComparison[0].insurer).toBe('Seguros Bolívar');
    expect(result.deductibleComparison[0].deductibleText).toContain('Responsabilidad Civil');
  });

  it('should add review prefix when critical extraction exists', () => {
    const criticalConfidence = new Map<number, ConfidenceResult>([
      [
        0,
        {
          score: 45,
          needsReview: true,
          isCritical: true,
          breakdown: {} as unknown as ConfidenceBreakdown,
        },
      ],
    ]);

    const result = generateComparison(
      [mockQuotes[0]],
      new Map([[0, mockScoringResults.get(0)!]]),
      new Map([[0, mockNarrativeResults.get(0)!]]),
      new Map([[0, []]]),
      new Map([[0, mockValidationResults.get(0)!]]),
      criticalConfidence
    );

    expect(result.recommendation).toContain('[REVISIÓN REQUERIDA]');
    expect(result.marketAnalysis).toContain('ATENCIÓN');
  });
});
