import { Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { documentIndexingService, DocumentMetadata } from '../services/documentIndexingService';
import { clauseIndexer } from '../services/clauseIndexer';
import { supabase } from '../config/database';
import { handleSupabaseError } from '../config/database';

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
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
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
const validateDocumentFields = (body: any): { valid: boolean; error?: string } => {
  const required = ['insurerName', 'documentName', 'documentType'];
  
  for (const field of required) {
    if (!body[field] || typeof body[field] !== 'string' || body[field].trim() === '') {
      return { valid: false, error: `Missing or invalid field: ${field}` };
    }
  }

  const validTypes = ['CLAUSULADO_GENERAL', 'CLAUSULADO_PARTICULAR', 'COTIZACION', 'ANEXO'];
  if (!validTypes.includes(body.documentType)) {
    return { valid: false, error: `Invalid documentType. Must be one of: ${validTypes.join(', ')}` };
  }

  if (body.insurerName.length > 200) {
    return { valid: false, error: 'insurerName must be <= 200 characters' };
  }

  if (body.documentName.length > 500) {
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
  createDocument: async (req: Request, res: Response): Promise<void> => {
    console.log('📥 [documentController.createDocument] Request received');

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

      // Validar campos
      const validation = validateDocumentFields(req.body);
      if (!validation.valid) {
        res.status(400).json({
          success: false,
          error: validation.error,
        });
        return;
      }

      const { insurerName, documentName, documentType, version, productName } = req.body;
      const uploadedBy = req.body.userId || 'anonymous';

      console.log(`   File: ${req.file.originalname} (${req.file.size} bytes)`);
      console.log(`   Insurer: ${insurerName}`);
      console.log(`   Document: ${documentName}`);
      console.log(`   Type: ${documentType}`);
      console.log(`   Product: ${productName || 'N/A'}`);

      // Obtener o crear aseguradora
      const insurerId = await documentIndexingService.getOrCreateInsurer(insurerName.trim());

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
      
      const { data: existingDoc } = await existingQuery.single() as { data: any };

      let archivedDoc = null;
      if (existingDoc) {
        console.log(`   📁 Archivando versión anterior: ${existingDoc.document_name} (v${existingDoc.version || 'N/A'})`);
        
        const { error: archiveError } = await (supabase
          .from('documents') as any)
          .update({ is_active: false, updated_at: new Date().toISOString() })
          .eq('id', existingDoc.id);

        if (archiveError) {
          console.warn(`   ⚠️ Error archivando documento anterior:`, archiveError);
        } else {
          archivedDoc = existingDoc;
        }
      }

      // Preparar metadata
      const metadata: DocumentMetadata = {
        insurerName: insurerName.trim(),
        documentName: documentName.trim(),
        documentType,
        version: version?.trim(),
        productName: productName?.trim(),
        uploadedBy,
      };

      // Indexar documento
      const result = await documentIndexingService.indexDocument(filePath!, metadata);

      if (!result.success) {
        res.status(500).json({
          success: false,
          error: 'Failed to index document',
          details: result.errors,
          warnings: result.warnings,
        });
        return;
      }

      // Index in clause_chunks for advanced analysis (async, non-blocking)
      if (result.success && result.documentId) {
        const isClause = documentType === 'CLAUSULADO_GENERAL' || documentType === 'CLAUSULADO_PARTICULAR';
        
        if (isClause) {
          console.log(`   🔍 [documentController] Triggering clause indexing for document ${result.documentId}`);
          
          try {
            const clauseJobId = await clauseIndexer.startIndexing(filePath!, {
              insurerName: insurerName.trim(),
              documentType,
              documentName: documentName.trim(),
              documentId: result.documentId,
            });
            
            console.log(`   ✅ [documentController] Clause indexing job started: ${clauseJobId}`);
          } catch (clauseError) {
            // Log but don't fail the upload
            console.warn(`   ⚠️ [documentController] Clause indexing failed (non-critical):`, clauseError);
          }
        }
      }

      res.status(201).json({
        success: true,
        documentId: result.documentId,
        insurerId: result.insurerId,
        stats: result.stats,
        warnings: result.warnings,
        archivedDocument: archivedDoc ? {
          id: archivedDoc.id,
          documentName: archivedDoc.document_name,
          version: archivedDoc.version,
        } : null,
      });

    } catch (error: any) {
      console.error('❌ [documentController] Error:', error);

      res.status(500).json({
        success: false,
        error: 'Internal server error',
        details: error.message,
      });
    } finally {
      // Garantizar limpieza del archivo temporal en TODAS las ramas
      if (filePath && fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
        } catch (e) {
          console.warn('Failed to cleanup temp file:', e);
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
      const { insurerId, documentType, isActive, latest, limit = '50', offset = '0' } = req.query;

      let query = supabase
        .from('documents')
        .select(`
          id,
          document_name,
          document_type,
          version,
          product_name,
          total_pages,
          is_active,
          created_at,
          insurers:insurer_id (id, name)
        `)
        .order('created_at', { ascending: false })
        .limit(parseInt(limit as string))
        .range(parseInt(offset as string), parseInt(offset as string) + parseInt(limit as string) - 1);

      // Filtrar por estado activo
      if (isActive === 'true') {
        query = query.eq('is_active', true);
      } else if (isActive === 'false') {
        query = query.eq('is_active', false);
      }

      if (insurerId) {
        query = query.eq('insurer_id', insurerId);
      }

      if (documentType) {
        query = query.eq('document_type', documentType);
      }

      const { data, error, count } = await query as { data: any[], error: any, count: number };

      if (error) {
        throw handleSupabaseError(error);
      }

      // Formatear respuesta
      let documents = (data as any[])?.map((doc: any) => ({
        id: doc.id,
        documentName: doc.document_name,
        documentType: doc.document_type,
        version: doc.version,
        productName: doc.product_name,
        totalPages: doc.total_pages,
        isActive: doc.is_active,
        createdAt: doc.created_at,
        insurer: doc.insurers,
      })) || [];

      // Si latest=true, filtrar solo la última versión activa por insurer+product+type
      if (latest === 'true') {
        const seen = new Set<string>();
        documents = documents.filter((doc: any) => {
          const key = `${doc.insurer?.id}-${doc.documentType}-${doc.productName}`;
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

    } catch (error: any) {
      console.error('❌ [documentController] Error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to list documents',
        details: error.message,
      });
    }
  },

  /**
   * GET /api/documents/:id - Obtener documento específico
   */
  getDocument: async (req: Request, res: Response): Promise<void> => {
    console.log(`📄 [documentController.getDocument] ID: ${req.params.id}`);
    
    try {
      const { id } = req.params;

      const { data, error } = await supabase
        .from('documents')
        .select(`
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
        `)
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
        .eq('document_id', id);

      // Obtener conteo de imágenes
      const { count: imageCount } = await supabase
        .from('page_images')
        .select('*', { count: 'exact', head: true })
        .eq('document_id', id);

      const docData = data as any;
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

    } catch (error: any) {
      console.error('❌ [documentController] Error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get document',
        details: error.message,
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

    } catch (error: any) {
      console.error('❌ [documentController] Error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete document',
        details: error.message,
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
        .eq('document_id', id)
        .order('page_number', { ascending: true })
        .limit(parseInt(limit as string))
        .range(parseInt(offset as string), parseInt(offset as string) + parseInt(limit as string) - 1);

      if (sectionType) {
        query = query.eq('section_type', sectionType);
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

    } catch (error: any) {
      console.error('❌ [documentController] Error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get document chunks',
        details: error.message,
      });
    }
  },
};
