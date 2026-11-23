import { Request, Response, NextFunction } from 'express';
import { supabase, handleSupabaseError } from '../config/database';
import { embeddingService } from '../services/vector/embeddingService';
import { ValidationError, NotFoundError } from '../errors';
import logger from '../config/logger';

interface SearchChunkResult {
  id: string;
  content: string;
  page_number: number;
  document_id: string;
  document_name: string;
  document_type: string;
  section_type: string;
  coverage_tags: string[];
  similarity: number;
}

interface ChunkImageResult {
  chunk_id: string;
  image_url: string;
  image_path: string;
}

interface CoverageChunkResult {
  id: string;
  content: string;
  page_number: number;
  section_type: string;
  coverage_tags: string[];
  documents: unknown;
}

export const searchController = {
  /**
   * POST /api/search - Búsqueda semántica
   */
  search: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    logger.info('searchController.search request received');

    try {
      const { query, insurerId, coverageTag, sectionType, limit = '5' } = req.body;

      if (!query || typeof query !== 'string' || query.trim() === '') {
        return next(new ValidationError('Query is required'));
      }

      if (!insurerId) {
        return next(new ValidationError('insurerId is required'));
      }

      logger.info(
        { query, insurerId, coverageTag: coverageTag || 'any' },
        'Executing semantic search'
      );

      // Generar embedding para la query
      const queryEmbedding = await embeddingService.generateQueryEmbedding(query);

      // Buscar en Supabase
      const { data: chunks, error } = await supabase.rpc('search_chunks_advanced', {
        p_embedding: queryEmbedding,
        p_insurer_id: insurerId,
        p_coverage_tags: coverageTag ? [coverageTag] : null,
        p_section_types: sectionType ? [sectionType] : null,
        p_match_count: parseInt(limit),
        p_min_similarity: 0.6,
      } as never);

      if (error) {
        throw handleSupabaseError(error);
      }

      const chunksData = (chunks || []) as SearchChunkResult[];
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
      const { data: chunksWithImagesRaw } = await supabase.rpc('get_chunks_with_images', {
        p_chunk_ids: chunkIds,
      } as never);

      const chunksWithImages = (chunksWithImagesRaw || []) as ChunkImageResult[];

      // Combinar resultados con imágenes
      const results = chunksData.map((chunk) => {
        const imageData = chunksWithImages?.find((img) => img.chunk_id === chunk.id);
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
          imageUrl: imageData?.image_url || null,
          imagePath: imageData?.image_path || null,
        };
      });

      res.json({
        success: true,
        query,
        results,
        count: results.length,
      });
    } catch (error: unknown) {
      next(error);
    }
  },

  /**
   * POST /api/search/by-coverage - Búsqueda por cobertura específica
   */
  searchByCoverage: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    logger.info('searchController.searchByCoverage request received');

    try {
      const { coverageTag, insurerId, documentType, limit = '10' } = req.body;

      if (!coverageTag) {
        return next(new ValidationError('coverageTag is required'));
      }

      logger.info(
        { coverageTag, insurerId: insurerId || 'any' },
        'Searching chunks by coverage tag'
      );

      let query = supabase
        .from('chunks')
        .select(
          `
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
        `
        )
        .contains('coverage_tags', [coverageTag])
        .limit(parseInt(limit));

      if (insurerId) {
        query = query.eq('documents.insurer_id', insurerId);
      }

      if (documentType) {
        query = query.eq('documents.document_type', documentType);
      }

      const { data, error } = await query;

      if (error) {
        throw handleSupabaseError(error);
      }

      const rows = (data || []) as CoverageChunkResult[];
      const results =
        rows.map((chunk) => ({
          chunkId: chunk.id,
          content: chunk.content,
          pageNumber: chunk.page_number,
          sectionType: chunk.section_type,
          coverageTags: chunk.coverage_tags,
          document: chunk.documents,
        })) || [];

      res.json({
        success: true,
        coverageTag,
        results,
        count: results.length,
      });
    } catch (error: unknown) {
      next(error);
    }
  },

  /**
   * POST /api/search/compare - Comparar cotización vs clausulado
   */
  compareDocuments: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    logger.info('searchController.compareDocuments request received');

    try {
      const { quoteDocumentId, clauseDocumentId, coverageTag } = req.body;

      if (!quoteDocumentId || !clauseDocumentId) {
        return next(new ValidationError('Both quoteDocumentId and clauseDocumentId are required'));
      }

      logger.info({ quoteDocumentId, clauseDocumentId }, 'Comparing quote vs clause documents');

      // Validar que ambos documentos existen
      const { data: quoteDoc } = await supabase
        .from('documents')
        .select('document_name, document_type')
        .eq('id', quoteDocumentId)
        .single();

      const { data: clauseDoc } = await supabase
        .from('documents')
        .select('document_name, document_type')
        .eq('id', clauseDocumentId)
        .single();

      if (!quoteDoc || !clauseDoc) {
        return next(new NotFoundError('One or both documents not found'));
      }

      // Usar función SQL para validación
      const { data: comparison, error } = await supabase.rpc('validate_quote_coverage', {
        p_quote_document_id: quoteDocumentId,
        p_clause_document_id: clauseDocumentId,
        p_coverage_tag: coverageTag || 'general',
        p_match_count: 5,
      } as never);

      if (error) {
        throw handleSupabaseError(error);
      }

      res.json({
        success: true,
        quoteDocument: quoteDoc,
        clauseDocument: clauseDoc,
        coverageTag: coverageTag || 'general',
        matches: comparison || [],
      });
    } catch (error: unknown) {
      next(error);
    }
  },
};
