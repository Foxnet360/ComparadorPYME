"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const quoteScorer_1 = require("../quoteScorer");
(0, vitest_1.describe)('quoteScorer', () => {
    const mockQuote = {
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
    const mockCrossRefs = [
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
    (0, vitest_1.it)('should calculate total score within 0-100 range', () => {
        const result = quoteScorer_1.quoteScorer.calculateScore(mockQuote, mockCrossRefs);
        (0, vitest_1.expect)(result.totalScore).toBeGreaterThanOrEqual(0);
        (0, vitest_1.expect)(result.totalScore).toBeLessThanOrEqual(100);
    });
    (0, vitest_1.it)('should calculate coverage completeness score', () => {
        const result = quoteScorer_1.quoteScorer.calculateScore(mockQuote, mockCrossRefs);
        (0, vitest_1.expect)(result.breakdown.coverage).toBeGreaterThan(0);
        (0, vitest_1.expect)(result.coverageCount).toBe(mockQuote.coverages.length);
    });
    (0, vitest_1.it)('should calculate deductible score', () => {
        const result = quoteScorer_1.quoteScorer.calculateScore(mockQuote, mockCrossRefs);
        (0, vitest_1.expect)(result.breakdown.deductibles).toBeGreaterThanOrEqual(0);
        (0, vitest_1.expect)(result.breakdown.deductibles).toBeLessThanOrEqual(100);
    });
    (0, vitest_1.it)('should calculate exclusion score', () => {
        const result = quoteScorer_1.quoteScorer.calculateScore(mockQuote, mockCrossRefs);
        (0, vitest_1.expect)(result.breakdown.exclusions).toBeGreaterThanOrEqual(0);
        (0, vitest_1.expect)(result.breakdown.exclusions).toBeLessThanOrEqual(100);
    });
    (0, vitest_1.it)('should calculate price ratio score', () => {
        const result = quoteScorer_1.quoteScorer.calculateScore(mockQuote, mockCrossRefs);
        (0, vitest_1.expect)(result.breakdown.priceRatio).toBeGreaterThanOrEqual(0);
        (0, vitest_1.expect)(result.breakdown.priceRatio).toBeLessThanOrEqual(100);
        (0, vitest_1.expect)(result.marketPriceAverage).toBeGreaterThan(0);
    });
    (0, vitest_1.it)('should handle empty cross-reference results', () => {
        const result = quoteScorer_1.quoteScorer.calculateScore(mockQuote, []);
        (0, vitest_1.expect)(result.totalScore).toBeGreaterThanOrEqual(0);
        (0, vitest_1.expect)(result.totalScore).toBeLessThanOrEqual(100);
    });
    (0, vitest_1.it)('should handle quote with no coverages', () => {
        const emptyQuote = Object.assign(Object.assign({}, mockQuote), { coverages: [] });
        const result = quoteScorer_1.quoteScorer.calculateScore(emptyQuote, []);
        (0, vitest_1.expect)(result.breakdown.coverage).toBe(0);
        (0, vitest_1.expect)(result.totalScore).toBeGreaterThan(0); // Price and other scores still calculated
    });
    (0, vitest_1.it)('should use market benchmark when no other quotes provided', () => {
        const result = quoteScorer_1.quoteScorer.calculateScore(mockQuote, mockCrossRefs);
        (0, vitest_1.expect)(result.marketPriceAverage).toBeGreaterThan(0);
        (0, vitest_1.expect)(result.quotePriceRank).toBe(0); // No comparison possible
    });
    (0, vitest_1.it)('should calculate price rank when multiple quotes provided', () => {
        const quote2 = Object.assign(Object.assign({}, mockQuote), { insurerName: 'Competitor', priceAnnual: 10000000 });
        const result = quoteScorer_1.quoteScorer.calculateScore(mockQuote, mockCrossRefs, [mockQuote, quote2]);
        (0, vitest_1.expect)(result.quotePriceRank).toBe(1); // mockQuote is cheaper
        (0, vitest_1.expect)(result.marketPriceAverage).toBe(9250000);
    });
    (0, vitest_1.it)('should count alerts correctly', () => {
        const result = quoteScorer_1.quoteScorer.calculateScore(mockQuote, mockCrossRefs);
        (0, vitest_1.expect)(result.criticalAlerts).toBe(1); // One CRITICAL from Robo
        (0, vitest_1.expect)(result.warningAlerts).toBe(1); // One WARNING from Incendio
    });
    (0, vitest_1.it)('should return default weights', () => {
        const weights = quoteScorer_1.quoteScorer.getDefaultWeights();
        (0, vitest_1.expect)(weights.coverage).toBe(0.25);
        (0, vitest_1.expect)(weights.deductibles).toBe(0.20);
        (0, vitest_1.expect)(weights.exclusions).toBe(0.20);
        (0, vitest_1.expect)(weights.priceRatio).toBe(0.15);
        (0, vitest_1.expect)(weights.sublimits).toBe(0.10);
        (0, vitest_1.expect)(weights.warranties).toBe(0.10);
        const sum = Object.values(weights).reduce((a, b) => a + b, 0);
        (0, vitest_1.expect)(sum).toBeCloseTo(1.0, 3);
    });
    (0, vitest_1.it)('should validate custom weights', () => {
        const valid = quoteScorer_1.quoteScorer.validateWeights({ coverage: 0.5, deductibles: 0.5 });
        (0, vitest_1.expect)(valid.valid).toBe(true);
        (0, vitest_1.expect)(valid.errors).toHaveLength(0);
    });
    (0, vitest_1.it)('should reject invalid weights', () => {
        const invalid = quoteScorer_1.quoteScorer.validateWeights({ coverage: 0.5, deductibles: 0.5, exclusions: 0.5 });
        (0, vitest_1.expect)(invalid.valid).toBe(false);
        (0, vitest_1.expect)(invalid.errors.length).toBeGreaterThan(0);
    });
    (0, vitest_1.it)('should reject weights outside 0-1 range', () => {
        const invalid = quoteScorer_1.quoteScorer.validateWeights({ coverage: 1.5 });
        (0, vitest_1.expect)(invalid.valid).toBe(false);
        (0, vitest_1.expect)(invalid.errors.some(e => e.includes('between 0 and 1'))).toBe(true);
    });
    (0, vitest_1.it)('should apply custom weights correctly', () => {
        const customWeights = { coverage: 0.4, deductibles: 0.3, exclusions: 0.15, priceRatio: 0.15 };
        const result = quoteScorer_1.quoteScorer.calculateScore(mockQuote, mockCrossRefs, [], customWeights);
        // Weights are normalized to sum to 1.0
        (0, vitest_1.expect)(result.weights.coverage).toBeGreaterThan(0);
        (0, vitest_1.expect)(result.weights.deductibles).toBeGreaterThan(0);
        const sum = Object.values(result.weights).reduce((a, b) => a + b, 0);
        (0, vitest_1.expect)(sum).toBeCloseTo(1.0, 3);
    });
    (0, vitest_1.it)('should normalize weights that do not sum to 1', () => {
        const customWeights = { coverage: 2, deductibles: 2 };
        const result = quoteScorer_1.quoteScorer.calculateScore(mockQuote, mockCrossRefs, [], customWeights);
        const sum = Object.values(result.weights).reduce((a, b) => a + b, 0);
        (0, vitest_1.expect)(sum).toBeCloseTo(1.0, 3);
    });
});
