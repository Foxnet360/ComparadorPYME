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

export default router;
