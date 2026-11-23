import express from 'express';
import request from 'supertest';
import { describe, it, expect, beforeEach } from 'vitest';

describe('P3-T4: Backend Async PDF Analysis Job Queue, Polling, SSE & Cancellation (S4)', () => {
  beforeEach(async () => {
    const { analysisJobQueue } = await import('../../server/src/services/analysisJobQueue');
    analysisJobQueue._resetForTests();
  });

  it('tracks job lifecycle queued -> parsing -> matching -> completed, enforces tenant ownership, and cleans up resources', async () => {
    const { analysisJobQueue } = await import('../../server/src/services/analysisJobQueue');
    let cleaned = false;

    const job = await analysisJobQueue.enqueueJob(
      { userId: 'owner-1', orgId: 'org-1' },
      async (ctx) => {
        await ctx.reportProgress('parsing', 30, 'Extrayendo PDF...');
        await ctx.reportProgress('matching', 75, 'Normalizando coberturas...');
        return { quotes: [{ insurerName: 'SURA', priceAnnual: 4500000 }], timestamp: 'now' };
      },
      () => {
        cleaned = true;
      }
    );

    expect(job.jobId).toBeTruthy();

    // Poll until completed
    let latest = await analysisJobQueue.getJob(job.jobId, 'owner-1', 'ally_technical', 'org-1');
    for (let i = 0; i < 20 && latest?.stage !== 'completed'; i++) {
      await new Promise((r) => setTimeout(r, 15));
      latest = await analysisJobQueue.getJob(job.jobId, 'owner-1', 'ally_technical', 'org-1');
    }

    expect(latest?.stage).toBe('completed');
    expect(latest?.progress).toBe(100);
    expect((latest?.result as { quotes?: unknown[] })?.quotes).toHaveLength(1);
    expect(cleaned).toBe(true);

    // Foreign tenant cannot access job (null -> 404 in route)
    const foreign = await analysisJobQueue.getJob(
      job.jobId,
      'attacker-2',
      'ally_technical',
      'org-2'
    );
    expect(foreign).toBeNull();
  });

  it('cancels an active job, aborts AbortSignal, invokes cleanup, and returns 404/200 over analysis routes', async () => {
    const { analysisJobQueue } = await import('../../server/src/services/analysisJobQueue');
    const { default: analysisRoutes } = await import('../../server/src/routes/analysis');

    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      (req as unknown as { user: { id: string; orgId: string; role: string } }).user = {
        id: 'user-cancel-1',
        orgId: 'org-cancel-1',
        role: 'ally_technical',
      };
      next();
    });
    app.use('/api/v1/analysis', analysisRoutes);

    let abortedObserved = false;
    let cleanedUp = false;

    const job = await analysisJobQueue.enqueueJob(
      { userId: 'user-cancel-1', orgId: 'org-cancel-1' },
      async (ctx) => {
        ctx.signal.addEventListener('abort', () => {
          abortedObserved = true;
        });
        await new Promise((resolve) => {
          const timer = setTimeout(resolve, 2000);
          ctx.signal.addEventListener(
            'abort',
            () => {
              clearTimeout(timer);
              resolve(undefined);
            },
            { once: true }
          );
        });
        return { cancelled: true };
      },
      () => {
        cleanedUp = true;
      }
    );

    const statusRes = await request(app).get(`/api/v1/analysis/jobs/${job.jobId}`);
    expect(statusRes.status).toBe(200);
    expect(statusRes.body.jobId).toBe(job.jobId);

    const cancelRes = await request(app).post(`/api/v1/analysis/jobs/${job.jobId}/cancel`).send({});
    expect(cancelRes.status).toBe(200);
    expect(cancelRes.body.stage).toBe('cancelled');

    await new Promise((r) => setTimeout(r, 30));
    expect(abortedObserved).toBe(true);
    expect(cleanedUp).toBe(true);

    const missingRes = await request(app).get('/api/v1/analysis/jobs/non-existent-id');
    expect(missingRes.status).toBe(404);
  });

  it('streams real-time SSE progress events until job completion on GET /jobs/:jobId/events', async () => {
    const { analysisJobQueue } = await import('../../server/src/services/analysisJobQueue');
    const { default: analysisRoutes } = await import('../../server/src/routes/analysis');

    const app = express();
    app.use((req, _res, next) => {
      (req as unknown as { user: { id: string; role: string } }).user = {
        id: 'user-sse-1',
        role: 'ally_technical',
      };
      next();
    });
    app.use('/api/v1/analysis', analysisRoutes);

    const job = await analysisJobQueue.enqueueJob({ userId: 'user-sse-1' }, async (ctx) => {
      await new Promise((r) => setTimeout(r, 20));
      await ctx.reportProgress('parsing', 40, 'Extrayendo PDF...');
      await new Promise((r) => setTimeout(r, 20));
      return { quotes: [] };
    });

    const sseRes = await request(app).get(`/api/v1/analysis/jobs/${job.jobId}/events`);
    expect(sseRes.status).toBe(200);
    expect(sseRes.headers['content-type']).toContain('text/event-stream');
    expect(sseRes.text).toContain('event: progress');
    expect(sseRes.text).toContain('"stage":"completed"');
  });

  it('exempts async job status polling and cancel endpoints from analyzeRateLimiter (>10 polls/min)', async () => {
    const { analysisJobQueue } = await import('../../server/src/services/analysisJobQueue');
    const { default: analysisRoutes } = await import('../../server/src/routes/analysis');
    const { analyzeRateLimiter } = await import('../../server/src/middleware/rateLimiter');

    const app = express();
    app.use((req, _res, next) => {
      (req as unknown as { user: { id: string; role: string } }).user = {
        id: 'user-poll-1',
        role: 'ally_technical',
      };
      next();
    });
    app.use('/api/v1/analysis', analyzeRateLimiter, analysisRoutes);

    const job = await analysisJobQueue.enqueueJob({ userId: 'user-poll-1' }, async () => ({
      quotes: [],
    }));

    for (let i = 0; i < 12; i++) {
      const pollRes = await request(app).get(`/api/v1/analysis/jobs/${job.jobId}`);
      expect(pollRes.status).toBe(200);
    }

    const cancelRes = await request(app).post(`/api/v1/analysis/jobs/${job.jobId}/cancel`);
    expect(cancelRes.status).toBe(200);
  });

  it('allows Prefer header on cross-origin CORS preflight OPTIONS /api/analyze', async () => {
    process.env.SMMLV_VALUE = process.env.SMMLV_VALUE || '1423500';
    process.env.UVT_VALUE = process.env.UVT_VALUE || '42412';
    const { app } = (await import('../../server/src/index')) as unknown as { app: express.Express };

    const preflight = await request(app)
      .options('/api/analyze')
      .set('Origin', 'http://localhost:3000')
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'authorization,prefer');

    expect(preflight.status).toBeLessThan(300);
    expect(String(preflight.headers['access-control-allow-headers'] || '')).toMatch(/Prefer/i);
  });
});
