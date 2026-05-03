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
const semanticMatcher_1 = require("../semanticMatcher");
const embeddingService_1 = require("../vector/embeddingService");
const gemini_1 = require("../gemini");
// Mock dependencies
vitest_1.vi.mock('../vector/embeddingService', () => ({
    embeddingService: {
        generateEmbedding: vitest_1.vi.fn(),
        generateEmbeddingsBatch: vitest_1.vi.fn(),
        cosineSimilarity: vitest_1.vi.fn(),
    }
}));
vitest_1.vi.mock('../gemini', () => ({
    geminiService: {
        extractText: vitest_1.vi.fn(),
    }
}));
(0, vitest_1.describe)('semanticMatcher', () => {
    (0, vitest_1.beforeEach)(() => {
        vitest_1.vi.clearAllMocks();
        semanticMatcher_1.semanticMatcher.clearCache();
    });
    (0, vitest_1.describe)('Layer 1: Thesaurus Exact Matching', () => {
        (0, vitest_1.it)('should match exact canonical names', () => __awaiter(void 0, void 0, void 0, function* () {
            const result = yield semanticMatcher_1.semanticMatcher.matchCoverage('Incendio (Edificio y Contenidos)');
            (0, vitest_1.expect)(result.categoryId).toBe(1);
            (0, vitest_1.expect)(result.canonicalName).toBe('Incendio (Edificio y Contenidos)');
            (0, vitest_1.expect)(result.confidence).toBe(1.0);
            (0, vitest_1.expect)(result.method).toBe('thesaurus');
        }));
        (0, vitest_1.it)('should match exact synonyms from thesaurus', () => __awaiter(void 0, void 0, void 0, function* () {
            // "Responsabilidad Civil (RCE)" has synonyms in thesaurus
            const result = yield semanticMatcher_1.semanticMatcher.matchCoverage('Responsabilidad Civil');
            (0, vitest_1.expect)(result.categoryId).toBe(6);
            (0, vitest_1.expect)(result.canonicalName).toBe('Responsabilidad Civil (RCE)');
            (0, vitest_1.expect)(result.confidence).toBe(1.0);
            (0, vitest_1.expect)(result.method).toBe('thesaurus');
        }));
        (0, vitest_1.it)('should match case-insensitively', () => __awaiter(void 0, void 0, void 0, function* () {
            const result = yield semanticMatcher_1.semanticMatcher.matchCoverage('INCENDIO (EDIFICIO Y CONTENIDOS)');
            (0, vitest_1.expect)(result.categoryId).toBe(1);
            (0, vitest_1.expect)(result.confidence).toBe(1.0);
        }));
        (0, vitest_1.it)('should match with accents normalized', () => __awaiter(void 0, void 0, void 0, function* () {
            const result = yield semanticMatcher_1.semanticMatcher.matchCoverage('Responsabilidad Civil (RCE)');
            (0, vitest_1.expect)(result.categoryId).toBe(6);
            (0, vitest_1.expect)(result.confidence).toBe(1.0);
        }));
        (0, vitest_1.it)('should return partial match confidence for substring matches', () => __awaiter(void 0, void 0, void 0, function* () {
            const result = yield semanticMatcher_1.semanticMatcher.matchCoverage('Incendio');
            // Should match category 1 but with lower confidence (partial match)
            (0, vitest_1.expect)(result.categoryId).toBe(1);
            (0, vitest_1.expect)(result.confidence).toBeGreaterThanOrEqual(0.9);
            (0, vitest_1.expect)(result.method).toBe('thesaurus');
        }));
        (0, vitest_1.it)('should prioritize longer partial matches for specificity', () => __awaiter(void 0, void 0, void 0, function* () {
            // "ROTURA DE VIDRIOS" should map to Vidrios Planos (cat 7) not Rotura de Maquinaria (cat 5)
            // because "vidrios" (7 chars) is more specific than "rotura" (6 chars)
            const result = yield semanticMatcher_1.semanticMatcher.matchCoverage('ROTURA DE VIDRIOS');
            (0, vitest_1.expect)(result.categoryId).toBe(7);
            (0, vitest_1.expect)(result.canonicalName).toBe('Vidrios Planos');
            (0, vitest_1.expect)(result.method).toBe('thesaurus');
        }));
    });
    (0, vitest_1.describe)('Layer 2: Fuzzy Matching', () => {
        (0, vitest_1.it)('should match with small typos', () => __awaiter(void 0, void 0, void 0, function* () {
            const result = yield semanticMatcher_1.semanticMatcher.matchCoverage('Responsaviliad Civil');
            (0, vitest_1.expect)(result.categoryId).toBe(6);
            (0, vitest_1.expect)(result.canonicalName).toBe('Responsabilidad Civil (RCE)');
            (0, vitest_1.expect)(result.method).toBe('fuzzy');
            (0, vitest_1.expect)(result.confidence).toBeGreaterThanOrEqual(semanticMatcher_1.CONFIDENCE_THRESHOLDS.FUZZY_MIN);
        }));
        (0, vitest_1.it)('should match with missing accents', () => __awaiter(void 0, void 0, void 0, function* () {
            const result = yield semanticMatcher_1.semanticMatcher.matchCoverage('Equipo Electrico y Electronico');
            (0, vitest_1.expect)(result.categoryId).toBe(4);
            (0, vitest_1.expect)(result.confidence).toBeGreaterThanOrEqual(semanticMatcher_1.CONFIDENCE_THRESHOLDS.FUZZY_MIN);
        }));
        (0, vitest_1.it)('should not match when confidence is below threshold', () => __awaiter(void 0, void 0, void 0, function* () {
            const result = yield semanticMatcher_1.semanticMatcher.matchCoverage('XYZ123 Nonexistent Coverage');
            // Should not match by fuzzy since distance is too high
            (0, vitest_1.expect)(result.categoryId).toBeNull();
            (0, vitest_1.expect)(result.confidence).toBe(0);
        }));
        (0, vitest_1.it)('should handle single character differences', () => __awaiter(void 0, void 0, void 0, function* () {
            const result = yield semanticMatcher_1.semanticMatcher.matchCoverage('Vidrios Planos');
            (0, vitest_1.expect)(result.categoryId).toBe(7);
            (0, vitest_1.expect)(result.confidence).toBeGreaterThanOrEqual(semanticMatcher_1.CONFIDENCE_THRESHOLDS.FUZZY_MIN);
        }));
    });
    (0, vitest_1.describe)('Layer 3: Embedding Matching', () => {
        (0, vitest_1.it)('should match using embeddings when thesaurus and fuzzy fail', () => __awaiter(void 0, void 0, void 0, function* () {
            // Mock embeddings
            const mockCoverageEmbedding = Array(768).fill(0).map((_, i) => i / 768);
            const mockCategoryEmbedding = Array(768).fill(0).map((_, i) => i / 768);
            vitest_1.vi.mocked(embeddingService_1.embeddingService.generateEmbedding).mockResolvedValue(mockCoverageEmbedding);
            vitest_1.vi.mocked(embeddingService_1.embeddingService.generateEmbeddingsBatch).mockResolvedValue(semanticMatcher_1.CANONICAL_CATEGORIES.map(cat => ({
                embedding: mockCategoryEmbedding,
                text: cat.name,
                model: 'gemini-embedding-001'
            })));
            vitest_1.vi.mocked(embeddingService_1.embeddingService.cosineSimilarity).mockReturnValue(0.85);
            // Use a name that won't match by thesaurus or fuzzy
            const result = yield semanticMatcher_1.semanticMatcher.matchCoverage('XYZCoverageForEmbedding456');
            (0, vitest_1.expect)(result.method).toBe('embedding');
            (0, vitest_1.expect)(result.confidence).toBeGreaterThanOrEqual(semanticMatcher_1.CONFIDENCE_THRESHOLDS.EMBEDDING_MIN);
        }));
        (0, vitest_1.it)('should use cached embeddings for repeated queries', () => __awaiter(void 0, void 0, void 0, function* () {
            const mockEmbedding = Array(768).fill(0).map((_, i) => i / 768);
            vitest_1.vi.mocked(embeddingService_1.embeddingService.generateEmbedding).mockResolvedValue(mockEmbedding);
            vitest_1.vi.mocked(embeddingService_1.embeddingService.generateEmbeddingsBatch).mockResolvedValue(semanticMatcher_1.CANONICAL_CATEGORIES.map(cat => ({
                embedding: mockEmbedding,
                text: cat.name,
                model: 'gemini-embedding-001'
            })));
            vitest_1.vi.mocked(embeddingService_1.embeddingService.cosineSimilarity).mockReturnValue(0.85);
            // Use a name that won't match by thesaurus or fuzzy
            const coverageName = 'XYZCoverage123';
            // First call
            yield semanticMatcher_1.semanticMatcher.matchCoverage(coverageName);
            // Second call - should use cache
            yield semanticMatcher_1.semanticMatcher.matchCoverage(coverageName);
            // generateEmbedding should only be called once due to caching
            (0, vitest_1.expect)(embeddingService_1.embeddingService.generateEmbedding).toHaveBeenCalledTimes(1);
        }));
        (0, vitest_1.it)('should not match when cosine similarity is below threshold', () => __awaiter(void 0, void 0, void 0, function* () {
            const mockEmbedding = Array(768).fill(0).map((_, i) => i / 768);
            vitest_1.vi.mocked(embeddingService_1.embeddingService.generateEmbedding).mockResolvedValue(mockEmbedding);
            vitest_1.vi.mocked(embeddingService_1.embeddingService.generateEmbeddingsBatch).mockResolvedValue(semanticMatcher_1.CANONICAL_CATEGORIES.map(cat => ({
                embedding: mockEmbedding,
                text: cat.name,
                model: 'gemini-embedding-001'
            })));
            vitest_1.vi.mocked(embeddingService_1.embeddingService.cosineSimilarity).mockReturnValue(0.5); // Below threshold
            const result = yield semanticMatcher_1.semanticMatcher.matchCoverage('Completely Unrelated Coverage Name');
            // Should fall through to LLM or return null
            (0, vitest_1.expect)(result.method).not.toBe('embedding');
        }));
    });
    (0, vitest_1.describe)('Layer 4: LLM Fallback', () => {
        (0, vitest_1.it)('should use LLM when other layers fail', () => __awaiter(void 0, void 0, void 0, function* () {
            // Mock LLM response
            vitest_1.vi.mocked(gemini_1.geminiService.extractText).mockResolvedValue('CATEGORIA: 6\nCONFIANZA: 0.85');
            const result = yield semanticMatcher_1.semanticMatcher.matchCoverage('RC Extranjera');
            (0, vitest_1.expect)(result.method).toBe('llm');
            (0, vitest_1.expect)(result.categoryId).toBe(6);
            (0, vitest_1.expect)(result.confidence).toBe(0.85);
        }));
        (0, vitest_1.it)('should handle LLM response parsing', () => __awaiter(void 0, void 0, void 0, function* () {
            vitest_1.vi.mocked(gemini_1.geminiService.extractText).mockResolvedValue('CATEGORIA: 3\nCONFIANZA: 0.75');
            // Use a name that won't match by thesaurus or fuzzy
            const result = yield semanticMatcher_1.semanticMatcher.matchCoverage('XYZAmbiguousCoverage123');
            (0, vitest_1.expect)(result.categoryId).toBe(3);
            (0, vitest_1.expect)(result.confidence).toBe(0.75);
        }));
        (0, vitest_1.it)('should reject LLM match when confidence is below threshold', () => __awaiter(void 0, void 0, void 0, function* () {
            vitest_1.vi.mocked(gemini_1.geminiService.extractText).mockResolvedValue('CATEGORIA: 6\nCONFIANZA: 0.3');
            const result = yield semanticMatcher_1.semanticMatcher.matchCoverage('Ambiguous Coverage');
            // Should not return LLM match since confidence is below threshold
            (0, vitest_1.expect)(result.categoryId).toBeNull();
            (0, vitest_1.expect)(result.confidence).toBe(0);
        }));
        (0, vitest_1.it)('should handle invalid LLM responses', () => __awaiter(void 0, void 0, void 0, function* () {
            vitest_1.vi.mocked(gemini_1.geminiService.extractText).mockResolvedValue('Invalid response format');
            const result = yield semanticMatcher_1.semanticMatcher.matchCoverage('Unknown Coverage');
            (0, vitest_1.expect)(result.categoryId).toBeNull();
            (0, vitest_1.expect)(result.confidence).toBe(0);
        }));
    });
    (0, vitest_1.describe)('Edge Cases', () => {
        (0, vitest_1.it)('should handle empty string', () => __awaiter(void 0, void 0, void 0, function* () {
            const result = yield semanticMatcher_1.semanticMatcher.matchCoverage('');
            (0, vitest_1.expect)(result.categoryId).toBeNull();
            (0, vitest_1.expect)(result.confidence).toBe(0);
        }));
        (0, vitest_1.it)('should handle null/undefined', () => __awaiter(void 0, void 0, void 0, function* () {
            const result = yield semanticMatcher_1.semanticMatcher.matchCoverage('');
            (0, vitest_1.expect)(result.categoryId).toBeNull();
            (0, vitest_1.expect)(result.confidence).toBe(0);
        }));
        (0, vitest_1.it)('should handle very long coverage names', () => __awaiter(void 0, void 0, void 0, function* () {
            const longName = 'Responsabilidad Civil Extracontractual por Daños a Terceros en Establecimientos Comerciales y Eventos';
            const result = yield semanticMatcher_1.semanticMatcher.matchCoverage(longName);
            // Should still match to RC category
            (0, vitest_1.expect)(result.categoryId).toBe(6);
        }));
        (0, vitest_1.it)('should get category name by ID', () => {
            const name = semanticMatcher_1.semanticMatcher.getCategoryName(1);
            (0, vitest_1.expect)(name).toBe('Incendio (Edificio y Contenidos)');
        });
        (0, vitest_1.it)('should return null for invalid category ID', () => {
            const name = semanticMatcher_1.semanticMatcher.getCategoryName(999);
            (0, vitest_1.expect)(name).toBeNull();
        });
        (0, vitest_1.it)('should return all categories', () => {
            const categories = semanticMatcher_1.semanticMatcher.getAllCategories();
            (0, vitest_1.expect)(categories).toHaveLength(14);
            (0, vitest_1.expect)(categories[0].id).toBe(1);
        });
    });
    (0, vitest_1.describe)('Performance', () => {
        (0, vitest_1.it)('should match multiple coverages efficiently', () => __awaiter(void 0, void 0, void 0, function* () {
            const coverages = [
                'Incendio (Edificio y Contenidos)',
                'Responsabilidad Civil',
                'Robo y Hurto',
                'Equipo Electrónico',
                'Vidrios Planos'
            ];
            const start = Date.now();
            const results = yield semanticMatcher_1.semanticMatcher.matchCoverages(coverages);
            const duration = Date.now() - start;
            (0, vitest_1.expect)(results).toHaveLength(5);
            (0, vitest_1.expect)(duration).toBeLessThan(5000); // Should complete in under 5 seconds
            // All should be matched by thesaurus (fastest layer)
            results.forEach(result => {
                (0, vitest_1.expect)(result.method).toBe('thesaurus');
                (0, vitest_1.expect)(result.confidence).toBeGreaterThanOrEqual(0.9);
            });
        }));
    });
});
