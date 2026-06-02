import { supabase } from '../config/database';
import { insurerNameNormalizer } from './insurerNameNormalizer';

export interface ChunkMetadata {
    insurerName: string;
    documentName: string;
    documentType: string;
    chapter?: string;
    section?: string;
    clauseId?: string;
    pageStart: number;
    pageEnd: number;
}

export interface RetrievedChunk {
    id: string;
    content: string;
    metadata: ChunkMetadata;
    distance: number;
}

// Helper function to extract coverage tags from content
const extractCoverageTags = (content: string): string[] => {
    const tags: string[] = [];
    const coverageTerms = [
        'daño', 'perdida', 'hurto', 'accidente', 'responsabilidad',
        'gastos', 'medicos', 'civil', 'extracontractual'
    ];
    
    const lowerContent = content.toLowerCase();
    coverageTerms.forEach(term => {
        if (lowerContent.includes(term)) {
            tags.push(term);
        }
    });
    
    return tags;
};

// Helper function to detect section type
const detectSectionType = (content: string): string | null => {
    const lowerContent = content.toLowerCase();
    
    if (lowerContent.includes('exclusi')) return 'EXCLUSION';
    if (lowerContent.includes('deducible')) return 'DEDUCIBLE';
    if (lowerContent.includes('garantia') || lowerContent.includes('cobertura')) return 'COBERTURA';
    if (lowerContent.includes('condicion')) return 'CONDICION';
    
    return 'GENERAL';
};

// Convert embedding array to PostgreSQL vector string format
const embeddingToString = (embedding: number[]): string => {
    return `[${embedding.join(',')}]`;
};

export const vectorStore = {
    /**
     * Inicializa el cliente (no-op para Supabase, ya está inicializado en database.ts)
     */
    initialize: async (): Promise<void> => {
        // Supabase client is already initialized in database.ts
        console.log('📦 [VectorStore] Using Supabase/pgvector');
    },

    /**
     * Agrega chunks a Supabase
     */
    addChunks: async (
        insurerName: string,
        chunks: { id: string; content: string; metadata: ChunkMetadata; embedding: number[] }[]
    ): Promise<void> => {
        // Preparar datos para Supabase
        const records = chunks.map(chunk => ({
            id: chunk.id,
            document_id: chunk.metadata.clauseId || chunk.id.split('_')[0],
            page_number: chunk.metadata.pageStart,
            content: chunk.content,
            content_normalized: chunk.content.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''),
            embedding: embeddingToString(chunk.embedding),
            metadata: chunk.metadata as any,
            coverage_tags: extractCoverageTags(chunk.content),
            section_type: detectSectionType(chunk.content) as any,
        }));

        // Insertar en Supabase
        const { error } = await supabase
            .from('chunks')
            .upsert(records as any, { onConflict: 'id' });

        if (error) {
            console.error('❌ [VectorStore] Error saving chunks:', error);
            throw error;
        }

        console.log(`✅ [VectorStore] Added ${chunks.length} chunks to Supabase for ${insurerName}`);
    },

    /**
     * Busca chunks similares usando pgvector
     */
    search: async (
        insurerName: string,
        queryEmbedding: number[],
        filter?: { clauseId?: string; section?: string },
        limit: number = 5
    ): Promise<RetrievedChunk[]> => {
        try {
            // Intentar usar RPC para búsqueda vectorial
            const { data, error } = await supabase
                .rpc('match_chunks', {
                    query_embedding: embeddingToString(queryEmbedding),
                    match_threshold: 0.5,
                    match_count: limit,
                    insurer_filter: insurerName
                } as any);

            if (error) {
                console.warn('⚠️ [VectorStore] RPC match_chunks failed, falling back to text search:', error);
                // Fallback: búsqueda de texto básica
                return vectorStore.fallbackTextSearch(insurerName, filter, limit);
            }

            if (!data) return [];

            return (data as any[]).map((row: any) => ({
                id: row.id,
                content: row.content,
                metadata: row.metadata as ChunkMetadata,
                distance: 1 - (row.similarity || 0), // Convertir similitud a distancia
            }));
        } catch (error) {
            console.error('❌ [VectorStore] Search error:', error);
            return vectorStore.fallbackTextSearch(insurerName, filter, limit);
        }
    },

    /**
     * Búsqueda de fallback usando texto (sin embeddings)
     */
    fallbackTextSearch: async (
        insurerName: string,
        filter?: { clauseId?: string; section?: string },
        limit: number = 5
    ): Promise<RetrievedChunk[]> => {
        console.log('🔍 [VectorStore] Using fallback text search');
        
        let query = supabase
            .from('chunks')
            .select('*')
            .limit(limit);

        if (filter?.clauseId) {
            query = query.eq('document_id', filter.clauseId);
        }

        const { data, error } = await query;

        if (error) {
            console.error('❌ [VectorStore] Fallback search error:', error);
            return [];
        }

        return (data || []).map((row: any) => ({
            id: row.id,
            content: row.content,
            metadata: row.metadata as ChunkMetadata,
            distance: 0, // No tenemos distancia real en búsqueda de texto
        }));
    },

    /**
     * Elimina todos los chunks de un documento
     */
    deleteDocument: async (insurerName: string, documentName: string): Promise<void> => {
        // Primero obtener los IDs de los documentos que coinciden
        const { data: documents, error: docError } = await supabase
            .from('documents')
            .select('id')
            .eq('document_name', documentName);

        if (docError) {
            console.error('❌ [VectorStore] Error finding documents:', docError);
            throw docError;
        }

        if (!documents || documents.length === 0) {
            console.log(`⚠️ [VectorStore] No documents found with name: ${documentName}`);
            return;
        }

        const documentIds = (documents as any[]).map(d => d.id);

        // Eliminar chunks asociados
        const { error: deleteError } = await supabase
            .from('chunks')
            .delete()
            .in('document_id', documentIds);

        if (deleteError) {
            console.error('❌ [VectorStore] Error deleting chunks:', deleteError);
            throw deleteError;
        }

        console.log(`✅ [VectorStore] Deleted chunks for ${documentName}`);
    },

    /**
     * Lista todos los documentos indexados
     */
    listDocuments: async (insurerName?: string): Promise<{ insurerName: string; documentName: string; chunkCount: number }[]> => {
        try {
            // Obtener documentos con conteo de chunks en una sola query (evita N+1)
            let query = supabase
                .from('documents')
                .select(`
                    id,
                    document_name,
                    insurers!inner(name),
                    chunks(count)
                `)
                .eq('is_active', true);

            if (insurerName) {
                const normalizedInsurer = insurerNameNormalizer.normalize(insurerName);
                query = query.eq('insurers.name', normalizedInsurer);
            }

            const { data: documents, error: docError } = await query;

            if (docError) {
                console.error('❌ [VectorStore] Error listing documents:', docError);
                return [];
            }

            if (!documents) return [];

            return (documents as any[]).map((doc: any) => ({
                insurerName: doc.insurers?.name || 'Unknown',
                documentName: doc.document_name,
                chunkCount: doc.chunks?.[0]?.count || 0,
            }));
        } catch (error) {
            console.error('❌ [VectorStore] Error in listDocuments:', error);
            return [];
        }
    },

    /**
     * Verifica si hay documentos para una aseguradora
     */
    hasDocuments: async (insurerName: string): Promise<boolean> => {
        const documents = await vectorStore.listDocuments(insurerName);
        return documents.length > 0;
    },
};

console.log('📦 [VectorStore] Initialized with Supabase/pgvector');
