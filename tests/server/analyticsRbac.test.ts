import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express, { type Express } from 'express';
import type { FakeSupabase } from './helpers/fakeSupabase';

const holder = vi.hoisted(() => ({ fake: null as unknown as FakeSupabase }));

vi.mock('../../server/src/config/database', async () => {
  const { createFakeSupabase } = await import('./helpers/fakeSupabase');
  holder.fake = createFakeSupabase();
  return { supabase: holder.fake.client };
});

const fake = holder.fake;

import analyticsRoutes from '../../server/src/routes/analyticsRoutes';
import { authGate } from '../../server/src/middleware/authGate';
import { errorHandler } from '../../server/src/middleware/errorHandler';
import { analyticsAggregationService } from '../../server/src/services/analyticsAggregationService';

function bearerTokenWithClaims(claims: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify(claims)).toString('base64url');
  return `Bearer ${header}.${payload}.test-signature`;
}

const SUPER_ADMIN = 'super-admin-uuid';
const ALLY_ADMIN = 'ally-admin-uuid';
const TECH_USER_1 = 'tech-user-uuid-1';
const TECH_USER_2 = 'tech-user-uuid-2';
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

const techToken1 = bearerTokenWithClaims({
  sub: TECH_USER_1,
  role: 'ally_technical',
  orgId: ORG_1,
  app_metadata: { role: 'ally_technical', org_id: ORG_1 },
  user_metadata: { name: 'Carlos Mendoza', org_id: ORG_1 },
});

function buildApp(): Express {
  const app = express();
  app.use(express.json());
  app.use('/api', authGate);
  app.use('/api/analytics', analyticsRoutes);
  app.use(errorHandler);
  return app;
}

describe('Analytics & DaaS RBAC API', () => {
  const app = buildApp();

  beforeEach(() => {
    fake.replaceRows('organizations', [
      { id: ORG_1, name: 'Correduría Andina S.A.', status: 'ACTIVE' },
      { id: ORG_2, name: 'Alianza Corredores Ltda.', status: 'ACTIVE' },
    ]);

    fake.replaceRows('analysis_history', [
      {
        id: 'hist-1',
        user_id: TECH_USER_1,
        org_id: ORG_1,
        domain: 'pyme',
        client_name: 'Empresa Alpha SAS',
        metadata: { status: 'SOLD' },
        total_score: 90,
        processing_time_ms: 600000,
        created_at: new Date().toISOString(),
        analysis_result: {
          quotes: [
            {
              insurerName: 'SURA',
              priceAnnual: 5000000,
              currency: 'COP',
              coverages: [{ name: 'Amparo Básico Incendio', value: '100M' }],
            },
          ],
        },
      },
      {
        id: 'hist-2',
        user_id: TECH_USER_2,
        org_id: ORG_1,
        domain: 'pyme',
        client_name: 'Empresa Beta Ltda',
        metadata: { status: 'SENT' },
        total_score: 80,
        processing_time_ms: 720000,
        created_at: new Date().toISOString(),
      },
      {
        id: 'hist-3',
        user_id: 'other-user',
        org_id: ORG_2,
        domain: 'autos',
        client_name: 'Flota Gamma',
        metadata: { status: 'LOST' },
        total_score: 60,
        processing_time_ms: 800000,
        created_at: new Date().toISOString(),
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
      {
        id: 'snap-3',
        domain: 'pyme',
        insurer_name: 'CHUBB',
        price_annual: 4800000,
        currency: 'COP',
        period_month: new Date().toISOString().substring(0, 7),
      },
    ]);

    fake.replaceRows('daas_api_usage', []);
  });

  describe('GET /api/analytics/executive', () => {
    it('rejects unauthenticated requests with 401', async () => {
      const res = await request(app).get('/api/analytics/executive');
      expect(res.status).toBe(401);
    });

    it('returns only personal metrics for ally_technical user', async () => {
      const res = await request(app)
        .get('/api/analytics/executive')
        .set('Authorization', techToken1);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.role).toBe('ally_technical');
      // Only hist-1 belongs to TECH_USER_1
      expect(res.body.data.totalComparisons).toBe(1);
      expect(res.body.data.soldCount).toBe(1);
      expect(res.body.data.conversionRate).toBe(100);
      // Technical analysts should NOT see team performance roster
      expect(res.body.data.analystPerformance).toBeUndefined();
    });

    it('returns organization-wide metrics for ally_admin user', async () => {
      const res = await request(app)
        .get('/api/analytics/executive')
        .set('Authorization', allyAdminToken);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.role).toBe('ally_admin');
      // hist-1 and hist-2 belong to ORG_1
      expect(res.body.data.totalComparisons).toBe(2);
      expect(res.body.data.soldCount).toBe(1);
      expect(res.body.data.conversionRate).toBe(50);
      // Admin should receive analyst performance table
      expect(Array.isArray(res.body.data.analystPerformance)).toBe(true);
    });

    it('returns global platform metrics and daasMetrics for super_admin', async () => {
      const res = await request(app)
        .get('/api/analytics/executive')
        .set('Authorization', superAdminToken);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.role).toBe('super_admin');
      // All 3 records across all orgs
      expect(res.body.data.totalComparisons).toBe(3);
      // Super admin receives DaaS metrics telemetry
      expect(res.body.data.daasMetrics).toBeDefined();
    });
  });

  describe('GET /api/analytics/daas/market-index', () => {
    it('forbids ally_technical with 403', async () => {
      const res = await request(app)
        .get('/api/analytics/daas/market-index?domain=pyme')
        .set('Authorization', techToken1);

      expect(res.status).toBe(403);
    });

    it('permits ally_admin and returns market benchmarks', async () => {
      const res = await request(app)
        .get('/api/analytics/daas/market-index?domain=pyme')
        .set('Authorization', allyAdminToken);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.domain).toBe('pyme');
      expect(res.body.data.sampleSize).toBe(3);
      expect(res.body.data.medianPremiumAnnual).toBe(4800000);
      expect(res.body.data.topInsurers.length).toBeGreaterThan(0);
    });
  });

  describe('POST /api/analytics/daas/ingest/:analysisId', () => {
    it('forbids non-super_admin with 403', async () => {
      const res = await request(app)
        .post('/api/analytics/daas/ingest/hist-1')
        .set('Authorization', allyAdminToken);

      expect(res.status).toBe(403);
    });

    it('allows super_admin to trigger ingestion into DaaS snapshots', async () => {
      const res = await request(app)
        .post('/api/analytics/daas/ingest/hist-1')
        .set('Authorization', superAdminToken);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.insertedQuotes).toBe(1);

      const snapshots = fake.rows('daas_market_snapshots');
      const inserted = snapshots.find((s) => s.source_analysis_id === 'hist-1');
      expect(inserted).toBeDefined();
      expect(inserted?.insurer_name).toBe('SURA');
      // Guarantees no client_name PII is persisted in the DaaS snapshot
      expect(inserted).not.toHaveProperty('client_name');
    });
  });

  describe('DaaS Ingestion Worker PII Sanitization', () => {
    it('sanitizes PII and extracts structured quotes correctly', async () => {
      const sample = {
        id: 'hist-pii-test',
        domain: 'autos',
        client_name: 'Juan Perez C.C. 123456789 Placa ABC-123',
        analysis_result: {
          quotes: [
            {
              insurerName: 'Seguros Bolívar',
              priceAnnual: '3,200,000',
              currency: 'COP',
              coverages: [
                {
                  name: 'Pérdida Total Vehículo ABC-123 Juan Perez',
                  value: '80,000,000',
                  deductible: '10%',
                },
              ],
            },
          ],
        },
      };

      const count = await analyticsAggregationService.ingestAnalysisToDaas(sample);
      expect(count).toBe(1);

      const snaps = fake.rows('daas_market_snapshots');
      const snap = snaps.find((s) => s.source_analysis_id === 'hist-pii-test');
      expect(snap).toBeDefined();
      expect(snap?.domain).toBe('autos');
      expect(snap?.price_annual).toBe(3200000);
      expect(snap?.insurer_name).toBe('Seguros Bolívar');
      // No PII in root snapshot object
      expect((snap as any).client_name).toBeUndefined();
    });
  });
});
