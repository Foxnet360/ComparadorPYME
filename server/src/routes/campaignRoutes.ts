/**
 * Campaign Config API Routes (renovacion-polizas PR-4, task 1.20)
 *
 * R4.1: brokers configure their expiration campaign windows (days before
 * policy end_date) and toggle automation. GET returns the persisted config
 * or the defaults (60/30/7, enabled) without persisting anything.
 * AUTH-2/XC-1: configs are keyed by the session user; spoofed userId is
 * rejected with 400.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest, requireUser } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';
import { validateBody } from '../middleware/validateRequest';
import { updateCampaignConfigSchema } from '../middleware/validationSchemas';
import {
  getCampaignConfig,
  saveCampaignConfig,
  DEFAULT_CAMPAIGN_WINDOWS,
} from '../repositories/campaignRepository';

const router = Router();

// AUTH-2: a client-supplied userId (body or query) is never trusted.
const hasClientSuppliedUserId = (req: Request): boolean =>
  req.query.userId !== undefined ||
  (req.body !== undefined &&
    typeof req.body === 'object' &&
    (req.body as Record<string, unknown>).userId !== undefined);

const rejectSpoofedUserId = (req: Request, res: Response, next: NextFunction): void => {
  if (hasClientSuppliedUserId(req)) {
    res.status(400).json({
      error: 'Bad Request',
      message: 'userId is derived from the authenticated session; do not send it',
    });
    return;
  }
  next();
};

/** GET /api/campaigns/config — persisted config or defaults (R4.1). */
router.get(
  '/config',
  rejectSpoofedUserId,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const userId = requireUser(req);
    const config = await getCampaignConfig(userId);
    if (!config) {
      res.json({ windows: [...DEFAULT_CAMPAIGN_WINDOWS], enabled: true });
      return;
    }
    res.json(config);
  })
);

/** PUT /api/campaigns/config — upsert the session user's config (R4.1). */
router.put(
  '/config',
  rejectSpoofedUserId,
  validateBody(updateCampaignConfigSchema),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const userId = requireUser(req);
    const saved = await saveCampaignConfig(
      userId,
      req.body as { windows: number[]; enabled: boolean }
    );
    res.json(saved);
  })
);

export default router;
