"use strict";
/**
 * RAG Retrieval Service
 * Provides functions to retrieve clause chunks using vector similarity and full-text search
 */
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
exports.ragRetrievalService = void 0;
const database_1 = require("../config/database");
const embeddingService_1 = require("./vector/embeddingService");
exports.ragRetrievalService = {
    /**
     * Hybrid search: combines vector similarity and full-text search
     */
    search: (query_1, ...args_1) => __awaiter(void 0, [query_1, ...args_1], void 0, function* (query, options = {}) {
        const { insurerName, coverageTags, sectionType, limit = 5 } = options;
        // Generate embedding for the query
        const queryEmbedding = yield embeddingService_1.embeddingService.generateEmbedding(query);
        // Call the hybrid search RPC
        const { data, error } = yield database_1.supabase
            .rpc('match_clauses', {
            query_embedding: queryEmbedding,
            query_text: query,
            insurer_filter: insurerName || null,
            coverage_filter: coverageTags || null,
            section_filter: sectionType || null,
            match_count: limit
        });
        if (error) {
            console.error('❌ [ragRetrieval] Hybrid search error:', error);
            return [];
        }
        if (!data)
            return [];
        return data.map(row => ({
            id: row.id,
            documentId: row.document_id,
            insurerName: row.insurer_name,
            sectionType: row.section_type,
            coverageTags: row.coverage_tags || [],
            content: row.content,
            pageNumber: row.page_number,
            similarity: row.similarity
        }));
    }),
    /**
     * Vector-only search (faster, no full-text)
     */
    vectorSearch: (query_1, ...args_1) => __awaiter(void 0, [query_1, ...args_1], void 0, function* (query, options = {}) {
        const { insurerName, coverageTags, limit = 5 } = options;
        const queryEmbedding = yield embeddingService_1.embeddingService.generateEmbedding(query);
        const { data, error } = yield database_1.supabase
            .rpc('match_clauses_vector', {
            query_embedding: queryEmbedding,
            insurer_filter: insurerName || null,
            coverage_filter: coverageTags || null,
            match_count: limit
        });
        if (error) {
            console.error('❌ [ragRetrieval] Vector search error:', error);
            return [];
        }
        if (!data)
            return [];
        return data.map(row => ({
            id: row.id,
            documentId: row.document_id,
            insurerName: row.insurer_name,
            sectionType: row.section_type,
            coverageTags: row.coverage_tags || [],
            content: row.content,
            pageNumber: row.page_number,
            similarity: row.similarity
        }));
    }),
    /**
     * Get clauses by coverage name (exact match)
     */
    getByCoverage: (coverageName_1, ...args_1) => __awaiter(void 0, [coverageName_1, ...args_1], void 0, function* (coverageName, options = {}) {
        const { insurerName, sectionType, limit = 3 } = options;
        const { data, error } = yield database_1.supabase
            .rpc('get_clauses_by_coverage', {
            coverage_name: coverageName,
            insurer_filter: insurerName || null,
            section_filter: sectionType || null,
            match_count: limit
        });
        if (error) {
            console.error('❌ [ragRetrieval] Coverage search error:', error);
            return [];
        }
        if (!data)
            return [];
        return data.map(row => ({
            id: row.id,
            documentId: row.document_id,
            insurerName: row.insurer_name,
            sectionType: row.section_type,
            coverageTags: row.coverage_tags || [],
            content: row.content,
            pageNumber: row.page_number,
            similarity: 1.0 // Exact match
        }));
    }),
    /**
     * Search with cross-insurer fallback
     */
    searchWithFallback: (query_1, ...args_1) => __awaiter(void 0, [query_1, ...args_1], void 0, function* (query, options = {}) {
        const { insurerName, coverageTags, limit = 5 } = options;
        // First try: search with insurer filter
        if (insurerName) {
            const results = yield exports.ragRetrievalService.search(query, {
                insurerName,
                coverageTags,
                limit
            });
            if (results.length > 0) {
                return { clauses: results, isFallback: false };
            }
            // Fallback: search without insurer filter
            console.log(`⚠️ [ragRetrieval] No clauses found for ${insurerName}, trying cross-insurer search...`);
            const fallbackResults = yield exports.ragRetrievalService.search(query, {
                coverageTags,
                limit
            });
            return {
                clauses: fallbackResults,
                isFallback: fallbackResults.length > 0
            };
        }
        // No insurer specified, do general search
        const results = yield exports.ragRetrievalService.search(query, { coverageTags, limit });
        return { clauses: results, isFallback: false };
    })
};
