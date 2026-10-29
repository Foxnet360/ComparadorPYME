/**
 * Organization API Routes
 * Management endpoints for organizations and team members
 */

import { Router } from 'express';
import { AuthenticatedRequest, requireUser, requireRole } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';
import { NotFoundError, ForbiddenError, AppError } from '../errors';
import { supabase } from '../config/database';
import {
  DEFAULT_COMMERCIAL_POLICIES,
  getEffectiveCommercialPolicies,
  CommercialPolicies,
} from '../shared/commercialPolicies';
import {
  createOrganization,
  updateOrganization,
  deleteOrganization,
  getOrganizationById,
  listOrganizations,
  addOrganizationMember,
  listOrganizationMembers,
  removeOrganizationMember,
  getUserOrganization,
  getOrganizationDirectory,
  getOrganizationMember,
  updateOrganizationMember,
  updateAuthUser,
  deleteUserFromAuth,
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
 * GET /api/organizations/directory
 * List users directory across organizations.
 */
router.get(
  '/directory',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    requireUser(req);
    const directory = await getOrganizationDirectory();
    res.json(directory);
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
 * GET /api/organizations/:id
 * Get single organization details. Super Admin or members of that org.
 */
router.get(
  '/:id',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const userId = requireUser(req);
    const orgId = String(req.params.id);
    const callerRole = req.user?.role;
    const callerOrgId = req.user?.orgId;

    if (callerRole !== 'super_admin' && callerOrgId !== orgId) {
      const membership = await getUserOrganization(userId);
      if (!membership || membership.organization.id !== orgId) {
        throw new ForbiddenError('Access to this organization is forbidden');
      }
    }

    const org = await getOrganizationById(orgId);
    if (!org) {
      throw new NotFoundError('Organization not found');
    }

    res.json(org);
  })
);

/**
 * GET /api/organizations/:id/commercial-policies
 * Fetch commercial policies for an organization, falling back to standard Colombian defaults.
 */
router.get(
  '/:id/commercial-policies',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    requireUser(req);
    const orgId = String(req.params.id);
    const org = await getOrganizationById(orgId);
    if (!org) {
      throw new NotFoundError('Organization not found');
    }

    const customPolicies = (org.settings as Record<string, any>)?.commercial_policies;
    const effective = getEffectiveCommercialPolicies(customPolicies);
    res.json({ commercialPolicies: effective });
  })
);

/**
 * PUT /api/organizations/:id/commercial-policies
 * Update commercial policies for an organization (Super Admin or Ally Admin of that org).
 */
router.put(
  '/:id/commercial-policies',
  requireRole('super_admin', 'ally_admin'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const orgId = String(req.params.id);
    const callerRole = req.user?.role;
    const callerOrgId = req.user?.orgId;

    if (callerRole === 'ally_admin' && callerOrgId && callerOrgId !== orgId) {
      throw new ForbiddenError('Solo puede configurar las políticas comerciales de su propia correduría');
    }

    const org = await getOrganizationById(orgId);
    if (!org) {
      throw new NotFoundError('Organization not found');
    }

    const incoming = req.body?.commercialPolicies as Partial<CommercialPolicies> | undefined;
    const effective = getEffectiveCommercialPolicies(incoming);

    const newSettings = {
      ...(org.settings || {}),
      commercial_policies: effective,
    };

    await updateOrganization(orgId, { settings: newSettings });

    res.json({ success: true, commercialPolicies: effective });
  })
);

/**
 * PUT /api/organizations/:id
 * Update an organization (Super Admin, or Ally Admin for their own org).
 */
router.put(
  '/:id',
  requireRole('super_admin', 'ally_admin'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const orgId = String(req.params.id);
    const callerRole = req.user?.role;
    const callerOrgId = req.user?.orgId;

    if (callerRole === 'ally_admin' && callerOrgId && callerOrgId !== orgId) {
      throw new ForbiddenError('No está autorizado para modificar otra correduría aliada');
    }

    const existing = await getOrganizationById(orgId);
    if (!existing) {
      throw new NotFoundError('Organization not found');
    }

    const { name, nit, contact_email, phone, status, settings } = req.body;

    const updated = await updateOrganization(orgId, {
      name,
      nit,
      contact_email,
      phone,
      ...(callerRole === 'super_admin' && status ? { status } : {}),
      settings: settings !== undefined ? settings : existing.settings,
    });

    res.json(updated);
  })
);

/**
 * DELETE /api/organizations/:id
 * Delete an organization (Super Admin only).
 */
router.delete(
  '/:id',
  requireRole('super_admin'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const orgId = String(req.params.id);
    const existing = await getOrganizationById(orgId);
    if (!existing) {
      throw new NotFoundError('Organization not found');
    }

    await deleteOrganization(orgId);
    res.status(204).end();
  })
);

/**
 * POST /api/organizations/users/invite
 * Invite or create a user in Supabase Auth and assign to an organization.
 * Super Admin can invite ally_admin or ally_technical for any organization.
 * Ally Admin can only invite ally_technical for their own organization.
 */
router.post(
  '/users/invite',
  requireRole('super_admin', 'ally_admin'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const callerId = requireUser(req);
    const callerRole = req.user?.role || 'ally_admin';
    const callerOrgId = req.user?.orgId;
    const { email, name, role, orgId, password } = req.body;

    if (!email || !name || !role || !orgId) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'email, name, role, and orgId are required',
      });
      return;
    }

    // Role-based boundary enforcement
    let effectiveCallerOrgId = req.user?.orgId;
    if (callerRole === 'ally_admin') {
      if (role !== 'ally_technical') {
        throw new ForbiddenError(
          'Los Administradores Aliados únicamente pueden autorizar o invitar Técnicos Analistas'
        );
      }
      if (!effectiveCallerOrgId || effectiveCallerOrgId === 'ally-100' || effectiveCallerOrgId.length !== 36) {
        const callerMembership = await getUserOrganization(callerId);
        if (callerMembership) {
          effectiveCallerOrgId = callerMembership.organization.id;
        }
      }
      if (effectiveCallerOrgId && effectiveCallerOrgId !== orgId) {
        throw new ForbiddenError(
          'No está autorizado para agregar usuarios a una correduría distinta a la suya'
        );
      }
    }

    const org = await getOrganizationById(orgId);
    if (!org) {
      throw new NotFoundError('La organización aliada seleccionada no existe');
    }

    // Check if user exists in auth.users
    const { data: listData } = await supabase.auth.admin.listUsers();
    let authUser = listData?.users?.find(
      (u) => u.email?.toLowerCase().trim() === email.toLowerCase().trim()
    );

    if (!authUser) {
      const temporaryPassword = password || `Csa${Math.random().toString(36).slice(-8)}!`;
      const { data: createData, error: createError } = await supabase.auth.admin.createUser({
        email: email.trim(),
        password: temporaryPassword,
        email_confirm: true,
        user_metadata: {
          name: name.trim(),
          role,
          org_id: org.id,
          org_name: org.name,
          intermediary_name: org.name,
        },
        app_metadata: {
          role,
          org_id: org.id,
        },
      });

      if (createError) {
        throw new AppError(`Error creando usuario en autenticación: ${createError.message}`, 400);
      }
      authUser = createData.user;
    } else {
      // User already exists in auth: update metadata and link to org
      await supabase.auth.admin.updateUserById(authUser.id, {
        user_metadata: {
          ...authUser.user_metadata,
          name: name.trim(),
          role,
          org_id: org.id,
          org_name: org.name,
        },
        app_metadata: {
          ...authUser.app_metadata,
          role,
          org_id: org.id,
        },
      });
    }

    // Add membership to organization_members
    const member = await addOrganizationMember({
      org_id: org.id,
      user_id: authUser.id,
      role,
    });

    res.status(201).json({
      success: true,
      user: {
        id: authUser.id,
        email: authUser.email,
        name: name.trim(),
        role,
        orgId: org.id,
        orgName: org.name,
      },
      member,
    });
  })
);

/**
 * PUT /api/organizations/users/:userId
 * Update an existing user's information, role, assigned organization, status or password.
 */
router.put(
  '/users/:userId',
  requireRole('super_admin', 'ally_admin'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const callerId = requireUser(req);
    const callerRole = req.user?.role || 'ally_admin';
    const targetUserId = String(req.params.userId);
    const { name, role, orgId, status, password, phone } = req.body;

    // Resolve caller's effective organization if ally_admin
    let effectiveCallerOrgId = req.user?.orgId;
    if (callerRole === 'ally_admin') {
      if (!effectiveCallerOrgId || effectiveCallerOrgId === 'ally-100' || effectiveCallerOrgId.length !== 36) {
        const callerMembership = await getUserOrganization(callerId);
        if (callerMembership) {
          effectiveCallerOrgId = callerMembership.organization.id;
        }
      }
    }

    // Fetch target user's current membership
    const targetMembership = await getOrganizationMember(targetUserId);
    if (!targetMembership) {
      throw new NotFoundError('Usuario no encontrado en ninguna organización');
    }

    // Role-based boundary enforcement
    if (callerRole === 'ally_admin') {
      // Ally admin can only modify users within their own organization
      if (targetMembership.org_id !== effectiveCallerOrgId) {
        throw new ForbiddenError('No está autorizado para modificar usuarios de otra correduría');
      }
      // Ally admin cannot modify super_admin or other ally_admin
      if (targetMembership.role !== 'ally_technical' && targetUserId !== callerId) {
        throw new ForbiddenError('Solo puede gestionar analistas técnicos de su equipo');
      }
      // Ally admin cannot escalate role or change organization
      if (role && role !== 'ally_technical') {
        throw new ForbiddenError('Los administradores aliados solo pueden asignar el rol de Técnico Analista');
      }
      if (orgId && orgId !== effectiveCallerOrgId) {
        throw new ForbiddenError('No puede trasladar usuarios a otra organización');
      }
    }

    // Determine target organization
    const finalOrgId = (callerRole === 'super_admin' && orgId) ? orgId : targetMembership.org_id;
    const finalRole = role || targetMembership.role;
    const finalStatus = status || targetMembership.status || 'ACTIVE';

    const targetOrg = await getOrganizationById(finalOrgId);
    if (!targetOrg) {
      throw new NotFoundError('Organización no encontrada');
    }

    // 1. Update organization_members row
    const updatedMember = await updateOrganizationMember(
      targetUserId,
      {
        role: finalRole,
        status: finalStatus,
        org_id: finalOrgId,
      },
      targetMembership.org_id
    );

    // 2. Update auth.users metadata and password
    await updateAuthUser(targetUserId, {
      name: name?.trim(),
      role: finalRole,
      org_id: finalOrgId,
      org_name: targetOrg.name,
      phone,
      status: finalStatus,
      password: password && password.trim().length >= 6 ? password.trim() : undefined,
    });

    res.json({
      success: true,
      user: {
        id: targetUserId,
        name: name?.trim() || undefined,
        role: finalRole,
        orgId: finalOrgId,
        orgName: targetOrg.name,
        status: finalStatus,
      },
      member: updatedMember,
    });
  })
);

/**
 * PATCH /api/organizations/users/:userId/status
 * Toggle active / inactive status for a user.
 */
router.patch(
  '/users/:userId/status',
  requireRole('super_admin', 'ally_admin'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const callerId = requireUser(req);
    const callerRole = req.user?.role || 'ally_admin';
    const targetUserId = String(req.params.userId);
    const { status } = req.body;

    if (!status || !['ACTIVE', 'INACTIVE', 'SUSPENDED'].includes(status)) {
      res.status(400).json({ error: 'Bad Request', message: 'Valid status is required (ACTIVE, INACTIVE, SUSPENDED)' });
      return;
    }

    // Fetch target user's current membership
    const targetMembership = await getOrganizationMember(targetUserId);
    if (!targetMembership) {
      throw new NotFoundError('Usuario no encontrado en la organización');
    }

    if (callerRole === 'ally_admin') {
      let effectiveCallerOrgId = req.user?.orgId;
      if (!effectiveCallerOrgId || effectiveCallerOrgId === 'ally-100' || effectiveCallerOrgId.length !== 36) {
        const callerMembership = await getUserOrganization(callerId);
        if (callerMembership) {
          effectiveCallerOrgId = callerMembership.organization.id;
        }
      }
      if (targetMembership.org_id !== effectiveCallerOrgId) {
        throw new ForbiddenError('No puede modificar usuarios de otra correduría');
      }
      if (targetMembership.role !== 'ally_technical') {
        throw new ForbiddenError('Solo puede modificar el estado de analistas técnicos');
      }
    }

    const updatedMember = await updateOrganizationMember(
      targetUserId,
      { status },
      targetMembership.org_id
    );

    await updateAuthUser(targetUserId, { status });

    res.json({
      success: true,
      userId: targetUserId,
      status,
      member: updatedMember,
    });
  })
);

/**
 * DELETE /api/organizations/users/:userId
 * Delete or unbind a user.
 * Super Admin deletes user completely (auth.users + organization_members).
 * Ally Admin removes the technical user from their organization.
 */
router.delete(
  '/users/:userId',
  requireRole('super_admin', 'ally_admin'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const callerId = requireUser(req);
    const callerRole = req.user?.role || 'ally_admin';
    const targetUserId = String(req.params.userId);

    if (targetUserId === callerId) {
      throw new ForbiddenError('No puede eliminar su propia cuenta de usuario');
    }

    const targetMembership = await getOrganizationMember(targetUserId);
    if (!targetMembership) {
      throw new NotFoundError('Usuario no encontrado en la organización');
    }

    if (callerRole === 'ally_admin') {
      let effectiveCallerOrgId = req.user?.orgId;
      if (!effectiveCallerOrgId || effectiveCallerOrgId === 'ally-100' || effectiveCallerOrgId.length !== 36) {
        const callerMembership = await getUserOrganization(callerId);
        if (callerMembership) {
          effectiveCallerOrgId = callerMembership.organization.id;
        }
      }
      if (targetMembership.org_id !== effectiveCallerOrgId) {
        throw new ForbiddenError('No puede eliminar usuarios de otra correduría');
      }
      if (targetMembership.role !== 'ally_technical') {
        throw new ForbiddenError('Solo puede eliminar analistas técnicos de su correduría');
      }

      await removeOrganizationMember(targetMembership.org_id, targetUserId);
      res.status(204).end();
      return;
    }

    // Super Admin: Full removal
    await removeOrganizationMember(targetMembership.org_id, targetUserId);
    try {
      await deleteUserFromAuth(targetUserId);
    } catch (authErr) {
      console.warn(`Could not delete user ${targetUserId} from auth:`, authErr);
    }

    res.status(204).end();
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
