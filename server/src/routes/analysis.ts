/**
 * Analysis Validation Routes
 * Route definitions for analysis validation endpoints
 * Business logic has been extracted to controllers/analysisValidationController.ts
 */

import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { authMiddleware, requireRole } from '../middleware/auth';
import {
  validateCoverages,
  analyzeDeductibleRisk,
  checkInverseCoverages,
  contextualizeExclusions,
  analyzeWarrantyCompliance,
  generateLegalOpinion,
  compareVersions,
  extractStructuredClause,
  storeStructuredClause,
  compareVariables,
  saveCorrection,
  disambiguateCoverage,
  getLearningMetrics,
  getMonthlyReport,
  batchRetrain,
  exportAnalysisExcel,
} from '../controllers/analysisValidationController';
import { getReviewQueueCoverages } from '../controllers/reviewQueueController';
import {
  getAnalysisJobStatus,
  streamAnalysisJobEvents,
  cancelAnalysisJob,
} from '../controllers/analysisJobsController';

const router = Router();

router.get('/jobs/:jobId', asyncHandler(getAnalysisJobStatus));
router.get('/jobs/:jobId/events', asyncHandler(streamAnalysisJobEvents));
router.post('/jobs/:jobId/cancel', asyncHandler(cancelAnalysisJob));

router.post('/validate-coverages', asyncHandler(validateCoverages));
router.post('/deductible-risk', asyncHandler(analyzeDeductibleRisk));
router.post('/inverse-check', asyncHandler(checkInverseCoverages));
router.post('/contextualize', asyncHandler(contextualizeExclusions));
router.post('/warranty-compliance', asyncHandler(analyzeWarrantyCompliance));
router.post('/legal-opinion', asyncHandler(generateLegalOpinion));
router.post('/compare-versions', asyncHandler(compareVersions));
router.post('/extract-structured-clause', asyncHandler(extractStructuredClause));
router.post(
  '/store-structured-clause',
  requireRole('super_admin', 'ally_admin'),
  asyncHandler(storeStructuredClause)
);
router.post('/compare-variables', asyncHandler(compareVariables));
router.post(
  '/correction',
  requireRole('super_admin', 'ally_admin', 'ally_technical'),
  asyncHandler(saveCorrection)
);
router.post(
  '/disambiguate-coverage',
  requireRole('super_admin', 'ally_admin', 'ally_technical'),
  asyncHandler(disambiguateCoverage)
);
router.get(
  '/learning-metrics',
  requireRole('super_admin', 'ally_admin'),
  asyncHandler(getLearningMetrics)
);
router.get(
  '/monthly-report',
  requireRole('super_admin', 'ally_admin'),
  asyncHandler(getMonthlyReport)
);
router.post('/batch-retrain', requireRole('super_admin'), asyncHandler(batchRetrain));
router.get(
  '/review-queue/coverages',
  requireRole('super_admin', 'ally_admin'),
  asyncHandler(getReviewQueueCoverages)
);
router.get('/:id/export', authMiddleware, asyncHandler(exportAnalysisExcel));
router.post('/:id/export', authMiddleware, asyncHandler(exportAnalysisExcel));

export default router;
