"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const crossReferenceEngine_1 = require("../crossReferenceEngine");
const ragRetrievalService_1 = require("../ragRetrievalService");
// Mock the ragRetrievalService
vitest_1.vi.mock('../ragRetrievalService', () => ({
    ragRetrievalService: {
        searchWithFallback: vitest_1.vi.fn()
    }
}));
(0, vitest_1.describe)('crossReferenceEngine', () => {
    const mockCoverage = {
        name: 'Incendio',
        canonicalName: 'Incendio (Edificio y Contenidos)',
        value: '500.000.000',
        deductible: '10%',
        confidence: 95
    };
    const mockQuote = {
        insurerName: 'Seguros Bolívar',
        policyName: 'PYME Empresarial',
        priceAnnual: 8500000,
        currency: 'COP',
        coverages: [mockCoverage],
        specialConditions: [],
        rawText: '',
        parseConfidence: 95
    };
    const mockClauses = [
        {
            id: '1',
            documentId: 'doc1',
            insurerName: 'Seguros Bolívar',
            sectionType: 'COBERTURA',
            coverageTags: ['Incendio (Edificio y Contenidos)'],
            content: 'Deducible: 10% del valor del siniestro. No cubre terremotos ni movimientos sísmicos.',
            pageNumber: 15,
            similarity: 0.92
        }
    ];
    (0, vitest_1.beforeEach)(() => {
        vitest_1.vi.clearAllMocks();
    });
    (0, vitest_1.it)('should cross-reference coverage and return result', () => __awaiter(void 0, void 0, void 0, function* () {
        ragRetrievalService_1.ragRetrievalService.searchWithFallback.mockResolvedValue({
            clauses: mockClauses,
            isFallback: false
        });
        const result = yield crossReferenceEngine_1.crossReferenceEngine.crossReferenceCoverage(mockCoverage, 'Seguros Bolívar');
        (0, vitest_1.expect)(result).toBeDefined();
        (0, vitest_1.expect)(result.coverageName).toBe(mockCoverage.canonicalName);
        (0, vitest_1.expect)(result.isVerified).toBe(true);
    }));
    (0, vitest_1.it)('should detect deductible discrepancies', () => __awaiter(void 0, void 0, void 0, function* () {
        const clauseWithHigherDeductible = [Object.assign(Object.assign({}, mockClauses[0]), { content: 'Deducible: 20% del valor del siniestro.' })];
        ragRetrievalService_1.ragRetrievalService.searchWithFallback.mockResolvedValue({
            clauses: clauseWithHigherDeductible,
            isFallback: false
        });
        const result = yield crossReferenceEngine_1.crossReferenceEngine.crossReferenceCoverage(mockCoverage, 'Seguros Bolívar');
        const criticalAlert = result.alerts.find(a => a.level === 'CRITICAL');
        (0, vitest_1.expect)(criticalAlert).toBeDefined();
        (0, vitest_1.expect)(criticalAlert === null || criticalAlert === void 0 ? void 0 : criticalAlert.title).toContain('Discrepancia');
    }));
    (0, vitest_1.it)('should detect favorable deductibles', () => __awaiter(void 0, void 0, void 0, function* () {
        const clauseWithLowerDeductible = [Object.assign(Object.assign({}, mockClauses[0]), { content: 'Deducible: 5% del valor del siniestro.' })];
        ragRetrievalService_1.ragRetrievalService.searchWithFallback.mockResolvedValue({
            clauses: clauseWithLowerDeductible,
            isFallback: false
        });
        const result = yield crossReferenceEngine_1.crossReferenceEngine.crossReferenceCoverage(mockCoverage, 'Seguros Bolívar');
        const goodAlert = result.alerts.find(a => a.level === 'GOOD');
        (0, vitest_1.expect)(goodAlert).toBeDefined();
        (0, vitest_1.expect)(goodAlert === null || goodAlert === void 0 ? void 0 : goodAlert.title).toContain('favorable');
    }));
    (0, vitest_1.it)('should detect exclusions in clauses', () => __awaiter(void 0, void 0, void 0, function* () {
        ragRetrievalService_1.ragRetrievalService.searchWithFallback.mockResolvedValue({
            clauses: mockClauses,
            isFallback: false
        });
        const result = yield crossReferenceEngine_1.crossReferenceEngine.crossReferenceCoverage(mockCoverage, 'Seguros Bolívar');
        const warningAlert = result.alerts.find(a => a.level === 'WARNING');
        (0, vitest_1.expect)(warningAlert).toBeDefined();
        (0, vitest_1.expect)(warningAlert === null || warningAlert === void 0 ? void 0 : warningAlert.title).toContain('Exclusiones');
    }));
    (0, vitest_1.it)('should handle no clauses found', () => __awaiter(void 0, void 0, void 0, function* () {
        ragRetrievalService_1.ragRetrievalService.searchWithFallback.mockResolvedValue({
            clauses: [],
            isFallback: false
        });
        const result = yield crossReferenceEngine_1.crossReferenceEngine.crossReferenceCoverage(mockCoverage, 'Seguros Bolívar');
        (0, vitest_1.expect)(result.isVerified).toBe(false);
        const infoAlert = result.alerts.find(a => a.level === 'INFO');
        (0, vitest_1.expect)(infoAlert).toBeDefined();
        (0, vitest_1.expect)(infoAlert === null || infoAlert === void 0 ? void 0 : infoAlert.title).toContain('Sin cláusulas');
    }));
    (0, vitest_1.it)('should handle fallback clauses', () => __awaiter(void 0, void 0, void 0, function* () {
        ragRetrievalService_1.ragRetrievalService.searchWithFallback.mockResolvedValue({
            clauses: mockClauses,
            isFallback: true
        });
        const result = yield crossReferenceEngine_1.crossReferenceEngine.crossReferenceCoverage(mockCoverage, 'Seguros Bolívar');
        // Fallback alert has both isFallback=true and specific title
        const fallbackAlert = result.alerts.find(a => a.isFallback && a.title === 'Referencia genérica');
        (0, vitest_1.expect)(fallbackAlert).toBeDefined();
        (0, vitest_1.expect)(fallbackAlert === null || fallbackAlert === void 0 ? void 0 : fallbackAlert.title).toBe('Referencia genérica');
    }));
    (0, vitest_1.it)('should handle errors gracefully', () => __awaiter(void 0, void 0, void 0, function* () {
        ragRetrievalService_1.ragRetrievalService.searchWithFallback.mockRejectedValue(new Error('Database error'));
        const result = yield crossReferenceEngine_1.crossReferenceEngine.crossReferenceCoverage(mockCoverage, 'Seguros Bolívar');
        (0, vitest_1.expect)(result.alerts.length).toBeGreaterThan(0);
        (0, vitest_1.expect)(result.alerts[0].title).toContain('Error');
    }));
    (0, vitest_1.it)('should cross-reference all coverages in a quote', () => __awaiter(void 0, void 0, void 0, function* () {
        const multiCoverageQuote = Object.assign(Object.assign({}, mockQuote), { coverages: [
                mockCoverage,
                Object.assign(Object.assign({}, mockCoverage), { name: 'Robo', canonicalName: 'Robo', value: '200M' })
            ] });
        ragRetrievalService_1.ragRetrievalService.searchWithFallback.mockResolvedValue({
            clauses: mockClauses,
            isFallback: false
        });
        const results = yield crossReferenceEngine_1.crossReferenceEngine.crossReferenceQuote(multiCoverageQuote);
        (0, vitest_1.expect)(results).toHaveLength(2);
        (0, vitest_1.expect)(results[0].coverageName).toBe('Incendio (Edificio y Contenidos)');
        (0, vitest_1.expect)(results[1].coverageName).toBe('Robo');
    }));
    (0, vitest_1.it)('should handle coverage with no deductible', () => __awaiter(void 0, void 0, void 0, function* () {
        const coverageNoDed = Object.assign(Object.assign({}, mockCoverage), { deductible: 'No aplica' });
        ragRetrievalService_1.ragRetrievalService.searchWithFallback.mockResolvedValue({
            clauses: mockClauses,
            isFallback: false
        });
        const result = yield crossReferenceEngine_1.crossReferenceEngine.crossReferenceCoverage(coverageNoDed, 'Seguros Bolívar');
        // Should not generate deductible comparison alerts
        const dedAlert = result.alerts.find(a => a.title.includes('Discrepancia') || a.title.includes('favorable'));
        (0, vitest_1.expect)(dedAlert).toBeUndefined();
    }));
    (0, vitest_1.it)('should handle unparseable deductible values', () => __awaiter(void 0, void 0, void 0, function* () {
        const coverageWeirdDed = Object.assign(Object.assign({}, mockCoverage), { deductible: 'Ver cláusula 5' });
        ragRetrievalService_1.ragRetrievalService.searchWithFallback.mockResolvedValue({
            clauses: mockClauses,
            isFallback: false
        });
        const result = yield crossReferenceEngine_1.crossReferenceEngine.crossReferenceCoverage(coverageWeirdDed, 'Seguros Bolívar');
        (0, vitest_1.expect)(result).toBeDefined();
        // Should not crash, just skip comparison
    }));
    (0, vitest_1.it)('should include clause reference in critical alerts', () => __awaiter(void 0, void 0, void 0, function* () {
        const clauseWithHigherDeductible = [Object.assign(Object.assign({}, mockClauses[0]), { content: 'Deducible: 20% del valor del siniestro.' })];
        ragRetrievalService_1.ragRetrievalService.searchWithFallback.mockResolvedValue({
            clauses: clauseWithHigherDeductible,
            isFallback: false
        });
        const result = yield crossReferenceEngine_1.crossReferenceEngine.crossReferenceCoverage(mockCoverage, 'Seguros Bolívar');
        const criticalAlert = result.alerts.find(a => a.level === 'CRITICAL');
        (0, vitest_1.expect)(criticalAlert).toBeDefined();
        (0, vitest_1.expect)(criticalAlert === null || criticalAlert === void 0 ? void 0 : criticalAlert.clauseReference).toBeDefined();
    }));
});
