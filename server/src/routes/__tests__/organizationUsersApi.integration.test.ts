import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express, { type Express } from 'express';
import type { FakeSupabase } from '../../../../tests/server/helpers/fakeSupabase';

const holder = vi.hoisted(() => ({ fake: null as unknown as FakeSupabase }));

vi.mock('../../config/database', async () => {
  const { createFakeSupabase } = await import('../../../../tests/server/helpers/fakeSupabase');
  holder.fake = createFakeSupabase();
  return { supabase: holder.fake.client };
});

const fake = holder.fake;

import organizationRoutes from '../organizationRoutes';
import { authGate } from '../../middleware/authGate';
import { errorHandler } from '../../middleware/errorHandler';

function bearerTokenWithClaims(claims: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify(claims)).toString('base64url');
  return `Bearer ${header}.${payload}.test-signature`;
}

const SUPER_ADMIN = 'super-admin-uuid';
const ALLY_ADMIN = 'ally-admin-uuid';
const TECH_USER = 'tech-user-uuid';
const OTHER_TECH_USER = 'other-tech-user-uuid';
const ORG_1 = 'org-uuid-1111-1111-1111-111111111111';
const ORG_2 = 'org-uuid-2222-2222-2222-222222222222';

const superAdminToken = bearerTokenWithClaims({
  sub: SUPER_ADMIN,
  role: 'super_admin',
  app_metadata: { role: 'super_admin' },
  user_metadata: { name: 'Super Admin' },
});

const allyAdminToken = bearerTokenWithClaims({
  sub: ALLY_ADMIN,
  role: 'ally_admin',
  orgId: ORG_1,
  app_metadata: { role: 'ally_admin', org_id: ORG_1 },
  user_metadata: { name: 'Ally Admin 1', org_id: ORG_1 },
});

function buildApp(): Express {
  const app = express();
  app.use(express.json());
  app.use('/api', authGate);
  app.use('/api/organizations', organizationRoutes);
  app.use(errorHandler);
  return app;
}

describe('Organization & User Management CRUD API', () => {
  beforeEach(() => {
    fake.replaceRows('organizations', [
      {
        id: ORG_1,
        name: 'Correduría Uno',
        nit: '900.111.111-1',
        status: 'ACTIVE',
        settings: {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: ORG_2,
        name: 'Correduría Dos',
        nit: '900.222.222-2',
        status: 'ACTIVE',
        settings: {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ]);

    fake.replaceRows('organization_members', [
      {
        id: 'member-1',
        org_id: ORG_1,
        user_id: SUPER_ADMIN,
        role: 'super_admin',
        status: 'ACTIVE',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 'member-2',
        org_id: ORG_1,
        user_id: ALLY_ADMIN,
        role: 'ally_admin',
        status: 'ACTIVE',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 'member-3',
        org_id: ORG_1,
        user_id: TECH_USER,
        role: 'ally_technical',
        status: 'ACTIVE',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 'member-4',
        org_id: ORG_2,
        user_id: OTHER_TECH_USER,
        role: 'ally_technical',
        status: 'ACTIVE',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ]);
  });

  it('GET /api/organizations/current returns user organization and role', async () => {
    const app = buildApp();
    const res = await request(app)
      .get('/api/organizations/current')
      .set('Authorization', allyAdminToken);

    if (res.status !== 200) {
      console.log('Error 500 detail:', res.body);
    }

    expect(res.status).toBe(200);
    expect(res.body.role).toBe('ally_admin');
    expect(res.body.orgId).toBe(ORG_1);
    expect(res.body.organization.name).toBe('Correduría Uno');
  });

  it('PUT /api/organizations/users/:userId allows Super Admin to update user name, role and org', async () => {
    const app = buildApp();

    const res = await request(app)
      .put(`/api/organizations/users/${TECH_USER}`)
      .set('Authorization', superAdminToken)
      .send({
        name: 'Técnico Actualizado',
        role: 'ally_admin',
        orgId: ORG_2,
        status: 'INACTIVE',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.user.name).toBe('Técnico Actualizado');
    expect(res.body.user.role).toBe('ally_admin');
    expect(res.body.user.orgId).toBe(ORG_2);
    expect(res.body.user.status).toBe('INACTIVE');
  });

  it('PATCH /api/organizations/users/:userId/status toggles status', async () => {
    const app = buildApp();

    const res = await request(app)
      .patch(`/api/organizations/users/${TECH_USER}/status`)
      .set('Authorization', allyAdminToken)
      .send({ status: 'INACTIVE' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.status).toBe('INACTIVE');
  });

  it('PUT /api/organizations/users/:userId allows Ally Admin to update technicians in their own team', async () => {
    const app = buildApp();

    const res = await request(app)
      .put(`/api/organizations/users/${TECH_USER}`)
      .set('Authorization', allyAdminToken)
      .send({
        name: 'Técnico Aliado Renombrado',
        role: 'ally_technical',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.user.name).toBe('Técnico Aliado Renombrado');
    expect(res.body.user.role).toBe('ally_technical');
    expect(res.body.user.orgId).toBe(ORG_1);
  });

  it('blocks Ally Admin from changing technician role to super_admin', async () => {
    const app = buildApp();

    const res = await request(app)
      .put(`/api/organizations/users/${TECH_USER}`)
      .set('Authorization', allyAdminToken)
      .send({
        role: 'super_admin',
      });

    expect(res.status).toBe(403);
  });

  it('blocks Ally Admin from reassigning technician to another organization', async () => {
    const app = buildApp();

    const res = await request(app)
      .put(`/api/organizations/users/${TECH_USER}`)
      .set('Authorization', allyAdminToken)
      .send({
        orgId: ORG_2,
      });

    expect(res.status).toBe(403);
  });

  it('blocks Ally Admin from modifying users belonging to another organization', async () => {
    const app = buildApp();

    const res = await request(app)
      .put(`/api/organizations/users/${OTHER_TECH_USER}`)
      .set('Authorization', allyAdminToken)
      .send({
        name: 'Intento de modificar usuario ajeno',
      });

    expect(res.status).toBe(403);
  });

  it('DELETE /api/organizations/users/:userId allows Ally Admin to remove a technician from their team', async () => {
    const app = buildApp();

    const res = await request(app)
      .delete(`/api/organizations/users/${TECH_USER}`)
      .set('Authorization', allyAdminToken);

    expect(res.status).toBe(204);
  });

  it('prevents user from deleting their own account', async () => {
    const app = buildApp();

    const res = await request(app)
      .delete(`/api/organizations/users/${ALLY_ADMIN}`)
      .set('Authorization', allyAdminToken);

    expect(res.status).toBe(403);
  });
});
