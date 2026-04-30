"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const quoteValidator_1 = require("../quoteValidator");
(0, vitest_1.describe)('quoteValidator', () => {
    const createMockQuote = (overrides = {}) => (Object.assign({ insurerName: 'Test Insurer', policyName: 'Test Policy', priceAnnual: 5000000, currency: 'COP', coverages: [
            { name: 'Incendio (Edificio y Contenidos)', canonicalName: 'Incendio (Edificio y Contenidos)', value: '500000000', deductible: '10%', confidence: 95, categoryId: null, matchConfidence: 0, matchMethod: null },
            { name: 'Responsabilidad Civil (RCE)', canonicalName: 'Responsabilidad Civil (RCE)', value: '100000000', deductible: '5 SMMLV', confidence: 95, categoryId: null, matchConfidence: 0, matchMethod: null },
        ], specialConditions: [], rawText: '', parseConfidence: 95 }, overrides));
    (0, vitest_1.describe)('validatePremium', () => {
        (0, vitest_1.it)('should pass for valid premium', () => {
            const quote = createMockQuote({ priceAnnual: 5000000 });
            const result = (0, quoteValidator_1.validatePremium)(quote);
            (0, vitest_1.expect)(result).toBeNull();
        });
        (0, vitest_1.it)('should flag missing premium', () => {
            const quote = createMockQuote({ priceAnnual: 0 });
            const result = (0, quoteValidator_1.validatePremium)(quote);
            (0, vitest_1.expect)(result).not.toBeNull();
            (0, vitest_1.expect)(result === null || result === void 0 ? void 0 : result.code).toBe('PREMIUM_MISSING');
        });
        (0, vitest_1.it)('should flag premium too low', () => {
            const quote = createMockQuote({ priceAnnual: 50000 });
            const result = (0, quoteValidator_1.validatePremium)(quote);
            (0, vitest_1.expect)(result).not.toBeNull();
            (0, vitest_1.expect)(result === null || result === void 0 ? void 0 : result.code).toBe('PREMIUM_SUSPECT');
        });
        (0, vitest_1.it)('should flag premium too high', () => {
            const quote = createMockQuote({ priceAnnual: 600000000 });
            const result = (0, quoteValidator_1.validatePremium)(quote);
            (0, vitest_1.expect)(result).not.toBeNull();
            (0, vitest_1.expect)(result === null || result === void 0 ? void 0 : result.code).toBe('PREMIUM_SUSPECT');
        });
    });
    (0, vitest_1.describe)('validateCoverageCompleteness', () => {
        (0, vitest_1.it)('should flag incomplete coverages', () => {
            const quote = createMockQuote({ coverages: [] });
            const result = (0, quoteValidator_1.validateCoverageCompleteness)(quote);
            (0, vitest_1.expect)(result).not.toBeNull();
            (0, vitest_1.expect)(result === null || result === void 0 ? void 0 : result.code).toBe('COVERAGES_INCOMPLETE');
        });
        (0, vitest_1.it)('should pass for complete coverages', () => {
            const quote = createMockQuote({
                coverages: [
                    { name: 'Incendio (Edificio y Contenidos)', canonicalName: 'Incendio (Edificio y Contenidos)', value: '500M', deductible: '10%', confidence: 95, categoryId: null, matchConfidence: 0, matchMethod: null },
                    { name: 'Lucro Cesante', canonicalName: 'Lucro Cesante', value: '100M', deductible: 'No aplica', confidence: 95, categoryId: null, matchConfidence: 0, matchMethod: null },
                    { name: 'Sustracción / Hurto', canonicalName: 'Sustracción / Hurto', value: '200M', deductible: '10%', confidence: 95, categoryId: null, matchConfidence: 0, matchMethod: null },
                    { name: 'Equipo Eléctrico y Electrónico', canonicalName: 'Equipo Eléctrico y Electrónico', value: '150M', deductible: '15%', confidence: 95, categoryId: null, matchConfidence: 0, matchMethod: null },
                    { name: 'Rotura de Maquinaria', canonicalName: 'Rotura de Maquinaria', value: '100M', deductible: '10%', confidence: 95, categoryId: null, matchConfidence: 0, matchMethod: null },
                    { name: 'Responsabilidad Civil (RCE)', canonicalName: 'Responsabilidad Civil (RCE)', value: '100M', deductible: '5 SMMLV', confidence: 95, categoryId: null, matchConfidence: 0, matchMethod: null },
                    { name: 'Vidrios Planos', canonicalName: 'Vidrios Planos', value: '50M', deductible: 'No aplica', confidence: 95, categoryId: null, matchConfidence: 0, matchMethod: null },
                    { name: 'Manejo Global / Infidelidad', canonicalName: 'Manejo Global / Infidelidad', value: '100M', deductible: '10%', confidence: 95, categoryId: null, matchConfidence: 0, matchMethod: null },
                    { name: 'Transporte de Mercancías', canonicalName: 'Transporte de Mercancías', value: '50M', deductible: '10%', confidence: 95, categoryId: null, matchConfidence: 0, matchMethod: null },
                    { name: 'Transporte de Valores', canonicalName: 'Transporte de Valores', value: '50M', deductible: '10%', confidence: 95, categoryId: null, matchConfidence: 0, matchMethod: null },
                    { name: 'Asistencia PYME', canonicalName: 'Asistencia PYME', value: 'Incluido', deductible: 'No aplica', confidence: 95, categoryId: null, matchConfidence: 0, matchMethod: null },
                    { name: 'Asistencia Legal', canonicalName: 'Asistencia Legal', value: 'Incluido', deductible: 'No aplica', confidence: 95, categoryId: null, matchConfidence: 0, matchMethod: null },
                    { name: 'Huelga, Motín, Asonada (HMACC)', canonicalName: 'Huelga, Motín, Asonada (HMACC)', value: '100M', deductible: '10%', confidence: 95, categoryId: null, matchConfidence: 0, matchMethod: null },
                    { name: 'Terremoto y Eventos Catastróficos', canonicalName: 'Terremoto y Eventos Catastróficos', value: '200M', deductible: '20%', confidence: 95, categoryId: null, matchConfidence: 0, matchMethod: null },
                ]
            });
            const result = (0, quoteValidator_1.validateCoverageCompleteness)(quote);
            (0, vitest_1.expect)(result).toBeNull();
        });
    });
    (0, vitest_1.describe)('validateDeductibleFormat', () => {
        (0, vitest_1.it)('should accept percentage format', () => {
            (0, vitest_1.expect)((0, quoteValidator_1.validateDeductibleFormat)('10%')).toBeNull();
        });
        (0, vitest_1.it)('should accept SMMLV format', () => {
            (0, vitest_1.expect)((0, quoteValidator_1.validateDeductibleFormat)('5 SMMLV')).toBeNull();
        });
        (0, vitest_1.it)('should accept "No aplica"', () => {
            (0, vitest_1.expect)((0, quoteValidator_1.validateDeductibleFormat)('No aplica')).toBeNull();
        });
        (0, vitest_1.it)('should flag high percentage', () => {
            const result = (0, quoteValidator_1.validateDeductibleFormat)('60%');
            (0, vitest_1.expect)(result).not.toBeNull();
            (0, vitest_1.expect)(result === null || result === void 0 ? void 0 : result.code).toBe('DEDUCTIBLE_HIGH_PERCENTAGE');
        });
        (0, vitest_1.it)('should flag unrecognized format', () => {
            const result = (0, quoteValidator_1.validateDeductibleFormat)('cualquier cosa');
            (0, vitest_1.expect)(result).not.toBeNull();
            (0, vitest_1.expect)(result === null || result === void 0 ? void 0 : result.code).toBe('DEDUCTIBLE_UNRECOGNIZED_FORMAT');
        });
    });
    (0, vitest_1.describe)('validateQuote', () => {
        (0, vitest_1.it)('should return valid result for good quote', () => {
            const quote = createMockQuote();
            const result = (0, quoteValidator_1.validateQuote)(quote);
            (0, vitest_1.expect)(result.isValid).toBe(true);
            (0, vitest_1.expect)(result.coverageCount).toBe(2);
        });
        (0, vitest_1.it)('should return invalid result for bad quote', () => {
            const quote = createMockQuote({
                priceAnnual: 0,
                coverages: []
            });
            const result = (0, quoteValidator_1.validateQuote)(quote);
            (0, vitest_1.expect)(result.isValid).toBe(false);
            (0, vitest_1.expect)(result.flags.length).toBeGreaterThan(0);
        });
        (0, vitest_1.it)('should detect missing coverages', () => {
            const quote = createMockQuote({
                coverages: [
                    { name: 'Incendio (Edificio y Contenidos)', canonicalName: 'Incendio (Edificio y Contenidos)', value: '500M', deductible: '10%', confidence: 95 }
                ]
            });
            const result = (0, quoteValidator_1.validateQuote)(quote);
            const completenessFlag = result.flags.find(f => f.code === 'COVERAGES_INCOMPLETE');
            (0, vitest_1.expect)(completenessFlag).toBeDefined();
        });
    });
});
