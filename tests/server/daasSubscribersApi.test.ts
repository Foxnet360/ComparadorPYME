import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express, { type Express } from 'express';
import type { FakeSupabase } from './helpers/fakeSupabase';
import { hashApiKey } from '../../server/src/middleware/daasApiKeyAuth';

const holder = vi.hoisted(() => ({ fake: null as unknown as FakeSupabase }));

vi.mock('../../server/src/config/database', async () => {
  const { createFakeSupabase } = await import('./helpers/fakeSupabase');
  holder.fake = createFakeSupabase();
  return { supabase: holder.fake.client };
});

const fake = holder.fake;

import daasRoutes from '../../server/src/routes/daasRoutes';
import { authGate } from '../../server/src/middleware/authGate';
import { errorHandler } from '../../server/src/middleware/errorHandler';

const VALID_KEY_SURA = 'csa_live_sura_test_key_123456789';
const HASH_SURA = hashApiKey(VALID_KEY_SURA);

const VALID_KEY_CHUBB = 'csa_live_chubb_test_key_987654321';
const HASH_CHUBB = hashApiKey(VALID_KEY_CHUBB);

const EXHAUSTED_KEY = 'csa_live_exhausted_key_000000000';
const HASH_EXHAUSTED = hashApiKey(EXHAUSTED_KEY);

function buildApp(): Express {
  const app = express();
  app.use(express.json());
  app.use('/api', authGate);
  app.use('/api/v1/daas', daasRoutes);
  app.use(errorHandler);
  return app;
}

describe('DaaS B2B Subscribers & API Key Monetization API', () => {
  const app = buildApp();

  beforeEach(() => {
    fake.replaceRows('daas_subscribers', [
      {
        id: 'sub-sura-uuid',
        name: 'Aseguradora SURA - Dirección Actuarial',
        api_key_prefix: 'csa_live_sura',
        api_key_hash: HASH_SURA,
        tier: 'ENTERPRISE',
        monthly_quota: 50000,
        current_month_usage: 100,
        rate_limit_per_minute: 600,
        allowed_domains: ['all'],
        status: 'ACTIVE',
      },
      {
        id: 'sub-chubb-uuid',
        name: 'CHUBB Seguros - Suscripción B2B',
        api_key_prefix: 'csa_live_chubb',
        api_key_hash: HASH_CHUBB,
        tier: 'TIER_1',
        monthly_quota: 2000,
        current_month_usage: 50,
        rate_limit_per_minute: 60,
        allowed_domains: ['pyme', 'autos'],
        status: 'ACTIVE',
      },
      {
        id: 'sub-exhausted-uuid',
        name: 'Broker Pequeño - Cuota Agotada',
        api_key_prefix: 'csa_live_exhausted',
        api_key_hash: HASH_EXHAUSTED,
        tier: 'TIER_1',
        monthly_quota: 50,
        current_month_usage: 51,
        rate_limit_per_minute: 60,
        allowed_domains: ['all'],
        status: 'ACTIVE',
      },
    ]);

    fake.replaceRows('daas_market_snapshots', [
      {
        id: 'snap-1',
        domain: 'pyme',
        insurer_name: 'SURA',
        price_annual: 4500000,
        currency: 'COP',
        period_month: new Date().toISOString().substring(0, 7),
      },
      {
        id: 'snap-2',
        domain: 'pyme',
        insurer_name: 'AXA Colpatria',
        price_annual: 5200000,
        currency: 'COP',
        period_month: new Date().toISOString().substring(0, 7),
      },
    ]);

    fake.replaceRows('daas_api_usage', []);
  });

  describe('Authentication & Security Gate', () => {
    it('rejects anonymous request without API key with 401', async () => {
      const res = await request(app).get('/api/v1/daas/benchmarks/pricing?domain=pyme');
      expect(res.status).toBe(401);
      expect(res.body.message).toContain('DaaS API Key required');
    });

    it('rejects invalid or tampered API key with 401', async () => {
      const res = await request(app)
        .get('/api/v1/daas/benchmarks/pricing?domain=pyme')
        .set('X-API-Key', 'csa_live_invalid_key_bogus');

      expect(res.status).toBe(401);
      expect(res.body.message).toContain('Invalid, expired or suspended');
    });

    it('accepts valid API key via X-API-Key and attaches quota headers', async () => {
      const res = await request(app)
        .get('/api/v1/daas/benchmarks/pricing?domain=pyme')
        .set('X-API-Key', VALID_KEY_SURA);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.domain).toBe('pyme');
      expect(res.headers['x-ratelimit-limit']).toBe('600');
      expect(res.headers['x-quota-monthly']).toBe('50000');
    });

    it('accepts valid API key via Authorization Bearer token', async () => {
      const res = await request(app)
        .get('/api/v1/daas/benchmarks/pricing?domain=pyme')
        .set('Authorization', `Bearer ${VALID_KEY_SURA}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('rejects subscriber when monthly quota is exceeded with 429', async () => {
      const res = await request(app)
        .get('/api/v1/daas/benchmarks/pricing?domain=pyme')
        .set('X-API-Key', EXHAUSTED_KEY);

      expect(res.status).toBe(429);
      expect(res.body.error).toBe('Quota Exceeded');
    });

    it('enforces allowed_domains restriction returning 403 on unauthorized domain', async () => {
      // CHUBB subscriber only allows ['pyme', 'autos']
      const res = await request(app)
        .get('/api/v1/daas/benchmarks/pricing?domain=hogar')
        .set('X-API-Key', VALID_KEY_CHUBB);

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Forbidden');
      expect(res.body.message).toContain('hogar');
    });
  });

  describe('DaaS Endpoints & Telemetry', () => {
    it('returns market-share distribution and logs usage', async () => {
      const res = await request(app)
        .get('/api/v1/daas/benchmarks/market-share')
        .set('X-API-Key', VALID_KEY_SURA);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.totalAnalyzedQuotes).toBe(2);
      expect(res.body.data.insurers.length).toBe(2);

      // Verify telemetric record in daas_api_usage
      const usage = fake.rows('daas_api_usage');
      expect(usage.length).toBeGreaterThan(0);
      expect(usage[0].subscriber_id).toBe('sub-sura-uuid');
      expect(usage[0].endpoint).toBe('/api/v1/daas/benchmarks/market-share');
    });

    it('returns subscriber status and remaining quota', async () => {
      const res = await request(app)
        .get('/api/v1/daas/subscriber/status')
        .set('X-API-Key', VALID_KEY_SURA);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toContain('SURA');
      expect(res.body.data.tier).toBe('ENTERPRISE');
      expect(res.body.data.monthlyQuota).toBe(50000);
      expect(res.body.data.remainingQuota).toBeGreaterThan(0);
    });
  });
});
