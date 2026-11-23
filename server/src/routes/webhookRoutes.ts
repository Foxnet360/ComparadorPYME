/**
 * Outbound Webhook Subscription Routes (/api/webhooks & /api/v1/webhooks)
 * Tenant-scoped management of HMAC-SHA256 webhook endpoints with SSRF validation.
 */

import { Router } from 'express';
import { z } from 'zod';
import { AuthenticatedRequest, requireUser } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';
import { rejectSpoofedUserId, validateBody } from '../middleware/validateRequest';
import { NotFoundError, ValidationError } from '../errors';
import { validateWebhookUrl, webhookService } from '../services/webhookService';

const router = Router();

const createWebhookSchema = z
  .object({
    url: z.string().url('url must be a valid HTTP/HTTPS URL'),
    events: z
      .array(
        z.enum(['analysis.completed', 'analysis.status_changed', 'renewal.status_changed', '*'])
      )
      .min(1, 'At least one event must be subscribed'),
  })
  .strict();

router.get(
  '/',
  rejectSpoofedUserId,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const userId = requireUser(req);
    const subscriptions = await webhookService.listSubscriptions(userId, req.user?.orgId);
    res.json({ subscriptions });
  })
);

router.post(
  '/',
  rejectSpoofedUserId,
  validateBody(createWebhookSchema),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const userId = requireUser(req);
    const body = req.body as z.infer<typeof createWebhookSchema>;

    try {
      validateWebhookUrl(body.url);
    } catch (err) {
      throw new ValidationError(err instanceof Error ? err.message : 'Invalid webhook URL');
    }

    const created = await webhookService.createSubscription({
      userId,
      orgId: req.user?.orgId,
      url: body.url,
      events: body.events,
    });

    res.status(201).json(created);
  })
);

router.delete(
  '/:id',
  rejectSpoofedUserId,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const userId = requireUser(req);
    const deleted = await webhookService.deleteSubscription(String(req.params.id), userId);
    if (!deleted) {
      throw new NotFoundError('Webhook subscription not found');
    }
    res.status(204).send();
  })
);

export default router;
