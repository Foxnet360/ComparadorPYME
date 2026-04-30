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
exports.documentIndexingService = exports.DocumentIndexingService = void 0;
const database_1 = require("../config/database");
const pdfExtractor_1 = require("./pdfExtractor");
const semanticChunker_1 = require("./semanticChunker");
const embeddingService_1 = require("./vector/embeddingService");
const pdfRenderer_1 = require("./pdfRenderer");
const database_2 = require("../config/database");
class DocumentIndexingService {
    constructor(progressCallback) {
        this.progressCallback = progressCallback;
    }
    reportProgress(progress) {
        if (this.progressCallback) {
            this.progressCallback(progress);
        }
        console.log(`[${progress.stage}] ${progress.message} (${progress.percent}%)`);
    }
    /**
     * Indexa un documento PDF completo en Supabase usando una transacción atómica
     */
    indexDocument(pdfPath, metadata) {
        return __awaiter(this, void 0, void 0, function* () {
            const startTime = Date.now();
            const errors = [];
            const warnings = [];
            console.log('🚀 [DocumentIndexingService] Starting document indexing...');
            console.log(`   File: ${pdfPath}`);
            console.log(`   Insurer: ${metadata.insurerName}`);
            console.log(`   Document: ${metadata.documentName}`);
            try {
                // 1. Extraer texto y metadata del PDF
                this.reportProgress({
                    stage: 'extracting',
                    message: 'Extrayendo texto del PDF',
                    percent: 10,
                });
                const extractionResult = yield pdfExtractor_1.pdfExtractor.extractTextFromPdf(pdfPath);
                if (extractionResult.isScanned) {
                    warnings.push('PDF parece ser escaneado, extracción de texto limitada');
                }
                warnings.push(...extractionResult.warnings);
                console.log(`✅ Texto extraído: ${extractionResult.text.length} caracteres, ${extractionResult.pages.length} páginas`);
                // 2. Obtener o crear aseguradora
                this.reportProgress({
                    stage: 'extracting',
                    message: 'Verificando aseguradora',
                    percent: 15,
                });
                const insurerId = yield this.getOrCreateInsurer(metadata.insurerName);
                console.log(`✅ Aseguradora: ${insurerId}`);
                // 3. Renderizar páginas a imágenes
                this.reportProgress({
                    stage: 'rendering',
                    message: 'Renderizando páginas a imágenes',
                    percent: 25,
                });
                const renderedPages = yield pdfRenderer_1.pdfRenderer.renderDocumentPages(pdfPath, insurerId, 'temp-doc-id');
                console.log(`✅ Páginas renderizadas: ${renderedPages.length}`);
                // 4. Crear chunks semánticos
                this.reportProgress({
                    stage: 'chunking',
                    message: 'Creando chunks semánticos',
                    percent: 50,
                });
                const chunks = semanticChunker_1.semanticChunker.createChunksFromPages(extractionResult.pages, {
                    documentName: metadata.documentName,
                    insurerName: metadata.insurerName,
                });
                console.log(`✅ Chunks creados: ${chunks.length}`);
                // 5. Generar embeddings
                this.reportProgress({
                    stage: 'embedding',
                    message: 'Generando embeddings',
                    percent: 70,
                });
                const chunksWithEmbeddings = yield this.generateEmbeddingsForChunks(chunks);
                if (chunksWithEmbeddings.length === 0) {
                    throw new Error('No se pudieron generar embeddings para ningún chunk');
                }
                console.log(`✅ Embeddings generados: ${chunksWithEmbeddings.length}`);
                // 6. Preparar datos para transacción atómica
                this.reportProgress({
                    stage: 'storing',
                    message: 'Preparando datos para almacenamiento atómico',
                    percent: 85,
                });
                const imagesPayload = renderedPages.map(page => ({
                    page_number: page.pageNumber,
                    storage_url: page.storageUrl,
                    storage_path: page.storagePath,
                    width: page.width,
                    height: page.height,
                }));
                const chunksPayload = chunksWithEmbeddings.map(chunk => ({
                    page_number: chunk.metadata.pageStart,
                    content: chunk.content,
                    content_normalized: chunk.contentNormalized,
                    embedding: `[${chunk.embedding.join(',')}]`,
                    metadata: chunk.metadata,
                    coverage_tags: chunk.coverageTags,
                    section_type: chunk.sectionType,
                }));
                // 7. Llamar a la transacción atómica
                this.reportProgress({
                    stage: 'storing',
                    message: 'Guardando documento, imágenes y chunks atómicamente',
                    percent: 90,
                });
                const { data: documentId, error: rpcError } = yield database_1.supabase
                    .rpc('index_document_transaction', {
                    p_insurer_id: insurerId,
                    p_document_name: metadata.documentName,
                    p_document_type: metadata.documentType,
                    p_version: metadata.version || null,
                    p_total_pages: extractionResult.metadata.pageCount,
                    p_storage_path: `${insurerId}`,
                    p_uploaded_by: metadata.uploadedBy || 'anonymous',
                    p_images: imagesPayload,
                    p_chunks: chunksPayload,
                });
                if (rpcError) {
                    throw new Error(`Transacción atómica fallida: ${rpcError.message}`);
                }
                console.log(`✅ Documento, imágenes y chunks guardados atómicamente: ${documentId}`);
                // 8. Completar
                this.reportProgress({
                    stage: 'complete',
                    message: 'Indexación completada',
                    percent: 100,
                });
                const processingTimeMs = Date.now() - startTime;
                console.log(`✅ [DocumentIndexingService] Indexación completada en ${processingTimeMs}ms`);
                return {
                    success: true,
                    documentId,
                    insurerId,
                    stats: {
                        totalPages: extractionResult.metadata.pageCount,
                        chunksCreated: chunksWithEmbeddings.length,
                        imagesUploaded: renderedPages.length,
                        processingTimeMs,
                    },
                    errors,
                    warnings,
                };
            }
            catch (error) {
                console.error('❌ [DocumentIndexingService] Error:', error);
                errors.push(error.message);
                return {
                    success: false,
                    stats: {
                        totalPages: 0,
                        chunksCreated: 0,
                        imagesUploaded: 0,
                        processingTimeMs: Date.now() - startTime,
                    },
                    errors,
                    warnings,
                };
            }
        });
    }
    /**
     * Obtiene o crea una aseguradora
     */
    getOrCreateInsurer(name) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Buscar aseguradora existente
                const { data: existing, error: searchError } = yield database_1.supabase
                    .from('insurers')
                    .select('id')
                    .eq('name', name)
                    .single();
                if (searchError && searchError.code !== 'PGRST116') {
                    throw (0, database_2.handleSupabaseError)(searchError);
                }
                if (existing) {
                    return existing.id;
                }
                // Crear nueva aseguradora
                const { data: created, error: createError } = yield database_1.supabase
                    .from('insurers')
                    .insert({ name })
                    .select('id')
                    .single();
                if (createError) {
                    throw (0, database_2.handleSupabaseError)(createError);
                }
                return created.id;
            }
            catch (error) {
                console.error('❌ Error getting/creating insurer:', error);
                throw error;
            }
        });
    }
    /**
     * Genera embeddings para los chunks
     */
    generateEmbeddingsForChunks(chunks) {
        return __awaiter(this, void 0, void 0, function* () {
            const results = [];
            for (let i = 0; i < chunks.length; i++) {
                try {
                    const chunk = chunks[i];
                    const embedding = yield embeddingService_1.embeddingService.generateEmbedding(chunk.content);
                    results.push(Object.assign(Object.assign({}, chunk), { embedding }));
                    // Reportar progreso
                    const percent = 70 + Math.floor((i / chunks.length) * 20);
                    this.reportProgress({
                        stage: 'embedding',
                        message: `Generando embedding ${i + 1}/${chunks.length}`,
                        percent,
                    });
                }
                catch (error) {
                    console.warn(`⚠️ Error generating embedding for chunk ${i}:`, error);
                    // Continuar con el siguiente chunk
                }
            }
            return results;
        });
    }
    /**
     * Elimina un documento y todos sus datos asociados
     */
    deleteDocument(documentId) {
        return __awaiter(this, void 0, void 0, function* () {
            console.log(`🗑️ [DocumentIndexingService] Deleting document: ${documentId}`);
            try {
                // Obtener información del documento
                const { data: document, error: docError } = yield database_1.supabase
                    .from('documents')
                    .select('insurer_id')
                    .eq('id', documentId)
                    .single();
                if (docError) {
                    console.error('❌ Document not found:', docError);
                    return false;
                }
                // Eliminar imágenes del storage
                const { data: images } = yield database_1.supabase
                    .from('page_images')
                    .select('storage_path')
                    .eq('document_id', documentId);
                if (images && images.length > 0) {
                    const paths = images.map(img => img.storage_path);
                    yield database_1.supabase.storage.from('clause-pages').remove(paths);
                }
                // Eliminar documento (cascada eliminará chunks y page_images)
                const { error: deleteError } = yield database_1.supabase
                    .from('documents')
                    .delete()
                    .eq('id', documentId);
                if (deleteError) {
                    throw (0, database_2.handleSupabaseError)(deleteError);
                }
                console.log(`✅ Document ${documentId} deleted successfully`);
                return true;
            }
            catch (error) {
                console.error('❌ Error deleting document:', error);
                return false;
            }
        });
    }
}
exports.DocumentIndexingService = DocumentIndexingService;
// Exportar instancia singleton
exports.documentIndexingService = new DocumentIndexingService();
