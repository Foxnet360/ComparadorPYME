/**
 * RAG Retrieval Service
 * Provides functions to retrieve clause chunks using vector similarity and full-text search
 */

import { supabase } from '../config/database';
import { embeddingService } from './vector/embeddingService';

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
        } = {}
    ): Promise<RetrievedClause[]> => {
        const { insurerName, coverageTags, sectionType, limit = 5 } = options;

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
            return [];
        }

        if (!data) return [];

        return (data as any[]).map(row => ({
            id: row.id,
            documentId: row.document_id,
            insurerName: row.insurer_name,
            sectionType: row.section_type,
            coverageTags: row.coverage_tags || [],
            content: row.content,
            pageNumber: row.page_number,
            similarity: row.similarity
        }));
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
        const { insurerName, coverageTags, limit = 5 } = options;

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
            return [];
        }

        if (!data) return [];

        return (data as any[]).map(row => ({
            id: row.id,
            documentId: row.document_id,
            insurerName: row.insurer_name,
            sectionType: row.section_type,
            coverageTags: row.coverage_tags || [],
            content: row.content,
            pageNumber: row.page_number,
            similarity: row.similarity
        }));
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
        const { insurerName, sectionType, limit = 3 } = options;

        const { data, error } = await supabase
            .rpc('get_chunks_by_coverage_unified', {
                coverage_name: coverageName,
                insurer_filter: insurerName || null,
                section_filter: sectionType || null,
                match_count: limit
            } as any);

        if (error) {
            console.error('❌ [ragRetrieval] Coverage search error:', error);
            return [];
        }

        if (!data) return [];

        return (data as any[]).map(row => ({
            id: row.id,
            documentId: row.document_id,
            insurerName: row.insurer_name,
            sectionType: row.section_type,
            coverageTags: row.coverage_tags || [],
            content: row.content,
            pageNumber: row.page_number,
            similarity: 1.0 // Exact match
        }));
    },

    /**
     * Search with cross-insurer fallback
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

        // First try: search with insurer filter
        if (insurerName) {
            const results = await ragRetrievalService.search(query, {
                insurerName,
                coverageTags,
                limit
            });

            if (results.length > 0) {
                return { clauses: results, isFallback: false };
            }

            // Fallback: search without insurer filter
            console.log(`⚠️ [ragRetrieval] No clauses found for ${insurerName}, trying cross-insurer search...`);
            
            const fallbackResults = await ragRetrievalService.search(query, {
                coverageTags,
                limit
            });

            return { 
                clauses: fallbackResults, 
                isFallback: fallbackResults.length > 0 
            };
        }

        // No insurer specified, do general search
        const results = await ragRetrievalService.search(query, { coverageTags, limit });
        return { clauses: results, isFallback: false };
    },

    /**
     * Check if an insurer has indexed clauses (pre-flight check)
     */
    checkInsurerHasClauses: async (insurerName: string): Promise<boolean> => {
        try {
            const { data, error } = await supabase
                .from('chunks')
                .select('id')
                .eq('insurer_name', insurerName)
                .limit(1);

            if (error) {
                console.error('❌ [ragRetrieval] Error checking clauses:', error);
                return false;
            }

            return data && data.length > 0;
        } catch (error) {
            console.error('❌ [ragRetrieval] Exception checking clauses:', error);
            return false;
        }
    }
};