/**
 * Audit Routes
 * Endpoint for enriching audit alerts with RAG evidence
 */

import { Router } from 'express';
import { enrichAuditAlerts } from '../services/auditEnrichmentService';
import { asyncHandler } from '../utils/asyncHandler';
import logger from '../config/logger';

const router = Router();

/**
 * POST /api/audit/enrich
 * Enriches audit alerts with clause evidence from RAG
 */
router.post(
  '/enrich',
  asyncHandler(async (req, res) => {
    const { quotes } = req.body;

    if (!quotes || !Array.isArray(quotes)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'quotes array is required',
      });
    }

    logger.info({ quoteCount: quotes.length }, 'auditRoute enriching quotes');

    const result = await enrichAuditAlerts(quotes);

    logger.info(
      {
        enrichedAlerts: result.enrichedAlerts.length,
        crossInsurerRisks: result.crossInsurerRisks.length,
      },
      'auditRoute enrichment complete'
    );

    return res.json(result);
  })
);

export default router;
