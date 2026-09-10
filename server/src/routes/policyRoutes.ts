/**
 * Portfolio Policies API Routes (renovacion-polizas PR-2, task 1.8)
 *
 * CRUD for the `policies` table, scoped to the authenticated session user.
 *
 * - R1.1: CRUD persists rows with user_id = session user.
 * - AUTH-2: ownership comes ONLY from the session; a client-supplied userId
 *   is rejected with 400 (the check runs before zod strips unknown keys).
 * - R1.4: zod parsing + the repository whitelist keep persistence minimal.
 * - XC-1: creating a policy requires an owned client — the client_id FK
 *   proves existence but not ownership, so the route verifies it.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest, requireUser } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';
import { validateBody } from '../middleware/validateRequest';
import {
  createPolicySchema,
  updatePolicySchema,
  promotePolicySchema,
} from '../middleware/validationSchemas';
import { NotFoundError, ValidationError } from '../errors';
import { getClientById } from '../repositories/clientRepository';
import { getAnalysisById } from '../repositories/analysisRepository';
import { buildPromotedPolicyInput, type PromoteConfirmations } from '../services/policyPromotion';
import {
  createPolicy,
  listPolicies,
  getPolicyById,
  updatePolicy,
  deletePolicy,
  POLICY_RAMOS,
  type CreatePolicyInput,
  type UpdatePolicyInput,
} from '../repositories/policyRepository';

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

const isSupportedRamo = (ramo: string): boolean =>
  (POLICY_RAMOS as readonly string[]).includes(ramo);

/** GET /api/policies — list the session user's policies (soonest expiry first). */
router.get(
  '/',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const userId = requireUser(req);
    const policies = await listPolicies(userId);
    res.json(policies);
  })
);

/** POST /api/policies — create a policy for an owned client. */
router.post(
  '/',
  rejectSpoofedUserId,
  validateBody(createPolicySchema),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const userId = requireUser(req);
    const input = req.body as CreatePolicyInput;

    if (!isSupportedRamo(input.ramo)) {
      throw new ValidationError('Validation failed', [
        { field: 'ramo', message: `ramo must be one of: ${POLICY_RAMOS.join(', ')}` },
      ]);
    }

    // XC-1: the FK proves the client exists, not that the session user owns
    // it. Verify ownership before persisting the link.
    const client = await getClientById(userId, input.client_id);
    if (!client) {
      throw new NotFoundError('Client not found');
    }

    const created = await createPolicy(userId, input);
    res.status(201).json(created);
  })
);

/**
 * POST /api/policies/promote (task 1.9, R1.3)
 * Promotes a winning analysis quote into a Policy. The mapper auto-carries
 * insurer/premium/coverages/deductibles/ramo/source_analysis_id; the broker
 * confirms policy_number, dates, client and the per-ramo insured object.
 * Ownership: getAnalysisById is NOT user-scoped, so the route verifies the
 * analysis and the target client belong to the session user and answers 404
 * (not 403) to avoid leaking existence across tenants (XC-1).
 */
router.post(
  '/promote',
  rejectSpoofedUserId,
  validateBody(promotePolicySchema),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const userId = requireUser(req);
    const { analysis_id, quote_index, confirmations } = req.body as {
      analysis_id: string;
      quote_index: number;
      confirmations: PromoteConfirmations;
    };

    const analysis = await getAnalysisById(analysis_id);
    if (!analysis || analysis.user_id !== userId) {
      throw new NotFoundError('Analysis not found');
    }

    const client = await getClientById(userId, confirmations.client_id);
    if (!client) {
      throw new NotFoundError('Client not found');
    }

    const input = buildPromotedPolicyInput(analysis, quote_index, confirmations);
    const created = await createPolicy(userId, input);
    res.status(201).json(created);
  })
);

/** GET /api/policies/:id — 404 when missing or not owned. */
router.get(
  '/:id',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const userId = requireUser(req);
    const policy = await getPolicyById(userId, String(req.params.id));
    if (!policy) {
      throw new NotFoundError('Policy not found');
    }
    res.json(policy);
  })
);

/** PATCH /api/policies/:id — whitelisted partial update of an own policy. */
router.patch(
  '/:id',
  rejectSpoofedUserId,
  validateBody(updatePolicySchema),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const userId = requireUser(req);
    const input = req.body as UpdatePolicyInput;
    if (input.ramo !== undefined && !isSupportedRamo(input.ramo)) {
      throw new ValidationError('Validation failed', [
        { field: 'ramo', message: `ramo must be one of: ${POLICY_RAMOS.join(', ')}` },
      ]);
    }
    const updated = await updatePolicy(userId, String(req.params.id), input);
    if (!updated) {
      throw new NotFoundError('Policy not found');
    }
    res.json(updated);
  })
);

/** DELETE /api/policies/:id — removes an own policy; 404 otherwise. */
router.delete(
  '/:id',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const userId = requireUser(req);
    const existing = await getPolicyById(userId, String(req.params.id));
    if (!existing) {
      throw new NotFoundError('Policy not found');
    }
    await deletePolicy(userId, String(req.params.id));
    res.status(204).end();
  })
);

export default router;
