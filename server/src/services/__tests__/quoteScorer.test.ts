import { describe, it, expect } from 'vitest';
import { quoteScorer, ScoreWeights } from '../quoteScorer';
import { ParsedQuote } from '../quoteParser';
import { CrossReferenceResult } from '../crossReferenceEngine';

describe('quoteScorer', () => {
    const mockQuote: ParsedQuote = {
        insurerName: 'Test Insurance',
        policyName: 'PYME Policy',
        priceAnnual: 8500000,
        currency: 'COP',
        coverages: [
            { name: 'Responsabilidad Civil', canonicalName: 'Responsabilidad Civil', value: '100M', deductible: '5 SMMLV', confidence: 90, categoryId: 6, matchConfidence: 1.0, matchMethod: 'thesaurus' },
            { name: 'Incendio', canonicalName: 'Incendio', value: '500M', deductible: '10%', confidence: 95, categoryId: 1, matchConfidence: 1.0, matchMethod: 'thesaurus' },
            { name: 'Robo', canonicalName: 'Robo', value: '200M', deductible: '10%', confidence: 90, categoryId: 3, matchConfidence: 1.0, matchMethod: 'thesaurus' },
            { name: 'Cristales', canonicalName: 'Cristales', value: '50M', deductible: 'No aplica', confidence: 85, categoryId: 7, matchConfidence: 1.0, matchMethod: 'thesaurus' },
            { name: 'Equipo Electrónico', canonicalName: 'Equipo Electrónico', value: '150M', deductible: '15%', confidence: 88, categoryId: 4, matchConfidence: 1.0, matchMethod: 'thesaurus' },
            { name: 'Deterioro de Mercancía', canonicalName: 'Deterioro de Mercancía', value: '80M', deductible: '10%', confidence: 82, categoryId: 9, matchConfidence: 1.0, matchMethod: 'thesaurus' },
            { name: 'Dinero en Caja Fuerte', canonicalName: 'Dinero en Caja Fuerte', value: '30M', deductible: '10%', confidence: 80, categoryId: 8, matchConfidence: 1.0, matchMethod: 'thesaurus' },
        ],
        specialConditions: [],
        rawText: '',
        parseConfidence: 95
    };

    const mockCrossRefs: CrossReferenceResult[] = [
        {
            coverageName: 'Responsabilidad Civil',
            quoteData: { value: '100M', deductible: '5 SMMLV' },
            clauseData: { deductible: '5 SMMLV', exclusions: [] },
            alerts: [],
            isVerified: true
        },
        {
            coverageName: 'Incendio',
            quoteData: { value: '500M', deductible: '10%' },
            clauseData: { deductible: '10%', exclusions: ['Terremotos no cubiertos'] },
            alerts: [
                { level: 'WARNING', coverageName: 'Incendio', title: 'Exclusiones', description: 'Terremotos excluidos', quoteValue: '500M', clauseValue: 'Terremotos no cubiertos', isFallback: false }
            ],
            isVerified: true
        },
        {
            coverageName: 'Robo',
            quoteData: { value: '200M', deductible: '10%' },
            clauseData: { deductible: '15%', exclusions: [] },
            alerts: [
                { level: 'CRITICAL', coverageName: 'Robo', title: 'Discrepancia', description: 'Deducible mayor en clausulado', quoteValue: '10%', clauseValue: '15%', isFallback: false }
            ],
            isVerified: true
        }
    ];

    it('should calculate total score within 0-100 range', () => {
        const result = quoteScorer.calculateScore(mockQuote, mockCrossRefs);
        
        expect(result.totalScore).toBeGreaterThanOrEqual(0);
        expect(result.totalScore).toBeLessThanOrEqual(100);
    });

    it('should calculate coverage completeness score', () => {
        const result = quoteScorer.calculateScore(mockQuote, mockCrossRefs);
        
        expect(result.breakdown.coverage).toBeGreaterThan(0);
        expect(result.coverageCount).toBe(mockQuote.coverages.length);
    });

    it('should calculate deductible score', () => {
        const result = quoteScorer.calculateScore(mockQuote, mockCrossRefs);
        
        expect(result.breakdown.deductibles).toBeGreaterThanOrEqual(0);
        expect(result.breakdown.deductibles).toBeLessThanOrEqual(100);
    });

    it('should calculate exclusion score', () => {
        const result = quoteScorer.calculateScore(mockQuote, mockCrossRefs);
        
        expect(result.breakdown.exclusions).toBeGreaterThanOrEqual(0);
        expect(result.breakdown.exclusions).toBeLessThanOrEqual(100);
    });

    it('should calculate price ratio score', () => {
        const result = quoteScorer.calculateScore(mockQuote, mockCrossRefs);
        
        expect(result.breakdown.priceRatio).toBeGreaterThanOrEqual(0);
        expect(result.breakdown.priceRatio).toBeLessThanOrEqual(100);
        expect(result.marketPriceAverage).toBeGreaterThan(0);
    });

    it('should handle empty cross-reference results', () => {
        const result = quoteScorer.calculateScore(mockQuote, []);
        
        expect(result.totalScore).toBeGreaterThanOrEqual(0);
        expect(result.totalScore).toBeLessThanOrEqual(100);
    });

    it('should handle quote with no coverages', () => {
        const emptyQuote = { ...mockQuote, coverages: [] };
        const result = quoteScorer.calculateScore(emptyQuote, []);
        
        expect(result.breakdown.coverage).toBe(0);
        expect(result.totalScore).toBeGreaterThan(0); // Price and other scores still calculated
    });

    it('should use market benchmark when no other quotes provided', () => {
        const result = quoteScorer.calculateScore(mockQuote, mockCrossRefs);
        
        expect(result.marketPriceAverage).toBeGreaterThan(0);
        expect(result.quotePriceRank).toBe(0); // No comparison possible
    });

    it('should calculate price rank when multiple quotes provided', async () => {
        const quote2 = { ...mockQuote, insurerName: 'Competitor', priceAnnual: 10000000 };
        const result = await quoteScorer.calculateScore(mockQuote, mockCrossRefs, [mockQuote, quote2]);
        
        expect(result.quotePriceRank).toBe(1); // mockQuote is cheaper
        expect(result.marketPriceAverage).toBe(9250000);
    });

    it('should count alerts correctly', () => {
        const result = quoteScorer.calculateScore(mockQuote, mockCrossRefs);
        
        expect(result.criticalAlerts).toBe(1); // One CRITICAL from Robo
        expect(result.warningAlerts).toBe(1); // One WARNING from Incendio
    });

    it('should return default weights', () => {
        const weights = quoteScorer.getDefaultWeights();
        
        expect(weights.coverage).toBe(0.25);
        expect(weights.deductibles).toBe(0.20);
        expect(weights.exclusions).toBe(0.20);
        expect(weights.priceRatio).toBe(0.15);
        expect(weights.sublimits).toBe(0.10);
        expect(weights.warranties).toBe(0.10);
        
        const sum = Object.values(weights).reduce((a, b) => a + b, 0);
        expect(sum).toBeCloseTo(1.0, 3);
    });

    it('should validate custom weights', () => {
        const valid = quoteScorer.validateWeights({ coverage: 0.5, deductibles: 0.5 });
        expect(valid.valid).toBe(true);
        expect(valid.errors).toHaveLength(0);
    });

    it('should reject invalid weights', () => {
        const invalid = quoteScorer.validateWeights({ coverage: 0.5, deductibles: 0.5, exclusions: 0.5 });
        expect(invalid.valid).toBe(false);
        expect(invalid.errors.length).toBeGreaterThan(0);
    });

    it('should reject weights outside 0-1 range', () => {
        const invalid = quoteScorer.validateWeights({ coverage: 1.5 });
        expect(invalid.valid).toBe(false);
        expect(invalid.errors.some(e => e.includes('between 0 and 1'))).toBe(true);
    });

    it('should apply custom weights correctly', () => {
        const customWeights: Partial<ScoreWeights> = { coverage: 0.4, deductibles: 0.3, exclusions: 0.15, priceRatio: 0.15 };
        const result = quoteScorer.calculateScore(mockQuote, mockCrossRefs, [], customWeights);
        
        // Weights are normalized to sum to 1.0
        expect(result.weights.coverage).toBeGreaterThan(0);
        expect(result.weights.deductibles).toBeGreaterThan(0);
        const sum = Object.values(result.weights).reduce((a, b) => a + b, 0);
        expect(sum).toBeCloseTo(1.0, 3);
    });

    it('should normalize weights that do not sum to 1', () => {
        const customWeights: Partial<ScoreWeights> = { coverage: 2, deductibles: 2 };
        const result = quoteScorer.calculateScore(mockQuote, mockCrossRefs, [], customWeights);
        
        const sum = Object.values(result.weights).reduce((a, b) => a + b, 0);
        expect(sum).toBeCloseTo(1.0, 3);
    });
});
