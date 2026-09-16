import { describe, it, expect } from 'vitest';
import request from 'supertest';
import express from 'express';
import type { Express } from 'express';
import { analyzeRateLimiter, globalRateLimiter, chatRateLimiter } from '../rateLimiter';
import { errorHandler } from '../../middleware/errorHandler';

// config/env.ts validates taxonomy constants at module load; set them before
// the app import in the wiring tests.
process.env.SMMLV_VALUE = process.env.SMMLV_VALUE || '1423500';
process.env.UVT_VALUE = process.env.UVT_VALUE || '42412';

/**
 * SEC-4: rate limiters must return 429 with Retry-After when the window is
 * exceeded, and must actually be mounted on the app (global limiter before
 * the auth gate on /api, stricter limiter on analysis routes, chat limiter
 * on /api/chat).
 */
describe('rateLimiter (SEC-4)', () => {
  describe('429 behavior', () => {
    const app = express();
    app.use('/limited', analyzeRateLimiter);
    app.post('/limited', (_req, res) => res.json({ ok: true }));
    app.use(errorHandler);

    it('serves 10 requests per minute, then rejects with 429 and Retry-After', async () => {
      for (let i = 0; i < 10; i++) {
        const response = await request(app).post('/limited').send({});
        expect(response.status, `request ${i + 1} should be allowed`).toBe(200);
      }

      const blocked = await request(app).post('/limited').send({});
      expect(blocked.status).toBe(429);
      expect(blocked.headers['retry-after']).toBeDefined();
      expect(blocked.body.retryAfter).toBeGreaterThan(0);
      expect(blocked.body.error).toMatch(/rate limit/i);
    });
  });

  describe('app wiring', () => {
    interface Layer {
      route?: { path: string };
      handle?: unknown;
      name?: string;
    }

    it('mounts the global limiter before the auth gate, and specific limiters after it', async () => {
      const { authGate } = await import('../authGate');
      const { app: realApp } = (await import('../../index')) as unknown as { app: Express };
      const stack = (realApp as unknown as { router: { stack: Layer[] } }).router.stack;

      const indexOf = (handle: unknown) => stack.findIndex((l) => l.handle === handle);

      const globalIdx = indexOf(globalRateLimiter);
      const gateIdx = indexOf(authGate);
      const analyzeIdx = indexOf(analyzeRateLimiter);
      const chatIdx = indexOf(chatRateLimiter);

      expect(globalIdx, 'globalRateLimiter must be mounted').toBeGreaterThanOrEqual(0);
      expect(gateIdx, 'authGate must be mounted').toBeGreaterThanOrEqual(0);
      expect(globalIdx, 'global limiter must run before the auth gate').toBeLessThan(gateIdx);

      expect(analyzeIdx, 'analyzeRateLimiter must be mounted').toBeGreaterThan(gateIdx);
      expect(chatIdx, 'chatRateLimiter must be mounted').toBeGreaterThan(gateIdx);
    });

    it('declares the analyze and chat limiters on their router mounts', async () => {
      const { apiRouterMounts } = (await import('../../index')) as unknown as {
        apiRouterMounts: ReadonlyArray<{
          prefix: string;
          middleware?: readonly unknown[];
          router: unknown;
        }>;
      };

      const analysisMount = apiRouterMounts.find((m) => m.prefix === '/api/analysis');
      const chatMount = apiRouterMounts.find((m) => m.prefix === '/api/chat');

      expect(analysisMount?.middleware).toContain(analyzeRateLimiter);
      expect(chatMount?.middleware).toContain(chatRateLimiter);
    });
  });
});
