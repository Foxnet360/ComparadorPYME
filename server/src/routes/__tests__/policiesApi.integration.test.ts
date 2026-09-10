import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express, { type Express } from 'express';

/**
 * renovacion-polizas PR-2 / task 1.8 — portfolio Policies API.
 * Contract: R1.1 (CRUD scoped to the session user), R1.4 (whitelisted,
 * minimal persistence), XC-1 (user B must not read/write user A's policies,
 * nor attach a policy to a client owned by user A — the FK alone does not
 * enforce ownership).
 */

import { bearerTokenFor } from '../../../../tests/server/helpers/authTokens';
import type { FakeSupabase } from '../../../../tests/server/helpers/fakeSupabase';

const holder = vi.hoisted(() => ({ fake: null as unknown as FakeSupabase }));

vi.mock('../../config/database', async () => {
  const { createFakeSupabase } = await import('../../../../tests/server/helpers/fakeSupabase');
  holder.fake = createFakeSupabase();
  return { supabase: holder.fake.client };
});

const fake = holder.fake;

import policyRoutes from '../policyRoutes';
import { authGate } from '../../middleware/authGate';
import { errorHandler } from '../../middleware/errorHandler';

const USER_A = 'user-a';
const USER_B = 'user-b';

function buildApp(): Express {
  const app = express();
  app.use(express.json());
  app.use('/api', authGate);
  app.use('/api/policies', policyRoutes);
  app.use(errorHandler);
  return app;
}

function seedClients(): void {
  fake.seed('clients', [
    { id: '11111111-1111-4111-8111-111111111111', user_id: USER_A, name: 'Cliente A' },
    { id: '22222222-2222-4222-8222-222222222222', user_id: USER_B, name: 'Cliente B' },
  ]);
}

const CLIENT_A = '11111111-1111-4111-8111-111111111111';
const CLIENT_B = '22222222-2222-4222-8222-222222222222';

function validPolicyPayload(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    client_id: CLIENT_A,
    ramo: 'autos',
    insurer: 'Seguros Bolívar',
    policy_number: 'POL-123',
    premium: 2400000,
    start_date: '2026-01-01',
    end_date: '2027-01-01',
    ...overrides,
  };
}

describe('POST /api/policies (1.8)', () => {
  beforeEach(() => {
    fake.replaceRows('clients', []);
    fake.replaceRows('policies', []);
    seedClients();
  });

  it('creates a policy for an own client with session ownership', async () => {
    const app = buildApp();
    const res = await request(app)
      .post('/api/policies')
      .set('Authorization', bearerTokenFor(USER_A))
      .send(validPolicyPayload());
    expect(res.status).toBe(201);
    expect(res.body.user_id).toBe(USER_A);
    expect(res.body.ramo).toBe('autos');
    expect(res.body.provenance).toBe('manual');
  });

  it('rejects a policy attached to a client owned by another user (XC-1)', async () => {
    const app = buildApp();
    const res = await request(app)
      .post('/api/policies')
      .set('Authorization', bearerTokenFor(USER_A))
      .send(validPolicyPayload({ client_id: CLIENT_B }));
    expect(res.status).toBe(404);
    expect(fake.rows('policies')).toHaveLength(0);
  });

  it('rejects an unsupported ramo', async () => {
    const app = buildApp();
    const res = await request(app)
      .post('/api/policies')
      .set('Authorization', bearerTokenFor(USER_A))
      .send(validPolicyPayload({ ramo: 'ovni' }));
    expect(res.status).toBe(400);
    expect(fake.rows('policies')).toHaveLength(0);
  });

  it('rejects a client-supplied userId (AUTH-2 spoofing vector)', async () => {
    const app = buildApp();
    const res = await request(app)
      .post('/api/policies')
      .set('Authorization', bearerTokenFor(USER_A))
      .send(validPolicyPayload({ userId: USER_B }));
    expect(res.status).toBe(400);
    expect(fake.rows('policies')).toHaveLength(0);
  });

  it('never stores extraneous fields (R1.4 whitelist)', async () => {
    const app = buildApp();
    const res = await request(app)
      .post('/api/policies')
      .set('Authorization', bearerTokenFor(USER_A))
      .send(validPolicyPayload({ broker_notes: 'do-not-store', user_id: USER_B }));
    expect(res.status).toBe(201);
    const stored = fake.rows('policies')[0];
    expect(stored.broker_notes).toBeUndefined();
    expect(stored.user_id).toBe(USER_A);
  });

  it('rejects anonymous requests with 401', async () => {
    const app = buildApp();
    const res = await request(app).post('/api/policies').send(validPolicyPayload());
    expect(res.status).toBe(401);
  });
});

describe('GET /api/policies + /:id (1.8, XC-1)', () => {
  beforeEach(() => {
    fake.replaceRows('clients', []);
    fake.replaceRows('policies', []);
  });

  it('lists only the session user policies', async () => {
    fake.seed('policies', [
      { id: 'p-a', user_id: USER_A, client_id: CLIENT_A, ramo: 'autos', end_date: '2027-01-01' },
      { id: 'p-b', user_id: USER_B, client_id: CLIENT_B, ramo: 'hogar', end_date: '2026-06-01' },
    ]);
    const app = buildApp();
    const res = await request(app)
      .get('/api/policies')
      .set('Authorization', bearerTokenFor(USER_A));
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].id).toBe('p-a');
  });

  it('returns 404 when user B reads user A policy', async () => {
    fake.seed('policies', [{ id: 'p-a', user_id: USER_A, client_id: CLIENT_A, ramo: 'autos' }]);
    const app = buildApp();
    const res = await request(app)
      .get('/api/policies/p-a')
      .set('Authorization', bearerTokenFor(USER_B));
    expect(res.status).toBe(404);
  });

  it('rejects anonymous requests with 401', async () => {
    const app = buildApp();
    expect((await request(app).get('/api/policies')).status).toBe(401);
    expect((await request(app).get('/api/policies/p-a')).status).toBe(401);
  });
});

describe('PATCH/DELETE /api/policies/:id (1.8, XC-1)', () => {
  beforeEach(() => {
    fake.replaceRows('clients', []);
    fake.replaceRows('policies', []);
    fake.seed('policies', [
      { id: 'p-a', user_id: USER_A, client_id: CLIENT_A, ramo: 'autos', insurer: 'SBS' },
    ]);
  });

  it('updates own policy and persists the change', async () => {
    const app = buildApp();
    const res = await request(app)
      .patch('/api/policies/p-a')
      .set('Authorization', bearerTokenFor(USER_A))
      .send({ premium: 2600000 });
    expect(res.status).toBe(200);
    expect(res.body.premium).toBe(2600000);
    expect(fake.rows('policies')[0].premium).toBe(2600000);
  });

  it('returns 404 and does not modify the row when user B patches user A policy', async () => {
    const app = buildApp();
    const res = await request(app)
      .patch('/api/policies/p-a')
      .set('Authorization', bearerTokenFor(USER_B))
      .send({ premium: 1 });
    expect(res.status).toBe(404);
    expect(fake.rows('policies')[0].insurer).toBe('SBS');
  });

  it('rejects an unsupported ramo on update', async () => {
    const app = buildApp();
    const res = await request(app)
      .patch('/api/policies/p-a')
      .set('Authorization', bearerTokenFor(USER_A))
      .send({ ramo: 'ovni' });
    expect(res.status).toBe(400);
    expect(fake.rows('policies')[0].ramo).toBe('autos');
  });

  it('deletes own policy; a later read returns 404', async () => {
    const app = buildApp();
    const del = await request(app)
      .delete('/api/policies/p-a')
      .set('Authorization', bearerTokenFor(USER_A));
    expect(del.status).toBe(204);
    const fetched = await request(app)
      .get('/api/policies/p-a')
      .set('Authorization', bearerTokenFor(USER_A));
    expect(fetched.status).toBe(404);
  });

  it('returns 404 and keeps the row when user B deletes user A policy', async () => {
    const app = buildApp();
    const res = await request(app)
      .delete('/api/policies/p-a')
      .set('Authorization', bearerTokenFor(USER_B));
    expect(res.status).toBe(404);
    expect(fake.rows('policies')).toHaveLength(1);
  });
});
