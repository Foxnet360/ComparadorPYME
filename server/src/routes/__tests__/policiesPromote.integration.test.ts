import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express, { type Express } from 'express';

/**
 * renovacion-polizas PR-2 / task 1.9 — POST /api/policies/promote.
 * Contract: R1.3 (promote a winning analysis quote into a Policy with
 * provenance recorded), AUTH-2 (the analysis and the client must belong to
 * the session user; getAnalysisById is NOT user-scoped, so the route checks
 * ownership and answers 404 to avoid leaking existence).
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
const ANALYSIS_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const ANALYSIS_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const CLIENT_A = '11111111-1111-4111-8111-111111111111';
const CLIENT_B = '22222222-2222-4222-8222-222222222222';

function buildApp(): Express {
  const app = express();
  app.use(express.json());
  app.use('/api', authGate);
  app.use('/api/policies', policyRoutes);
  app.use(errorHandler);
  return app;
}

function seedAnalysis(id: string, userId: string): void {
  fake.seed('analysis_history', [
    {
      id,
      user_id: userId,
      domain: 'autos',
      analysis_result: {
        quotes: [
          {
            insurerName: 'Seguros Bolívar',
            policyName: 'Autos Plus',
            priceAnnual: 2400000,
            priceMonthly: 200000,
            currency: 'COP',
            deductibles: '10%',
            coverages: [{ name: 'RCE', value: '100M', deductible: '10%' }],
            score: 85,
          },
        ],
      },
    },
  ]);
}

function validPromoteBody(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    analysis_id: ANALYSIS_A,
    quote_index: 0,
    confirmations: {
      client_id: CLIENT_A,
      policy_number: 'POL-555',
      start_date: '2026-03-01',
      end_date: '2027-03-01',
      insured: { plate: 'XYZ789', model: 'Renault Logan 2021', value: 60000000 },
    },
    ...overrides,
  };
}

describe('POST /api/policies/promote (1.9, R1.3)', () => {
  beforeEach(() => {
    fake.replaceRows('analysis_history', []);
    fake.replaceRows('clients', []);
    fake.replaceRows('policies', []);
    fake.seed('clients', [
      { id: CLIENT_A, user_id: USER_A, name: 'Cliente A' },
      { id: CLIENT_B, user_id: USER_B, name: 'Cliente B' },
    ]);
    seedAnalysis(ANALYSIS_A, USER_A);
    seedAnalysis(ANALYSIS_B, USER_B);
  });

  it('promotes the winning quote into a policy with provenance recorded', async () => {
    const app = buildApp();
    const res = await request(app)
      .post('/api/policies/promote')
      .set('Authorization', bearerTokenFor(USER_A))
      .send(validPromoteBody());

    expect(res.status).toBe(201);
    expect(res.body.user_id).toBe(USER_A);
    expect(res.body.client_id).toBe(CLIENT_A);
    expect(res.body.insurer).toBe('Seguros Bolívar');
    expect(res.body.premium).toBe(2400000);
    expect(res.body.ramo).toBe('autos');
    expect(res.body.policy_number).toBe('POL-555');
    expect(res.body.provenance).toBe('analysis');
    expect(res.body.source_analysis_id).toBe(ANALYSIS_A);
    expect(res.body.ramo_details).toEqual({
      insured: { plate: 'XYZ789', model: 'Renault Logan 2021', value: 60000000 },
    });
  });

  it('returns 404 when the analysis belongs to another user (no existence leak)', async () => {
    const app = buildApp();
    const res = await request(app)
      .post('/api/policies/promote')
      .set('Authorization', bearerTokenFor(USER_A))
      .send(validPromoteBody({ analysis_id: ANALYSIS_B }));
    expect(res.status).toBe(404);
    expect(fake.rows('policies')).toHaveLength(0);
  });

  it('returns 404 when the analysis does not exist', async () => {
    const app = buildApp();
    const res = await request(app)
      .post('/api/policies/promote')
      .set('Authorization', bearerTokenFor(USER_A))
      .send(validPromoteBody({ analysis_id: '99999999-9999-4999-8999-999999999999' }));
    expect(res.status).toBe(404);
  });

  it('returns 404 when confirmations reference a client owned by another user', async () => {
    const app = buildApp();
    const res = await request(app)
      .post('/api/policies/promote')
      .set('Authorization', bearerTokenFor(USER_A))
      .send(
        validPromoteBody({
          confirmations: { ...validPromoteBody().confirmations, client_id: CLIENT_B },
        })
      );
    expect(res.status).toBe(404);
    expect(fake.rows('policies')).toHaveLength(0);
  });

  it('returns 400 when the per-ramo insured object is incomplete', async () => {
    const app = buildApp();
    const res = await request(app)
      .post('/api/policies/promote')
      .set('Authorization', bearerTokenFor(USER_A))
      .send(
        validPromoteBody({
          confirmations: { ...validPromoteBody().confirmations, insured: { plate: 'XYZ789' } },
        })
      );
    expect(res.status).toBe(400);
    expect(fake.rows('policies')).toHaveLength(0);
  });

  it('returns 400 for an out-of-range quote_index', async () => {
    const app = buildApp();
    const res = await request(app)
      .post('/api/policies/promote')
      .set('Authorization', bearerTokenFor(USER_A))
      .send(validPromoteBody({ quote_index: 9 }));
    expect(res.status).toBe(400);
  });

  it('rejects anonymous requests with 401', async () => {
    const app = buildApp();
    const res = await request(app).post('/api/policies/promote').send(validPromoteBody());
    expect(res.status).toBe(401);
  });
});
