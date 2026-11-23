import fs from 'fs';
import path from 'path';
import request from 'supertest';
import { describe, it, expect, beforeAll } from 'vitest';
import type { Express } from 'express';
import { isPublicPath } from '../../server/src/middleware/authGate';

process.env.SMMLV_VALUE = process.env.SMMLV_VALUE || '1423500';
process.env.UVT_VALUE = process.env.UVT_VALUE || '42412';

let app: Express;
let apiRouterMounts: ReadonlyArray<{ prefix: string }>;

beforeAll(async () => {
  const mod = (await import('../../server/src/index')) as unknown as {
    app: Express;
    apiRouterMounts: ReadonlyArray<{ prefix: string }>;
  };
  app = mod.app;
  apiRouterMounts = mod.apiRouterMounts;
});

describe('P3-T1: API Versioning (/api/v1/*) & Unified OpenAPI 3.0.3 (S1)', () => {
  it('normalizes /v1 prefixes in authGate while keeping /v1/daas and protected routes fail-closed', () => {
    expect(isPublicPath('/v1/documents', 'GET')).toBe(true);
    expect(isPublicPath('/v1/insurers', 'GET')).toBe(true);
    expect(isPublicPath('/v1/openapi.json', 'GET')).toBe(true);
    expect(isPublicPath('/openapi.json', 'GET')).toBe(true);
    expect(isPublicPath('/v1/daas/benchmarks/pricing', 'GET')).toBe(true);

    expect(isPublicPath('/v1/documents', 'POST')).toBe(false);
    expect(isPublicPath('/v1/insurers', 'POST')).toBe(false);
    expect(isPublicPath('/v1/clients', 'GET')).toBe(false);
    expect(isPublicPath('/v1/analyze', 'POST')).toBe(false);
    expect(isPublicPath('/v1/analysis/correction', 'POST')).toBe(false);
  });

  it('mounts both /api/* and /api/v1/* router prefixes in apiRouterMounts and protects /api/v1/* routes with 401', async () => {
    const prefixes = apiRouterMounts.map((m) => m.prefix);
    expect(prefixes).toContain('/api/clients');
    expect(prefixes).toContain('/api/v1/clients');
    expect(prefixes).toContain('/api/v1/policies');
    expect(prefixes).toContain('/api/v1/analysis');
    expect(prefixes).toContain('/api/v1/analytics');
    expect(prefixes).toContain('/api/v1/daas');

    const unauthClients = await request(app).get('/api/v1/clients');
    expect(unauthClients.status).toBe(401);

    const unauthAnalyze = await request(app).post('/api/v1/analyze').send({});
    expect(unauthAnalyze.status).toBe(401);
  });

  it('serves unified OpenAPI 3.0.3 spec on GET /api/v1/openapi.json and GET /api/openapi.json', async () => {
    const v1Res = await request(app).get('/api/v1/openapi.json');
    expect(v1Res.status).toBe(200);
    expect(v1Res.body.openapi).toMatch(/^3\.0\./);
    expect(v1Res.body.paths['/api/v1/analyze']).toBeDefined();
    expect(v1Res.body.paths['/api/v1/clients']).toBeDefined();
    expect(v1Res.body.paths['/api/v1/daas/benchmarks/pricing']).toBeDefined();
    expect(v1Res.body.paths['/api/v1/daas/subscriber/status']).toBeDefined();
    expect(v1Res.body.components?.securitySchemes?.BearerAuth).toBeDefined();
    expect(v1Res.body.components?.securitySchemes?.ApiKeyAuth).toBeDefined();

    const legacyRes = await request(app).get('/api/openapi.json');
    expect(legacyRes.status).toBe(200);
    expect(legacyRes.body.info?.version).toBe(v1Res.body.info?.version);
  });

  it('keeps docs/openapi.yaml and docs/daas-openapi.yaml aligned with real endpoints and { success, data } envelopes', () => {
    const repoRoot = path.resolve(__dirname, '../..');
    const unifiedYaml = fs.readFileSync(path.join(repoRoot, 'docs/openapi.yaml'), 'utf-8');
    const daasYaml = fs.readFileSync(path.join(repoRoot, 'docs/daas-openapi.yaml'), 'utf-8');

    expect(unifiedYaml).toContain('openapi: 3.0.3');
    expect(unifiedYaml).toContain('/api/v1/analyze:');
    expect(unifiedYaml).toContain('/api/v1/daas/benchmarks/pricing:');
    expect(unifiedYaml).toContain('/api/v1/daas/subscriber/status:');

    expect(daasYaml).toContain('/subscriber/status:');
    expect(daasYaml).toContain('success:');
    expect(daasYaml).toContain('rateLimitPerMinute:');
    expect(daasYaml).toContain('X-RateLimit-Limit');
  });
});
