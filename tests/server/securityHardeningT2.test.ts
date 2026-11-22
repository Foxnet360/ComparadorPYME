import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import type { AuthenticatedRequest } from '../../server/src/middleware/auth';
import { errorHandler } from '../../server/src/middleware/errorHandler';
import { daasApiKeyAuth, hashApiKey } from '../../server/src/middleware/daasApiKeyAuth';

const mockState = vi.hoisted(() => ({
  rpcResult: { data: null as unknown, error: null as unknown },
  subscriberRows: [] as Array<Record<string, unknown>>,
  listUsersPages: [] as Array<Array<Record<string, unknown>>>,
  updateUserById: vi.fn(async () => ({ data: { user: {} }, error: null })),
  createUser: vi.fn(async () => ({ data: { user: { id: 'new-user-id', email: 'new@test.com' } }, error: null })),
  orgMemberByUser: new Map<string, Record<string, unknown>>(),
  orgs: new Map<string, Record<string, unknown>>([
    ['org-1', { id: 'org-1', name: 'Org 1' }],
    ['org-2', { id: 'org-2', name: 'Org 2' }],
  ]),
}));

vi.mock('../../server/src/config/database', () => ({
  supabase: {
    rpc: vi.fn(async () => mockState.rpcResult),
    from: vi.fn((table: string) => {
      if (table === 'daas_subscribers') {
        return {
          select: () => ({
            eq: () => ({
              eq: async () => ({ data: mockState.subscriberRows, error: null }),
            }),
          }),
          update: () => ({
            eq: async () => ({ data: null, error: null }),
          }),
        };
      }
      return {
        select: () => ({
          eq: () => ({
            single: async () => ({ data: null, error: { code: 'PGRST116' } }),
            maybeSingle: async () => ({ data: null, error: null }),
          }),
        }),
      };
    }),
    auth: {
      admin: {
        listUsers: vi.fn(async (opts?: { page?: number }) => {
          const pageIdx = (opts?.page ?? 1) - 1;
          return {
            data: { users: mockState.listUsersPages[pageIdx] || [] },
            error: null,
          };
        }),
        updateUserById: mockState.updateUserById,
        createUser: mockState.createUser,
      },
    },
  },
}));

vi.mock('../../server/src/repositories/organizationRepository', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../server/src/repositories/organizationRepository')>();
  return {
    ...actual,
    getOrganizationById: vi.fn(async (id: string) => mockState.orgs.get(id) || null),
    getUserOrganization: vi.fn(async () => ({ organization: { id: 'org-1', name: 'Org 1' }, role: 'ally_admin' })),
    getOrganizationMember: vi.fn(async (userId: string) => mockState.orgMemberByUser.get(userId) || null),
    addOrganizationMember: vi.fn(async (input: Record<string, unknown>) => ({ id: 'm-1', ...input })),
    createOrganization: vi.fn(async (input: Record<string, unknown>) => ({ id: 'org-new', ...input })),
  };
});

import organizationRoutes from '../../server/src/routes/organizationRoutes';
import monitoringRoutes from '../../server/src/routes/monitoring';
import analysisRoutes from '../../server/src/routes/analysis';
import { createTemplateRegistryRoutes } from '../../server/src/routes/templateRegistry';
import type { TemplateRegistryService } from '../../server/src/services/templateRegistryService';

vi.mock('../../server/src/middleware/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../server/src/middleware/auth')>();
  return {
    ...actual,
    authMiddleware: (req: AuthenticatedRequest, res: express.Response, next: express.NextFunction) => {
      if (req.user) {
        next();
        return;
      }
      return actual.authMiddleware(req, res, next);
    },
  };
});

function makeApp(role: AuthenticatedRequest['user'] extends infer U ? (U extends { role?: infer R } ? R : string) : string, orgId = 'org-1') {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as AuthenticatedRequest).user = { id: 'caller-1', role: role as string, orgId };
    next();
  });
  app.use('/api/organizations', organizationRoutes);
  app.use('/api/monitoring', monitoringRoutes);
  app.use('/api/analysis', analysisRoutes);
  const mockTemplateService = {
    loadTemplates: vi.fn(async () => []),
    getTemplate: vi.fn(() => undefined),
    upsertTemplate: vi.fn(async () => {}),
    deleteTemplate: vi.fn(async () => {}),
    invalidateCache: vi.fn(async () => {}),
  } as unknown as TemplateRegistryService;
  app.use('/api/templates/registry', createTemplateRegistryRoutes(mockTemplateService));
  app.use(errorHandler);
  return app;
}

describe('T2 Security Hardening (S2a)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockState.rpcResult = { data: null, error: { message: 'rpc unavailable' } };
    mockState.subscriberRows = [];
    mockState.listUsersPages = [];
    mockState.orgMemberByUser.clear();
  });

  it('blocks ally_technical from self-service creating an organization (403)', async () => {
    const app = makeApp('ally_technical');
    const res = await request(app).post('/api/organizations').send({ name: 'Rogue Org' });
    expect(res.status).toBe(403);
  });

  it('blocks ally_admin from taking over an existing user in another organization via /users/invite', async () => {
    mockState.listUsersPages = [
      [
        {
          id: 'victim-org2',
          email: 'victim@org2.com',
          user_metadata: { name: 'Victim' },
          app_metadata: { role: 'ally_technical', org_id: 'org-2' },
        },
      ],
    ];
    mockState.orgMemberByUser.set('victim-org2', {
      id: 'mem-victim',
      org_id: 'org-2',
      user_id: 'victim-org2',
      role: 'ally_technical',
      status: 'ACTIVE',
    });

    const app = makeApp('ally_admin', 'org-1');
    const res = await request(app).post('/api/organizations/users/invite').send({
      email: 'victim@org2.com',
      name: 'Hijacked',
      role: 'ally_technical',
      orgId: 'org-1',
    });

    expect(res.status).toBe(403);
    expect(mockState.updateUserById).not.toHaveBeenCalled();
  });

  it('blocks ally_admin from downgrading a super_admin via /users/invite', async () => {
    mockState.listUsersPages = [
      [
        {
          id: 'super-1',
          email: 'root@platform.com',
          user_metadata: { name: 'Root' },
          app_metadata: { role: 'super_admin' },
        },
      ],
    ];
    mockState.orgMemberByUser.set('super-1', {
      id: 'mem-super',
      org_id: 'org-1',
      user_id: 'super-1',
      role: 'super_admin',
      status: 'ACTIVE',
    });

    const app = makeApp('ally_admin', 'org-1');
    const res = await request(app).post('/api/organizations/users/invite').send({
      email: 'root@platform.com',
      name: 'Downgraded',
      role: 'ally_technical',
      orgId: 'org-1',
    });

    expect(res.status).toBe(403);
    expect(mockState.updateUserById).not.toHaveBeenCalled();
  });

  it('blocks ally_admin from assigning ally_admin or arbitrary roles via POST /:id/members', async () => {
    const app = makeApp('ally_admin', 'org-1');

    const resAdmin = await request(app)
      .post('/api/organizations/org-1/members')
      .send({ user_id: 'u-123', role: 'ally_admin' });
    expect(resAdmin.status).toBe(403);

    const resBogus = await request(app)
      .post('/api/organizations/org-1/members')
      .send({ user_id: 'u-123', role: 'arbitrary_role' });
    expect(resBogus.status).toBe(400);
  });

  it('does NOT fall back to daas_subscribers when verify_daas_api_key returns is_valid=false', async () => {
    const key = 'csa_live_expired_key_123';
    mockState.rpcResult = {
      data: [{ subscriber_id: 'sub-1', is_valid: false }],
      error: null,
    };
    mockState.subscriberRows = [
      {
        id: 'sub-1',
        name: 'Expired Sub',
        api_key_hash: hashApiKey(key),
        status: 'ACTIVE',
        expires_at: '2020-01-01T00:00:00Z',
        monthly_quota: 1000,
        current_month_usage: 0,
      },
    ];

    const app = express();
    app.use('/api/v1/daas', daasApiKeyAuth, (_req, res) => res.json({ ok: true }));

    const res = await request(app).get('/api/v1/daas/test').set('X-API-Key', key);
    expect(res.status).toBe(401);
  });

  it('rejects expired expires_at in daasApiKeyAuth fallback when RPC fails', async () => {
    const key = 'csa_live_expired_fallback_123';
    mockState.rpcResult = { data: null, error: { message: 'rpc not found' } };
    mockState.subscriberRows = [
      {
        id: 'sub-2',
        name: 'Expired Fallback Sub',
        api_key_hash: hashApiKey(key),
        status: 'ACTIVE',
        expires_at: '2020-01-01T00:00:00Z',
        monthly_quota: 1000,
        current_month_usage: 0,
      },
    ];

    const app = express();
    app.use('/api/v1/daas', daasApiKeyAuth, (_req, res) => res.json({ ok: true }));

    const res = await request(app).get('/api/v1/daas/test').set('X-API-Key', key);
    expect(res.status).toBe(401);
  });

  it('blocks non-super_admin users from /api/monitoring/dashboard, /errors, and /alerts', async () => {
    const app = makeApp('ally_technical');
    expect((await request(app).get('/api/monitoring/dashboard')).status).toBe(403);
    expect((await request(app).get('/api/monitoring/errors')).status).toBe(403);
    expect((await request(app).get('/api/monitoring/alerts')).status).toBe(403);
  });

  it('allows ally_admin to read template registry but blocks mutations', async () => {
    const app = makeApp('ally_admin');
    const getRes = await request(app).get('/api/templates/registry');
    expect(getRes.status).toBe(200);
    const delRes = await request(app).delete('/api/templates/registry/bbva-pyme-v1');
    expect(delRes.status).toBe(403);
  });

  it('blocks ally_technical from storing global structured clauses', async () => {
    const app = makeApp('ally_technical');
    const res = await request(app)
      .post('/api/analysis/store-structured-clause')
      .send({ insurer: 'AXA' });
    expect(res.status).toBe(403);
  });
});
