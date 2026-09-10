/**
 * Renewals API Routes (renovacion-polizas PR-4, task 1.17)
 *
 * - R3.1: GET /api/renewals?state= lists the session user's renewals;
 *   POST /:id/transition applies a server-validated state transition and
 *   records the renewal_events audit row (actor = session user).
 * - R3.2: outcome rules (lost-requires-reason, final_premium) are enforced
 *   by the state machine, never trusted to the client.
 * - AUTH-2: ownership comes ONLY from the session; a client-supplied userId
 *   is rejected with 400 before zod strips unknown keys.
 * - XC-1: unknown or foreign renewals answer 404 — no existence leak.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest, requireUser } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';
import { validateBody } from '../middleware/validateRequest';
import { transitionRenewalSchema } from '../middleware/validationSchemas';
import { NotFoundError, ValidationError, ConflictError } from '../errors';
import {
  InvalidTransitionError,
  isRenewalState,
  planTransition,
  type RenewalState,
  type TransitionInput,
} from '../services/renewalStateMachine';
import { getRenewalById, listRenewals, applyTransition } from '../repositories/renewalRepository';
import { insertDelivery, getDelivery, deleteDelivery } from '../repositories/campaignRepository';
import { sendManualDelivery } from '../services/campaignService';

const router = Router();

/** R4.2: the :window path param is a positive integer of days (e.g. '30'). */
function parseWindowParam(raw: string): string {
  if (!/^\d{1,3}$/.test(raw)) {
    throw new ValidationError('Validation failed', [
      { field: 'window', message: 'window must be a positive integer of days' },
    ]);
  }
  const days = parseInt(raw, 10);
  if (days < 1 || days > 365) {
    throw new ValidationError('Validation failed', [
      { field: 'window', message: 'window must be between 1 and 365 days' },
    ]);
  }
  return String(days);
}

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

/** GET /api/renewals?state= — list the session user's renewals. */
router.get(
  '/',
  rejectSpoofedUserId,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const userId = requireUser(req);
    const stateParam = req.query.state;
    if (stateParam !== undefined && !isRenewalState(stateParam)) {
      throw new ValidationError('Validation failed', [
        { field: 'state', message: 'unknown renewal state' },
      ]);
    }
    const renewals = await listRenewals(userId, stateParam as RenewalState | undefined);
    res.json(renewals);
  })
);

/**
 * POST /api/renewals/:id/transition — R3.1/R3.2.
 * The machine decides: structural violations (illegal edge, terminal closed)
 * answer 409; payload violations (missing loss_reason/final_premium) 400.
 */
router.post(
  '/:id/transition',
  rejectSpoofedUserId,
  validateBody(transitionRenewalSchema),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const userId = requireUser(req);
    const renewal = await getRenewalById(userId, String(req.params.id));
    if (!renewal) {
      throw new NotFoundError('Renewal not found');
    }

    let plan;
    try {
      plan = planTransition(renewal.state, req.body as TransitionInput);
    } catch (error) {
      if (error instanceof InvalidTransitionError) {
        if (error.kind === 'payload') {
          throw new ValidationError(error.message, error.details);
        }
        throw new ConflictError(error.message);
      }
      throw error;
    }

    const updated = await applyTransition(userId, renewal.id, plan, userId);
    if (!updated) {
      throw new NotFoundError('Renewal not found');
    }
    res.json(updated);
  })
);

/**
 * POST /api/renewals/:id/campaigns/:window/send (R4.2 manual send).
 * Same insert-first-then-send idempotency as the scheduler (R4.3): an
 * already-claimed pair answers 409.
 */
router.post(
  '/:id/campaigns/:window/send',
  rejectSpoofedUserId,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const userId = requireUser(req);
    const windowKey = parseWindowParam(String(req.params.window));
    const renewal = await getRenewalById(userId, String(req.params.id));
    if (!renewal) {
      throw new NotFoundError('Renewal not found');
    }

    const result = await sendManualDelivery({
      userId,
      renewalId: renewal.id,
      renewalState: renewal.state,
      windowKey,
      actorId: userId,
    });
    if (result.kind === 'conflict') {
      throw new ConflictError('This renewal window was already handled');
    }
    res.json(result.delivery);
  })
);

/**
 * POST /api/renewals/:id/campaigns/:window/skip (R4.2 manual skip).
 * Claims the pair with status 'skipped' so the scheduler never sends it.
 */
router.post(
  '/:id/campaigns/:window/skip',
  rejectSpoofedUserId,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const userId = requireUser(req);
    const windowKey = parseWindowParam(String(req.params.window));
    const renewal = await getRenewalById(userId, String(req.params.id));
    if (!renewal) {
      throw new NotFoundError('Renewal not found');
    }

    const result = await insertDelivery({
      renewal_id: renewal.id,
      window_key: windowKey,
      status: 'skipped',
    });
    if (result.kind === 'conflict') {
      throw new ConflictError('This renewal window was already handled');
    }
    res.json(result.delivery);
  })
);

/**
 * POST /api/renewals/:id/campaigns/:window/reschedule (R4.2).
 * Releases a pending/skipped pair so the next scheduler tick plans it
 * again. Already-sent deliveries are immutable (409); a pair that was
 * never claimed answers 404.
 */
router.post(
  '/:id/campaigns/:window/reschedule',
  rejectSpoofedUserId,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const userId = requireUser(req);
    const windowKey = parseWindowParam(String(req.params.window));
    const renewal = await getRenewalById(userId, String(req.params.id));
    if (!renewal) {
      throw new NotFoundError('Renewal not found');
    }

    const delivery = await getDelivery(renewal.id, windowKey);
    if (!delivery) {
      throw new NotFoundError('No campaign delivery for this renewal window');
    }
    if (delivery.status === 'sent') {
      throw new ConflictError('An already-sent delivery cannot be rescheduled');
    }

    await deleteDelivery(renewal.id, windowKey);
    res.json({ renewal_id: renewal.id, window_key: windowKey, rescheduled: true });
  })
);

export default router;
