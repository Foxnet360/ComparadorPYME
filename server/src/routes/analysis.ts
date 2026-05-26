/**
 * Analysis Validation Routes
 * Route definitions for analysis validation endpoints
 * Business logic has been extracted to controllers/analysisValidationController.ts
 */

import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
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
  getLearningMetrics,
  getMonthlyReport,
  batchRetrain
} from '../controllers/analysisValidationController';

const router = Router();

router.post('/validate-coverages', asyncHandler(validateCoverages));
router.post('/deductible-risk', asyncHandler(analyzeDeductibleRisk));
router.post('/inverse-check', asyncHandler(checkInverseCoverages));
router.post('/contextualize', asyncHandler(contextualizeExclusions));
router.post('/warranty-compliance', asyncHandler(analyzeWarrantyCompliance));
router.post('/legal-opinion', asyncHandler(generateLegalOpinion));
router.post('/compare-versions', asyncHandler(compareVersions));
router.post('/extract-structured-clause', asyncHandler(extractStructuredClause));
router.post('/store-structured-clause', asyncHandler(storeStructuredClause));
router.post('/compare-variables', asyncHandler(compareVariables));
router.post('/correction', asyncHandler(saveCorrection));
router.get('/learning-metrics', asyncHandler(getLearningMetrics));
router.get('/monthly-report', asyncHandler(getMonthlyReport));
router.post('/batch-retrain', asyncHandler(batchRetrain));

export default router;
