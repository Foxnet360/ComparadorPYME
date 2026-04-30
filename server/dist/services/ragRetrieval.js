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
exports.ragRetrieval = void 0;
const vectorStore_1 = require("./vectorStore");
const embeddingService_1 = require("./vector/embeddingService");
exports.ragRetrieval = {
    /**
     * Recupera chunks relevantes para una consulta
     */
    retrieve: (query_1, insurerName_1, ...args_1) => __awaiter(void 0, [query_1, insurerName_1, ...args_1], void 0, function* (query, insurerName, limit = 5) {
        const queryEmbedding = yield embeddingService_1.embeddingService.generateQueryEmbedding(query);
        let results = [];
        if (insurerName) {
            results = yield vectorStore_1.vectorStore.search(insurerName, queryEmbedding, undefined, limit);
        }
        else {
            const documents = yield vectorStore_1.vectorStore.listDocuments();
            for (const doc of documents) {
                const insurerResults = yield vectorStore_1.vectorStore.search(doc.insurerName, queryEmbedding, undefined, limit);
                results.push(...insurerResults);
            }
            results.sort((a, b) => a.distance - b.distance);
            results = results.slice(0, limit);
        }
        return {
            chunks: results,
            query,
            insurerName,
        };
    }),
    /**
     * Recupera chunks para múltiples términos de búsqueda
     */
    retrieveWithTerms: (terms_1, insurerName_1, ...args_1) => __awaiter(void 0, [terms_1, insurerName_1, ...args_1], void 0, function* (terms, insurerName, limitPerTerm = 3) {
        const allChunks = [];
        for (const term of terms) {
            const results = yield exports.ragRetrieval.retrieve(term, insurerName, limitPerTerm);
            allChunks.push(...results.chunks);
        }
        const uniqueChunks = allChunks.reduce((acc, chunk) => {
            if (!acc.find(c => c.id === chunk.id)) {
                acc.push(chunk);
            }
            return acc;
        }, []);
        const citations = uniqueChunks.map(chunk => ({
            chunk: chunk.content,
            metadata: chunk.metadata,
        }));
        return {
            chunks: uniqueChunks,
            citations,
        };
    }),
    /**
     * Recupera chunks para una cobertura específica
     */
    retrieveForCoverage: (coverageName, insurerName) => __awaiter(void 0, void 0, void 0, function* () {
        const terms = [
            coverageName,
            `${coverageName} exclusiones`,
            `${coverageName} limitaciones`,
            `${coverageName} condiciones`,
        ];
        return exports.ragRetrieval.retrieveWithTerms(terms, insurerName, 3);
    }),
    /**
     * Construye citation metadata para el análisis
     */
    buildCitations: (chunks) => {
        return chunks.map(chunk => ({
            clauseId: chunk.metadata.clauseId || chunk.id,
            section: chunk.metadata.section || chunk.metadata.chapter || 'General',
            page: chunk.metadata.pageStart,
            excerpt: chunk.content.substring(0, 200) + (chunk.content.length > 200 ? '...' : ''),
        }));
    },
};
