/**
 * Unified Comparison API Routes
 * Endpoints for the unified multimodal comparison engine
 */

import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { comparisonEngineAdapter } from '../services/unifiedComparison/comparisonEngineAdapter';
import { unifiedComparisonFlag } from '../services/unifiedComparison/featureFlagService';


const router = express.Router();

// Configure multer for file uploads
const upload = multer({
  dest: path.join(process.cwd(), 'uploads', 'temp'),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB max per file
    files: 20 // Max 20 files
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'));
    }
  }
});

/**
 * POST /api/comparison/unified
 * Create a unified comparison of multiple insurance quotes
 */
router.post('/unified', 
  upload.array('quotes', 10),
  async (req, res) => {
    const correlationId = `api-unified-${Date.now()}`;
    const userId = (req as any).user?.id;

    try {
      console.log(`🌐 [API] POST /api/comparison/unified [${correlationId}]`);

      // Validate request
      if (!req.files || (req.files as Express.Multer.File[]).length === 0) {
        return res.status(400).json({
          error: 'No quote files provided',
          message: 'Please upload at least one quote PDF'
        });
      }

      const files = req.files as Express.Multer.File[];
      
      // Validate file count
      if (files.length > 10) {
        return res.status(400).json({
          error: 'Too many files',
          message: 'Maximum 10 quote files allowed'
        });
      }

      // Validate file sizes
      const oversizedFiles = files.filter(f => f.size > 50 * 1024 * 1024);
      if (oversizedFiles.length > 0) {
        return res.status(400).json({
          error: 'File too large',
          message: `Files exceed 50MB limit: ${oversizedFiles.map(f => f.originalname).join(', ')}`
        });
      }

      console.log(`📄 [API] Processing ${files.length} quote files [${correlationId}]`);

      // Get file paths
      const filePaths = files.map(f => f.path);

      // Check if unified engine is enabled for this user
      const isUnifiedEnabled = unifiedComparisonFlag.isEnabled(userId);
      console.log(`🚩 [API] Unified engine ${isUnifiedEnabled ? 'enabled' : 'disabled'} for user ${userId || 'anonymous'} [${correlationId}]`);

      // Generate comparison
      const result = await comparisonEngineAdapter.generateComparison(filePaths, userId);

      // Clean up temporary files
      files.forEach(f => {
        try {
          fs.unlinkSync(f.path);
        } catch (_e) {
          console.warn(`⚠️ [API] Failed to clean up temp file ${f.path}`);
        }
      });

      // Return result
      res.json({
        success: true,
        correlationId,
        engine: isUnifiedEnabled ? 'unified' : 'legacy',
        data: result
      });

    } catch (error: any) {
      console.error(`❌ [API] POST /api/comparison/unified failed [${correlationId}]:`, error.message);
      
      // Clean up temp files on error
      if (req.files) {
        (req.files as Express.Multer.File[]).forEach(f => {
          try {
            fs.unlinkSync(f.path);
          } catch (_e) {
            // Ignore cleanup errors
          }
        });
      }

      res.status(500).json({
        error: 'Comparison failed',
        message: error.message,
        correlationId
      });
    }
  }
);

/**
 * POST /api/comparison/:id/deep-mode
 * Validate comparison with clause PDFs
 */
router.post('/:id/deep-mode',
  upload.array('clauses', 5),
  async (req, res) => {
    const correlationId = `api-deep-${Date.now()}`;
    const { id } = req.params;

    try {
      console.log(`🌐 [API] POST /api/comparison/${id}/deep-mode [${correlationId}]`);

      // Validate request
      if (!req.files || (req.files as Express.Multer.File[]).length === 0) {
        return res.status(400).json({
          error: 'No clause files provided',
          message: 'Please upload at least one clause PDF for validation'
        });
      }

      const files = req.files as Express.Multer.File[];
      const filePaths = files.map(f => f.path);

      console.log(`📄 [API] Validating with ${files.length} clause files [${correlationId}]`);

      // Validate with clauses
      const comparisonId = Array.isArray(id) ? id[0] : id;
      const result = await comparisonEngineAdapter.validateWithClauses(comparisonId, filePaths);

      // Clean up temporary files
      files.forEach(f => {
        try {
          fs.unlinkSync(f.path);
        } catch (_e) {
          console.warn(`⚠️ [API] Failed to clean up temp file ${f.path}`);
        }
      });

      res.json({
        success: true,
        correlationId,
        comparisonId: id,
        data: result
      });

    } catch (error: any) {
      console.error(`❌ [API] POST /api/comparison/${id}/deep-mode failed [${correlationId}]:`, error.message);
      
      // Clean up temp files on error
      if (req.files) {
        (req.files as Express.Multer.File[]).forEach(f => {
          try {
            fs.unlinkSync(f.path);
          } catch (_e) {
            // Ignore cleanup errors
          }
        });
      }

      res.status(500).json({
        error: 'Deep mode validation failed',
        message: error.message,
        correlationId
      });
    }
  }
);

/**
 * GET /api/comparison/status
 * Get feature flag status and rollout configuration
 */
router.get('/status', (req, res) => {
  const userId = (req as any).user?.id;
  
  res.json({
    unifiedEngine: {
      enabled: unifiedComparisonFlag.isEnabled(userId),
      rolloutConfig: unifiedComparisonFlag.getRolloutConfig(),
      model: process.env.GEMINI_MODEL || 'gemini-3.5-flash'
    }
  });
});

export default router;
