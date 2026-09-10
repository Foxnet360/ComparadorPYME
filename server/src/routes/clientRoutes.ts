/**
 * Portfolio Clients API Routes (renovacion-polizas PR-2, task 1.7)
 *
 * CRUD for the `clients` table, scoped to the authenticated session user.
 * Replaces the legacy client_profiles sync endpoint: the frontend syncs
 * profiles through local storage and never called the old HTTP route, while
 * the portfolio spec (R1.1) owns this path now.
 *
 * - R1.1: CRUD persists rows with user_id = session user and reads them back.
 * - AUTH-2: ownership comes ONLY from the authenticated session; a
 *   client-supplied userId (body or query) is rejected with 400.
 * - XC-1: the route is behind the auth gate (no public allowlist entry) and
 *   every repository call carries the session user_id.
 * - R1.4: zod parsing strips unknown keys and the repository whitelists the
 *   persisted columns, so extraneous fields never reach the database.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest, requireUser } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';
import { validateBody } from '../middleware/validateRequest';
import { createClientSchema, updateClientSchema } from '../middleware/validationSchemas';
import { NotFoundError } from '../errors';
import {
  createClient,
  listClients,
  getClientById,
  updateClient,
  deleteClient,
  type CreateClientInput,
  type UpdateClientInput,
} from '../repositories/clientRepository';

const router = Router();

// AUTH-2: a client-supplied userId (body or query) is never trusted; the
// backend derives ownership from the authenticated session instead.
const hasClientSuppliedUserId = (req: Request): boolean =>
  req.query.userId !== undefined ||
  (req.body !== undefined &&
    typeof req.body === 'object' &&
    (req.body as Record<string, unknown>).userId !== undefined);

const rejectClientSuppliedUserId = (req: Request, res: Response): boolean => {
  if (!hasClientSuppliedUserId(req)) {
    return false;
  }
  res.status(400).json({
    error: 'Bad Request',
    message: 'userId is derived from the authenticated session; do not send it',
  });
  return true;
};

// Middleware form for routes with body validation: the spoofing check MUST
// run before validateBody, because zod strips unknown keys and would erase
// the evidence of a forged userId.
const rejectSpoofedUserId = (req: Request, res: Response, next: NextFunction): void => {
  if (!rejectClientSuppliedUserId(req, res)) {
    next();
  }
};

/** GET /api/clients — list the session user's clients. */
router.get(
  '/',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    if (rejectClientSuppliedUserId(req, res)) {
      return;
    }
    const userId = requireUser(req);
    const clients = await listClients(userId);
    res.json(clients);
  })
);

/** POST /api/clients — create a client owned by the session user. */
router.post(
  '/',
  rejectSpoofedUserId,
  validateBody(createClientSchema),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const userId = requireUser(req);
    const created = await createClient(userId, req.body as CreateClientInput);
    res.status(201).json(created);
  })
);

/** GET /api/clients/:id — 404 when the client is missing or not owned. */
router.get(
  '/:id',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    if (rejectClientSuppliedUserId(req, res)) {
      return;
    }
    const userId = requireUser(req);
    const client = await getClientById(userId, String(req.params.id));
    if (!client) {
      throw new NotFoundError('Client not found');
    }
    res.json(client);
  })
);

/** PATCH /api/clients/:id — whitelisted partial update of an own client. */
router.patch(
  '/:id',
  rejectSpoofedUserId,
  validateBody(updateClientSchema),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const userId = requireUser(req);
    const updated = await updateClient(
      userId,
      String(req.params.id),
      req.body as UpdateClientInput
    );
    if (!updated) {
      throw new NotFoundError('Client not found');
    }
    res.json(updated);
  })
);

/** DELETE /api/clients/:id — removes an own client; 404 otherwise. */
router.delete(
  '/:id',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    if (rejectClientSuppliedUserId(req, res)) {
      return;
    }
    const userId = requireUser(req);
    const existing = await getClientById(userId, String(req.params.id));
    if (!existing) {
      throw new NotFoundError('Client not found');
    }
    await deleteClient(userId, String(req.params.id));
    res.status(204).end();
  })
);

export default router;
