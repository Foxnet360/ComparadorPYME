import { supabase } from '../config/database';

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

interface ChunkRecord {
    id: string;
    content: string;
    metadata: ChunkMetadata;
    embedding: number[];
    document_id: string;
}

// Cache en memoria para chunks (mejora rendimiento en desarrollo)
const chunksCache: Map<string, ChunkRecord[]> = new Map();

export const vectorStore = {
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
            embedding: chunk.embedding,
            metadata: chunk.metadata,
            coverage_tags: extractCoverageTags(chunk.content),
            section_type: detectSectionType(chunk.content),
        }));

        // Insertar en Supabase
        const { error } = await supabase
            .from('chunks')
            .upsert(records, { onConflict: 'id' });

        if (error) {
            console.error('❌ [VectorStore] Error saving chunks:', error);
            throw error;
        }

        // Actualizar caché
        const collectionName = insurerName.toLowerCase().replace(/\s+/g, '_');
        chunksCache.set(collectionName, chunks as ChunkRecord[]);

        console.log(`✅ [VectorStore] Saved ${chunks.length} chunks to Supabase for ${insurerName}`);
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
        // Primero intentar búsqueda vectorial con pgvector
        let query = supabase
            .rpc('match_chunks', {
                query_embedding: queryEmbedding,
                match_threshold: 0.5,
                match_count: limit
            });

        // Ejecutar consulta
        const { data, error } = await query;

        if (error) {
            console.error('❌ [VectorStore] Search error:', error);
            
            // Fallback: búsqueda por similitud de coseno manual
            return await manualSimilaritySearch(insurerName, queryEmbedding, filter, limit);
        }

        if (!data || data.length === 0) {
            return [];
        }

        // Transformar resultados
        return data.map((row: any) => ({
            id: row.id,
            content: row.content,
            metadata: row.metadata as ChunkMetadata,
            distance: 1 - row.similarity, // Convertir similitud a distancia
        }));
    },

    /**
     * Elimina todos los chunks de un documento
     */
    deleteDocument: async (insurerName: string, documentName: string): Promise<void> => {
        // Buscar documentos por nombre
        const { data: docs, error: docError } = await supabase
            .from('documents')
            .select('id')
            .ilike('document_name', `%${documentName}%`);

        if (docError || !docs || docs.length === 0) {
            console.warn(`⚠️ [VectorStore] Document not found: ${documentName}`);
            return;
        }

        const docIds = docs.map(d => d.id);

        // Eliminar chunks asociados
        const { error } = await supabase
            .from('chunks')
            .delete()
            .in('document_id', docIds);

        if (error) {
            console.error('❌ [VectorStore] Error deleting chunks:', error);
            throw error;
        }

        console.log(`✅ [VectorStore] Deleted chunks for ${documentName}`);
    },

    /**
     * Lista todos los documentos indexados
     */
    listDocuments: async (insurerName?: string): Promise<{ insurerName: string; documentName: string; chunkCount: number }[]> => {
        // Obtener documentos con conteo de chunks
        let query = supabase
            .from('documents')
            .select(`
                id,
                document_name,
                insurer_id,
                insurers:insurer_id (name)
            `)
            .eq('is_active', true);

        if (insurerName) {
            query = query.ilike('insurers.name', `%${insurerName}%`);
        }

        const { data: documents, error } = await query;

        if (error) {
            console.error('❌ [VectorStore] Error listing documents:', error);
            return [];
        }

        if (!documents || documents.length === 0) {
            return [];
        }

        // Obtener conteos de chunks para cada documento
        const docIds = documents.map(d => d.id);
        const { data: chunkCounts, error: countError } = await supabase
            .from('chunks')
            .select('document_id, count')
            .in('document_id', docIds)
            .group('document_id');

        if (countError) {
            console.error('❌ [VectorStore] Error counting chunks:', countError);
        }

        const countMap = new Map(chunkCounts?.map(c => [c.document_id, parseInt(c.count)]) || []);

        return documents.map(doc => ({
            insurerName: (doc.insurers as any)?.name || 'Unknown',
            documentName: doc.document_name,
            chunkCount: countMap.get(doc.id) || 0
        }));
    },

    /**
     * Limpia la caché (útil para testing)
     */
    clearCache: (): void => {
        chunksCache.clear();
        console.log('🧹 [VectorStore] Cache cleared');
    }
};

// Funciones auxiliares

function extractCoverageTags(content: string): string[] {
    const tags: string[] = [];
    const coverageKeywords = [
        'incendio', 'lucro cesante', 'sustracción', 'hurto', 'robo',
        'equipo eléctrico', 'electrónico', 'rotura maquinaria',
        'responsabilidad civil', 'rc', 'vidrios', 'infidelidad',
        'transporte', 'asistencia', 'huelga', 'terremoto'
    ];
    
    const lowerContent = content.toLowerCase();
    for (const keyword of coverageKeywords) {
        if (lowerContent.includes(keyword)) {
            tags.push(keyword);
        }
    }
    
    return tags;
}

function detectSectionType(content: string): string | null {
    const lowerContent = content.toLowerCase();
    
    if (lowerContent.includes('exclusión') || lowerContent.includes('no cubre')) {
        return 'EXCLUSION';
    }
    if (lowerContent.includes('deducible') || lowerContent.includes('franquicia')) {
        return 'DEDUCIBLE';
    }
    if (lowerContent.includes('condición') || lowerContent.includes('requisito')) {
        return 'CONDICION';
    }
    if (lowerContent.includes('cobertura') || lowerContent.includes('garantía')) {
        return 'COBERTURA';
    }
    
    return 'GENERAL';
}

// Búsqueda por similitud manual (fallback)
async function manualSimilaritySearch(
    insurerName: string,
    queryEmbedding: number[],
    filter?: { clauseId?: string; section?: string },
    limit: number = 5
): Promise<RetrievedChunk[]> {
    console.log('⚠️ [VectorStore] Using manual similarity search (fallback)');
    
    // Obtener todos los chunks del caché o de Supabase
    const collectionName = insurerName.toLowerCase().replace(/\s+/g, '_');
    let chunks: ChunkRecord[] = [];
    
    if (chunksCache.has(collectionName)) {
        chunks = chunksCache.get(collectionName)!;
    } else {
        // Obtener de Supabase
        const { data, error } = await supabase
            .from('chunks')
            .select('id, content, metadata, embedding');
        
        if (!error && data) {
            chunks = data as ChunkRecord[];
            chunksCache.set(collectionName, chunks);
        }
    }
    
    // Calcular similitudes
    const scored = chunks.map(chunk => ({
        ...chunk,
        similarity: cosineSimilarity(queryEmbedding, chunk.embedding)
    }));
    
    // Ordenar por similitud
    scored.sort((a, b) => b.similarity - a.similarity);
    
    // Tomar los mejores resultados
    return scored.slice(0, limit).map(c => ({
        id: c.id,
        content: c.content,
        metadata: c.metadata,
        distance: 1 - c.similarity
    }));
}

function cosineSimilarity(a: number[], b: number[]): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < a.length; i++) {
        dotProduct += a[i] * b[i];
        normA += a[i] * a[i];
        normB += b[i] * b[i];
    }
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}
