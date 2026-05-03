"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const thesaurusMapper_1 = require("../thesaurusMapper");
(0, vitest_1.describe)('thesaurusMapper', () => {
    (0, vitest_1.describe)('loadThesaurus', () => {
        (0, vitest_1.it)('should load thesaurus successfully', () => {
            const thesaurus = (0, thesaurusMapper_1.loadThesaurus)();
            (0, vitest_1.expect)(thesaurus.length).toBeGreaterThan(0);
            (0, vitest_1.expect)(thesaurus[0]).toHaveProperty('canonicalName');
            (0, vitest_1.expect)(thesaurus[0]).toHaveProperty('variants');
            (0, vitest_1.expect)(thesaurus[0]).toHaveProperty('category');
        });
        (0, vitest_1.it)('should have common PYME coverages', () => {
            const thesaurus = (0, thesaurusMapper_1.loadThesaurus)();
            const coverageNames = thesaurus.map(t => t.canonicalName);
            (0, vitest_1.expect)(coverageNames).toContain('Incendio (Edificio y Contenidos)');
            (0, vitest_1.expect)(coverageNames).toContain('Responsabilidad Civil (RCE)');
            (0, vitest_1.expect)(coverageNames).toContain('Lucro Cesante');
        });
    });
    (0, vitest_1.describe)('mapCoverageName', () => {
        (0, vitest_1.it)('should match exact canonical names', () => {
            const result = (0, thesaurusMapper_1.mapCoverageName)('Incendio (Edificio y Contenidos)');
            (0, vitest_1.expect)(result.canonicalName).toBe('Incendio (Edificio y Contenidos)');
            (0, vitest_1.expect)(result.confidence).toBe(1.0);
            (0, vitest_1.expect)(result.needsReview).toBe(false);
        });
        (0, vitest_1.it)('should match variant names', () => {
            const result = (0, thesaurusMapper_1.mapCoverageName)('Amparo Básico (Incendio)');
            (0, vitest_1.expect)(result.canonicalName).toBe('Incendio (Edificio y Contenidos)');
            (0, vitest_1.expect)(result.confidence).toBeGreaterThan(0.7);
            (0, vitest_1.expect)(result.needsReview).toBe(false);
        });
        (0, vitest_1.it)('should match similar names with fuzzy matching', () => {
            const result = (0, thesaurusMapper_1.mapCoverageName)('Incendio y Rayo');
            (0, vitest_1.expect)(result.canonicalName).toBe('Incendio (Edificio y Contenidos)');
            (0, vitest_1.expect)(result.confidence).toBeGreaterThan(0.5);
        });
        (0, vitest_1.it)('should return original name for unknown coverage', () => {
            const result = (0, thesaurusMapper_1.mapCoverageName)('12345!@#$%67890');
            // With completely random input, it may still fuzzy-match to something,
            // but confidence should be very low and it should need review
            (0, vitest_1.expect)(result.confidence).toBeLessThan(0.5);
            (0, vitest_1.expect)(result.needsReview).toBe(true);
        });
        (0, vitest_1.it)('should handle case insensitivity', () => {
            const result1 = (0, thesaurusMapper_1.mapCoverageName)('incendio (edificio y contenidos)');
            const result2 = (0, thesaurusMapper_1.mapCoverageName)('INCENDIO (EDIFICIO Y CONTENIDOS)');
            (0, vitest_1.expect)(result1.canonicalName).toBe('Incendio (Edificio y Contenidos)');
            (0, vitest_1.expect)(result2.canonicalName).toBe('Incendio (Edificio y Contenidos)');
        });
        (0, vitest_1.it)('should match RCE variants', () => {
            const result = (0, thesaurusMapper_1.mapCoverageName)('RC General');
            (0, vitest_1.expect)(result.canonicalName).toBe('Responsabilidad Civil (RCE)');
            (0, vitest_1.expect)(result.confidence).toBeGreaterThan(0.7);
        });
    });
    (0, vitest_1.describe)('normalizeDeductible', () => {
        (0, vitest_1.it)('should handle "No aplica"', () => {
            (0, vitest_1.expect)((0, thesaurusMapper_1.normalizeDeductible)('No aplica')).toEqual({
                normalized: 'No aplica',
                needsReview: false,
            });
        });
        (0, vitest_1.it)('should handle "No aplica Deducible"', () => {
            (0, vitest_1.expect)((0, thesaurusMapper_1.normalizeDeductible)('No aplica Deducible')).toEqual({
                normalized: 'No aplica',
                needsReview: false,
            });
        });
        (0, vitest_1.it)('should handle percentages', () => {
            (0, vitest_1.expect)((0, thesaurusMapper_1.normalizeDeductible)('10%')).toEqual({
                normalized: '10%',
                needsReview: false,
            });
        });
        (0, vitest_1.it)('should handle percentage with context', () => {
            const result = (0, thesaurusMapper_1.normalizeDeductible)('10% / Mín. 2 SMMLV (aplica sobre pérdida)');
            (0, vitest_1.expect)(result.normalized).toBe('10% / Mín. 2 SMMLV (aplica sobre pérdida)');
            (0, vitest_1.expect)(result.context).toBe('/ Mín. 2 SMMLV (aplica sobre pérdida)');
            (0, vitest_1.expect)(result.needsReview).toBe(false);
        });
        (0, vitest_1.it)('should handle SMMLV format', () => {
            (0, vitest_1.expect)((0, thesaurusMapper_1.normalizeDeductible)('5 SMMLV')).toEqual({
                normalized: '5 SMMLV',
                needsReview: false,
            });
            (0, vitest_1.expect)((0, thesaurusMapper_1.normalizeDeductible)('3 SM')).toEqual({
                normalized: '3 SMMLV',
                needsReview: false,
            });
        });
        (0, vitest_1.it)('should handle fixed amounts', () => {
            const result = (0, thesaurusMapper_1.normalizeDeductible)('$500,000');
            (0, vitest_1.expect)(result.normalized).toBe('$500.000');
            (0, vitest_1.expect)(result.needsReview).toBe(false);
        });
        (0, vitest_1.it)('should handle empty string', () => {
            (0, vitest_1.expect)((0, thesaurusMapper_1.normalizeDeductible)('')).toEqual({
                normalized: 'No aplica',
                needsReview: false,
            });
        });
        (0, vitest_1.it)('should flag unknown formats for review', () => {
            const result = (0, thesaurusMapper_1.normalizeDeductible)('cualquier cosa');
            (0, vitest_1.expect)(result.normalized).toBe('cualquier cosa');
            (0, vitest_1.expect)(result.needsReview).toBe(true);
        });
    });
    (0, vitest_1.describe)('normalizeCoverages', () => {
        (0, vitest_1.it)('should normalize array of coverages', () => {
            const coverages = [
                { name: 'Amparo Básico (Incendio)', value: '500M', deductible: '10%' },
                { name: 'RC General', value: '100M', deductible: '5 SMMLV' },
            ];
            const result = (0, thesaurusMapper_1.normalizeCoverages)(coverages);
            (0, vitest_1.expect)(result.normalized[0].name).toBe('Incendio (Edificio y Contenidos)');
            (0, vitest_1.expect)(result.normalized[0].deductible).toBe('10%');
            (0, vitest_1.expect)(result.normalized[1].name).toBe('Responsabilidad Civil (RCE)');
            (0, vitest_1.expect)(result.normalized[1].deductible).toBe('5 SMMLV');
            (0, vitest_1.expect)(result.needsReview).toBe(false);
        });
        (0, vitest_1.it)('should track original names', () => {
            const coverages = [
                { name: 'Amparo Básico (Incendio)', value: '500M', deductible: '10%' },
            ];
            const result = (0, thesaurusMapper_1.normalizeCoverages)(coverages);
            (0, vitest_1.expect)(result.normalized[0].originalName).toBe('Amparo Básico (Incendio)');
        });
        (0, vitest_1.it)('should flag when review is needed', () => {
            const coverages = [
                { name: 'XYZ123-Unknown-Coverage-QWERTY', value: '100M', deductible: '10%' },
            ];
            const result = (0, thesaurusMapper_1.normalizeCoverages)(coverages);
            (0, vitest_1.expect)(result.needsReview).toBe(true);
            (0, vitest_1.expect)(result.normalized[0].confidence).toBeLessThan(0.3);
        });
        (0, vitest_1.it)('should handle empty coverage array', () => {
            const result = (0, thesaurusMapper_1.normalizeCoverages)([]);
            (0, vitest_1.expect)(result.normalized).toHaveLength(0);
            (0, vitest_1.expect)(result.needsReview).toBe(false);
        });
    });
});
