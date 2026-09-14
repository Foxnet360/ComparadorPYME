import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express, { type Express } from 'express';

/**
 * renovacion-polizas PR-2 / task 1.7 — portfolio Clients API.
 * Contract: R1.1 (CRUD scoped to the session user), AUTH-2 (ownership only
 * from the session; client-supplied userId rejected), XC-1 (user B must not
 * read/write user A's clients), R1.4 (extraneous fields are never stored).
 *
 * The router is mounted behind the REAL authGate exactly like production
 * (app.use('/api', authGate)) with the database backed by the in-memory
 * fake, so user scoping flows through the real repository code.
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

import clientRoutes from '../clientRoutes';
import { authGate } from '../../middleware/authGate';
import { errorHandler } from '../../middleware/errorHandler';

const USER_A = 'user-a';
const USER_B = 'user-b';

function buildApp(): Express {
  const app = express();
  app.use(express.json());
  app.use('/api', authGate);
  app.use('/api/clients', clientRoutes);
  app.use(errorHandler);
  return app;
}

describe('POST /api/clients (1.7)', () => {
  beforeEach(() => {
    fake.replaceRows('clients', []);
  });

  it('creates a client owned by the session user and reads it back', async () => {
    const app = buildApp();

    const created = await request(app)
      .post('/api/clients')
      .set('Authorization', bearerTokenFor(USER_A))
      .send({ name: 'Acme SAS', tax_id: '900123456', contact: { email: 'a@acme.co' } });
    expect(created.status).toBe(201);
    expect(created.body.name).toBe('Acme SAS');
    expect(created.body.user_id).toBe(USER_A);

    const fetched = await request(app)
      .get(`/api/clients/${created.body.id}`)
      .set('Authorization', bearerTokenFor(USER_A));
    expect(fetched.status).toBe(200);
    expect(fetched.body.id).toBe(created.body.id);
    expect(fetched.body.tax_id).toBe('900123456');
  });

  it('rejects a client-supplied userId (AUTH-2 spoofing vector)', async () => {
    const app = buildApp();
    const res = await request(app)
      .post('/api/clients')
      .set('Authorization', bearerTokenFor(USER_A))
      .send({ name: 'Acme SAS', userId: USER_B });
    expect(res.status).toBe(400);
    expect(fake.rows('clients')).toHaveLength(0);
  });

  it('requires a name', async () => {
    const app = buildApp();
    const res = await request(app)
      .post('/api/clients')
      .set('Authorization', bearerTokenFor(USER_A))
      .send({ tax_id: '900123456' });
    expect(res.status).toBe(400);
  });

  it('never stores extraneous fields (R1.4 whitelist)', async () => {
    const app = buildApp();
    const res = await request(app)
      .post('/api/clients')
      .set('Authorization', bearerTokenFor(USER_A))
      .send({ name: 'Acme SAS', internal_notes: 'do-not-store', org_id: 'spoofed-org' });
    expect(res.status).toBe(201);
    const stored = fake.rows('clients')[0];
    expect(stored.internal_notes).toBeUndefined();
    expect(stored.org_id).toBeUndefined();
  });

  it('rejects anonymous requests with 401', async () => {
    const app = buildApp();
    const res = await request(app).post('/api/clients').send({ name: 'Acme SAS' });
    expect(res.status).toBe(401);
  });
});

describe('GET /api/clients (1.7)', () => {
  beforeEach(() => {
    fake.replaceRows('clients', []);
  });

  it('lists only the session user clients', async () => {
    fake.seed('clients', [
      { id: 'a-1', user_id: USER_A, name: 'Cliente A' },
      { id: 'b-1', user_id: USER_B, name: 'Cliente B' },
    ]);
    const app = buildApp();

    const res = await request(app).get('/api/clients').set('Authorization', bearerTokenFor(USER_A));
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].id).toBe('a-1');
  });

  it('rejects anonymous requests with 401', async () => {
    const app = buildApp();
    const res = await request(app).get('/api/clients');
    expect(res.status).toBe(401);
  });

  it('returns an empty array when the session user has no clients', async () => {
    fake.seed('clients', [{ id: 'b-1', user_id: USER_B, name: 'Cliente B' }]);
    const app = buildApp();
    const res = await request(app).get('/api/clients').set('Authorization', bearerTokenFor(USER_A));
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});

describe('GET/PATCH/DELETE /api/clients/:id (1.7, XC-1)', () => {
  beforeEach(() => {
    fake.replaceRows('clients', []);
  });

  it('returns 404 when user B reads user A client', async () => {
    fake.seed('clients', [{ id: 'a-1', user_id: USER_A, name: 'Cliente A' }]);
    const app = buildApp();
    const res = await request(app)
      .get('/api/clients/a-1')
      .set('Authorization', bearerTokenFor(USER_B));
    expect(res.status).toBe(404);
  });

  it('updates own client and persists the change', async () => {
    fake.seed('clients', [{ id: 'a-1', user_id: USER_A, name: 'Cliente A' }]);
    const app = buildApp();
    const res = await request(app)
      .patch('/api/clients/a-1')
      .set('Authorization', bearerTokenFor(USER_A))
      .send({ name: 'Cliente A renombrado' });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Cliente A renombrado');
    expect(fake.rows('clients')[0].name).toBe('Cliente A renombrado');
  });

  it('returns 404 and does not modify the row when user B patches user A client', async () => {
    fake.seed('clients', [{ id: 'a-1', user_id: USER_A, name: 'Cliente A' }]);
    const app = buildApp();
    const res = await request(app)
      .patch('/api/clients/a-1')
      .set('Authorization', bearerTokenFor(USER_B))
      .send({ name: 'Hijacked' });
    expect(res.status).toBe(404);
    expect(fake.rows('clients')[0].name).toBe('Cliente A');
  });

  it('deletes own client; a later read returns 404', async () => {
    fake.seed('clients', [{ id: 'a-1', user_id: USER_A, name: 'Cliente A' }]);
    const app = buildApp();
    const del = await request(app)
      .delete('/api/clients/a-1')
      .set('Authorization', bearerTokenFor(USER_A));
    expect(del.status).toBe(204);

    const fetched = await request(app)
      .get('/api/clients/a-1')
      .set('Authorization', bearerTokenFor(USER_A));
    expect(fetched.status).toBe(404);
  });

  it('returns 404 and keeps the row when user B deletes user A client', async () => {
    fake.seed('clients', [{ id: 'a-1', user_id: USER_A, name: 'Cliente A' }]);
    const app = buildApp();
    const res = await request(app)
      .delete('/api/clients/a-1')
      .set('Authorization', bearerTokenFor(USER_B));
    expect(res.status).toBe(404);
    expect(fake.rows('clients')).toHaveLength(1);
  });

  it('rejects anonymous PATCH with 401', async () => {
    const app = buildApp();
    const res = await request(app).patch('/api/clients/a-1').send({ name: 'x' });
    expect(res.status).toBe(401);
  });

  it('rejects an empty PATCH body with 400', async () => {
    fake.seed('clients', [{ id: 'a-1', user_id: USER_A, name: 'Cliente A' }]);
    const app = buildApp();
    const res = await request(app)
      .patch('/api/clients/a-1')
      .set('Authorization', bearerTokenFor(USER_A))
      .send({});
    expect(res.status).toBe(400);
    expect(fake.rows('clients')[0].name).toBe('Cliente A');
  });
});
