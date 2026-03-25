import { supabase } from '../config/database';
import { pdfExtractor, PageData, PDFMetadata } from './pdfExtractor';
import { semanticChunker, Chunk } from './semanticChunker';
import { embeddingService } from './vector/embeddingService';
import { pdfRenderer, RenderedPage } from './pdfRenderer';
import { handleSupabaseError } from '../config/database';
import fs from 'fs';

export interface DocumentMetadata {
  insurerName: string;
  documentName: string;
  documentType: 'CLAUSULADO_GENERAL' | 'CLAUSULADO_PARTICULAR' | 'COTIZACION';
  version?: string;
  uploadedBy?: string;
}

export interface IndexingResult {
  success: boolean;
  documentId?: string;
  insurerId?: string;
  stats: {
    totalPages: number;
    chunksCreated: number;
    imagesUploaded: number;
    processingTimeMs: number;
  };
  errors: string[];
  warnings: string[];
}

export interface IndexingProgress {
  stage: 'extracting' | 'rendering' | 'chunking' | 'embedding' | 'storing' | 'complete';
  message: string;
  percent: number;
}

export type ProgressCallback = (progress: IndexingProgress) => void;

export class DocumentIndexingService {
  private progressCallback?: ProgressCallback;

  constructor(progressCallback?: ProgressCallback) {
    this.progressCallback = progressCallback;
  }

  private reportProgress(progress: IndexingProgress) {
    if (this.progressCallback) {
      this.progressCallback(progress);
    }
    console.log(`[${progress.stage}] ${progress.message} (${progress.percent}%)`);
  }

  /**
   * Indexa un documento PDF completo en Supabase
   */
  async indexDocument(
    pdfPath: string,
    metadata: DocumentMetadata
  ): Promise<IndexingResult> {
    const startTime = Date.now();
    const errors: string[] = [];
    const warnings: string[] = [];

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

      const extractionResult = await pdfExtractor.extractTextFromPdf(pdfPath);
      
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

      const insurerId = await this.getOrCreateInsurer(metadata.insurerName);
      console.log(`✅ Aseguradora: ${insurerId}`);

      // 3. Renderizar páginas a imágenes
      this.reportProgress({
        stage: 'rendering',
        message: 'Renderizando páginas a imágenes',
        percent: 25,
      });

      const renderedPages = await pdfRenderer.renderDocumentPages(
        pdfPath,
        insurerId,
        'temp-doc-id' // Se actualizará después
      );

      console.log(`✅ Páginas renderizadas: ${renderedPages.length}`);

      // 4. Crear registro del documento
      this.reportProgress({
        stage: 'storing',
        message: 'Creando registro del documento',
        percent: 35,
      });

      const documentId = await this.createDocumentRecord(
        insurerId,
        metadata,
        extractionResult.metadata,
        renderedPages
      );

      console.log(`✅ Documento creado: ${documentId}`);

      // 5. Actualizar storage paths con el documentId real
      this.reportProgress({
        stage: 'storing',
        message: 'Actualizando referencias de imágenes',
        percent: 40,
      });

      await this.updatePageImageReferences(documentId, renderedPages);

      // 6. Crear chunks semánticos
      this.reportProgress({
        stage: 'chunking',
        message: 'Creando chunks semánticos',
        percent: 50,
      });

      const chunks = semanticChunker.createChunksFromPages(
        extractionResult.pages,
        {
          documentName: metadata.documentName,
          insurerName: metadata.insurerName,
        }
      );

      console.log(`✅ Chunks creados: ${chunks.length}`);

      // 7. Generar embeddings
      this.reportProgress({
        stage: 'embedding',
        message: 'Generando embeddings',
        percent: 70,
      });

      const chunksWithEmbeddings = await this.generateEmbeddingsForChunks(chunks);
      
      if (chunksWithEmbeddings.length === 0) {
        throw new Error('No se pudieron generar embeddings para ningún chunk');
      }

      console.log(`✅ Embeddings generados: ${chunksWithEmbeddings.length}`);

      // 8. Guardar chunks en base de datos
      this.reportProgress({
        stage: 'storing',
        message: 'Guardando chunks en base de datos',
        percent: 90,
      });

      await this.saveChunksToDatabase(documentId, chunksWithEmbeddings);

      console.log(`✅ Chunks guardados en base de datos`);

      // 9. Completar
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

    } catch (error: any) {
      console.error('❌ [DocumentIndexingService] Error:', error);
      errors.push(error.message);

      // Intentar rollback
      await this.rollback(pdfPath);

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
  }

  /**
   * Obtiene o crea una aseguradora
   */
  private async getOrCreateInsurer(name: string): Promise<string> {
    try {
      // Buscar aseguradora existente
      const { data: existing, error: searchError } = await supabase
        .from('insurers')
        .select('id')
        .eq('name', name)
        .single();

      if (searchError && searchError.code !== 'PGRST116') {
        throw handleSupabaseError(searchError);
      }

      if (existing) {
        return existing.id;
      }

      // Crear nueva aseguradora
      const { data: created, error: createError } = await supabase
        .from('insurers')
        .insert({ name })
        .select('id')
        .single();

      if (createError) {
        throw handleSupabaseError(createError);
      }

      return created.id;
    } catch (error) {
      console.error('❌ Error getting/creating insurer:', error);
      throw error;
    }
  }

  /**
   * Crea el registro del documento en la base de datos
   */
  private async createDocumentRecord(
    insurerId: string,
    metadata: DocumentMetadata,
    pdfMetadata: PDFMetadata,
    renderedPages: RenderedPage[]
  ): Promise<string> {
    try {
      const storagePath = `${insurerId}`;

      const { data, error } = await supabase
        .from('documents')
        .insert({
          insurer_id: insurerId,
          document_name: metadata.documentName,
          document_type: metadata.documentType,
          version: metadata.version,
          total_pages: pdfMetadata.pageCount,
          storage_path: storagePath,
          is_active: true,
          uploaded_by: metadata.uploadedBy,
        })
        .select('id')
        .single();

      if (error) {
        throw handleSupabaseError(error);
      }

      return data.id;
    } catch (error) {
      console.error('❌ Error creating document record:', error);
      throw error;
    }
  }

  /**
   * Actualiza las referencias de imágenes con el documentId correcto
   */
  private async updatePageImageReferences(
    documentId: string,
    renderedPages: RenderedPage[]
  ): Promise<void> {
    try {
      for (const page of renderedPages) {
        const { error } = await supabase
          .from('page_images')
          .insert({
            document_id: documentId,
            page_number: page.pageNumber,
            storage_url: page.storageUrl,
            storage_path: page.storagePath,
            width: page.width,
            height: page.height,
          });

        if (error) {
          console.warn(`⚠️ Error saving page image reference for page ${page.pageNumber}:`, error);
        }
      }
    } catch (error) {
      console.error('❌ Error updating page image references:', error);
      // No lanzar error, solo loguear
    }
  }

  /**
   * Genera embeddings para los chunks
   */
  private async generateEmbeddingsForChunks(
    chunks: Chunk[]
  ): Promise<Array<Chunk & { embedding: number[] }>> {
    const results: Array<Chunk & { embedding: number[] }> = [];

    for (let i = 0; i < chunks.length; i++) {
      try {
        const chunk = chunks[i];
        const embedding = await embeddingService.generateEmbedding(chunk.content);
        
        results.push({
          ...chunk,
          embedding,
        });

        // Reportar progreso
        const percent = 70 + Math.floor((i / chunks.length) * 20);
        this.reportProgress({
          stage: 'embedding',
          message: `Generando embedding ${i + 1}/${chunks.length}`,
          percent,
        });

      } catch (error) {
        console.warn(`⚠️ Error generating embedding for chunk ${i}:`, error);
        // Continuar con el siguiente chunk
      }
    }

    return results;
  }

  /**
   * Guarda los chunks con embeddings en la base de datos
   */
  private async saveChunksToDatabase(
    documentId: string,
    chunks: Array<Chunk & { embedding: number[] }>
  ): Promise<void> {
    try {
      const chunksToInsert = chunks.map((chunk, index) => ({
        document_id: documentId,
        page_number: chunk.metadata.pageStart,
        content: chunk.content,
        content_normalized: chunk.contentNormalized,
        embedding: chunk.embedding,
        metadata: chunk.metadata,
        coverage_tags: chunk.coverageTags,
        section_type: chunk.sectionType,
      }));

      // Insertar en batches de 50
      const batchSize = 50;
      for (let i = 0; i < chunksToInsert.length; i += batchSize) {
        const batch = chunksToInsert.slice(i, i + batchSize);
        
        const { error } = await supabase
          .from('chunks')
          .insert(batch);

        if (error) {
          console.error(`❌ Error saving chunks batch ${i}:`, error);
          throw handleSupabaseError(error);
        }

        const percent = 90 + Math.floor((i / chunksToInsert.length) * 10);
        this.reportProgress({
          stage: 'storing',
          message: `Guardando chunks ${i + 1}-${Math.min(i + batchSize, chunksToInsert.length)}/${chunksToInsert.length}`,
          percent,
        });
      }
    } catch (error) {
      console.error('❌ Error saving chunks to database:', error);
      throw error;
    }
  }

  /**
   * Realiza rollback en caso de error
   */
  private async rollback(pdfPath: string): Promise<void> {
    console.log('🔄 [DocumentIndexingService] Performing rollback...');
    
    try {
      // Limpiar archivo temporal si existe
      if (fs.existsSync(pdfPath)) {
        fs.unlinkSync(pdfPath);
        console.log('   Temporary file cleaned up');
      }
    } catch (error) {
      console.error('❌ Error during rollback:', error);
    }
  }

  /**
   * Elimina un documento y todos sus datos asociados
   */
  async deleteDocument(documentId: string): Promise<boolean> {
    console.log(`🗑️ [DocumentIndexingService] Deleting document: ${documentId}`);

    try {
      // Obtener información del documento
      const { data: document, error: docError } = await supabase
        .from('documents')
        .select('insurer_id')
        .eq('id', documentId)
        .single();

      if (docError) {
        console.error('❌ Document not found:', docError);
        return false;
      }

      // Eliminar imágenes del storage
      const { data: images } = await supabase
        .from('page_images')
        .select('storage_path')
        .eq('document_id', documentId);

      if (images && images.length > 0) {
        const paths = images.map(img => img.storage_path);
        await supabase.storage.from('clause-pages').remove(paths);
      }

      // Eliminar documento (cascada eliminará chunks y page_images)
      const { error: deleteError } = await supabase
        .from('documents')
        .delete()
        .eq('id', documentId);

      if (deleteError) {
        throw handleSupabaseError(deleteError);
      }

      console.log(`✅ Document ${documentId} deleted successfully`);
      return true;

    } catch (error) {
      console.error('❌ Error deleting document:', error);
      return false;
    }
  }
}

// Exportar instancia singleton
export const documentIndexingService = new DocumentIndexingService();
