import { describe, it, expect } from 'vitest';
import { isPublicPath } from '../authGate';

/**
 * AUTH-1: the allowlist is matched against the path relative to the /api
 * mount point (e.g. POST /api/analyze arrives here as "/analyze").
 * /health is not under /api, so it never reaches the gate.
 */
describe('isPublicPath (AUTH-1 allowlist semantics - Production Hardened)', () => {
  it.each(['/v1/daas', '/v1/daas/quotes', '/v1/daas/market-index'])('allows DaaS prefix %s', (path) => {
    expect(isPublicPath(path)).toBe(true);
  });

  it('allows public GET routes for insurers and documents', () => {
    expect(isPublicPath('/insurers', 'GET')).toBe(true);
    expect(isPublicPath('/documents', 'GET')).toBe(true);
    expect(isPublicPath('/documents/abc-123', 'GET')).toBe(true);
  });

  it('rejects POST/PUT/DELETE for insurers and documents without auth', () => {
    expect(isPublicPath('/insurers', 'POST')).toBe(false);
    expect(isPublicPath('/documents', 'POST')).toBe(false);
  });

  it.each([
    '/analyze',
    '/history',
    '/audit/enrich',
    '/comparison',
    '/comparison/unified',
    '/analysis/abc-123/export',
    '/analysis/00000000-0000-0000-0000-000000000000/export',
    '/analysis/correction',
    '/analysis/validate-coverages',
    '/analyze-rag',
    '/chat',
    '/search',
    '/templates/registry',
    '/monitoring',
    '/features',
    '/clients',
    '/clients/abc-123',
    '/policies',
    '/policies/abc-123',
    '/policies/promote',
    '/',
  ])('rejects secured core path %s', (path) => {
    expect(isPublicPath(path)).toBe(false);
  });
});
