/**
 * RAG Retrieval Service
 * Provides functions to retrieve clause chunks using vector similarity and full-text search
 */

import { supabase } from '../config/database';
import { embeddingService } from './vector/embeddingService';
import { insurerNameNormalizer } from './insurerNameNormalizer';
import { queryExpander } from './queryExpander';
import { getCacheValue, setCacheValue } from './cache/redisCache';

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
const MIN_SIMILARITY_THRESHOLD = 0.62;

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
     * Search with query expansion (Hybrid Search V2)
     * Expands query with synonyms and performs multiple searches
     */
    searchWithExpansion: async (
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
        
        // Normalize insurer name
        if (insurerName) {
            const normalized = insurerNameNormalizer.normalize(insurerName);
            if (normalized !== insurerName) {
                console.log(`🔄 [ragRetrieval] Normalized insurer name: "${insurerName}" → "${normalized}"`);
                insurerName = normalized;
            }
        }

        // Check cache first
        const cacheKey = `search:${Buffer.from(query + insurerName).toString('base64').substring(0, 32)}`;
        try {
            const cached = await getCacheValue(cacheKey);
            if (cached) {
                console.log(`✅ [ragRetrieval] Cache hit for query`);
                return JSON.parse(cached);
            }
        } catch (error) {
            console.warn('⚠️ [ragRetrieval] Cache error:', error);
        }

        // Expand query
        const expansions = queryExpander.expand(query, { insurerName });
        console.log(`🔍 [ragRetrieval] Searching with ${expansions.length} query variants`);

        // Execute searches for all variants
        const allResults: RetrievedClause[] = [];
        
        for (const expansion of expansions) {
            try {
                const queryEmbedding = await embeddingService.generateEmbedding(expansion.query);
                
                const { data, error } = await supabase
                    .rpc('match_chunks_hybrid', {
                        query_embedding: queryEmbedding,
                        query_text: expansion.query,
                        insurer_filter: insurerName || null,
                        coverage_filter: coverageTags || null,
                        section_filter: sectionType || null,
                        match_count: Math.ceil(limit / expansions.length) + 5,
                        vector_weight: expansion.weight,
                        text_weight: 1 - expansion.weight
                    } as any);

                if (error) {
                    console.warn(`⚠️ [ragRetrieval] Search error for "${expansion.query}":`, error);
                    continue;
                }

                if (data) {
                    const results = (data as any[]).map(row => ({
                        id: row.id,
                        documentId: row.document_id,
                        insurerName: row.insurer_name,
                        sectionType: row.section_type,
                        coverageTags: row.coverage_tags || [],
                        content: row.content,
                        pageNumber: row.page_number,
                        similarity: row.combined_score || row.similarity
                    }));
                    
                    allResults.push(...results);
                }
            } catch (error) {
                console.warn(`⚠️ [ragRetrieval] Error searching "${expansion.query}":`, error);
            }
        }

        // Deduplicate by ID and sort by similarity
        const seen = new Set<string>();
        const uniqueResults = allResults
            .filter(r => {
                if (seen.has(r.id)) return false;
                seen.add(r.id);
                return r.similarity >= minSimilarity;
            })
            .sort((a, b) => b.similarity - a.similarity)
            .slice(0, limit);

        const avgSimilarity = uniqueResults.length > 0 
            ? uniqueResults.reduce((sum, r) => sum + r.similarity, 0) / uniqueResults.length 
            : 0;

        logRagPerformance({
            operation: 'searchWithExpansion',
            insurerName,
            query,
            durationMs: Date.now() - startTime,
            chunksReturned: uniqueResults.length,
            avgSimilarity,
            timestamp: new Date().toISOString()
        });

        // Cache results
        try {
            await setCacheValue(cacheKey, 3600, JSON.stringify(uniqueResults)); // 1 hour cache
        } catch (error) {
            console.warn('⚠️ [ragRetrieval] Cache write error:', error);
        }

        return uniqueResults;
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
            
            // 1. Buscar el id de la aseguradora en el catálogo `insurers`
            const { data: insurerData, error: insurerError } = await supabase
                .from('insurers')
                .select('id')
                .eq('name', normalizedName)
                .limit(1);

            let matchedInsurerId: string | null = null;
            
            if (insurerData && insurerData.length > 0) {
                matchedInsurerId = (insurerData[0] as any).id;
            } else {
                // Fuzzy matching ILIKE si no hay match directo
                const { data: fuzzyData, error: fuzzyError } = await supabase
                    .from('insurers')
                    .select('id')
                    .ilike('name', `%${normalizedName}%`)
                    .limit(1);
                
                if (fuzzyError || !fuzzyData || fuzzyData.length === 0) {
                    return false;
                }
                matchedInsurerId = (fuzzyData[0] as any).id;
            }

            const insurerId = matchedInsurerId!;

            // 2. Consultar documentos activos específicos de esa aseguradora
            const { data: docData, error: docError } = await supabase
                .from('documents')
                .select('id')
                .eq('insurer_id', insurerId)
                .in('document_type', ['CLAUSULADO_GENERAL', 'CLAUSULADO_PARTICULAR'])
                .eq('is_active', true)
                .limit(1);

            if (docError || !docData || docData.length === 0) {
                return false;
            }

            // 3. Verificación pre-flight opcional: Asegurar que existan chunks indexados
            const { count, error: chunksError } = await supabase
                .from('chunks')
                .select('id', { count: 'exact', head: true })
                .eq('document_id', (docData[0] as any).id)
                .limit(1);

            if (chunksError || count === null || count === 0) {
                console.warn(`⚠️ [ragRetrieval] Document found for ${normalizedName} but has 0 chunks indexados.`);
                return false;
            }

            return true;
        } catch (error) {
            console.error('❌ [ragRetrieval] Exception checking clauses:', error);
            return false;
        }
    },

    /**
     * Re-rank results using cross-encoder approach
     * Computes more accurate relevance scores by comparing query+chunk pairs
     */
    reRankResults: async (
        query: string,
        results: RetrievedClause[],
        options: {
            topK?: number;
        } = {}
    ): Promise<RetrievedClause[]> => {
        const { topK = Math.min(results.length, 10) } = options;
        
        if (results.length <= 1) return results;
        
        console.log(`🔄 [ragRetrieval] Re-ranking ${results.length} results...`);
        const startTime = Date.now();
        
        try {
            // Generate query embedding once
            const queryEmbedding = await embeddingService.generateEmbedding(query);
            
            // Re-score each result by computing cross-encoder similarity
            // In a full implementation, this would use a dedicated cross-encoder model
            // Here we use a refined embedding similarity as a proxy
            const reScored = await Promise.all(
                results.map(async (result) => {
                    // Create a combined query+chunk text for better semantic matching
                    const combinedText = `${query} ${result.content}`;
                    const combinedEmbedding = await embeddingService.generateEmbedding(combinedText);
                    
                    // Cross-encoder score: similarity between query and combined representation
                    const crossScore = embeddingService.cosineSimilarity(queryEmbedding, combinedEmbedding);
                    
                    // Blend original similarity with cross-encoder score
                    const blendedScore = (result.similarity * 0.4) + (crossScore * 0.6);
                    
                    return {
                        ...result,
                        similarity: Math.min(blendedScore, 1.0) // Cap at 1.0
                    };
                })
            );
            
            // Sort by re-ranked score and return topK
            const ranked = reScored
                .sort((a, b) => b.similarity - a.similarity)
                .slice(0, topK);
            
            console.log(`✅ [ragRetrieval] Re-ranking complete: ${results.length} → ${ranked.length} results (${Date.now() - startTime}ms)`);
            
            return ranked;
        } catch (error) {
            console.error('❌ [ragRetrieval] Re-ranking error:', error);
            // Fallback: return original results sorted by original score
            return results
                .sort((a, b) => b.similarity - a.similarity)
                .slice(0, topK);
        }
    },

    /**
     * Parent-child retrieval (Hybrid Search V2 Enhancement)
     * Retrieves child chunks and fetches their parent context for better understanding
     */
    searchWithParentContext: async (
        query: string,
        options: {
            insurerName?: string;
            coverageTags?: string[];
            sectionType?: string;
            limit?: number;
            minSimilarity?: number;
            parentContextRatio?: number; // How many parent chunks to include (0-1)
        } = {}
    ): Promise<RetrievedClause[]> => {
        const startTime = Date.now();
        const { 
            insurerName, 
            coverageTags, 
            sectionType, 
            limit = 10, 
            minSimilarity = MIN_SIMILARITY_THRESHOLD,
            parentContextRatio = 0.3 // Include 30% parent context by default
        } = options;
        
        console.log(`🔍 [ragRetrieval] Parent-child search: "${query}"`);
        
        // Step 1: Search for child chunks (specific passages)
        const childResults = await ragRetrievalService.searchWithExpansion(query, {
            insurerName,
            coverageTags,
            sectionType,
            limit: Math.ceil(limit * 0.7), // 70% child chunks
            minSimilarity
        });
        
        if (childResults.length === 0) {
            return [];
        }
        
        // Step 2: Extract parent document IDs from child results
        const parentDocIds = [...new Set(childResults.map(r => r.documentId))];
        
        // Step 3: Fetch parent chunks (broader context) for these documents
        const parentLimit = Math.max(1, Math.ceil(limit * parentContextRatio));
        const parentResults: RetrievedClause[] = [];
        
        for (const docId of parentDocIds.slice(0, 3)) { // Limit to top 3 documents
            try {
                const { data, error } = await supabase
                    .rpc('get_parent_chunks', {
                        document_id: docId,
                        section_filter: sectionType || null,
                        match_count: Math.ceil(parentLimit / parentDocIds.length)
                    } as any);
                
                if (error) {
                    console.warn(`⚠️ [ragRetrieval] Error fetching parent chunks for doc ${docId}:`, error);
                    continue;
                }
                
                if (data) {
                    const parents = (data as any[]).map(row => ({
                        id: row.id,
                        documentId: row.document_id,
                        insurerName: row.insurer_name,
                        sectionType: row.section_type,
                        coverageTags: row.coverage_tags || [],
                        content: row.content,
                        pageNumber: row.page_number,
                        similarity: 0.85 // Parent chunks get high base similarity
                    }));
                    parentResults.push(...parents);
                }
            } catch (error) {
                console.warn(`⚠️ [ragRetrieval] Error in parent retrieval for doc ${docId}:`, error);
            }
        }
        
        // Step 4: Merge child and parent results
        // Mark parent chunks to distinguish them
        const markedParents = parentResults.map(p => ({
            ...p,
            content: `[CONTEXTO GENERAL] ${p.content}`,
            similarity: p.similarity * 0.9 // Slightly lower priority than direct matches
        }));
        
        // Combine and deduplicate
        const combined = [...childResults, ...markedParents];
        const seen = new Set<string>();
        const uniqueResults = combined
            .filter(r => {
                if (seen.has(r.id)) return false;
                seen.add(r.id);
                return true;
            })
            .sort((a, b) => b.similarity - a.similarity)
            .slice(0, limit);
        
        const avgSimilarity = uniqueResults.length > 0
            ? uniqueResults.reduce((sum, r) => sum + r.similarity, 0) / uniqueResults.length
            : 0;
        
        logRagPerformance({
            operation: 'searchWithParentContext',
            insurerName,
            query,
            durationMs: Date.now() - startTime,
            chunksReturned: uniqueResults.length,
            avgSimilarity,
            timestamp: new Date().toISOString()
        });
        
        console.log(`✅ [ragRetrieval] Parent-child search: ${childResults.length} children + ${markedParents.length} parents = ${uniqueResults.length} total`);
        
        return uniqueResults;
    }
};