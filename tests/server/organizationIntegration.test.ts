import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import organizationRoutes from '../../server/src/routes/organizationRoutes';
import { AuthenticatedRequest } from '../../server/src/middleware/auth';
import { errorHandler } from '../../server/src/middleware/errorHandler';
import * as orgRepo from '../../server/src/repositories/organizationRepository';

describe('Multi-Tenant Organization API & Team Sharing', () => {
  let app: express.Application;
  let mockUser: AuthenticatedRequest['user'];

  beforeEach(() => {
    vi.restoreAllMocks();
    app = express();
    app.use(express.json());

    // Inject mock user middleware
    app.use((req, _res, next) => {
      (req as AuthenticatedRequest).user = mockUser;
      next();
    });

    app.use('/api/organizations', organizationRoutes);
    app.use(errorHandler);
  });

  describe('GET /api/organizations/current', () => {
    it('returns the organization and role when the user belongs to an org', async () => {
      mockUser = { id: 'user-tech-1', role: 'ally_technical', orgId: 'org-andina' };
      vi.spyOn(orgRepo, 'getUserOrganization').mockResolvedValueOnce({
        organization: {
          id: 'org-andina',
          name: 'Correduría Andina',
          nit: '900123456',
          contact_email: 'info@andina.com',
          phone: '3001234567',
          status: 'ACTIVE',
          settings: {},
          created_at: '2026-01-01',
          updated_at: '2026-01-01',
        },
        role: 'ally_technical',
      });

      const res = await request(app).get('/api/organizations/current');
      expect(res.status).toBe(200);
      expect(res.body.orgId).toBe('org-andina');
      expect(res.body.role).toBe('ally_technical');
      expect(res.body.organization.name).toBe('Correduría Andina');
    });

    it('returns null organization when user has no membership yet', async () => {
      mockUser = { id: 'user-new', role: 'ally_technical' };
      vi.spyOn(orgRepo, 'getUserOrganization').mockResolvedValueOnce(null);

      const res = await request(app).get('/api/organizations/current');
      expect(res.status).toBe(200);
      expect(res.body.organization).toBeNull();
      expect(res.body.orgId).toBeNull();
    });
  });

  describe('RBAC on GET /api/organizations', () => {
    it('rejects ally_technical with 403 Forbidden', async () => {
      mockUser = { id: 'u1', role: 'ally_technical', orgId: 'org-1' };
      const res = await request(app).get('/api/organizations');
      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Forbidden');
    });

    it('rejects ally_admin with 403 Forbidden for global organization listing', async () => {
      mockUser = { id: 'u2', role: 'ally_admin', orgId: 'org-1' };
      const res = await request(app).get('/api/organizations');
      expect(res.status).toBe(403);
    });

    it('allows super_admin to list all organizations', async () => {
      mockUser = { id: 'sa-1', role: 'super_admin' };
      vi.spyOn(orgRepo, 'listOrganizations').mockResolvedValueOnce([
        {
          id: 'org-1',
          name: 'Agencia A',
          nit: '123',
          contact_email: null,
          phone: null,
          status: 'ACTIVE',
          settings: {},
          created_at: '2026-01-01',
          updated_at: '2026-01-01',
        },
      ]);

      const res = await request(app).get('/api/organizations');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body).toHaveLength(1);
    });
  });

  describe('Organization Members Isolation', () => {
    it('prevents users of organization B from reading members of organization A', async () => {
      mockUser = { id: 'u-b', role: 'ally_admin', orgId: 'org-b' };
      vi.spyOn(orgRepo, 'getUserOrganization').mockResolvedValueOnce({
        organization: { id: 'org-b', name: 'Org B' } as any,
        role: 'ally_admin',
      });

      const res = await request(app).get('/api/organizations/org-a/members');
      expect(res.status).toBe(403);
    });

    it('allows ally_admin of organization A to read their team members', async () => {
      mockUser = { id: 'u-admin-a', role: 'ally_admin', orgId: 'org-a' };
      vi.spyOn(orgRepo, 'listOrganizationMembers').mockResolvedValueOnce([
        { id: 'm1', org_id: 'org-a', user_id: 'u-tech-1', role: 'ally_technical', created_at: '', updated_at: '' },
        { id: 'm2', org_id: 'org-a', user_id: 'u-admin-a', role: 'ally_admin', created_at: '', updated_at: '' },
      ]);

      const res = await request(app).get('/api/organizations/org-a/members');
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
    });
  });
});
