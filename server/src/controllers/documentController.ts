import { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import {
  documentIndexingService,
  DocumentMetadata,
  computePdfSha256,
} from '../services/documentIndexingService';
import { insurerNameNormalizer } from '../services/insurerNameNormalizer';
import { supabase } from '../config/database';
import { handleSupabaseError } from '../config/database';
import { AuthenticatedRequest, requireUser } from '../middleware/auth';
import { AppError } from '../errors';
import logger from '../config/logger';

interface DocumentListItem {
  id: string;
  document_name: string;
  document_type: string;
  version: string | null;
  product_name: string | null;
  domain?: string | null;
  total_pages: number | null;
  is_active: boolean;
  is_permanent?: boolean;
  created_at: string;
  insurers: { id: string; name: string } | null;
}

interface ExistingDocument {
  id: string;
  document_name: string;
  version: string | null;
}

interface DocumentDetail {
  id: string;
  document_name: string;
  document_type: string;
  version: string | null;
  total_pages: number | null;
  storage_path: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  insurers: { id: string; name: string; nit: string | null } | null;
}

// Configuración de multer para upload de archivos
const uploadDir = '/tmp/uploads';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf' || file.originalname.toLowerCase().endsWith('.pdf')) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'));
    }
  },
});

// Validación de campos requeridos
const validateDocumentFields = (
  body: Record<string, unknown>
): { valid: boolean; error?: string } => {
  const required = ['insurerName', 'documentName', 'documentType'];

  for (const field of required) {
    const value = body[field];
    if (!value || typeof value !== 'string' || value.trim() === '') {
      return { valid: false, error: `Missing or invalid field: ${field}` };
    }
  }

  const documentType = body.documentType as string;
  const validTypes = ['CLAUSULADO_GENERAL', 'CLAUSULADO_PARTICULAR', 'COTIZACION', 'ANEXO'];
  if (!validTypes.includes(documentType)) {
    return {
      valid: false,
      error: `Invalid documentType. Must be one of: ${validTypes.join(', ')}`,
    };
  }

  const insurerName = body.insurerName as string;
  if (insurerName.length > 200) {
    return { valid: false, error: 'insurerName must be <= 200 characters' };
  }

  const documentName = body.documentName as string;
  if (documentName.length > 500) {
    return { valid: false, error: 'documentName must be <= 500 characters' };
  }

  return { valid: true };
};

export const documentController = {
  /**
   * Middleware de upload para usar en rutas
   */
  uploadMiddleware: upload.single('file'),

  /**
   * POST /api/documents - Indexar nuevo documento
   */
  createDocument: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    logger.info('📥 [documentController.createDocument] Request received');

    const filePath = req.file?.path;

    try {
      // Verificar que hay archivo
      if (!req.file) {
        res.status(400).json({
          success: false,
          error: 'No file uploaded',
          details: 'Please provide a PDF file in the "file" field',
        });
        return;
      }

      // AUTH-2: ownership comes from the authenticated session; a
      // client-supplied userId is a spoofing vector and is rejected.
      if ((req.body as Record<string, unknown>).userId !== undefined) {
        res.status(400).json({
          success: false,
          error: 'userId is derived from the authenticated session; do not send it',
        });
        return;
      }
      const uploadedBy = requireUser(req as AuthenticatedRequest);

      // Validar campos
      const validation = validateDocumentFields(req.body);
      if (!validation.valid) {
        res.status(400).json({
          success: false,
          error: validation.error,
        });
        return;
      }

      const { insurerName, documentName, documentType, version, productName, domain } = req.body;

      logger.info(`   File: ${req.file.originalname} (${req.file.size} bytes)`);
      logger.info(`   Insurer: ${insurerName}`);
      logger.info(`   Document: ${documentName}`);
      logger.info(`   Type: ${documentType}`);
      logger.info(`   Product: ${productName || 'N/A'}`);
      logger.info(`   Domain: ${domain || 'pyme'}`);

      // Calculate SHA-256 hash for strict deduplication if file is on disk
      let fileHash: string | undefined;
      if (filePath && fs.existsSync(filePath)) {
        try {
          const fileBuffer = fs.readFileSync(filePath);
          fileHash = computePdfSha256(fileBuffer);
        } catch (err) {
          logger.warn({ err }, 'Could not read file for SHA-256 hash calculation');
        }
      } else if (req.file.buffer) {
        fileHash = computePdfSha256(req.file.buffer);
      }

      // Obtener o crear aseguradora
      const insurerId = await documentIndexingService.getOrCreateInsurer(insurerName.trim());

      // Verificar deduplicación estricta por SHA-256 file_hash
      if (fileHash && typeof documentIndexingService.findExistingDeduplicatedDocument === 'function') {
        const existingMatch = await documentIndexingService.findExistingDeduplicatedDocument(
          insurerId,
          documentName.trim(),
          fileHash,
          (domain as string) || 'pyme'
        );

        if (existingMatch?.exactHashMatch) {
          logger.info(
            `   ⚡ [Deduplicación] Clausulado idéntico ya existente en repositorio: ${existingMatch.exactHashMatch.id}`
          );
          res.status(200).json({
            success: true,
            deduplicated: true,
            message: 'El clausulado ya existe y se encuentra previamente indexado en la biblioteca',
            documentId: existingMatch.exactHashMatch.id,
            insurerId: existingMatch.exactHashMatch.insurerId,
            stats: {
              totalPages: existingMatch.exactHashMatch.totalPages,
              chunksCreated: existingMatch.exactHashMatch.chunkCount,
              imagesUploaded: 0,
              processingTimeMs: 0,
            },
            warnings: [],
            archivedDocument: null,
          });
          return;
        }
      }

      // Verificar si existe documento activo para esta combinación (insurer + type + product)
      let existingQuery = supabase
        .from('documents')
        .select('id, document_name, version')
        .eq('insurer_id', insurerId)
        .eq('document_type', documentType)
        .eq('is_active', true);

      // Si hay product_name, filtrar por él también
      if (productName) {
        existingQuery = existingQuery.eq('product_name', productName.trim());
      } else {
        existingQuery = existingQuery.is('product_name', null);
      }

      const { data: existingDocRaw } = (await existingQuery.single()) as unknown as {
        data: ExistingDocument | null;
      };
      const existingDoc = existingDocRaw;

      let archivedDoc = null;
      if (existingDoc) {
        logger.info(
          `   📁 Archivando versión anterior: ${existingDoc.document_name} (v${existingDoc.version || 'N/A'})`
        );

        const { error: archiveError } = await supabase
          .from('documents')
          .update({ is_active: false, updated_at: new Date().toISOString() } as never)
          .eq('id', existingDoc.id);

        if (archiveError) {
          logger.warn({ err: archiveError }, `   ⚠️ Error archivando documento anterior`);
        } else {
          archivedDoc = existingDoc;
        }
      }

      // Preparar metadata completa
      const metadata: DocumentMetadata = {
        insurerName: insurerName.trim(),
        documentName: documentName.trim(),
        documentType,
        version: version?.trim(),
        productName: productName?.trim(),
        domain: (domain as any) || 'pyme',
        fileHash,
        isPermanent: true,
        uploadedBy,
      };

      // Indexar documento
      const result = await documentIndexingService.indexDocument(filePath!, metadata);

      if (!result.success) {
        // ERR-1: indexing failures reach the central errorHandler (traceId).
        next(
          new AppError(`Failed to index document: ${result.errors.join('; ') || 'unknown'}`, 500)
        );
        return;
      }

      res.status(201).json({
        success: true,
        documentId: result.documentId,
        insurerId: result.insurerId,
        stats: result.stats,
        warnings: result.warnings,
        archivedDocument: archivedDoc
          ? {
              id: archivedDoc.id,
              documentName: archivedDoc.document_name,
              version: archivedDoc.version,
            }
          : null,
      });
    } catch (error: unknown) {
      logger.error({ err: error }, '❌ [documentController] Error');

      // ERR-1: forward to the central error handler instead of a raw 500.
      next(error instanceof Error ? error : new Error(String(error)));
    } finally {
      // Garantizar limpieza del archivo temporal en TODAS las ramas
      if (filePath && fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
        } catch (e) {
          logger.warn({ err: e }, 'Failed to cleanup temp file');
        }
      }
    }
  },

  /**
   * GET /api/documents - Listar documentos
   */
  listDocuments: async (req: Request, res: Response): Promise<void> => {
    console.log('📋 [documentController.listDocuments] Request received');

    try {
      const { insurerId, documentType, domain, isActive, latest, limit = '100', offset = '0' } = req.query;

      let query = supabase
        .from('documents')
        .select(
          `
          id,
          document_name,
          document_type,
          version,
          product_name,
          domain,
          total_pages,
          is_active,
          is_permanent,
          created_at,
          insurers:insurer_id (id, name)
        `
        )
        .order('created_at', { ascending: false })
        .limit(parseInt(limit as string))
        .range(
          parseInt(offset as string),
          parseInt(offset as string) + parseInt(limit as string) - 1
        );

      // Filtrar por estado activo
      if (isActive === 'true') {
        query = query.eq('is_active', true);
      } else if (isActive === 'false') {
        query = query.eq('is_active', false);
      }

      if (insurerId) {
        query = query.eq('insurer_id', String(insurerId));
      }

      if (documentType) {
        query = query.eq('document_type', documentType as "CLAUSULADO_GENERAL" | "CLAUSULADO_PARTICULAR" | "COTIZACION");
      }

      if (domain) {
        query = query.eq('domain', String(domain));
      }

      const { data, error, count } = (await query) as unknown as {
        data: DocumentListItem[] | null;
        error: unknown;
        count: number | null;
      };

      if (error) {
        throw handleSupabaseError(error);
      }

      // Formatear respuesta
      let documents = (data || []).map((doc) => ({
        id: doc.id,
        documentName: doc.document_name,
        documentType: doc.document_type,
        version: doc.version,
        productName: doc.product_name,
        domain: doc.domain,
        totalPages: doc.total_pages,
        isActive: doc.is_active,
        isPermanent: doc.is_permanent,
        createdAt: doc.created_at,
        insurer: doc.insurers,
      }));

      // Si latest=true, filtrar solo la última versión activa por insurer+product+type
      if (latest === 'true') {
        const seen = new Set<string>();
        documents = documents.filter((doc) => {
          const key = `${doc.insurer?.id}-${doc.documentType}-${doc.productName}-${doc.domain}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return doc.isActive === true;
        });
      }

      res.json({
        success: true,
        documents,
        count: documents.length,
        total: count,
      });
    } catch (error: unknown) {
      console.error('❌ [documentController] Error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to list documents',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  },

  /**
   * GET /api/documents/check-existing - Verificar si existe clausulado asociado
   */
  checkExistingClause: async (req: Request, res: Response): Promise<void> => {
    try {
      const { insurerName, domain, productName } = req.query;

      if (!insurerName || typeof insurerName !== 'string') {
        res.status(400).json({
          success: false,
          error: 'insurerName is required',
        });
        return;
      }

      const normalized = insurerNameNormalizer.normalize(insurerName);

      // Query active documents
      let query = supabase
        .from('documents')
        .select(
          `
          id,
          document_name,
          document_type,
          version,
          product_name,
          domain,
          total_pages,
          is_active,
          created_at,
          insurers:insurer_id!inner (id, name)
        `
        )
        .eq('is_active', true);

      if (domain && typeof domain === 'string') {
        query = query.eq('domain', domain);
      }

      if (productName && typeof productName === 'string') {
        query = query.ilike('product_name', `%${productName.trim()}%`);
      }

      const { data, error } = (await query) as unknown as {
        data: DocumentListItem[] | null;
        error: unknown;
      };

      if (error) {
        throw handleSupabaseError(error);
      }

      // Filter by normalized insurer name
      const matches = (data || []).filter((doc) => {
        if (!doc.insurers?.name) return false;
        const docInsurerNorm = insurerNameNormalizer.normalize(doc.insurers.name);
        return (
          docInsurerNorm === normalized ||
          docInsurerNorm.includes(normalized) ||
          normalized.includes(docInsurerNorm)
        );
      });

      if (matches.length > 0) {
        const bestMatch = matches[0]!;
        res.json({
          exists: true,
          count: matches.length,
          document: {
            id: bestMatch.id,
            documentName: bestMatch.document_name,
            productName: bestMatch.product_name,
            version: bestMatch.version,
            domain: bestMatch.domain,
            totalPages: bestMatch.total_pages,
            insurer: bestMatch.insurers,
          },
          matches: matches.map((m) => ({
            id: m.id,
            documentName: m.document_name,
            productName: m.product_name,
            version: m.version,
            domain: m.domain,
            totalPages: m.total_pages,
            insurer: m.insurers,
          })),
        });
      } else {
        res.json({
          exists: false,
          count: 0,
          document: null,
          matches: [],
        });
      }
    } catch (error: unknown) {
      console.error('❌ [documentController.checkExistingClause] Error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to check existing clause',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  },

  /**
   * GET /api/documents/:id - Obtener documento específico
   */
  getDocument: async (req: Request, res: Response): Promise<void> => {
    console.log(`📄 [documentController.getDocument] ID: ${req.params.id}`);

    try {
      const { id } = req.params as { id: string };

      const { data, error } = await supabase
        .from('documents')
        .select(
          `
          id,
          document_name,
          document_type,
          version,
          total_pages,
          storage_path,
          is_active,
          created_at,
          updated_at,
          insurers:insurer_id (id, name, nit)
        `
        )
        .eq('id', id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          res.status(404).json({
            success: false,
            error: 'Document not found',
          });
          return;
        }
        throw handleSupabaseError(error);
      }

      // Obtener conteo de chunks
      const { count: chunkCount } = await supabase
        .from('chunks')
        .select('*', { count: 'exact', head: true })
        .eq('document_id', id as string);

      // Obtener conteo de imágenes
      const { count: imageCount } = await supabase
        .from('page_images')
        .select('*', { count: 'exact', head: true })
        .eq('document_id', id as string);

      const docData = data as unknown as DocumentDetail;
      res.json({
        success: true,
        document: {
          id: docData.id,
          documentName: docData.document_name,
          documentType: docData.document_type,
          version: docData.version,
          totalPages: docData.total_pages,
          storagePath: docData.storage_path,
          isActive: docData.is_active,
          createdAt: docData.created_at,
          updatedAt: docData.updated_at,
          insurer: docData.insurers,
          stats: {
            chunkCount,
            imageCount,
          },
        },
      });
    } catch (error: unknown) {
      console.error('❌ [documentController] Error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get document',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  },

  /**
   * DELETE /api/documents/:id - Eliminar documento
   */
  deleteDocument: async (req: Request, res: Response): Promise<void> => {
    console.log(`🗑️ [documentController.deleteDocument] ID: ${req.params.id}`);

    try {
      const id = req.params.id as string;

      const success = await documentIndexingService.deleteDocument(id);

      if (!success) {
        res.status(404).json({
          success: false,
          error: 'Document not found or could not be deleted',
        });
        return;
      }

      res.json({
        success: true,
        message: 'Document deleted successfully',
      });
    } catch (error: unknown) {
      console.error('❌ [documentController] Error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete document',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  },

  /**
   * GET /api/documents/:id/chunks - Obtener chunks de un documento
   */
  getDocumentChunks: async (req: Request, res: Response): Promise<void> => {
    console.log(`📦 [documentController.getDocumentChunks] ID: ${req.params.id}`);

    try {
      const { id } = req.params;
      const { limit = '50', offset = '0', sectionType, coverageTag } = req.query;

      let query = supabase
        .from('chunks')
        .select('id, page_number, content, coverage_tags, section_type, metadata, created_at')
        .eq('document_id', id as string)
        .order('page_number', { ascending: true })
        .limit(parseInt(limit as string))
        .range(
          parseInt(offset as string),
          parseInt(offset as string) + parseInt(limit as string) - 1
        );

      if (sectionType) {
        query = query.eq('section_type', sectionType as "COBERTURA" | "EXCLUSION" | "DEDUCIBLE" | "CONDICION" | "GENERAL");
      }

      if (coverageTag) {
        query = query.contains('coverage_tags', [coverageTag]);
      }

      const { data, error, count } = await query;

      if (error) {
        throw handleSupabaseError(error);
      }

      res.json({
        success: true,
        documentId: id,
        chunks: data || [],
        count: data?.length || 0,
        total: count,
      });
    } catch (error: unknown) {
      console.error('❌ [documentController] Error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get document chunks',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  },
};
