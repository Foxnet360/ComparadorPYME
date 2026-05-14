/**
 * RAG Retrieval Service
 * Provides functions to retrieve clause chunks using vector similarity and full-text search
 */

import { supabase } from '../config/database';
import { embeddingService } from './vector/embeddingService';
import { insurerNameNormalizer } from './insurerNameNormalizer';

export interface RetrievedClause {
    id: string;
    documentId: string;
    insurerName: string;
    sectionType: string;
    coverageTags: string[];
    content: string;
    pageNumber: number;
    similarity: number;
}

// Minimum similarity threshold for RAG retrieval
const MIN_SIMILARITY_THRESHOLD = 0.7;

interface RagPerformanceLog {
    operation: string;
    insurerName?: string;
    query: string;
    durationMs: number;
    chunksReturned: number;
    avgSimilarity: number;
    timestamp: string;
}

const logRagPerformance = (log: RagPerformanceLog) => {
    console.log(`📊 [RAG Perf] ${log.operation} | Insurer: ${log.insurerName || 'N/A'} | Chunks: ${log.chunksReturned} | AvgSim: ${log.avgSimilarity.toFixed(3)} | Duration: ${log.durationMs}ms`);
};

export const ragRetrievalService = {
    /**
     * Hybrid search: combines vector similarity and full-text search
     */
    search: async (
        query: string,
        options: {
            insurerName?: string;
            coverageTags?: string[];
            sectionType?: string;
            limit?: number;
            minSimilarity?: number;
        } = {}
    ): Promise<RetrievedClause[]> => {
        const startTime = Date.now();
        let { insurerName, coverageTags, sectionType, limit = 15, minSimilarity = MIN_SIMILARITY_THRESHOLD } = options;
        
        // Normalize insurer name before searching
        if (insurerName) {
            const normalized = insurerNameNormalizer.normalize(insurerName);
            if (normalized !== insurerName) {
                console.log(`🔄 [ragRetrieval] Normalized insurer name: "${insurerName}" → "${normalized}"`);
                insurerName = normalized;
            }
        }

        // Generate embedding for the query
        const queryEmbedding = await embeddingService.generateEmbedding(query);

        // Call the unified hybrid search RPC
        const { data, error } = await supabase
            .rpc('match_chunks_unified', {
                query_embedding: queryEmbedding,
                query_text: query,
                insurer_filter: insurerName || null,
                coverage_filter: coverageTags || null,
                section_filter: sectionType || null,
                match_count: limit
            } as any);

        if (error) {
            console.error('❌ [ragRetrieval] Hybrid search error:', error);
            logRagPerformance({
                operation: 'search',
                insurerName,
                query,
                durationMs: Date.now() - startTime,
                chunksReturned: 0,
                avgSimilarity: 0,
                timestamp: new Date().toISOString()
            });
            return [];
        }

        if (!data) {
            logRagPerformance({
                operation: 'search',
                insurerName,
                query,
                durationMs: Date.now() - startTime,
                chunksReturned: 0,
                avgSimilarity: 0,
                timestamp: new Date().toISOString()
            });
            return [];
        }

        const results = (data as any[]).map(row => ({
            id: row.id,
            documentId: row.document_id,
            insurerName: row.insurer_name,
            sectionType: row.section_type,
            coverageTags: row.coverage_tags || [],
            content: row.content,
            pageNumber: row.page_number,
            similarity: row.similarity
        }));

        const avgSimilarity = results.length > 0 
            ? results.reduce((sum, r) => sum + r.similarity, 0) / results.length 
            : 0;

        logRagPerformance({
            operation: 'search',
            insurerName,
            query,
            durationMs: Date.now() - startTime,
            chunksReturned: results.length,
            avgSimilarity,
            timestamp: new Date().toISOString()
        });

        return results;
    },

    /**
     * Vector-only search (faster, no full-text)
     */
    vectorSearch: async (
        query: string,
        options: {
            insurerName?: string;
            coverageTags?: string[];
            limit?: number;
        } = {}
    ): Promise<RetrievedClause[]> => {
        const startTime = Date.now();
        let { insurerName, coverageTags, limit = 5 } = options;
        
        // Normalize insurer name before searching
        if (insurerName) {
            const normalized = insurerNameNormalizer.normalize(insurerName);
            if (normalized !== insurerName) {
                console.log(`🔄 [ragRetrieval] Normalized insurer name: "${insurerName}" → "${normalized}"`);
                insurerName = normalized;
            }
        }

        const queryEmbedding = await embeddingService.generateEmbedding(query);

        const { data, error } = await supabase
            .rpc('match_chunks_vector_unified', {
                query_embedding: queryEmbedding,
                insurer_filter: insurerName || null,
                coverage_filter: coverageTags || null,
                match_count: limit
            } as any);

        if (error) {
            console.error('❌ [ragRetrieval] Vector search error:', error);
            logRagPerformance({
                operation: 'vectorSearch',
                insurerName,
                query,
                durationMs: Date.now() - startTime,
                chunksReturned: 0,
                avgSimilarity: 0,
                timestamp: new Date().toISOString()
            });
            return [];
        }

        if (!data) {
            logRagPerformance({
                operation: 'vectorSearch',
                insurerName,
                query,
                durationMs: Date.now() - startTime,
                chunksReturned: 0,
                avgSimilarity: 0,
                timestamp: new Date().toISOString()
            });
            return [];
        }

        const results = (data as any[]).map(row => ({
            id: row.id,
            documentId: row.document_id,
            insurerName: row.insurer_name,
            sectionType: row.section_type,
            coverageTags: row.coverage_tags || [],
            content: row.content,
            pageNumber: row.page_number,
            similarity: row.similarity
        }));

        const avgSimilarity = results.length > 0
            ? results.reduce((sum, r) => sum + r.similarity, 0) / results.length
            : 0;

        logRagPerformance({
            operation: 'vectorSearch',
            insurerName,
            query,
            durationMs: Date.now() - startTime,
            chunksReturned: results.length,
            avgSimilarity,
            timestamp: new Date().toISOString()
        });

        return results;
    },

    /**
     * Get clauses by coverage name (exact match)
     */
    getByCoverage: async (
        coverageName: string,
        options: {
            insurerName?: string;
            sectionType?: string;
            limit?: number;
        } = {}
    ): Promise<RetrievedClause[]> => {
        const startTime = Date.now();
        let { insurerName, sectionType, limit = 3 } = options;
        
        // Normalize insurer name before searching
        if (insurerName) {
            const normalized = insurerNameNormalizer.normalize(insurerName);
            if (normalized !== insurerName) {
                console.log(`🔄 [ragRetrieval] Normalized insurer name: "${insurerName}" → "${normalized}"`);
                insurerName = normalized;
            }
        }

        const { data, error } = await supabase
            .rpc('get_chunks_by_coverage_unified', {
                coverage_name: coverageName,
                insurer_filter: insurerName || null,
                section_filter: sectionType || null,
                match_count: limit
            } as any);

        if (error) {
            console.error('❌ [ragRetrieval] Coverage search error:', error);
            logRagPerformance({
                operation: 'getByCoverage',
                insurerName,
                query: coverageName,
                durationMs: Date.now() - startTime,
                chunksReturned: 0,
                avgSimilarity: 0,
                timestamp: new Date().toISOString()
            });
            return [];
        }

        if (!data) {
            logRagPerformance({
                operation: 'getByCoverage',
                insurerName,
                query: coverageName,
                durationMs: Date.now() - startTime,
                chunksReturned: 0,
                avgSimilarity: 0,
                timestamp: new Date().toISOString()
            });
            return [];
        }

        const results = (data as any[]).map(row => ({
            id: row.id,
            documentId: row.document_id,
            insurerName: row.insurer_name,
            sectionType: row.section_type,
            coverageTags: row.coverage_tags || [],
            content: row.content,
            pageNumber: row.page_number,
            similarity: row.similarity
        }));

        // Filter by minimum similarity threshold
        const filteredResults = results.filter(r => r.similarity >= MIN_SIMILARITY_THRESHOLD);
        
        if (filteredResults.length === 0 && results.length > 0) {
            console.warn(`⚠️ [ragRetrieval] All chunks below threshold (${MIN_SIMILARITY_THRESHOLD}). Best: ${results[0].similarity.toFixed(3)}`);
        }

        const avgSimilarity = results.length > 0
            ? results.reduce((sum, r) => sum + r.similarity, 0) / results.length
            : 0;

        logRagPerformance({
            operation: 'getByCoverage',
            insurerName,
            query: coverageName,
            durationMs: Date.now() - startTime,
            chunksReturned: filteredResults.length,
            avgSimilarity,
            timestamp: new Date().toISOString()
        });

        return filteredResults;
    },

    /**
     * Search with cross-insurer fallback - DISABLED
     * Cross-insurer fallback removed to prevent hallucinations from irrelevant clauses
     */
    searchWithFallback: async (
        query: string,
        options: {
            insurerName?: string;
            coverageTags?: string[];
            limit?: number;
        } = {}
    ): Promise<{ clauses: RetrievedClause[]; isFallback: boolean }> => {
        const { insurerName, coverageTags, limit = 5 } = options;

        // Search with insurer filter only - no fallback
        const results = await ragRetrievalService.search(query, {
            insurerName,
            coverageTags,
            limit
        });

        return { clauses: results, isFallback: false };
    },

    /**
     * Check if an insurer has indexed clauses (pre-flight check)
     * Uses clause_chunks table (correct schema) with fallback to documents table
     */
    checkInsurerHasClauses: async (insurerName: string): Promise<boolean> => {
        try {
            // Normalize insurer name before checking
            const normalizedName = insurerNameNormalizer.normalize(insurerName);
            if (normalizedName !== insurerName) {
                console.log(`🔄 [ragRetrieval] Normalized insurer name for clause check: "${insurerName}" → "${normalizedName}"`);
            }
            
            // First try clause_chunks (correct table with insurer_name column)
            const { data: clauseData, error: clauseError } = await supabase
                .from('clause_chunks')
                .select('id')
                .eq('insurer_name', normalizedName)
                .limit(1);

            if (!clauseError && clauseData && clauseData.length > 0) {
                return true;
            }

            // Fallback: check documents table for clause documents
            const { data: docData, error: docError } = await supabase
                .from('documents')
                .select('id, insurer_id')
                .in('document_type', ['CLAUSULADO_GENERAL', 'CLAUSULADO_PARTICULAR'])
                .eq('is_active', true)
                .limit(1);

            if (!docError && docData && docData.length > 0) {
                console.log(`⚠️ [ragRetrieval] No chunks for ${insurerName} but documents exist. Consider indexing.`);
                return true;
            }

            return false;
        } catch (error) {
            console.error('❌ [ragRetrieval] Exception checking clauses:', error);
            return false;
        }
    }
};