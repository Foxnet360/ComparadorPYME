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
exports.searchController = void 0;
const database_1 = require("../config/database");
const embeddingService_1 = require("../services/vector/embeddingService");
const database_2 = require("../config/database");
exports.searchController = {
    /**
     * POST /api/search - Búsqueda semántica
     */
    search: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        console.log('🔍 [searchController.search] Request received');
        try {
            const { query, insurerId, coverageTag, sectionType, limit = '5' } = req.body;
            if (!query || typeof query !== 'string' || query.trim() === '') {
                res.status(400).json({
                    success: false,
                    error: 'Query is required',
                });
                return;
            }
            if (!insurerId) {
                res.status(400).json({
                    success: false,
                    error: 'insurerId is required',
                });
                return;
            }
            console.log(`   Query: "${query}"`);
            console.log(`   Insurer: ${insurerId}`);
            console.log(`   Coverage: ${coverageTag || 'any'}`);
            // Generar embedding para la query
            const queryEmbedding = yield embeddingService_1.embeddingService.generateQueryEmbedding(query);
            // Buscar en Supabase
            const { data: chunks, error } = yield database_1.supabase.rpc('search_chunks_advanced', {
                p_embedding: queryEmbedding,
                p_insurer_id: insurerId,
                p_coverage_tags: coverageTag ? [coverageTag] : null,
                p_section_types: sectionType ? [sectionType] : null,
                p_match_count: parseInt(limit),
                p_min_similarity: 0.6,
            });
            if (error) {
                throw (0, database_2.handleSupabaseError)(error);
            }
            const chunksData = chunks || [];
            if (chunksData.length === 0) {
                res.json({
                    success: true,
                    query,
                    results: [],
                    message: 'No results found',
                });
                return;
            }
            // Obtener imágenes de páginas para los resultados
            const chunkIds = chunksData.map((c) => c.id);
            const { data: chunksWithImagesRaw } = yield database_1.supabase.rpc('get_chunks_with_images', {
                p_chunk_ids: chunkIds,
            });
            const chunksWithImages = (chunksWithImagesRaw || []);
            // Combinar resultados con imágenes
            const results = chunksData.map((chunk) => {
                const imageData = chunksWithImages === null || chunksWithImages === void 0 ? void 0 : chunksWithImages.find((img) => img.chunk_id === chunk.id);
                return {
                    chunkId: chunk.id,
                    content: chunk.content,
                    pageNumber: chunk.page_number,
                    documentId: chunk.document_id,
                    documentName: chunk.document_name,
                    documentType: chunk.document_type,
                    sectionType: chunk.section_type,
                    coverageTags: chunk.coverage_tags,
                    similarity: chunk.similarity,
                    imageUrl: (imageData === null || imageData === void 0 ? void 0 : imageData.image_url) || null,
                    imagePath: (imageData === null || imageData === void 0 ? void 0 : imageData.image_path) || null,
                };
            });
            res.json({
                success: true,
                query,
                results,
                count: results.length,
            });
        }
        catch (error) {
            console.error('❌ [searchController] Error:', error);
            res.status(500).json({
                success: false,
                error: 'Search failed',
                details: error.message,
            });
        }
    }),
    /**
     * POST /api/search/by-coverage - Búsqueda por cobertura específica
     */
    searchByCoverage: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        console.log('🔍 [searchController.searchByCoverage] Request received');
        try {
            const { coverageTag, insurerId, documentType, limit = '10' } = req.body;
            if (!coverageTag) {
                res.status(400).json({
                    success: false,
                    error: 'coverageTag is required',
                });
                return;
            }
            console.log(`   Coverage: ${coverageTag}`);
            console.log(`   Insurer: ${insurerId || 'any'}`);
            let query = database_1.supabase
                .from('chunks')
                .select(`
          id,
          content,
          page_number,
          section_type,
          coverage_tags,
          metadata,
          documents:document_id (
            id,
            document_name,
            document_type,
            insurers:insurer_id (id, name)
          )
        `)
                .contains('coverage_tags', [coverageTag])
                .limit(parseInt(limit));
            if (insurerId) {
                query = query.eq('documents.insurer_id', insurerId);
            }
            if (documentType) {
                query = query.eq('documents.document_type', documentType);
            }
            const { data, error } = yield query;
            if (error) {
                throw (0, database_2.handleSupabaseError)(error);
            }
            const results = (data === null || data === void 0 ? void 0 : data.map((chunk) => ({
                chunkId: chunk.id,
                content: chunk.content,
                pageNumber: chunk.page_number,
                sectionType: chunk.section_type,
                coverageTags: chunk.coverage_tags,
                document: chunk.documents,
            }))) || [];
            res.json({
                success: true,
                coverageTag,
                results,
                count: results.length,
            });
        }
        catch (error) {
            console.error('❌ [searchController] Error:', error);
            res.status(500).json({
                success: false,
                error: 'Search failed',
                details: error.message,
            });
        }
    }),
    /**
     * POST /api/search/compare - Comparar cotización vs clausulado
     */
    compareDocuments: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        console.log('⚖️  [searchController.compareDocuments] Request received');
        try {
            const { quoteDocumentId, clauseDocumentId, coverageTag } = req.body;
            if (!quoteDocumentId || !clauseDocumentId) {
                res.status(400).json({
                    success: false,
                    error: 'Both quoteDocumentId and clauseDocumentId are required',
                });
                return;
            }
            console.log(`   Quote: ${quoteDocumentId}`);
            console.log(`   Clause: ${clauseDocumentId}`);
            // Validar que ambos documentos existen
            const { data: quoteDoc } = yield database_1.supabase
                .from('documents')
                .select('document_name, document_type')
                .eq('id', quoteDocumentId)
                .single();
            const { data: clauseDoc } = yield database_1.supabase
                .from('documents')
                .select('document_name, document_type')
                .eq('id', clauseDocumentId)
                .single();
            if (!quoteDoc || !clauseDoc) {
                res.status(404).json({
                    success: false,
                    error: 'One or both documents not found',
                });
                return;
            }
            // Usar función SQL para validación
            const { data: comparison, error } = yield database_1.supabase.rpc('validate_quote_coverage', {
                p_quote_document_id: quoteDocumentId,
                p_clause_document_id: clauseDocumentId,
                p_coverage_tag: coverageTag || 'general',
                p_match_count: 5,
            });
            if (error) {
                throw (0, database_2.handleSupabaseError)(error);
            }
            res.json({
                success: true,
                quoteDocument: quoteDoc,
                clauseDocument: clauseDoc,
                coverageTag: coverageTag || 'general',
                matches: comparison || [],
            });
        }
        catch (error) {
            console.error('❌ [searchController] Error:', error);
            res.status(500).json({
                success: false,
                error: 'Comparison failed',
                details: error.message,
            });
        }
    }),
};
