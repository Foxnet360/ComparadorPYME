/**
 * Organization API Routes
 * Management endpoints for organizations and team members
 */

import { Router } from 'express';
import { AuthenticatedRequest, requireUser, requireRole } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';
import { NotFoundError, ForbiddenError } from '../errors';
import {
  createOrganization,
  getOrganizationById,
  listOrganizations,
  addOrganizationMember,
  listOrganizationMembers,
  removeOrganizationMember,
  getUserOrganization,
} from '../repositories/organizationRepository';

const router = Router();

/**
 * GET /api/organizations/current
 * Returns the current authenticated user's organization and assigned role.
 */
router.get(
  '/current',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const userId = requireUser(req);
    const result = await getUserOrganization(userId);
    if (!result) {
      res.json({
        organization: null,
        role: req.user?.role || 'ally_technical',
        orgId: null,
      });
      return;
    }

    res.json({
      organization: result.organization,
      role: result.role,
      orgId: result.organization.id,
    });
  })
);

/**
 * GET /api/organizations
 * List all organizations. Super Admin only.
 */
router.get(
  '/',
  requireRole('super_admin'),
  asyncHandler(async (_req: AuthenticatedRequest, res) => {
    const orgs = await listOrganizations();
    res.json(orgs);
  })
);

/**
 * POST /api/organizations
 * Create a new organization. If created by an unassigned user,
 * they automatically become the ally_admin for this organization.
 */
router.post(
  '/',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const userId = requireUser(req);
    const { name, nit, contact_email, phone } = req.body;

    if (!name || typeof name !== 'string') {
      res.status(400).json({ error: 'Bad Request', message: 'name is required' });
      return;
    }

    const org = await createOrganization({
      name,
      nit,
      contact_email,
      phone,
    });

    if (!org) {
      res.status(500).json({ error: 'Internal Server Error', message: 'Failed to create organization' });
      return;
    }

    // Automatically bind the creating user as ally_admin if not super_admin
    const userRole = req.user?.role === 'super_admin' ? 'super_admin' : 'ally_admin';
    await addOrganizationMember({
      org_id: org.id,
      user_id: userId,
      role: userRole,
    });

    res.status(201).json(org);
  })
);

/**
 * GET /api/organizations/:id/members
 * List members of an organization. Accessible by members of that organization or super_admin.
 */
router.get(
  '/:id/members',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const userId = requireUser(req);
    const orgId = String(req.params.id);

    // Verify permission: super_admin or member of the same org
    const userRole = req.user?.role;
    const userOrgId = req.user?.orgId;

    if (userRole !== 'super_admin' && userOrgId !== orgId) {
      // Check db if not in JWT
      const membership = await getUserOrganization(userId);
      if (!membership || membership.organization.id !== orgId) {
        throw new ForbiddenError('Access to this organization members is forbidden');
      }
    }

    const members = await listOrganizationMembers(orgId);
    res.json(members);
  })
);

/**
 * POST /api/organizations/:id/members
 * Add a member to the organization. Admin only.
 */
router.post(
  '/:id/members',
  requireRole('super_admin', 'ally_admin'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const orgId = String(req.params.id);
    const { user_id, role } = req.body;

    if (!user_id || !role) {
      res.status(400).json({ error: 'Bad Request', message: 'user_id and role are required' });
      return;
    }

    const member = await addOrganizationMember({
      org_id: orgId,
      user_id,
      role,
    });

    res.status(201).json(member);
  })
);

/**
 * DELETE /api/organizations/:id/members/:userId
 * Remove a member from the organization. Admin only.
 */
router.delete(
  '/:id/members/:userId',
  requireRole('super_admin', 'ally_admin'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const orgId = String(req.params.id);
    const targetUserId = String(req.params.userId);

    await removeOrganizationMember(orgId, targetUserId);
    res.status(204).end();
  })
);

export default router;
