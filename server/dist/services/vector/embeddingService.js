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
exports.embeddingService = void 0;
const genai_1 = require("@google/genai");
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
if (!GEMINI_API_KEY) {
    console.error('❌ [Embedding Service] GEMINI_API_KEY not configured');
}
const EMBEDDING_MODEL_NAME = process.env.GEMINI_EMBEDDING_MODEL || 'gemini-embedding-001';
const EMBEDDING_DIMENSIONS = 768;
const genAI = new genai_1.GoogleGenAI({ apiKey: GEMINI_API_KEY });
exports.embeddingService = {
    /**
     * Genera embedding para un texto usando Gemini Embedding API
     */
    generateEmbedding: (text_1, ...args_1) => __awaiter(void 0, [text_1, ...args_1], void 0, function* (text, retries = 3) {
        var _a, _b;
        const truncatedText = text.slice(0, 8000);
        let lastError = null;
        for (let attempt = 1; attempt <= retries; attempt++) {
            try {
                const result = yield genAI.models.embedContent({
                    model: EMBEDDING_MODEL_NAME,
                    contents: [{ parts: [{ text: truncatedText }] }],
                });
                let embedding = (_b = (_a = result.embeddings) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.values;
                if (!embedding || embedding.length === 0) {
                    throw new Error('No embedding returned from Gemini');
                }
                // Truncar a 768 dimensiones para compatibilidad con la base de datos
                if (embedding.length > EMBEDDING_DIMENSIONS) {
                    console.log(`🔧 [Embedding Service] Truncating embedding from ${embedding.length} to ${EMBEDDING_DIMENSIONS} dims`);
                    embedding = embedding.slice(0, EMBEDDING_DIMENSIONS);
                }
                return embedding;
            }
            catch (error) {
                lastError = error;
                console.warn(`⚠️ [Embedding Service] Attempt ${attempt}/${retries} failed: ${lastError.message}`);
                if (attempt < retries) {
                    const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
                    yield new Promise(resolve => setTimeout(resolve, delay));
                }
            }
        }
        console.error('❌ [Embedding Service] All retry attempts failed:', lastError);
        throw new Error(`Failed to generate embedding after ${retries} attempts: ${lastError === null || lastError === void 0 ? void 0 : lastError.message}`);
    }),
    /**
     * Genera embeddings en batch para múltiples textos
     */
    generateEmbeddingsBatch: (texts) => __awaiter(void 0, void 0, void 0, function* () {
        const results = [];
        const batchSize = 50;
        for (let i = 0; i < texts.length; i += batchSize) {
            const batch = texts.slice(i, i + batchSize);
            const batchPromises = batch.map((text, index) => __awaiter(void 0, void 0, void 0, function* () {
                try {
                    const embedding = yield exports.embeddingService.generateEmbedding(text);
                    return {
                        embedding,
                        text,
                        model: EMBEDDING_MODEL_NAME,
                    };
                }
                catch (error) {
                    console.error(`❌ [Embedding Service] Failed to generate embedding for text ${i + index}:`, error);
                    return null;
                }
            }));
            const batchResults = yield Promise.all(batchPromises);
            results.push(...batchResults.filter((r) => r !== null));
            if (i + batchSize < texts.length) {
                yield new Promise(resolve => setTimeout(resolve, 100));
            }
        }
        return results;
    }),
    /**
     * Genera embedding para una consulta de búsqueda
     */
    generateQueryEmbedding: (query) => __awaiter(void 0, void 0, void 0, function* () {
        return exports.embeddingService.generateEmbedding(query);
    }),
    /**
     * Calcula similitud coseno entre dos vectores
     */
    cosineSimilarity: (vecA, vecB) => {
        if (vecA.length !== vecB.length) {
            throw new Error('Vectors must have same dimension');
        }
        let dotProduct = 0;
        let normA = 0;
        let normB = 0;
        for (let i = 0; i < vecA.length; i++) {
            dotProduct += vecA[i] * vecB[i];
            normA += vecA[i] * vecA[i];
            normB += vecB[i] * vecB[i];
        }
        if (normA === 0 || normB === 0)
            return 0;
        return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
    },
    /**
     * Verifica que la API de Gemini esté funcionando
     */
    verifyConnection: () => __awaiter(void 0, void 0, void 0, function* () {
        try {
            const testEmbedding = yield exports.embeddingService.generateEmbedding('test');
            return testEmbedding.length > 0;
        }
        catch (error) {
            console.error('❌ [Embedding Service] Connection verification failed:', error);
            return false;
        }
    }),
};
console.log(`🔢 [Embedding Service] Initialized with model: ${EMBEDDING_MODEL_NAME} (${EMBEDDING_DIMENSIONS} dims)`);
