"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const quoteValidator_1 = require("../quoteValidator");
const confidenceScorer_1 = require("../confidenceScorer");
(0, vitest_1.describe)('expectedCoverages schema', () => {
    const createMockQuote = (overrides = {}) => (Object.assign({ insurerName: 'Test Insurer', policyName: 'Test Policy', priceAnnual: 5000000, currency: 'COP', coverages: [
            { name: 'Incendio (Edificio y Contenidos)', canonicalName: 'Incendio (Edificio y Contenidos)', value: '500M', deductible: '10%', confidence: 95, categoryId: null, matchConfidence: 0, matchMethod: null },
            { name: 'Responsabilidad Civil (RCE)', canonicalName: 'Responsabilidad Civil (RCE)', value: '100M', deductible: '5 SMMLV', confidence: 95, categoryId: null, matchConfidence: 0, matchMethod: null },
        ], specialConditions: [], rawText: '', parseConfidence: 95 }, overrides));
    (0, vitest_1.describe)('validateCoverageCompleteness with expectedCoverages', () => {
        (0, vitest_1.it)('should validate using expectedCoverages when available', () => {
            const quote = createMockQuote({
                expectedCoverages: [
                    { name: 'Incendio (Edificio y Contenidos)', status: 'present', value: '500M', deductible: '10%' },
                    { name: 'Lucro Cesante', status: 'missing', value: null, deductible: null },
                    { name: 'Sustracción / Hurto', status: 'present', value: '100M', deductible: '10%' },
                ]
            });
            const result = (0, quoteValidator_1.validateCoverageCompleteness)(quote);
            (0, vitest_1.expect)(result).not.toBeNull();
            (0, vitest_1.expect)(result === null || result === void 0 ? void 0 : result.code).toBe('COVERAGES_INCOMPLETE');
            (0, vitest_1.expect)(result === null || result === void 0 ? void 0 : result.message).toContain('Faltan 1 coberturas');
        });
        (0, vitest_1.it)('should pass when all coverages are present', () => {
            const quote = createMockQuote({
                expectedCoverages: [
                    { name: 'Incendio (Edificio y Contenidos)', status: 'present', value: '500M', deductible: '10%' },
                    { name: 'Lucro Cesante', status: 'present', value: '100M', deductible: '10%' },
                    { name: 'Sustracción / Hurto', status: 'present', value: '100M', deductible: '10%' },
                ]
            });
            const result = (0, quoteValidator_1.validateCoverageCompleteness)(quote);
            (0, vitest_1.expect)(result).toBeNull();
        });
        (0, vitest_1.it)('should count excluded coverages as not missing', () => {
            const quote = createMockQuote({
                expectedCoverages: [
                    { name: 'Incendio (Edificio y Contenidos)', status: 'present', value: '500M', deductible: '10%' },
                    { name: 'Lucro Cesante', status: 'excluded', value: 'No contratado', deductible: null },
                ]
            });
            const result = (0, quoteValidator_1.validateCoverageCompleteness)(quote);
            (0, vitest_1.expect)(result).toBeNull();
        });
        (0, vitest_1.it)('should fallback to legacy validation when expectedCoverages not available', () => {
            const quote = createMockQuote({
                coverages: [
                    { name: 'Incendio (Edificio y Contenidos)', canonicalName: 'Incendio (Edificio y Contenidos)', value: '500M', deductible: '10%', confidence: 95, categoryId: null, matchConfidence: 0, matchMethod: null },
                ]
            });
            const result = (0, quoteValidator_1.validateCoverageCompleteness)(quote);
            (0, vitest_1.expect)(result).not.toBeNull();
            (0, vitest_1.expect)(result === null || result === void 0 ? void 0 : result.code).toBe('COVERAGES_INCOMPLETE');
        });
    });
    (0, vitest_1.describe)('calculateConfidence with expectedCoverages', () => {
        (0, vitest_1.it)('should calculate completeness using expectedCoverages', () => {
            const quote = createMockQuote({
                expectedCoverages: [
                    { name: 'Incendio', status: 'present', value: '500M', deductible: '10%' },
                    { name: 'Lucro Cesante', status: 'present', value: '100M', deductible: '10%' },
                    { name: 'Sustracción', status: 'missing', value: null, deductible: null },
                    { name: 'Equipo', status: 'missing', value: null, deductible: null },
                ]
            });
            const validation = {
                isValid: true,
                flags: [],
                coverageCount: 2,
                expectedCoverageCount: 14,
                numericParseSuccess: true
            };
            const result = (0, confidenceScorer_1.calculateConfidence)(quote, validation, true);
            // 2 present out of 4 expected = 50% completeness
            // Score should be reasonable but not perfect
            (0, vitest_1.expect)(result.score).toBeGreaterThanOrEqual(30);
            (0, vitest_1.expect)(result.score).toBeLessThanOrEqual(90);
        });
        (0, vitest_1.it)('should give perfect score when all expectedCoverages are present', () => {
            const allPresent = Array(14).fill(null).map((_, i) => ({
                name: `Coverage ${i}`,
                status: 'present',
                value: '100M',
                deductible: '10%'
            }));
            const quote = createMockQuote({ expectedCoverages: allPresent });
            const validation = {
                isValid: true,
                flags: [],
                coverageCount: 14,
                expectedCoverageCount: 14,
                numericParseSuccess: true
            };
            const result = (0, confidenceScorer_1.calculateConfidence)(quote, validation, true);
            (0, vitest_1.expect)(result.score).toBeGreaterThanOrEqual(80);
        });
    });
});
