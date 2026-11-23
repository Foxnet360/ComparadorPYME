import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import express from 'express';
import request from 'supertest';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockState = {
  daasSubscriberA: {
    id: 'sub-rate-limit-a',
    name: 'Actuaria A',
    tier: 'TIER_1',
    monthly_quota: 1000,
    current_month_usage: 5,
    rate_limit_per_minute: 2,
    allowed_domains: ['all'],
    status: 'ACTIVE',
  },
  daasSubscriberB: {
    id: 'sub-rate-limit-b',
    name: 'Actuaria B',
    tier: 'ENTERPRISE',
    monthly_quota: 10000,
    current_month_usage: 5,
    rate_limit_per_minute: 10,
    allowed_domains: ['all'],
    status: 'ACTIVE',
  },
  analysisRows: [] as Array<Record<string, unknown>>,
};

vi.mock('../../server/src/config/database', () => ({
  supabase: {
    rpc: vi.fn().mockImplementation((fnName: string) => {
      if (fnName === 'get_executive_analytics_summary') {
        return Promise.resolve({ data: null, error: { message: 'rpc unavailable in unit test' } });
      }
      if (fnName === 'get_daas_market_index') {
        return Promise.resolve({
          data: {
            domain: 'pyme',
            sampleSize: 10,
            avgPremiumAnnual: 4500000,
            medianPremiumAnnual: 4400000,
            percentile25: 3800000,
            percentile75: 5100000,
            currency: 'COP',
            topInsurers: [],
            calculatedAt: new Date().toISOString(),
          },
          error: null,
        });
      }
      return Promise.resolve({ data: null, error: { message: 'mock rpc miss' } });
    }),
    from: vi.fn().mockImplementation((table: string) => {
      if (table === 'daas_subscribers') {
        const hashA = crypto.createHash('sha256').update('csa_test_key_a').digest('hex');
        const hashB = crypto.createHash('sha256').update('csa_test_key_b').digest('hex');
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockImplementation((_col: string, hash: string) => ({
              eq: vi.fn().mockImplementation(() => {
                if (hash === hashA) {
                  return Promise.resolve({ data: [mockState.daasSubscriberA], error: null });
                }
                if (hash === hashB) {
                  return Promise.resolve({ data: [mockState.daasSubscriberB], error: null });
                }
                return Promise.resolve({ data: [], error: null });
              }),
            })),
          }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        };
      }
      if (table === 'analysis_history') {
        const chain: Record<string, unknown> = {};
        chain.select = vi.fn().mockReturnValue(chain);
        chain.gte = vi.fn().mockReturnValue(chain);
        chain.eq = vi.fn().mockReturnValue(chain);
        chain.then = (resolve: (val: unknown) => void) =>
          Promise.resolve({ data: mockState.analysisRows, error: null }).then(resolve);
        return chain;
      }
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            then: (resolve: (val: unknown) => void) =>
              Promise.resolve({ data: [], error: null }).then(resolve),
          }),
          then: (resolve: (val: unknown) => void) =>
            Promise.resolve({ data: [], error: null }).then(resolve),
        }),
        insert: vi.fn().mockResolvedValue({ data: null, error: null }),
      };
    }),
  },
}));

describe('P3-T2: DaaS Subscriber Rate Limit, Real Metrics & Outbound Webhooks (S2)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockState.analysisRows = [];
  });

  it('enforces per-subscriber rateLimitPerMinute (HTTP 429) without blocking distinct subscribers', async () => {
    const { default: daasRoutes } = await import('../../server/src/routes/daasRoutes');
    const app = express();
    app.use('/api/v1/daas', daasRoutes);

    const r1 = await request(app)
      .get('/api/v1/daas/benchmarks/pricing?domain=pyme')
      .set('X-API-Key', 'csa_test_key_a');
    expect(r1.status).toBe(200);
    expect(r1.headers['x-ratelimit-limit']).toBe('2');
    expect(r1.headers['x-ratelimit-remaining']).toBe('1');

    const r2 = await request(app)
      .get('/api/v1/daas/benchmarks/pricing?domain=pyme')
      .set('X-API-Key', 'csa_test_key_a');
    expect(r2.status).toBe(200);
    expect(r2.headers['x-ratelimit-remaining']).toBe('0');

    const r3 = await request(app)
      .get('/api/v1/daas/benchmarks/pricing?domain=pyme')
      .set('X-API-Key', 'csa_test_key_a');
    expect(r3.status).toBe(429);
    expect(r3.body.error).toMatch(/rate limit/i);
    expect(r3.headers['retry-after']).toBeDefined();

    const rB = await request(app)
      .get('/api/v1/daas/benchmarks/pricing?domain=pyme')
      .set('X-API-Key', 'csa_test_key_b');
    expect(rB.status).toBe(200);
  });

  it('computes soldCount (SOLD & ACCEPTED) and real totalPremium in analyticsAggregationService fallback', async () => {
    const { analyticsAggregationService } =
      await import('../../server/src/services/analyticsAggregationService');

    mockState.analysisRows = [
      {
        id: 'a1',
        domain: 'pyme',
        total_score: 78,
        metadata: { status: 'ACCEPTED', selectedPremium: 4200000 },
        analysis_result: { quotes: [{ insurerName: 'SURA', priceAnnual: 4200000, score: 78 }] },
      },
      {
        id: 'a2',
        domain: 'autos',
        total_score: 91,
        metadata: { status: 'SOLD' },
        unified_result: {
          quotes: [
            { insurerName: 'BOLIVAR', priceAnnual: 3100000, score: 80 },
            { insurerName: 'ALLIANZ', priceAnnual: 2800000, score: 91 },
          ],
        },
      },
      {
        id: 'a3',
        domain: 'pyme',
        total_score: 60,
        metadata: { status: 'DRAFT' },
        analysis_result: { quotes: [{ insurerName: 'MAPFRE', priceAnnual: 5000000, score: 60 }] },
      },
    ];

    const summary = await analyticsAggregationService.getExecutiveAnalytics(
      { id: 'user-1', role: 'ally_technical' },
      30
    );

    expect(summary.totalComparisons).toBe(3);
    expect(summary.soldCount).toBe(2);
    expect(summary.conversionRate).toBe(67);
    expect(summary.totalPremium).toBe(7000000);
  });

  it('validates webhook URLs against SSRF, signs payloads with HMAC-SHA256, and retries transient failures', async () => {
    const { validateWebhookUrl, signWebhookPayload, dispatchWebhookWithRetry } =
      await import('../../server/src/services/webhookService');

    expect(() => validateWebhookUrl('https://hooks.partner.com/csa')).not.toThrow();
    expect(() => validateWebhookUrl('http://127.0.0.1:8080/hook')).toThrow();
    expect(() => validateWebhookUrl('http://localhost:3000/hook')).toThrow();
    expect(() => validateWebhookUrl('http://169.254.169.254/latest/meta-data')).toThrow();
    expect(() => validateWebhookUrl('http://10.0.0.5/internal')).toThrow();
    expect(() => validateWebhookUrl('ftp://hooks.partner.com/csa')).toThrow();

    const payload = JSON.stringify({ event: 'analysis.completed', id: 'an-1' });
    const secret = 'whsec_test_secret_123';
    const sig = signWebhookPayload(payload, secret);
    const expected = 'sha256=' + crypto.createHmac('sha256', secret).update(payload).digest('hex');
    expect(sig).toBe(expected);

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 503 })
      .mockResolvedValueOnce({ ok: true, status: 200 });

    const delivery = await dispatchWebhookWithRetry(
      {
        url: 'https://hooks.partner.com/csa',
        secret,
        event: 'analysis.completed',
        eventId: 'evt-1',
        data: { analysisId: 'an-1' },
      },
      { fetchFn: fetchMock as unknown as typeof fetch, maxAttempts: 3, baseDelayMs: 1 }
    );

    expect(delivery.delivered).toBe(true);
    expect(delivery.attempts).toBe(2);
    expect(delivery.statusCode).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('ships migration 037 with RLS-protected webhook tables and real totalPremium SQL aggregation', () => {
    const migrationPath = path.resolve(
      __dirname,
      '../../supabase/migrations/20261123000037_daas_rate_metrics_webhooks.sql'
    );
    const sql = fs.readFileSync(migrationPath, 'utf-8');

    expect(sql).toContain('CREATE TABLE IF NOT EXISTS public.webhook_subscriptions');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS public.webhook_deliveries');
    expect(sql).toContain('ENABLE ROW LEVEL SECURITY');
    expect(sql).toContain('FORCE ROW LEVEL SECURITY');
    expect(sql).toContain('extract_analysis_sold_premium');
    expect(sql).toContain("IN ('SOLD', 'ACCEPTED')");
  });
});
