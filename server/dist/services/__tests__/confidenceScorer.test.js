"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const confidenceScorer_1 = require("../confidenceScorer");
(0, vitest_1.describe)('confidenceScorer', () => {
    const createMockQuote = (overrides = {}) => (Object.assign({ insurerName: 'Test Insurer', policyName: 'Test Policy', priceAnnual: 5000000, currency: 'COP', coverages: [
            { name: 'Incendio (Edificio y Contenidos)', canonicalName: 'Incendio (Edificio y Contenidos)', value: '500000000', deductible: '10%', confidence: 95, categoryId: null, matchConfidence: 0, matchMethod: null },
            { name: 'Responsabilidad Civil (RCE)', canonicalName: 'Responsabilidad Civil (RCE)', value: '100000000', deductible: '5 SMMLV', confidence: 95, categoryId: null, matchConfidence: 0, matchMethod: null },
        ], specialConditions: [], rawText: '', parseConfidence: 95 }, overrides));
    const createMockValidation = (overrides = {}) => (Object.assign({ isValid: true, flags: [], coverageCount: 14, expectedCoverageCount: 14, numericParseSuccess: true }, overrides));
    (0, vitest_1.describe)('calculateConfidence', () => {
        (0, vitest_1.it)('should return high confidence for perfect extraction', () => {
            const quote = createMockQuote({
                coverages: Array(14).fill(null).map((_, i) => ({
                    name: `Coverage ${i}`,
                    canonicalName: `Coverage ${i}`,
                    value: '1000000',
                    deductible: '10%',
                    confidence: 95
                }))
            });
            const validation = createMockValidation();
            const result = (0, confidenceScorer_1.calculateConfidence)(quote, validation, true);
            (0, vitest_1.expect)(result.score).toBeGreaterThanOrEqual(80);
            (0, vitest_1.expect)(result.needsReview).toBe(false);
            (0, vitest_1.expect)(result.isCritical).toBe(false);
        });
        (0, vitest_1.it)('should return low confidence for poor extraction', () => {
            const quote = createMockQuote({
                priceAnnual: 0,
                coverages: []
            });
            const validation = createMockValidation({
                isValid: false,
                flags: [
                    { field: 'priceAnnual', severity: 'WARNING', message: 'Missing premium', code: 'PREMIUM_MISSING' }
                ],
                coverageCount: 0,
                numericParseSuccess: false
            });
            const result = (0, confidenceScorer_1.calculateConfidence)(quote, validation, false);
            (0, vitest_1.expect)(result.score).toBeLessThan(50);
            (0, vitest_1.expect)(result.needsReview).toBe(true);
            (0, vitest_1.expect)(result.isCritical).toBe(true);
        });
        (0, vitest_1.it)('should give bonus for structured extraction', () => {
            const quote = createMockQuote();
            const validation = createMockValidation();
            const structuredResult = (0, confidenceScorer_1.calculateConfidence)(quote, validation, true);
            const unstructuredResult = (0, confidenceScorer_1.calculateConfidence)(quote, validation, false);
            (0, vitest_1.expect)(structuredResult.score).toBeGreaterThanOrEqual(unstructuredResult.score);
        });
        (0, vitest_1.it)('should include breakdown', () => {
            const quote = createMockQuote();
            const validation = createMockValidation();
            const result = (0, confidenceScorer_1.calculateConfidence)(quote, validation, true);
            (0, vitest_1.expect)(result.breakdown.coverageCompleteness).toBeDefined();
            (0, vitest_1.expect)(result.breakdown.numericParseSuccess).toBeDefined();
            (0, vitest_1.expect)(result.breakdown.validationPassRate).toBeDefined();
            (0, vitest_1.expect)(result.breakdown.schemaCompliance).toBeDefined();
        });
    });
    (0, vitest_1.describe)('getConfidenceLabel', () => {
        (0, vitest_1.it)('should return "Alta" for high scores', () => {
            (0, vitest_1.expect)((0, confidenceScorer_1.getConfidenceLabel)(95)).toBe('Alta');
        });
        (0, vitest_1.it)('should return "Media" for medium scores', () => {
            (0, vitest_1.expect)((0, confidenceScorer_1.getConfidenceLabel)(80)).toBe('Media');
        });
        (0, vitest_1.it)('should return "Baja" for low scores', () => {
            (0, vitest_1.expect)((0, confidenceScorer_1.getConfidenceLabel)(60)).toBe('Baja');
        });
        (0, vitest_1.it)('should return "Crítica" for very low scores', () => {
            (0, vitest_1.expect)((0, confidenceScorer_1.getConfidenceLabel)(30)).toBe('Crítica');
        });
    });
    (0, vitest_1.describe)('getConfidenceColor', () => {
        (0, vitest_1.it)('should return green for high scores', () => {
            (0, vitest_1.expect)((0, confidenceScorer_1.getConfidenceColor)(95)).toBe('green');
        });
        (0, vitest_1.it)('should return yellow for medium scores', () => {
            (0, vitest_1.expect)((0, confidenceScorer_1.getConfidenceColor)(80)).toBe('yellow');
        });
        (0, vitest_1.it)('should return orange for low scores', () => {
            (0, vitest_1.expect)((0, confidenceScorer_1.getConfidenceColor)(60)).toBe('orange');
        });
        (0, vitest_1.it)('should return red for very low scores', () => {
            (0, vitest_1.expect)((0, confidenceScorer_1.getConfidenceColor)(30)).toBe('red');
        });
    });
    (0, vitest_1.describe)('formatConfidence', () => {
        (0, vitest_1.it)('should format high confidence correctly', () => {
            const quote = createMockQuote({
                coverages: Array(14).fill(null).map((_, i) => ({
                    name: `Coverage ${i}`,
                    canonicalName: `Coverage ${i}`,
                    value: '1000000',
                    deductible: '10%',
                    confidence: 95
                }))
            });
            const result = (0, confidenceScorer_1.calculateConfidence)(quote, createMockValidation(), true);
            const formatted = (0, confidenceScorer_1.formatConfidence)(result);
            (0, vitest_1.expect)(formatted).toContain('/100');
            (0, vitest_1.expect)(formatted).toContain('Alta');
        });
        (0, vitest_1.it)('should include review flag when needed', () => {
            const result = (0, confidenceScorer_1.calculateConfidence)(createMockQuote({ priceAnnual: 0, coverages: [] }), createMockValidation({ isValid: false, coverageCount: 0 }), false);
            const formatted = (0, confidenceScorer_1.formatConfidence)(result);
            (0, vitest_1.expect)(formatted).toContain('Revisar');
        });
    });
});
