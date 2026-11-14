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
import { AuthenticatedRequest, requireUser, requireRole } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';
import { validateBody } from '../middleware/validateRequest';
import { createClientSchema, updateClientSchema } from '../middleware/validationSchemas';
import { NotFoundError, ValidationError } from '../errors';
import {
  createClient,
  listClients,
  getClientById,
  updateClient,
  deleteClient,
  listClientShares,
  shareClientWithUser,
  unshareClientWithUser,
  delegateClientToAdvisors,
  updateClientLeadStatus,
  listDelegationAudit,
  searchOrgClientDirectory,
  type CreateClientInput,
  type UpdateClientInput,
  type LeadStatus,
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

/** GET /api/clients — list the session user's clients (Opción A). */
router.get(
  '/',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    if (rejectClientSuppliedUserId(req, res)) {
      return;
    }
    const userId = requireUser(req);
    const clients = await listClients(userId, req.user?.orgId, req.user?.role);
    res.json(clients);
  })
);

/** GET /api/clients/directory — shared organization client directory for duplicate checking. */
router.get(
  '/directory',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    requireUser(req);
    if (!req.user?.orgId) {
      res.json([]);
      return;
    }
    const search = typeof req.query.search === 'string' ? req.query.search : '';
    const directory = await searchOrgClientDirectory(req.user.orgId, search);
    res.json(directory);
  })
);

/** GET /api/clients/delegations/audit — admin audit log of lead delegations and status evolution. */
router.get(
  '/delegations/audit',
  requireRole('super_admin', 'ally_admin'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    requireUser(req);
    const orgId = req.user?.orgId;
    if (!orgId) {
      res.json([]);
      return;
    }
    const clientId = typeof req.query.clientId === 'string' ? req.query.clientId : undefined;
    const advisorId = typeof req.query.advisorId === 'string' ? req.query.advisorId : undefined;
    const audit = await listDelegationAudit({ orgId, clientId, advisorId });
    res.json(audit);
  })
);

/** POST /api/clients — create a client owned by the session user. */
router.post(
  '/',
  rejectSpoofedUserId,
  validateBody(createClientSchema),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const userId = requireUser(req);
    const created = await createClient(userId, req.body as CreateClientInput, req.user?.orgId);
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
    const client = await getClientById(userId, String(req.params.id), req.user?.orgId);
    if (!client) {
      throw new NotFoundError('Client not found');
    }
    res.json(client);
  })
);

/** PATCH & PUT /api/clients/:id — whitelisted partial/full update of an own client. */
const handleUpdateClient = asyncHandler(async (req: AuthenticatedRequest, res) => {
  const userId = requireUser(req);
  const updated = await updateClient(
    userId,
    String(req.params.id),
    req.body as UpdateClientInput,
    req.user?.orgId
  );
  if (!updated) {
    throw new NotFoundError('Client not found');
  }
  res.json(updated);
});

router.patch('/:id', rejectSpoofedUserId, validateBody(updateClientSchema), handleUpdateClient);

router.put('/:id', rejectSpoofedUserId, validateBody(updateClientSchema), handleUpdateClient);

/** DELETE /api/clients/:id — removes an own client; 404 otherwise. */
router.delete(
  '/:id',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    if (rejectClientSuppliedUserId(req, res)) {
      return;
    }
    const userId = requireUser(req);
    const existing = await getClientById(userId, String(req.params.id), req.user?.orgId);
    if (!existing) {
      throw new NotFoundError('Client not found');
    }
    await deleteClient(userId, String(req.params.id), req.user?.orgId);
    res.status(204).end();
  })
);

/** GET /api/clients/:id/shares — list Técnicos Analistas with shared access. */
router.get(
  '/:id/shares',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const userId = requireUser(req);
    const client = await getClientById(userId, String(req.params.id), req.user?.orgId);
    if (!client) {
      throw new NotFoundError('Client not found');
    }
    const shares = await listClientShares(client.id);
    res.json(shares);
  })
);

/** POST /api/clients/:id/share — share client with another Técnico Analista in the org. */
router.post(
  '/:id/share',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const userId = requireUser(req);
    const orgId = req.user?.orgId;
    if (!orgId) {
      throw new ValidationError('El usuario debe pertenecer a una organización para compartir clientes.');
    }
    const client = await getClientById(userId, String(req.params.id), orgId);
    if (!client) {
      throw new NotFoundError('Client not found');
    }
    const { sharedWithUserId, permission } = req.body as {
      sharedWithUserId?: string;
      permission?: 'view' | 'edit';
    };
    if (!sharedWithUserId) {
      throw new ValidationError('sharedWithUserId es obligatorio.');
    }
    const share = await shareClientWithUser({
      clientId: client.id,
      orgId,
      sharedWithUserId,
      sharedByUserId: userId,
      permission: permission === 'view' ? 'view' : 'edit',
    });
    res.status(201).json(share);
  })
);

/** DELETE /api/clients/:id/share/:targetUserId — revoke shared access. */
router.delete(
  '/:id/share/:targetUserId',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const userId = requireUser(req);
    const orgId = req.user?.orgId;
    if (!orgId) {
      throw new ValidationError('Organización requerida.');
    }
    const client = await getClientById(userId, String(req.params.id), orgId);
    if (!client) {
      throw new NotFoundError('Client not found');
    }
    await unshareClientWithUser({
      clientId: client.id,
      orgId,
      targetUserId: String(req.params.targetUserId),
      actorUserId: userId,
    });
    res.status(204).end();
  })
);

/** POST /api/clients/:id/delegate — admin delegates a lead to one or more Técnicos Analistas. */
router.post(
  '/:id/delegate',
  requireRole('super_admin', 'ally_admin'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const userId = requireUser(req);
    const orgId = req.user?.orgId;
    if (!orgId) {
      throw new ValidationError('Organización requerida.');
    }
    const { primaryAdvisorId, sharedAdvisorIds, notes } = req.body as {
      primaryAdvisorId?: string;
      sharedAdvisorIds?: string[];
      notes?: string;
    };
    if (!primaryAdvisorId) {
      throw new ValidationError('primaryAdvisorId es obligatorio.');
    }
    const updated = await delegateClientToAdvisors({
      clientId: String(req.params.id),
      orgId,
      actorUserId: userId,
      primaryAdvisorId,
      sharedAdvisorIds,
      notes,
    });
    if (!updated) {
      throw new NotFoundError('Client not found');
    }
    res.json(updated);
  })
);

/** PATCH /api/clients/:id/lead-status — update lead lifecycle status with audit log. */
router.patch(
  '/:id/lead-status',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const userId = requireUser(req);
    const orgId = req.user?.orgId;
    if (!orgId) {
      throw new ValidationError('Organización requerida.');
    }
    const { leadStatus, notes } = req.body as { leadStatus?: LeadStatus; notes?: string };
    const allowed: LeadStatus[] = ['nuevo', 'asignado', 'en_gestion', 'cotizado', 'cerrado', 'perdido'];
    if (!leadStatus || !allowed.includes(leadStatus)) {
      throw new ValidationError('leadStatus inválido.');
    }
    const updated = await updateClientLeadStatus({
      clientId: String(req.params.id),
      orgId,
      actorUserId: userId,
      leadStatus,
      notes,
    });
    if (!updated) {
      throw new NotFoundError('Client not found');
    }
    res.json(updated);
  })
);

export default router;
