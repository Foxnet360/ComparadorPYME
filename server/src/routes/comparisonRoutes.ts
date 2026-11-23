/**
 * Unified Comparison API Routes
 * Endpoints for the unified multimodal comparison engine
 */

import express from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { comparisonEngineAdapter } from '../services/unifiedComparison/comparisonEngineAdapter';
import { validatePdfMagicBytes } from '../middleware/upload';
import { env } from '../config/env';

function cleanupUploadedFiles(files?: Express.Multer.File[]): void {
  if (!files || files.length === 0) return;
  for (const f of files) {
    try {
      if (f.path && fs.existsSync(f.path)) {
        fs.unlinkSync(f.path);
      }
    } catch {
      // Ignore cleanup errors
    }
  }
}
import { unifiedComparisonFlag } from '../services/unifiedComparison/featureFlagService';
import { featureFlags } from '../config/featureFlags';
import { saveAnalysisHistory } from '../repositories/analysisRepository';
import { matrixRowsToComparisonReport } from '../controllers/analysisController';
import logger from '../config/logger';

const router = express.Router();

// Configure multer for file uploads
const upload = multer({
  dest: path.join(process.cwd(), 'uploads', 'temp'),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB max per file
    files: 20, // Max 20 files
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'));
    }
  },
});

/**
 * POST /api/comparison/unified
 * Create a unified comparison of multiple insurance quotes
 */
router.post('/unified', upload.array('quotes', 10), async (req, res) => {
  const startTime = Date.now();
  const correlationId = `api-unified-${Date.now()}`;
  const userId = (req as AuthenticatedRequest).user?.id;

  try {
    logger.info({ correlationId }, 'POST /api/comparison/unified received');

    // Validate request
    if (!req.files || (req.files as Express.Multer.File[]).length === 0) {
      return res.status(400).json({
        error: 'No quote files provided',
        message: 'Please upload at least one quote PDF',
      });
    }

    const files = req.files as Express.Multer.File[];

    // Validate file count
    if (files.length > 10) {
      cleanupUploadedFiles(files);
      return res.status(400).json({
        error: 'Too many files',
        message: 'Maximum 10 quote files allowed',
      });
    }

    // Validate file sizes
    const oversizedFiles = files.filter((f) => f.size > 50 * 1024 * 1024);
    if (oversizedFiles.length > 0) {
      cleanupUploadedFiles(files);
      return res.status(400).json({
        error: 'File too large',
        message: `Files exceed 50MB limit: ${oversizedFiles.map((f) => f.originalname).join(', ')}`,
      });
    }

    // Validate PDF magic bytes
    const invalidPdfs = files.filter((f) => !validatePdfMagicBytes(f.path));
    if (invalidPdfs.length > 0) {
      cleanupUploadedFiles(files);
      return res.status(400).json({
        error: 'Invalid PDF file',
        message: `Invalid PDF header: ${invalidPdfs.map((f) => f.originalname).join(', ')}`,
      });
    }

    logger.info(
      { correlationId, fileCount: files.length },
      'Processing unified comparison quote files'
    );

    // Get file paths
    const filePaths = files.map((f) => f.path);

    // Check if unified engine is enabled for this user
    const isUnifiedEnabled = unifiedComparisonFlag.isEnabled(userId);
    logger.info(
      { correlationId, isUnifiedEnabled, userId: userId || 'anonymous' },
      'Unified comparison engine status'
    );

    // Generate comparison
    const adapterResult = await comparisonEngineAdapter.generateComparison(filePaths, userId);

    // Save to analysis_history in database if user is authenticated
    let savedId: string | null = null;
    if (userId) {
      try {
        const clientName = req.body.clientName || 'Cliente';
        const comparisonResult = await matrixRowsToComparisonReport(adapterResult.matrix, files, {
          graphEnabled: adapterResult.graphEnabled,
          templateHintsEnabled: adapterResult.templateHintsEnabled,
        });
        const duration = Date.now() - startTime;

        const insertData = {
          user_id: userId,
          client_name: clientName,
          analysis_result: comparisonResult,
          recommendation: comparisonResult.recommendation || null,
          total_score: comparisonResult.quotes?.[0]?.score || null,
          extraction_confidence: 85,
          needs_review: false,
          validation_flags_count: 0,
          engine_type: adapterResult.engine,
          processing_time_ms: duration,
          confidence_score: 85,
          unified_result: comparisonResult,
          fallback_reason: adapterResult.fallbackReason || null,
          correlation_id: adapterResult.correlationId,
        };

        savedId = await saveAnalysisHistory(insertData);
        logger.info({ correlationId, savedId }, 'Unified comparison persisted to database');
      } catch (saveError) {
        logger.error({ err: saveError, correlationId }, 'Failed to persist unified comparison');
      }
    }

    // Clean up temporary files
    files.forEach((f) => {
      try {
        fs.unlinkSync(f.path);
      } catch (_e) {
        logger.warn({ filePath: f.path, correlationId }, 'Failed to clean up temp file');
      }
    });

    // Return result
    return res.json({
      success: true,
      correlationId: adapterResult.correlationId,
      engine: adapterResult.engine,
      fallbackReason: adapterResult.fallbackReason,
      data: adapterResult.matrix,
      id: savedId || undefined,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Comparison failed';
    logger.error({ correlationId, message }, 'POST /api/comparison/unified failed');

    // Clean up temp files on error
    if (req.files) {
      (req.files as Express.Multer.File[]).forEach((f) => {
        try {
          fs.unlinkSync(f.path);
        } catch (_e) {
          // Ignore cleanup errors
        }
      });
    }

    return res.status(500).json({
      error: 'Comparison failed',
      message,
      correlationId,
    });
  }
});

/**
 * POST /api/comparison/:id/deep-mode
 * Validate comparison with clause PDFs
 */
router.post('/:id/deep-mode', upload.array('clauses', 5), async (req, res) => {
  const correlationId = `api-deep-${Date.now()}`;
  const { id } = req.params;

  try {
    logger.info({ correlationId, comparisonId: id }, 'POST /api/comparison/:id/deep-mode received');

    // Deep clause validation is disabled by default until fully implemented
    if (!featureFlags.isEnabled('deepClauseValidation')) {
      cleanupUploadedFiles(req.files as Express.Multer.File[] | undefined);
      return res.status(400).json({
        error: 'Deep mode validation is not enabled',
        message:
          'The deep clause validation feature is experimental and disabled. Set ENABLE_DEEP_CLAUSE_VALIDATION=true to enable it once the implementation is complete.',
      });
    }

    // Validate request
    if (!req.files || (req.files as Express.Multer.File[]).length === 0) {
      return res.status(400).json({
        error: 'No clause files provided',
        message: 'Please upload at least one clause PDF for validation',
      });
    }

    const files = req.files as Express.Multer.File[];
    const filePaths = files.map((f) => f.path);

    logger.info(
      { correlationId, clauseCount: files.length },
      'Validating deep mode with clause files'
    );

    // Validate with clauses
    const comparisonId = (Array.isArray(id) ? id[0] : id) as string;
    const result = await comparisonEngineAdapter.validateWithClauses(comparisonId, filePaths);

    // Clean up temporary files
    files.forEach((f) => {
      try {
        fs.unlinkSync(f.path);
      } catch (_e) {
        logger.warn({ filePath: f.path, correlationId }, 'Failed to clean up temp file');
      }
    });

    return res.json({
      success: true,
      correlationId,
      comparisonId: id,
      data: result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Deep mode validation failed';
    logger.error(
      { correlationId, comparisonId: id, message },
      'POST /api/comparison/:id/deep-mode failed'
    );

    // Clean up temp files on error
    if (req.files) {
      (req.files as Express.Multer.File[]).forEach((f) => {
        try {
          fs.unlinkSync(f.path);
        } catch (_e) {
          // Ignore cleanup errors
        }
      });
    }

    return res.status(500).json({
      error: 'Deep mode validation failed',
      message,
      correlationId,
    });
  }
});

/**
 * GET /api/comparison/status
 * Get feature flag status and rollout configuration
 */
router.get('/status', (req, res) => {
  const userId = (req as AuthenticatedRequest).user?.id;

  res.json({
    unifiedEngine: {
      enabled: unifiedComparisonFlag.isEnabled(userId),
      rolloutConfig: unifiedComparisonFlag.getRolloutConfig(),
      model: env.GEMINI_MODEL,
    },
  });
});

export default router;
