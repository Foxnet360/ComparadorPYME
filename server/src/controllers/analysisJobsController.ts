import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import {
  analysisJobEvents,
  analysisJobQueue,
  toPublicSnapshot,
} from '../services/analysisJobQueue';
import { resolveAnalysisUserId } from './analysisHelpers';

/**
 * GET /api/analysis/jobs/:jobId
 */
export const getAnalysisJobStatus = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  const jobId = String(req.params.jobId || '');
  const userId = resolveAnalysisUserId(req) || 'anonymous';
  const job = await analysisJobQueue.getJob(jobId, userId, req.user?.role, req.user?.orgId);
  if (!job) {
    res.status(404).json({ error: 'Not Found', message: 'Análisis asíncrono no encontrado.' });
    return;
  }
  res.json(toPublicSnapshot(job));
};

/**
 * GET /api/analysis/jobs/:jobId/events (SSE)
 */
export const streamAnalysisJobEvents = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  const jobId = String(req.params.jobId || '');
  const userId = resolveAnalysisUserId(req) || 'anonymous';
  const initial = await analysisJobQueue.getJob(jobId, userId, req.user?.role, req.user?.orgId);
  if (!initial) {
    res.status(404).json({ error: 'Not Found', message: 'Análisis asíncrono no encontrado.' });
    return;
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const writeSnapshot = (snapshot: ReturnType<typeof toPublicSnapshot>) => {
    res.write(`event: progress\ndata: ${JSON.stringify(snapshot)}\n\n`);
  };

  writeSnapshot(toPublicSnapshot(initial));

  if (
    initial.stage === 'completed' ||
    initial.stage === 'failed' ||
    initial.stage === 'cancelled'
  ) {
    res.end();
    return;
  }

  const cleanup = () => {
    analysisJobEvents.off(jobId, onUpdate);
  };

  const onUpdate = (snapshot: ReturnType<typeof toPublicSnapshot>) => {
    writeSnapshot(snapshot);
    if (
      snapshot.stage === 'completed' ||
      snapshot.stage === 'failed' ||
      snapshot.stage === 'cancelled'
    ) {
      cleanup();
      res.end();
    }
  };

  analysisJobEvents.on(jobId, onUpdate);
  req.on('close', cleanup);
};

/**
 * POST /api/analysis/jobs/:jobId/cancel
 */
export const cancelAnalysisJob = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  const jobId = String(req.params.jobId || '');
  const userId = resolveAnalysisUserId(req) || 'anonymous';
  const cancelled = await analysisJobQueue.cancelJob(
    jobId,
    userId,
    req.user?.role,
    req.user?.orgId
  );
  if (!cancelled) {
    res.status(404).json({ error: 'Not Found', message: 'Análisis asíncrono no encontrado.' });
    return;
  }
  res.json(toPublicSnapshot(cancelled));
};
