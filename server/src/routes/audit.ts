/**
 * Audit Routes
 * Endpoint for enriching audit alerts with RAG evidence
 */

import { Router } from 'express';
import { enrichAuditAlerts } from '../services/auditEnrichmentService';

const router = Router();

/**
 * POST /api/audit/enrich
 * Enriches audit alerts with clause evidence from RAG
 */
router.post('/enrich', async (req, res) => {
    try {
        const { quotes } = req.body;
        
        if (!quotes || !Array.isArray(quotes)) {
            return res.status(400).json({
                error: 'Bad Request',
                message: 'quotes array is required'
            });
        }
        
        console.log(`🔍 [auditRoute] Enriching ${quotes.length} quotes`);
        
        const result = await enrichAuditAlerts(quotes);
        
        console.log(`✅ [auditRoute] Enrichment complete: ${result.enrichedAlerts.length} alerts, ${result.crossInsurerRisks.length} cross-insurer risks`);
        
        res.json(result);
    } catch (error) {
        console.error('❌ [auditRoute] Enrichment error:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to enrich audit alerts'
        });
    }
});

export default router;
