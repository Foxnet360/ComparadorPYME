import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { supabase, handleSupabaseError } from '../config/database';
import { pdfExtractor } from './pdfExtractor';
import { semanticChunker, Chunk } from './semanticChunker';
import { embeddingService } from './vector/embeddingService';
import { pdfRenderer } from './pdfRenderer';
import { geminiService } from './gemini';
import { featureFlags } from '../config/featureFlags';
import { structuredClauseExtractor } from './structuredClauseExtractor';
import { InsuranceDomain } from '../types/domain';
import { insurerNameNormalizer } from './insurerNameNormalizer';

export interface DocumentMetadata {
  insurerName: string;
  documentName: string;
  documentType: 'CLAUSULADO_GENERAL' | 'CLAUSULADO_PARTICULAR' | 'COTIZACION' | 'ANEXO';
  version?: string;
  productName?: string;
  uploadedBy?: string;
  domain?: InsuranceDomain;
  fileHash?: string;
  isPermanent?: boolean;
}

export interface IndexingResult {
  success: boolean;
  documentId?: string;
  insurerId?: string;
  deduplicated?: boolean;
  fileHash?: string;
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

export function computePdfSha256(fileBuffer: Buffer): string {
  return crypto.createHash('sha256').update(fileBuffer).digest('hex');
}

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
   * Checks if a document with the same SHA-256 file_hash or (insurer_id, document_name) already exists.
   * Returns deduplicated existing record if identical hash and chunks exist.
   */
  async findExistingDeduplicatedDocument(
    insurerId: string,
    documentName: string,
    fileHash?: string,
    domain?: string
  ): Promise<{
    exactHashMatch?: { id: string; insurerId: string; totalPages: number; chunkCount: number };
    sameNameDiffHashDocId?: string;
  }> {
    if (!fileHash) {
      return {};
    }

    try {
      // 1. Check by exact SHA-256 file_hash in documents
      const hashQuery = supabase
        .from('documents')
        .select('id, insurer_id, document_name, total_pages, is_active')
        .eq('file_hash', fileHash);

      const { data: hashRows } = await (hashQuery as unknown as Promise<{
        data: Array<{
          id: string;
          insurer_id: string;
          document_name: string;
          total_pages: number | null;
          is_active: boolean;
        }> | null;
      }>);

      if (Array.isArray(hashRows) && hashRows.length > 0) {
        const matchedDoc = hashRows[0]!;
        const { count: chunkCount } = await supabase
          .from('chunks')
          .select('*', { count: 'exact', head: true })
          .eq('document_id', matchedDoc.id);

        if ((chunkCount ?? 0) > 0) {
          // Reactivate and mark permanent without duplicating
          try {
            await supabase
              .from('documents')
              .update({
                is_active: true,
                is_permanent: true,
                ...(domain ? { domain } : {}),
                updated_at: new Date().toISOString(),
              } as never)
              .eq('id', matchedDoc.id);
          } catch {
            await supabase
              .from('documents')
              .update({
                is_active: true,
                updated_at: new Date().toISOString(),
              } as never)
              .eq('id', matchedDoc.id);
          }

          return {
            exactHashMatch: {
              id: matchedDoc.id,
              insurerId: matchedDoc.insurer_id || insurerId,
              totalPages: matchedDoc.total_pages || 1,
              chunkCount: chunkCount || 1,
            },
          };
        }
      }

      // 2. Check by (insurer_id, document_name) to avoid duplicate rows
      const nameQuery = supabase
        .from('documents')
        .select('id, file_hash, total_pages, is_active')
        .eq('insurer_id', insurerId)
        .eq('document_name', documentName);

      const { data: nameRows } = await (nameQuery as unknown as Promise<{
        data: Array<{
          id: string;
          file_hash: string | null;
          total_pages: number | null;
          is_active: boolean;
        }> | null;
      }>);

      if (Array.isArray(nameRows) && nameRows.length > 0) {
        const existingDoc = nameRows[0]!;
        if (existingDoc.file_hash === fileHash) {
          const { count: chunkCount } = await supabase
            .from('chunks')
            .select('*', { count: 'exact', head: true })
            .eq('document_id', existingDoc.id);

          if ((chunkCount ?? 0) > 0) {
            await supabase
              .from('documents')
              .update({
                is_active: true,
                updated_at: new Date().toISOString(),
              } as never)
              .eq('id', existingDoc.id);

            return {
              exactHashMatch: {
                id: existingDoc.id,
                insurerId,
                totalPages: existingDoc.total_pages || 1,
                chunkCount: chunkCount || 1,
              },
            };
          }
        }
        return { sameNameDiffHashDocId: existingDoc.id };
      }
    } catch {
      // Non-fatal: proceed with standard indexing
    }

    return {};
  }

  /**
   * Indexa un documento PDF completo en Supabase usando una transacción atómica
   * Con deduplicación permanente por SHA-256 file_hash y (insurer_id, document_name)
   */
  async indexDocument(pdfPath: string, metadata: DocumentMetadata): Promise<IndexingResult> {
    const startTime = Date.now();
    const errors: string[] = [];
    const warnings: string[] = [];

    console.log('🚀 [DocumentIndexingService] Starting document indexing...');
    console.log(`   File: ${pdfPath}`);
    console.log(`   Insurer: ${metadata.insurerName}`);
    console.log(`   Document: ${metadata.documentName}`);

    try {
      // Compute SHA-256 hash when real file is on disk or passed in metadata
      let fileHash = metadata.fileHash;
      if (!fileHash && pdfPath && fs.existsSync(pdfPath)) {
        try {
          const fileBuffer = fs.readFileSync(pdfPath);
          fileHash = computePdfSha256(fileBuffer);
        } catch {
          // Ignore hash error if file cannot be read directly
        }
      }

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

      console.log(
        `✅ Texto extraído: ${extractionResult.text.length} caracteres, ${extractionResult.pages.length} páginas`
      );

      // 2. Obtener o crear aseguradora
      this.reportProgress({
        stage: 'extracting',
        message: 'Verificando aseguradora',
        percent: 15,
      });

      const insurerId = await this.getOrCreateInsurer(metadata.insurerName);
      console.log(`✅ Aseguradora: ${insurerId}`);

      // 2.5 Verificar deduplicación permanente por file_hash o (insurer_id, document_name)
      if (fileHash) {
        const dedupCheck = await this.findExistingDeduplicatedDocument(
          insurerId,
          metadata.documentName,
          fileHash,
          metadata.domain
        );

        if (dedupCheck.exactHashMatch) {
          console.log(
            `♻️ [DocumentIndexingService] Clausulado permanente ya indexado (SHA-256: ${fileHash.slice(0, 12)}...). Reutilizando ${dedupCheck.exactHashMatch.id}`
          );
          this.reportProgress({
            stage: 'complete',
            message: 'Clausulado permanente verificado en biblioteca (sin duplicación)',
            percent: 100,
          });
          return {
            success: true,
            documentId: dedupCheck.exactHashMatch.id,
            insurerId: dedupCheck.exactHashMatch.insurerId,
            deduplicated: true,
            fileHash,
            stats: {
              totalPages:
                dedupCheck.exactHashMatch.totalPages || extractionResult.metadata.pageCount,
              chunksCreated: dedupCheck.exactHashMatch.chunkCount,
              imagesUploaded: 0,
              processingTimeMs: Date.now() - startTime,
            },
            errors,
            warnings,
          };
        }
      }

      // 3. Renderizar páginas a imágenes
      this.reportProgress({
        stage: 'rendering',
        message: 'Renderizando páginas a imágenes',
        percent: 25,
      });

      const renderedPages = await pdfRenderer.renderDocumentPages(
        pdfPath,
        insurerId,
        'temp-doc-id'
      );

      console.log(`✅ Páginas renderizadas: ${renderedPages.length}`);

      // OCR Fallback for scanned/empty pages
      console.log('🔍 Checking for empty/scanned pages needing OCR fallback...');
      let ocrRan = false;
      for (const page of extractionResult.pages) {
        const trimmedText = page.text.trim();
        // If the page has very little text and we have rendered images
        if (trimmedText.length < 150) {
          const renderedPage = renderedPages.find((rp) => rp.pageNumber === page.pageNumber);
          if (renderedPage && renderedPage.buffer) {
            console.log(
              `📸 [OCR Fallback] Page ${page.pageNumber} text is empty or too short (${trimmedText.length} chars). Transcribing with Gemini...`
            );
            try {
              const transcribedText = await geminiService.performOcrOnImage(renderedPage.buffer);
              if (transcribedText.trim().length > 0) {
                page.text = transcribedText;
                page.wordCount = transcribedText.split(/\s+/).length;
                page.hasContent = true;
                ocrRan = true;
                console.log(
                  `   ✅ Transcribed ${page.text.length} characters for page ${page.pageNumber}`
                );
              }
            } catch (ocrError: unknown) {
              const ocrMessage = ocrError instanceof Error ? ocrError.message : String(ocrError);
              console.warn(
                `   ⚠️ Failed to transcribe page ${page.pageNumber} via Gemini OCR:`,
                ocrMessage
              );
              warnings.push(
                `Fallo al transcribir página ${page.pageNumber} vía OCR: ${ocrMessage}`
              );
            }
          }
        }
      }

      if (ocrRan) {
        // Re-construct the full text if any page got OCRed
        extractionResult.text = extractionResult.pages.map((p) => p.text).join('\n\n');
        console.log(
          `✅ Text reconstructed after OCR fallback: ${extractionResult.text.length} characters`
        );
      }

      // 4. Crear chunks semánticos
      this.reportProgress({
        stage: 'chunking',
        message: 'Creando chunks semánticos',
        percent: 50,
      });

      const chunks = semanticChunker.createChunksFromPages(extractionResult.pages, {
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

      const chunksWithEmbeddings = await this.generateEmbeddingsForChunks(chunks);

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

      const imagesPayload = renderedPages.map((page) => ({
        page_number: page.pageNumber,
        storage_url: page.storageUrl,
        storage_path: page.storagePath,
        width: page.width,
        height: page.height,
      }));

      const chunksPayload = chunksWithEmbeddings.map((chunk) => ({
        page_number: chunk.metadata.pageStart,
        content: chunk.content,
        content_normalized: chunk.contentNormalized,
        embedding: `[${chunk.embedding.join(',')}]`,
        metadata: {
          ...chunk.metadata,
          ...(metadata.domain ? { domain: metadata.domain } : {}),
        },
        coverage_tags: chunk.coverageTags,
        section_type: chunk.sectionType,
      }));

      // 7. Llamar a la transacción atómica
      this.reportProgress({
        stage: 'storing',
        message: 'Guardando documento, imágenes y chunks atómicamente',
        percent: 90,
      });

      const { data: documentId, error: rpcError } = await supabase.rpc(
        'index_document_transaction',
        {
          p_insurer_id: insurerId,
          p_document_name: metadata.documentName,
          p_document_type: metadata.documentType,
          p_version: metadata.version || null,
          p_total_pages: extractionResult.metadata.pageCount,
          p_storage_path: `${insurerId}`,
          p_uploaded_by: metadata.uploadedBy || 'anonymous',
          p_images: imagesPayload,
          p_chunks: chunksPayload,
          p_product_name: metadata.productName || metadata.documentName,
        } as unknown as never
      );

      if (rpcError) {
        throw new Error(`Transacción atómica fallida: ${rpcError.message}`);
      }

      // Stamp file_hash, domain, and is_permanent on the persisted document
      if (documentId && (fileHash || metadata.domain)) {
        try {
          await supabase
            .from('documents')
            .update({
              ...(fileHash ? { file_hash: fileHash } : {}),
              ...(metadata.domain ? { domain: metadata.domain } : {}),
              is_permanent: true,
              is_active: true,
              updated_at: new Date().toISOString(),
            } as never)
            .eq('id', documentId);
        } catch {
          try {
            if (fileHash) {
              await supabase
                .from('documents')
                .update({
                  file_hash: fileHash,
                  is_active: true,
                  updated_at: new Date().toISOString(),
                } as never)
                .eq('id', documentId);
            }
          } catch {
            // Non-fatal if mocked in unit tests
          }
        }
      }

      console.log(`✅ Documento, imágenes y chunks guardados atómicamente: ${documentId}`);

      // 8. Auto-extract structured clauses (gated by feature flag)
      if (featureFlags.isEnabled('autoExtractStructuredClauses')) {
        this.reportProgress({
          stage: 'storing',
          message: 'Extrayendo cláusulas estructuradas',
          percent: 95,
        });

        try {
          const extractionPromise = structuredClauseExtractor.extractFromText(
            extractionResult.text,
            metadata.insurerName,
            metadata.productName || metadata.documentName,
            metadata.documentType as 'CLAUSULADO_GENERAL' | 'CLAUSULADO_PARTICULAR'
          );

          const timeoutPromise = new Promise<never>((_, reject) =>
            setTimeout(
              () => reject(new Error('Structured clause extraction timed out after 30s')),
              30000
            )
          );

          const structured = await Promise.race([extractionPromise, timeoutPromise]);

          await structuredClauseExtractor.storeStructuredClause(
            structured,
            documentId,
            metadata.domain || 'pyme'
          );
          console.log(
            `✅ [DocumentIndexingService] Structured clause extracted and stored for document ${documentId}`
          );
        } catch (extractError: unknown) {
          const errorMsg =
            extractError instanceof Error ? extractError.message : String(extractError);
          console.warn(
            `⚠️ [DocumentIndexingService] Structured clause extraction failed for ${documentId}:`,
            errorMsg
          );
          warnings.push(`Extracción estructurada fallida: ${errorMsg}`);
        }
      }

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
        deduplicated: false,
        fileHash,
        stats: {
          totalPages: extractionResult.metadata.pageCount,
          chunksCreated: chunksWithEmbeddings.length,
          imagesUploaded: renderedPages.length,
          processingTimeMs,
        },
        errors,
        warnings,
      };
    } catch (error: unknown) {
      console.error('❌ [DocumentIndexingService] Error:', error);
      errors.push(error instanceof Error ? error.message : String(error));

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
  async getOrCreateInsurer(name: string): Promise<string> {
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
        return (existing as { id: string }).id;
      }

      // Crear nueva aseguradora
      const { data: created, error: createError } = await supabase
        .from('insurers')
        .insert({ name } as unknown as never[])
        .select('id')
        .single();

      if (createError) {
        throw handleSupabaseError(createError);
      }

      if (!created) {
        throw new Error('Failed to create insurer: no data returned');
      }

      return (created as { id: string }).id;
    } catch (error) {
      console.error('❌ Error getting/creating insurer:', error);
      throw error;
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
        const chunk = chunks[i]!;
        const embedding = await embeddingService.generateEmbedding(chunk.content);

        results.push({
          ...chunk,
          embedding,
        } as Chunk & { embedding: number[] });

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
   * Elimina un documento y todos sus datos asociados
   */
  async deleteDocument(documentId: string): Promise<boolean> {
    console.log(`🗑️ [DocumentIndexingService] Deleting document: ${documentId}`);

    try {
      // Obtener información del documento
      const { error: docError } = await supabase
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
        const paths = (images as Array<{ storage_path: string }>).map((img) => img.storage_path);
        await supabase.storage.from('clause-pages').remove(paths);
      }

      // Eliminar documento (cascada eliminará chunks y page_images)
      const { error: deleteError } = await supabase.from('documents').delete().eq('id', documentId);

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

/**
 * Ensures an uploaded clause PDF buffer is permanently stored and indexed in the
 * persistent library without duplicating existing SHA-256 hashes or (insurer_id, document_name) rows.
 */
export async function ensureClausePersistedInLibrary(
  fileBuffer: Buffer,
  fileName: string,
  insurerName: string,
  domain?: string
): Promise<{
  documentId?: string;
  insurerId?: string;
  deduplicated: boolean;
  fileHash: string;
}> {
  const fileHash = computePdfSha256(fileBuffer);
  const normalizedInsurer =
    insurerNameNormalizer.normalize(insurerName || 'Aseguradora') || 'Aseguradora';
  const cleanDocName =
    fileName
      .replace(/\.pdf$/i, '')
      .replace(/[_-]+/g, ' ')
      .trim() || 'Clausulado General';

  const insurerId = await documentIndexingService.getOrCreateInsurer(normalizedInsurer);

  // Check if already persisted by SHA-256 hash or (insurer_id, document_name)
  const existing = await documentIndexingService.findExistingDeduplicatedDocument(
    insurerId,
    cleanDocName,
    fileHash,
    domain
  );

  if (existing.exactHashMatch) {
    return {
      documentId: existing.exactHashMatch.id,
      insurerId: existing.exactHashMatch.insurerId,
      deduplicated: true,
      fileHash,
    };
  }

  const tmpDir = '/tmp/uploads';
  if (!fs.existsSync(tmpDir)) {
    fs.mkdirSync(tmpDir, { recursive: true });
  }
  const tempPdfPath = path.join(tmpDir, `perm-clause-${fileHash.slice(0, 12)}-${Date.now()}.pdf`);

  try {
    fs.writeFileSync(tempPdfPath, fileBuffer);
    const result = await documentIndexingService.indexDocument(tempPdfPath, {
      insurerName: normalizedInsurer,
      documentName: cleanDocName,
      documentType: 'CLAUSULADO_GENERAL',
      productName: cleanDocName,
      domain: (domain as InsuranceDomain) || 'pyme',
      fileHash,
      isPermanent: true,
    });

    return {
      documentId: result.documentId,
      insurerId: result.insurerId || insurerId,
      deduplicated: Boolean(result.deduplicated),
      fileHash,
    };
  } finally {
    if (fs.existsSync(tempPdfPath)) {
      try {
        fs.unlinkSync(tempPdfPath);
      } catch {
        // Ignore cleanup failure
      }
    }
  }
}
