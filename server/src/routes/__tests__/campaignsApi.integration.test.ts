import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express, { type Express } from 'express';

/**
 * renovacion-polizas PR-4 / task 1.20 — campaign config + manual actions.
 * Contract: R4.1 (GET/PUT per-user windows config), R4.2 (manual
 * send/skip/reschedule per (renewal, window)), R4.3 (manual send shares the
 * insert-first-then-send idempotency with the scheduler), AUTH-2/XC-1
 * (session scoping, spoofing rejected, foreign renewals 404).
 */

import { bearerTokenFor } from '../../../../tests/server/helpers/authTokens';
import type { FakeSupabase } from '../../../../tests/server/helpers/fakeSupabase';

const holder = vi.hoisted(() => ({ fake: null as unknown as FakeSupabase }));

vi.mock('../../config/database', async () => {
  const { createFakeSupabase, RENEWAL_UNIQUE_CONSTRAINTS } =
    await import('../../../../tests/server/helpers/fakeSupabase');
  holder.fake = createFakeSupabase();
  for (const constraint of RENEWAL_UNIQUE_CONSTRAINTS) {
    holder.fake.registerUnique(constraint.table, constraint);
  }
  return { supabase: holder.fake.client };
});

const fake = holder.fake;

import campaignRoutes from '../campaignRoutes';
import renewalRoutes from '../renewalRoutes';
import { authGate } from '../../middleware/authGate';
import { errorHandler } from '../../middleware/errorHandler';

const USER_A = 'user-a';
const USER_B = 'user-b';

function buildApp(): Express {
  const app = express();
  app.use(express.json());
  app.use('/api', authGate);
  app.use('/api/campaigns', campaignRoutes);
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
  fake.replaceRows('campaign_configs', []);
  fake.replaceRows('campaign_deliveries', []);
});

describe('GET /api/campaigns/config (R4.1)', () => {
  it('returns the persisted config for the session user', async () => {
    fake.seed('campaign_configs', [{ user_id: USER_A, windows: [45, 10], enabled: true }]);
    const app = buildApp();

    const res = await request(app)
      .get('/api/campaigns/config')
      .set('Authorization', bearerTokenFor(USER_A));

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ windows: [45, 10], enabled: true });
  });

  it('returns defaults when the user has no config yet (without persisting)', async () => {
    const app = buildApp();

    const res = await request(app)
      .get('/api/campaigns/config')
      .set('Authorization', bearerTokenFor(USER_A));

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ windows: [60, 30, 7], enabled: true });
    expect(fake.rows('campaign_configs')).toHaveLength(0);
  });

  it('never leaks another tenant config (XC-1)', async () => {
    fake.seed('campaign_configs', [{ user_id: USER_B, windows: [90], enabled: false }]);
    const app = buildApp();

    const res = await request(app)
      .get('/api/campaigns/config')
      .set('Authorization', bearerTokenFor(USER_A));

    expect(res.body.windows).toEqual([60, 30, 7]);
    expect(res.body.enabled).toBe(true);
  });

  it('rejects anonymous requests with 401', async () => {
    const app = buildApp();
    const res = await request(app).get('/api/campaigns/config');
    expect(res.status).toBe(401);
  });
});

describe('PUT /api/campaigns/config (R4.1)', () => {
  it('creates the config on first write and updates it afterwards', async () => {
    const app = buildApp();

    const created = await request(app)
      .put('/api/campaigns/config')
      .set('Authorization', bearerTokenFor(USER_A))
      .send({ windows: [90, 15], enabled: true });
    expect(created.status).toBe(200);
    expect(created.body).toMatchObject({ user_id: USER_A, windows: [90, 15], enabled: true });

    const updated = await request(app)
      .put('/api/campaigns/config')
      .set('Authorization', bearerTokenFor(USER_A))
      .send({ windows: [30], enabled: false });
    expect(updated.status).toBe(200);
    expect(updated.body).toMatchObject({ windows: [30], enabled: false });
    expect(fake.rows('campaign_configs')).toHaveLength(1);
  });

  it('rejects invalid windows with 400', async () => {
    const app = buildApp();
    for (const windows of [[], [0], [-3], [1.5], [400], 'not-an-array']) {
      const res = await request(app)
        .put('/api/campaigns/config')
        .set('Authorization', bearerTokenFor(USER_A))
        .send({ windows, enabled: true });
      expect(res.status, `windows=${JSON.stringify(windows)}`).toBe(400);
    }
    expect(fake.rows('campaign_configs')).toHaveLength(0);
  });

  it('rejects a client-supplied userId (AUTH-2)', async () => {
    const app = buildApp();
    const res = await request(app)
      .put('/api/campaigns/config')
      .set('Authorization', bearerTokenFor(USER_A))
      .send({ windows: [30], enabled: true, userId: USER_B });
    expect(res.status).toBe(400);
  });
});

describe('POST /api/renewals/:id/campaigns/:window/send (R4.2/R4.3)', () => {
  it('claims the pair, sends, and marks the delivery sent', async () => {
    const id = seedRenewal();
    const app = buildApp();

    const res = await request(app)
      .post(`/api/renewals/${id}/campaigns/30/send`)
      .set('Authorization', bearerTokenFor(USER_A));

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ renewal_id: id, window_key: '30', status: 'sent' });
    expect(typeof res.body.sent_at).toBe('string');
  });

  it('advances a detected renewal to notified with the broker as actor', async () => {
    const id = seedRenewal();
    const app = buildApp();

    await request(app)
      .post(`/api/renewals/${id}/campaigns/30/send`)
      .set('Authorization', bearerTokenFor(USER_A));

    expect(fake.rows('renewals')[0].state).toBe('notified');
    expect(fake.rows('renewal_events')[0]).toMatchObject({
      from_state: 'detected',
      to_state: 'notified',
      actor_id: USER_A,
    });
  });

  it('a second manual send of the same pair conflicts with 409 (R4.3)', async () => {
    const id = seedRenewal();
    const app = buildApp();

    await request(app)
      .post(`/api/renewals/${id}/campaigns/30/send`)
      .set('Authorization', bearerTokenFor(USER_A));
    const second = await request(app)
      .post(`/api/renewals/${id}/campaigns/30/send`)
      .set('Authorization', bearerTokenFor(USER_A));

    expect(second.status).toBe(409);
    expect(fake.rows('campaign_deliveries')).toHaveLength(1);
  });

  it('returns 404 for a foreign renewal (XC-1)', async () => {
    const id = seedRenewal();
    const app = buildApp();
    const res = await request(app)
      .post(`/api/renewals/${id}/campaigns/30/send`)
      .set('Authorization', bearerTokenFor(USER_B));
    expect(res.status).toBe(404);
    expect(fake.rows('campaign_deliveries')).toHaveLength(0);
  });

  it('rejects a non-numeric window with 400', async () => {
    const id = seedRenewal();
    const app = buildApp();
    const res = await request(app)
      .post(`/api/renewals/${id}/campaigns/abc/send`)
      .set('Authorization', bearerTokenFor(USER_A));
    expect(res.status).toBe(400);
  });
});

describe('POST /api/renewals/:id/campaigns/:window/skip (R4.2)', () => {
  it('records the window as skipped so the scheduler never sends it', async () => {
    const id = seedRenewal();
    const app = buildApp();

    const res = await request(app)
      .post(`/api/renewals/${id}/campaigns/7/skip`)
      .set('Authorization', bearerTokenFor(USER_A));

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ renewal_id: id, window_key: '7', status: 'skipped' });

    // The pair is claimed: a later manual send of the same window conflicts.
    const send = await request(app)
      .post(`/api/renewals/${id}/campaigns/7/send`)
      .set('Authorization', bearerTokenFor(USER_A));
    expect(send.status).toBe(409);
  });
});

describe('POST /api/renewals/:id/campaigns/:window/reschedule (R4.2)', () => {
  it('releases a skipped pair so the next tick plans it again', async () => {
    const id = seedRenewal();
    const app = buildApp();

    await request(app)
      .post(`/api/renewals/${id}/campaigns/7/skip`)
      .set('Authorization', bearerTokenFor(USER_A));
    const res = await request(app)
      .post(`/api/renewals/${id}/campaigns/7/reschedule`)
      .set('Authorization', bearerTokenFor(USER_A));

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ renewal_id: id, window_key: '7', rescheduled: true });
    expect(fake.rows('campaign_deliveries')).toHaveLength(0);
  });

  it('refuses to reschedule an already-sent delivery with 409', async () => {
    const id = seedRenewal();
    const app = buildApp();

    await request(app)
      .post(`/api/renewals/${id}/campaigns/30/send`)
      .set('Authorization', bearerTokenFor(USER_A));
    const res = await request(app)
      .post(`/api/renewals/${id}/campaigns/30/reschedule`)
      .set('Authorization', bearerTokenFor(USER_A));

    expect(res.status).toBe(409);
    expect(fake.rows('campaign_deliveries')).toHaveLength(1);
  });

  it('returns 404 when there is no delivery for the pair', async () => {
    const id = seedRenewal();
    const app = buildApp();
    const res = await request(app)
      .post(`/api/renewals/${id}/campaigns/30/reschedule`)
      .set('Authorization', bearerTokenFor(USER_A));
    expect(res.status).toBe(404);
  });

  it('rejects anonymous requests with 401', async () => {
    const app = buildApp();
    const res = await request(app).post('/api/renewals/x/campaigns/30/skip');
    expect(res.status).toBe(401);
  });
});
