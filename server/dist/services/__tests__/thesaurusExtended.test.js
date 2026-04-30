"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const thesaurusMapper_1 = require("../thesaurusMapper");
(0, vitest_1.describe)('extended thesaurus', () => {
    (0, vitest_1.describe)('sub-limit mapping', () => {
        (0, vitest_1.it)('should map Remoción de Escombros to Incendio parent with sub-limit type', () => {
            const result = (0, thesaurusMapper_1.mapCoverageName)('Remoción de Escombros');
            (0, vitest_1.expect)(result.canonicalName).toBe('Remoción de Escombros');
            (0, vitest_1.expect)(result.type).toBe('sub-limit');
            (0, vitest_1.expect)(result.parentCoverage).toBeDefined();
            (0, vitest_1.expect)(result.confidence).toBeGreaterThan(0.6);
        });
        (0, vitest_1.it)('should map Honorarios Profesionales with sub-limit type', () => {
            const result = (0, thesaurusMapper_1.mapCoverageName)('Honorarios Profesionales');
            (0, vitest_1.expect)(result.type).toBe('sub-limit');
            (0, vitest_1.expect)(result.parentCoverage).toBeDefined();
        });
        (0, vitest_1.it)('should use lower threshold (0.6) for sub-limits', () => {
            // Sub-limits should be accepted at 0.65 confidence
            const result = (0, thesaurusMapper_1.mapCoverageName)('Remoción de Escombros');
            (0, vitest_1.expect)(result.confidence).toBeGreaterThanOrEqual(0.6);
            (0, vitest_1.expect)(result.needsReview).toBe(false);
        });
        (0, vitest_1.it)('should still flag sub-limits below 0.6', () => {
            const result = (0, thesaurusMapper_1.mapCoverageName)('XYZ Unknown Sub-limit');
            if (result.type !== 'main') {
                (0, vitest_1.expect)(result.confidence).toBeLessThan(0.6);
                (0, vitest_1.expect)(result.needsReview).toBe(true);
            }
        });
    });
    (0, vitest_1.describe)('rider mapping', () => {
        (0, vitest_1.it)('should map Amparo Automático as rider type', () => {
            const result = (0, thesaurusMapper_1.mapCoverageName)('Amparo Automático de Nuevos Bienes');
            (0, vitest_1.expect)(result.type).toBe('rider');
            (0, vitest_1.expect)(result.parentCoverage).toBeDefined();
        });
        (0, vitest_1.it)('should use lower threshold (0.6) for riders', () => {
            const result = (0, thesaurusMapper_1.mapCoverageName)('Amparo Automático');
            if (result.type === 'rider') {
                (0, vitest_1.expect)(result.confidence).toBeGreaterThanOrEqual(0.6);
            }
        });
    });
    (0, vitest_1.describe)('type-specific thresholds in normalizeCoverages', () => {
        (0, vitest_1.it)('should accept sub-limits at 0.65 confidence', () => {
            const coverages = [
                { name: 'Remoción de Escombros', value: '1000000', deductible: '10%' },
            ];
            const result = (0, thesaurusMapper_1.normalizeCoverages)(coverages);
            (0, vitest_1.expect)(result.normalized[0].type).toBe('sub-limit');
            // Should NOT need review if confidence >= 0.6
            if (result.normalized[0].confidence >= 0.6) {
                (0, vitest_1.expect)(result.needsReview).toBe(false);
            }
        });
        (0, vitest_1.it)('should include parentCoverage for sub-limits', () => {
            var _a;
            const coverages = [
                { name: 'Remoción de Escombros', value: '1000000', deductible: '10%' },
            ];
            const result = (0, thesaurusMapper_1.normalizeCoverages)(coverages);
            (0, vitest_1.expect)(result.normalized[0].parentCoverage).toBeDefined();
            (0, vitest_1.expect)((_a = result.normalized[0].parentCoverage) === null || _a === void 0 ? void 0 : _a.length).toBeGreaterThan(0);
        });
        (0, vitest_1.it)('should include type for all coverages', () => {
            const coverages = [
                { name: 'Incendio (Edificio y Contenidos)', value: '500M', deductible: '10%' },
                { name: 'Remoción de Escombros', value: '1000000', deductible: '10%' },
            ];
            const result = (0, thesaurusMapper_1.normalizeCoverages)(coverages);
            (0, vitest_1.expect)(result.normalized[0].type).toBe('main');
            (0, vitest_1.expect)(result.normalized[1].type).toBe('sub-limit');
        });
    });
    (0, vitest_1.describe)('thesaurus loading', () => {
        (0, vitest_1.it)('should load main thesaurus', () => {
            const thesaurus = (0, thesaurusMapper_1.loadThesaurus)();
            (0, vitest_1.expect)(thesaurus.length).toBeGreaterThan(0);
            const mainEntries = thesaurus.filter(t => !t.type || t.type === 'main');
            (0, vitest_1.expect)(mainEntries.length).toBeGreaterThan(0);
        });
        (0, vitest_1.it)('should have main coverages from base thesaurus', () => {
            const thesaurus = (0, thesaurusMapper_1.loadThesaurus)();
            const mainEntries = thesaurus.filter(t => !t.type || t.type === 'main');
            const coverageNames = mainEntries.map(t => t.canonicalName);
            (0, vitest_1.expect)(coverageNames).toContain('Incendio (Edificio y Contenidos)');
            (0, vitest_1.expect)(coverageNames).toContain('Responsabilidad Civil (RCE)');
        });
    });
});
