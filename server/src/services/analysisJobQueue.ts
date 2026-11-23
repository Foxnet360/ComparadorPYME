import crypto from 'crypto';
import { EventEmitter } from 'events';
import { getCacheValue, setCacheValue } from './cache/redisCache';
import logger from '../config/logger';

export type AnalysisJobStage =
  | 'queued'
  | 'parsing'
  | 'matching'
  | 'auditing'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface AnalysisJobProgressEvent {
  jobId: string;
  stage: AnalysisJobStage;
  progress: number;
  message: string;
  updatedAt: string;
  result?: unknown;
  error?: string;
}

export interface AnalysisJobRecord extends AnalysisJobProgressEvent {
  userId: string;
  orgId?: string | null;
  createdAt: string;
  cancelled: boolean;
}

export interface AnalysisJobOwner {
  userId: string;
  orgId?: string | null;
}

export interface AnalysisJobContext {
  jobId: string;
  signal: AbortSignal;
  reportProgress: (
    stage: Exclude<AnalysisJobStage, 'queued' | 'completed' | 'failed' | 'cancelled'>,
    progress: number,
    message: string
  ) => Promise<void>;
}

const JOB_CACHE_TTL_SECONDS = 3600;
const jobMemoryStore = new Map<string, AnalysisJobRecord>();
const jobControllers = new Map<string, AbortController>();
export const analysisJobEvents = new EventEmitter();
analysisJobEvents.setMaxListeners(100);

function cacheKey(jobId: string): string {
  return `analysis:job:${jobId}`;
}

async function persistJob(record: AnalysisJobRecord): Promise<void> {
  jobMemoryStore.set(record.jobId, record);
  try {
    await setCacheValue(cacheKey(record.jobId), JOB_CACHE_TTL_SECONDS, JSON.stringify(record));
  } catch (err) {
    logger.warn({ err, jobId: record.jobId }, 'Failed to mirror analysis job to Redis cache');
  }
}

async function loadJob(jobId: string): Promise<AnalysisJobRecord | null> {
  const inMemory = jobMemoryStore.get(jobId);
  if (inMemory) {
    return inMemory;
  }
  try {
    const raw = await getCacheValue(cacheKey(jobId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AnalysisJobRecord;
    jobMemoryStore.set(jobId, parsed);
    return parsed;
  } catch {
    return null;
  }
}

function emitJobUpdate(record: AnalysisJobRecord): void {
  analysisJobEvents.emit(record.jobId, toPublicSnapshot(record));
}

export function toPublicSnapshot(record: AnalysisJobRecord): AnalysisJobProgressEvent {
  return {
    jobId: record.jobId,
    stage: record.stage,
    progress: record.progress,
    message: record.message,
    updatedAt: record.updatedAt,
    ...(record.result !== undefined ? { result: record.result } : {}),
    ...(record.error !== undefined ? { error: record.error } : {}),
  };
}

function hasJobAccess(
  record: AnalysisJobRecord,
  callerUserId: string,
  callerRole?: string,
  callerOrgId?: string | null
): boolean {
  if (callerRole === 'super_admin') return true;
  if (record.userId === callerUserId) return true;
  if (callerOrgId && record.orgId && record.orgId === callerOrgId) return true;
  return false;
}

export class AnalysisCancelledError extends Error {
  constructor(message = 'Analysis job cancelled by user') {
    super(message);
    this.name = 'AnalysisCancelledError';
  }
}

export const analysisJobQueue = {
  async enqueueJob(
    owner: AnalysisJobOwner,
    worker: (ctx: AnalysisJobContext) => Promise<unknown>,
    onCleanup?: () => void
  ): Promise<AnalysisJobRecord> {
    const jobId = crypto.randomUUID();
    const now = new Date().toISOString();
    const controller = new AbortController();

    const record: AnalysisJobRecord = {
      jobId,
      userId: owner.userId,
      orgId: owner.orgId ?? null,
      stage: 'queued',
      progress: 5,
      message: 'Análisis en cola...',
      createdAt: now,
      updatedAt: now,
      cancelled: false,
    };

    jobControllers.set(jobId, controller);
    await persistJob(record);
    emitJobUpdate(record);

    const reportProgress: AnalysisJobContext['reportProgress'] = async (
      stage,
      progress,
      message
    ) => {
      const current = await loadJob(jobId);
      if (!current || current.cancelled || controller.signal.aborted) {
        throw new AnalysisCancelledError();
      }
      current.stage = stage;
      current.progress = Math.max(0, Math.min(99, Math.round(progress)));
      current.message = message;
      current.updatedAt = new Date().toISOString();
      await persistJob(current);
      emitJobUpdate(current);
    };

    void (async () => {
      try {
        const result = await worker({
          jobId,
          signal: controller.signal,
          reportProgress,
        });

        const current = await loadJob(jobId);
        if (!current) return;
        if (current.cancelled || controller.signal.aborted) {
          current.stage = 'cancelled';
          current.updatedAt = new Date().toISOString();
          await persistJob(current);
          emitJobUpdate(current);
          return;
        }

        current.stage = 'completed';
        current.progress = 100;
        current.message = 'Análisis completado';
        current.result = result;
        current.updatedAt = new Date().toISOString();
        await persistJob(current);
        emitJobUpdate(current);
      } catch (err) {
        const current = await loadJob(jobId);
        if (!current) return;

        if (
          err instanceof AnalysisCancelledError ||
          current.cancelled ||
          controller.signal.aborted
        ) {
          current.stage = 'cancelled';
          current.message = 'Análisis cancelado por el usuario';
          current.updatedAt = new Date().toISOString();
          await persistJob(current);
          emitJobUpdate(current);
        } else {
          current.stage = 'failed';
          current.error = err instanceof Error ? err.message : 'Error procesando el análisis';
          current.message = current.error;
          current.updatedAt = new Date().toISOString();
          await persistJob(current);
          emitJobUpdate(current);
        }
      } finally {
        jobControllers.delete(jobId);
        if (onCleanup) {
          try {
            onCleanup();
          } catch (cleanupErr) {
            logger.warn({ err: cleanupErr, jobId }, 'Async job cleanup failed');
          }
        }
      }
    })();

    return record;
  },

  async getJob(
    jobId: string,
    callerUserId: string,
    callerRole?: string,
    callerOrgId?: string | null
  ): Promise<AnalysisJobRecord | null> {
    const record = await loadJob(jobId);
    if (!record) return null;
    if (!hasJobAccess(record, callerUserId, callerRole, callerOrgId)) {
      return null;
    }
    return record;
  },

  async cancelJob(
    jobId: string,
    callerUserId: string,
    callerRole?: string,
    callerOrgId?: string | null
  ): Promise<AnalysisJobRecord | null> {
    const record = await loadJob(jobId);
    if (!record) return null;
    if (!hasJobAccess(record, callerUserId, callerRole, callerOrgId)) {
      return null;
    }

    if (record.stage === 'completed' || record.stage === 'failed' || record.stage === 'cancelled') {
      return record;
    }

    record.cancelled = true;
    record.stage = 'cancelled';
    record.message = 'Análisis cancelado por el usuario';
    record.updatedAt = new Date().toISOString();

    const controller = jobControllers.get(jobId);
    if (controller && !controller.signal.aborted) {
      controller.abort();
    }

    await persistJob(record);
    emitJobUpdate(record);
    return record;
  },

  _resetForTests(): void {
    for (const ctrl of jobControllers.values()) {
      ctrl.abort();
    }
    jobControllers.clear();
    jobMemoryStore.clear();
    analysisJobEvents.removeAllListeners();
  },
};
