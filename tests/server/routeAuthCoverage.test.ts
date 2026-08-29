import { describe, it, expect } from 'vitest';
import request from 'supertest';
import type { Express, Router } from 'express';
import { authGate, isPublicPath } from '../../server/src/middleware/authGate';

/**
 * AUTH-1 route-coverage safety net.
 *
 * Walks the REAL Express app (imported without starting the listener —
 * index.ts skips bootstrap when VITEST is set) and proves that every
 * registered /api/* route that is NOT in the public allowlist rejects an
 * anonymous request with 401. The gate runs before any controller, so
 * protected-route handlers are never executed by these requests.
 */

interface RouteEntry {
  method: string;
  path: string;
}

interface RouterLayer {
  route?: { path: string; methods: Record<string, boolean> };
  handle?: unknown;
  name?: string;
}

function collectRouterRoutes(prefix: string, router: Router, out: RouteEntry[]): void {
  const stack = (router as unknown as { stack: RouterLayer[] }).stack;
  for (const layer of stack) {
    if (layer.route) {
      for (const method of Object.keys(layer.route.methods)) {
        out.push({ method: method.toUpperCase(), path: prefix + layer.route.path });
      }
    } else if (layer.name === 'router' && layer.handle) {
      // Nested router: express 5 does not expose the sub-prefix, and this
      // app does not nest routers inside mounted routers. Fail loudly if
      // that ever changes so coverage cannot silently drift.
      throw new Error(`Nested router found under ${prefix}; extend route coverage walker`);
    }
  }
}

// config/env.ts validates taxonomy constants at module load; set them before
// importing the app so the coverage test can run without a full .env.
process.env.SMMLV_VALUE = process.env.SMMLV_VALUE || '1300000';
process.env.UVT_VALUE = process.env.UVT_VALUE || '42412';

const { app, apiRouterMounts } = (await import('../../server/src/index')) as unknown as {
  app: Express;
  apiRouterMounts: ReadonlyArray<{ prefix: string; router: Router }>;
};

function collectAllApiRoutes(): RouteEntry[] {
  const out: RouteEntry[] = [];
  const stack = (app as unknown as { router: { stack: RouterLayer[] } }).router.stack;

  for (const layer of stack) {
    if (layer.route) {
      for (const method of Object.keys(layer.route.methods)) {
        out.push({ method: method.toUpperCase(), path: layer.route.path });
      }
    }
  }

  for (const { prefix, router } of apiRouterMounts) {
    collectRouterRoutes(prefix, router, out);
  }

  return out.filter((entry) => entry.path === '/api' || entry.path.startsWith('/api/'));
}

describe('route auth coverage (AUTH-1)', () => {
  it('mounts the auth gate before every /api route and router', () => {
    const stack = (app as unknown as { router: { stack: RouterLayer[] } }).router.stack;
    const gateIndex = stack.findIndex((layer) => layer.handle === authGate);
    expect(gateIndex, 'authGate must be mounted on the app').toBeGreaterThanOrEqual(0);

    // Nothing that serves /api traffic may be registered before the gate:
    // no route layer with an /api path and no mounted router at all.
    for (const [index, layer] of stack.entries()) {
      if (index >= gateIndex) continue;
      if (layer.route) {
        expect(
          layer.route.path,
          `route ${layer.route.path} is registered before authGate`
        ).not.toMatch(/^\/api/);
      }
      expect(
        layer.name === 'router' && layer.handle !== authGate,
        `a router is mounted before authGate at stack index ${index}`
      ).toBe(false);
    }

    // Every declared router mount must actually be present in the app stack,
    // after the gate.
    for (const { prefix, router } of apiRouterMounts) {
      const mountIndex = stack.findIndex((layer) => layer.handle === router);
      expect(mountIndex, `${prefix} router is not mounted on the app`).toBeGreaterThan(gateIndex);
    }
  });

  it('every non-allowlisted /api route rejects anonymous requests with 401', async () => {
    const routes = collectAllApiRoutes();
    expect(routes.length).toBeGreaterThan(0);

    const protectedRoutes = routes.filter(
      ({ path }) => !isPublicPath(path.replace(/^\/api/, '') || '/')
    );
    // Sanity: the catalog must cover the known protected surface.
    expect(protectedRoutes.map((r) => `${r.method} ${r.path}`)).toEqual(
      expect.arrayContaining([
        'POST /api/documents',
        'GET /api/documents',
        'POST /api/analysis/correction',
        'POST /api/search',
      ])
    );

    for (const { method, path } of protectedRoutes) {
      const url = path.replace(/:[^/]+/g, 'test-id');
      const response = await request(app)
        [method.toLowerCase() as 'get' | 'post' | 'put' | 'delete'](url)
        .send({});
      expect(response.status, `${method} ${path} must reject anonymous requests with 401`).toBe(
        401
      );
    }
  });

  it('allowlisted routes pass the gate without a token (no 401 from the gate)', () => {
    // Classification-only check: the HTTP behavior of allowlisted endpoints
    // is covered by their own route tests. Here we only pin the allowlist.
    const publicPaths = ['/analyze', '/history', '/comparison', '/clients', '/analysis/x/export'];
    for (const path of publicPaths) {
      expect(isPublicPath(path)).toBe(true);
    }
  });
});
