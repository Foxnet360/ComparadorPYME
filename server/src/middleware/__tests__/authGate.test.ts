import { describe, it, expect } from 'vitest';
import { isPublicPath } from '../authGate';

/**
 * AUTH-1: the allowlist is matched against the path relative to the /api
 * mount point (e.g. POST /api/analyze arrives here as "/analyze").
 * /health is not under /api, so it never reaches the gate.
 */
describe('isPublicPath (AUTH-1 allowlist semantics)', () => {
  it.each(['/analyze', '/history'])('allows exact public path %s', (path) => {
    expect(isPublicPath(path)).toBe(true);
  });

  it.each(['/comparison', '/comparison/unified', '/clients', '/clients/abc-123'])(
    'allows public prefix %s',
    (path) => {
      expect(isPublicPath(path)).toBe(true);
    }
  );

  it.each(['/analysis/abc-123/export', '/analysis/00000000-0000-0000-0000-000000000000/export'])(
    'allows the parametric export route %s',
    (path) => {
      expect(isPublicPath(path)).toBe(true);
    }
  );

  it.each([
    '/documents',
    '/documents/abc-123',
    '/analysis/correction',
    '/analysis/validate-coverages',
    '/analysis/abc-123/export/extra',
    '/analyze-rag',
    '/chat',
    '/search',
    '/audit/enrich',
    '/templates/registry',
    '/monitoring',
    '/features',
    '/',
  ])('rejects non-allowlisted path %s', (path) => {
    expect(isPublicPath(path)).toBe(false);
  });
});
