import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express, { type Express } from 'express';

/**
 * renovacion-polizas PR-4 / task 1.17 — renewals API.
 * Contract: R3.1 (state filter + server-validated transitions with audit),
 * R3.2 (lost-requires-reason, final_premium rule), AUTH-2 (ownership from
 * session only; spoofed userId rejected), XC-1 (user B gets 404, never data).
 *
 * Mounted behind the REAL authGate exactly like production, backed by the
 * in-memory fake so repository scoping is exercised for real.
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

import renewalRoutes from '../renewalRoutes';
import { authGate } from '../../middleware/authGate';
import { errorHandler } from '../../middleware/errorHandler';

const USER_A = 'user-a';
const USER_B = 'user-b';

function buildApp(): Express {
  const app = express();
  app.use(express.json());
  app.use('/api', authGate);
  app.use('/api/renewals', renewalRoutes);
  app.use(errorHandler);
  return app;
}

function seedRenewal(overrides: Record<string, unknown> = {}): string {
  const row = fake.insertRow('renewals', {
    user_id: USER_A,
    policy_id: 'pol-1',
    cycle_start: '2026-11-01',
    state: 'detected',
    outcome: null,
    final_premium: null,
    loss_reason: null,
    ...overrides,
  });
  return row.id as string;
}

beforeEach(() => {
  fake.replaceRows('renewals', []);
  fake.replaceRows('renewal_events', []);
});

describe('GET /api/renewals (1.17, R3.1)', () => {
  it('lists only the session user renewals', async () => {
    seedRenewal();
    fake.seed('renewals', [
      { user_id: USER_B, policy_id: 'p9', cycle_start: '2026-11-01', state: 'detected' },
    ]);
    const app = buildApp();

    const res = await request(app)
      .get('/api/renewals')
      .set('Authorization', bearerTokenFor(USER_A));

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].policy_id).toBe('pol-1');
  });

  it('filters by ?state=', async () => {
    seedRenewal();
    seedRenewal({ policy_id: 'pol-2', state: 'quoted' });
    const app = buildApp();

    const res = await request(app)
      .get('/api/renewals?state=quoted')
      .set('Authorization', bearerTokenFor(USER_A));

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].state).toBe('quoted');
  });

  it('rejects an unknown state filter with 400', async () => {
    const app = buildApp();
    const res = await request(app)
      .get('/api/renewals?state=archived')
      .set('Authorization', bearerTokenFor(USER_A));
    expect(res.status).toBe(400);
  });

  it('rejects a client-supplied userId (AUTH-2 spoofing vector)', async () => {
    const app = buildApp();
    const res = await request(app)
      .get(`/api/renewals?userId=${USER_B}`)
      .set('Authorization', bearerTokenFor(USER_A));
    expect(res.status).toBe(400);
  });

  it('rejects anonymous requests with 401', async () => {
    const app = buildApp();
    const res = await request(app).get('/api/renewals');
    expect(res.status).toBe(401);
  });
});

describe('POST /api/renewals/:id/transition (1.17, R3.1/R3.2)', () => {
  it('applies a valid transition and records the audit event', async () => {
    const id = seedRenewal();
    const app = buildApp();

    const res = await request(app)
      .post(`/api/renewals/${id}/transition`)
      .set('Authorization', bearerTokenFor(USER_A))
      .send({ to: 'notified' });

    expect(res.status).toBe(200);
    expect(res.body.state).toBe('notified');

    const events = fake.rows('renewal_events');
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      renewal_id: id,
      from_state: 'detected',
      to_state: 'notified',
      actor_id: USER_A,
    });
  });

  it('closes as renewed_competitor with final_premium (R3.2)', async () => {
    const id = seedRenewal({ state: 'quoted' });
    const app = buildApp();

    const res = await request(app)
      .post(`/api/renewals/${id}/transition`)
      .set('Authorization', bearerTokenFor(USER_A))
      .send({ to: 'closed', outcome: 'renewed_competitor', final_premium: 2100000 });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      state: 'closed',
      outcome: 'renewed_competitor',
      final_premium: 2100000,
    });
  });

  it('rejects closing as lost without loss_reason with 400 (R3.2)', async () => {
    const id = seedRenewal({ state: 'quoted' });
    const app = buildApp();

    const res = await request(app)
      .post(`/api/renewals/${id}/transition`)
      .set('Authorization', bearerTokenFor(USER_A))
      .send({ to: 'closed', outcome: 'lost' });

    expect(res.status).toBe(400);
    expect(fake.rows('renewals')[0].state).toBe('quoted');
    expect(fake.rows('renewal_events')).toHaveLength(0);
  });

  it('rejects closing a renewed outcome without final_premium with 400 (R3.2)', async () => {
    const id = seedRenewal({ state: 'quoted' });
    const app = buildApp();

    const res = await request(app)
      .post(`/api/renewals/${id}/transition`)
      .set('Authorization', bearerTokenFor(USER_A))
      .send({ to: 'closed', outcome: 'renewed_same_insurer' });

    expect(res.status).toBe(400);
  });

  it('rejects an illegal jump (detected → quoted) with 409', async () => {
    const id = seedRenewal();
    const app = buildApp();

    const res = await request(app)
      .post(`/api/renewals/${id}/transition`)
      .set('Authorization', bearerTokenFor(USER_A))
      .send({ to: 'quoted' });

    expect(res.status).toBe(409);
    expect(fake.rows('renewals')[0].state).toBe('detected');
  });

  it('closed is terminal: any further transition returns 409', async () => {
    const id = seedRenewal({ state: 'closed', outcome: 'lost', loss_reason: 'x' });
    const app = buildApp();

    const res = await request(app)
      .post(`/api/renewals/${id}/transition`)
      .set('Authorization', bearerTokenFor(USER_A))
      .send({ to: 'detected' });

    expect(res.status).toBe(409);
  });

  it('returns 404 when user B transitions user A renewal (XC-1, no existence leak)', async () => {
    const id = seedRenewal();
    const app = buildApp();

    const res = await request(app)
      .post(`/api/renewals/${id}/transition`)
      .set('Authorization', bearerTokenFor(USER_B))
      .send({ to: 'notified' });

    expect(res.status).toBe(404);
    expect(fake.rows('renewals')[0].state).toBe('detected');
    expect(fake.rows('renewal_events')).toHaveLength(0);
  });

  it('returns 404 for an unknown renewal id', async () => {
    const app = buildApp();
    const res = await request(app)
      .post('/api/renewals/nope/transition')
      .set('Authorization', bearerTokenFor(USER_A))
      .send({ to: 'notified' });
    expect(res.status).toBe(404);
  });

  it('rejects a client-supplied userId in the body (AUTH-2)', async () => {
    const id = seedRenewal();
    const app = buildApp();
    const res = await request(app)
      .post(`/api/renewals/${id}/transition`)
      .set('Authorization', bearerTokenFor(USER_A))
      .send({ to: 'notified', userId: USER_B });
    expect(res.status).toBe(400);
  });

  it('rejects an unknown target state with 400', async () => {
    const id = seedRenewal();
    const app = buildApp();
    const res = await request(app)
      .post(`/api/renewals/${id}/transition`)
      .set('Authorization', bearerTokenFor(USER_A))
      .send({ to: 'archived' });
    expect(res.status).toBe(400);
  });

  it('rejects anonymous requests with 401', async () => {
    const app = buildApp();
    const res = await request(app).post('/api/renewals/x/transition').send({ to: 'notified' });
    expect(res.status).toBe(401);
  });
});

describe('GET /api/renewals/:id/events (PR-5 task 1.22, R3.1)', () => {
  const seedEvent = (renewalId: string, overrides: Record<string, unknown> = {}) =>
    fake.insertRow('renewal_events', {
      renewal_id: renewalId,
      from_state: null,
      to_state: 'detected',
      actor_id: USER_A,
      payload: {},
      created_at: '2026-09-01T00:00:00Z',
      ...overrides,
    });

  it('returns the audit history for an own renewal, oldest first', async () => {
    const id = seedRenewal();
    seedEvent(id);
    seedEvent(id, {
      from_state: 'detected',
      to_state: 'notified',
      created_at: '2026-09-02T00:00:00Z',
    });
    const app = buildApp();

    const res = await request(app)
      .get(`/api/renewals/${id}/events`)
      .set('Authorization', bearerTokenFor(USER_A));

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0].to_state).toBe('detected');
    expect(res.body[1].to_state).toBe('notified');
    expect(res.body[1].from_state).toBe('detected');
  });

  it('answers 404 for another user renewal — no existence leak (XC-1)', async () => {
    const id = seedRenewal();
    seedEvent(id);
    const app = buildApp();

    const res = await request(app)
      .get(`/api/renewals/${id}/events`)
      .set('Authorization', bearerTokenFor(USER_B));

    expect(res.status).toBe(404);
  });

  it('answers 404 for an unknown renewal', async () => {
    const app = buildApp();
    const res = await request(app)
      .get('/api/renewals/does-not-exist/events')
      .set('Authorization', bearerTokenFor(USER_A));
    expect(res.status).toBe(404);
  });

  it('rejects anonymous requests with 401', async () => {
    const app = buildApp();
    const res = await request(app).get('/api/renewals/x/events');
    expect(res.status).toBe(401);
  });

  it('rejects a spoofed userId query param with 400 (AUTH-2)', async () => {
    const id = seedRenewal();
    const app = buildApp();
    const res = await request(app)
      .get(`/api/renewals/${id}/events?userId=${USER_B}`)
      .set('Authorization', bearerTokenFor(USER_A));
    expect(res.status).toBe(400);
  });
});
