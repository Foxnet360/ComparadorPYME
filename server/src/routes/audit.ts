/**
 * Audit Routes
 * Endpoint for enriching audit alerts with RAG evidence
 */

import { Router } from 'express';
import { enrichAuditAlerts } from '../services/auditEnrichmentService';
import { asyncHandler } from '../utils/asyncHandler';

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

    console.log(`🔍 [auditRoute] Enriching ${quotes.length} quotes`);

    const result = await enrichAuditAlerts(quotes);

    console.log(
      `✅ [auditRoute] Enrichment complete: ${result.enrichedAlerts.length} alerts, ${result.crossInsurerRisks.length} cross-insurer risks`
    );

    res.json(result);
  })
);

export default router;
