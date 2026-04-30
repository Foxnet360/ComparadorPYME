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
exports.vectorStore = void 0;
const database_1 = require("../config/database");
// Helper function to extract coverage tags from content
const extractCoverageTags = (content) => {
    const tags = [];
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
const detectSectionType = (content) => {
    const lowerContent = content.toLowerCase();
    if (lowerContent.includes('exclusi'))
        return 'EXCLUSION';
    if (lowerContent.includes('deducible'))
        return 'DEDUCIBLE';
    if (lowerContent.includes('garantia') || lowerContent.includes('cobertura'))
        return 'COBERTURA';
    if (lowerContent.includes('condicion'))
        return 'CONDICION';
    return 'GENERAL';
};
// Convert embedding array to PostgreSQL vector string format
const embeddingToString = (embedding) => {
    return `[${embedding.join(',')}]`;
};
exports.vectorStore = {
    /**
     * Inicializa el cliente (no-op para Supabase, ya está inicializado en database.ts)
     */
    initialize: () => __awaiter(void 0, void 0, void 0, function* () {
        // Supabase client is already initialized in database.ts
        console.log('📦 [VectorStore] Using Supabase/pgvector');
    }),
    /**
     * Agrega chunks a Supabase
     */
    addChunks: (insurerName, chunks) => __awaiter(void 0, void 0, void 0, function* () {
        // Preparar datos para Supabase
        const records = chunks.map(chunk => ({
            id: chunk.id,
            document_id: chunk.metadata.clauseId || chunk.id.split('_')[0],
            page_number: chunk.metadata.pageStart,
            content: chunk.content,
            content_normalized: chunk.content.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''),
            embedding: embeddingToString(chunk.embedding),
            metadata: chunk.metadata,
            coverage_tags: extractCoverageTags(chunk.content),
            section_type: detectSectionType(chunk.content),
        }));
        // Insertar en Supabase
        const { error } = yield database_1.supabase
            .from('chunks')
            .upsert(records, { onConflict: 'id' });
        if (error) {
            console.error('❌ [VectorStore] Error saving chunks:', error);
            throw error;
        }
        console.log(`✅ [VectorStore] Added ${chunks.length} chunks to Supabase for ${insurerName}`);
    }),
    /**
     * Busca chunks similares usando pgvector
     */
    search: (insurerName_1, queryEmbedding_1, filter_1, ...args_1) => __awaiter(void 0, [insurerName_1, queryEmbedding_1, filter_1, ...args_1], void 0, function* (insurerName, queryEmbedding, filter, limit = 5) {
        try {
            // Intentar usar RPC para búsqueda vectorial
            const { data, error } = yield database_1.supabase
                .rpc('match_chunks', {
                query_embedding: embeddingToString(queryEmbedding),
                match_threshold: 0.5,
                match_count: limit,
                insurer_filter: insurerName
            });
            if (error) {
                console.warn('⚠️ [VectorStore] RPC match_chunks failed, falling back to text search:', error);
                // Fallback: búsqueda de texto básica
                return exports.vectorStore.fallbackTextSearch(insurerName, filter, limit);
            }
            if (!data)
                return [];
            return data.map((row) => ({
                id: row.id,
                content: row.content,
                metadata: row.metadata,
                distance: 1 - (row.similarity || 0), // Convertir similitud a distancia
            }));
        }
        catch (error) {
            console.error('❌ [VectorStore] Search error:', error);
            return exports.vectorStore.fallbackTextSearch(insurerName, filter, limit);
        }
    }),
    /**
     * Búsqueda de fallback usando texto (sin embeddings)
     */
    fallbackTextSearch: (insurerName_1, filter_1, ...args_1) => __awaiter(void 0, [insurerName_1, filter_1, ...args_1], void 0, function* (insurerName, filter, limit = 5) {
        console.log('🔍 [VectorStore] Using fallback text search');
        let query = database_1.supabase
            .from('chunks')
            .select('*')
            .limit(limit);
        if (filter === null || filter === void 0 ? void 0 : filter.clauseId) {
            query = query.eq('document_id', filter.clauseId);
        }
        const { data, error } = yield query;
        if (error) {
            console.error('❌ [VectorStore] Fallback search error:', error);
            return [];
        }
        return (data || []).map((row) => ({
            id: row.id,
            content: row.content,
            metadata: row.metadata,
            distance: 0, // No tenemos distancia real en búsqueda de texto
        }));
    }),
    /**
     * Elimina todos los chunks de un documento
     */
    deleteDocument: (insurerName, documentName) => __awaiter(void 0, void 0, void 0, function* () {
        // Primero obtener los IDs de los documentos que coinciden
        const { data: documents, error: docError } = yield database_1.supabase
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
        const documentIds = documents.map(d => d.id);
        // Eliminar chunks asociados
        const { error: deleteError } = yield database_1.supabase
            .from('chunks')
            .delete()
            .in('document_id', documentIds);
        if (deleteError) {
            console.error('❌ [VectorStore] Error deleting chunks:', deleteError);
            throw deleteError;
        }
        console.log(`✅ [VectorStore] Deleted chunks for ${documentName}`);
    }),
    /**
     * Lista todos los documentos indexados
     */
    listDocuments: (insurerName) => __awaiter(void 0, void 0, void 0, function* () {
        try {
            // Obtener documentos con conteo de chunks en una sola query (evita N+1)
            let query = database_1.supabase
                .from('documents')
                .select(`
                    id,
                    document_name,
                    insurers!inner(name),
                    chunks(count)
                `)
                .eq('is_active', true);
            if (insurerName) {
                query = query.eq('insurers.name', insurerName);
            }
            const { data: documents, error: docError } = yield query;
            if (docError) {
                console.error('❌ [VectorStore] Error listing documents:', docError);
                return [];
            }
            if (!documents)
                return [];
            return documents.map((doc) => {
                var _a, _b, _c;
                return ({
                    insurerName: ((_a = doc.insurers) === null || _a === void 0 ? void 0 : _a.name) || 'Unknown',
                    documentName: doc.document_name,
                    chunkCount: ((_c = (_b = doc.chunks) === null || _b === void 0 ? void 0 : _b[0]) === null || _c === void 0 ? void 0 : _c.count) || 0,
                });
            });
        }
        catch (error) {
            console.error('❌ [VectorStore] Error in listDocuments:', error);
            return [];
        }
    }),
    /**
     * Verifica si hay documentos para una aseguradora
     */
    hasDocuments: (insurerName) => __awaiter(void 0, void 0, void 0, function* () {
        const documents = yield exports.vectorStore.listDocuments(insurerName);
        return documents.length > 0;
    }),
};
console.log('📦 [VectorStore] Initialized with Supabase/pgvector');
