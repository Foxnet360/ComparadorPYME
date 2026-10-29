/**
 * Analytics and DaaS API Routes
 * Endpoints for Executive Analytics and B2B Market Intelligence benchmarks.
 */

import { Router } from 'express';
import { AuthenticatedRequest, requireUser, requireRole } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';
import { analyticsAggregationService } from '../services/analyticsAggregationService';
import { supabase } from '../config/database';

const router = Router();

/**
 * GET /api/analytics/executive
 * Returns aggregated executive KPIs strictly partitioned according to the caller's role.
 */
router.get(
  '/executive',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    requireUser(req);
    const user = req.user!;
    const timeframeDays = parseInt(String(req.query.timeframeDays || '90'), 10) || 90;

    const data = await analyticsAggregationService.getExecutiveAnalytics(user, timeframeDays);

    res.json({
      success: true,
      data,
    });
  })
);

/**
 * GET /api/analytics/daas/market-index
 * Returns statistical market pricing benchmark and percentiles for an insurance domain.
 * Accessible by super_admin, ally_admin, and authorized B2B subscribers.
 */
router.get(
  '/daas/market-index',
  requireRole('super_admin', 'ally_admin', 'data_subscriber'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const startTime = Date.now();
    const domain = (req.query.domain as string) || 'pyme';
    const periodMonths = parseInt(String(req.query.periodMonths || '6'), 10) || 6;

    const benchmark = await analyticsAggregationService.getDaasMarketIndex(domain, periodMonths);

    // Track usage telemetry
    const subscriberId = (req.headers['x-subscriber-id'] as string) || req.user?.id || 'anonymous-subscriber';
    await analyticsAggregationService.recordDaasApiUsage(
      subscriberId,
      '/api/analytics/daas/market-index',
      { domain, periodMonths },
      Date.now() - startTime,
      200
    );

    res.json({
      success: true,
      data: benchmark,
    });
  })
);

/**
 * POST /api/analytics/daas/ingest/:analysisId
 * Administrative endpoint to trigger DaaS snapshot ingestion for an existing analysis.
 */
router.post(
  '/daas/ingest/:analysisId',
  requireRole('super_admin'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const { analysisId } = req.params;

    if (!analysisId) {
      res.status(400).json({ success: false, error: 'analysisId is required' });
      return;
    }

    const { data: record, error } = await (supabase
      .from('analysis_history' as any)
      .select('*')
      .eq('id', analysisId as string)
      .single() as any);

    if (error || !record) {
      res.status(404).json({
        success: false,
        error: 'Analysis record not found',
      });
      return;
    }

    const count = await analyticsAggregationService.ingestAnalysisToDaas(record);

    res.json({
      success: true,
      message: `Ingested ${count} quote snapshots into DaaS repository`,
      insertedQuotes: count,
    });
  })
);

export default router;
