/**
 * DaaS B2B Public API Routes (v1)
 * External data endpoints for insurance companies, reinsurers, and actuarial subscribers.
 */

import { Router } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { daasApiKeyAuth } from '../middleware/daasApiKeyAuth';
import { asyncHandler } from '../utils/asyncHandler';
import { analyticsAggregationService } from '../services/analyticsAggregationService';
import { supabase } from '../config/database';

const router = Router();

// Apply DaaS API Key authentication to all routes on this router
router.use(daasApiKeyAuth);

/**
 * GET /api/v1/daas/benchmarks/pricing
 * Actuarial pricing benchmark and premium dispersion percentiles (P25, P50, P75).
 */
router.get(
  '/benchmarks/pricing',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const startTime = Date.now();
    const domain = (req.query.domain as string) || 'pyme';
    const periodMonths = parseInt(String(req.query.periodMonths || '6'), 10) || 6;

    // Check subscriber domain restrictions if configured
    const allowed = req.subscriber?.allowedDomains || ['all'];
    if (!allowed.includes('all') && !allowed.includes(domain)) {
      res.status(403).json({
        error: 'Forbidden',
        message: `Your subscriber tier does not include access to the '${domain}' insurance domain.`,
      });
      return;
    }

    const benchmark = await analyticsAggregationService.getDaasMarketIndex(domain, periodMonths);

    // Record consumption telemetry
    await analyticsAggregationService.recordDaasApiUsage(
      req.subscriber!.id,
      '/api/v1/daas/benchmarks/pricing',
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
 * GET /api/v1/daas/benchmarks/market-share
 * Market share distribution of insurance companies by quotation volume.
 */
router.get(
  '/benchmarks/market-share',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const startTime = Date.now();
    const domain = req.query.domain as string | undefined;

    let query = supabase
      .from('daas_market_snapshots' as any)
      .select('insurer_name');

    if (domain) {
      query = query.eq('domain', domain);
    }

    const { data: rows } = await (query as any);
    const snapshots = rows || [];
    const total = snapshots.length;

    const counts: Record<string, number> = {};
    for (const s of snapshots) {
      counts[s.insurer_name] = (counts[s.insurer_name] || 0) + 1;
    }

    const insurers = Object.entries(counts)
      .map(([name, count]) => ({
        insurerName: name,
        quoteCount: count,
        sharePercentage: total > 0 ? Number(((count / total) * 100).toFixed(2)) : 0,
      }))
      .sort((a, b) => b.quoteCount - a.quoteCount);

    await analyticsAggregationService.recordDaasApiUsage(
      req.subscriber!.id,
      '/api/v1/daas/benchmarks/market-share',
      { domain: domain || 'all' },
      Date.now() - startTime,
      200
    );

    res.json({
      success: true,
      data: {
        totalAnalyzedQuotes: total,
        insurers,
      },
    });
  })
);

/**
 * GET /api/v1/daas/subscriber/status
 * Returns current quota usage and subscriber tier status.
 */
router.get(
  '/subscriber/status',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    res.json({
      success: true,
      data: {
        subscriberId: req.subscriber?.id,
        name: req.subscriber?.name,
        tier: req.subscriber?.tier,
        monthlyQuota: req.subscriber?.monthlyQuota,
        currentMonthUsage: req.subscriber?.currentMonthUsage,
        remainingQuota: Math.max(0, (req.subscriber?.monthlyQuota || 0) - (req.subscriber?.currentMonthUsage || 0)),
        rateLimitPerMinute: req.subscriber?.rateLimitPerMinute,
        allowedDomains: req.subscriber?.allowedDomains,
      },
    });
  })
);

export default router;
