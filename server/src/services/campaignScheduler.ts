/**
 * Campaign Scheduler (renovacion-polizas PR-4, task 1.19)
 *
 * Design Q3: node-cron server job with DB advisory-lock leader election.
 * - Guarded entry: nothing schedules unless CAMPAIGN_SCHEDULER_ENABLED=true,
 *   and a second start returns the live instance (no double registration).
 * - Leader election: every tick tries the advisory lock; only the winner
 *   runs, and the lock is always released (finally) so a crashed tick never
 *   wedges the schedule.
 * - The tick itself is idempotent via campaign_deliveries
 *   UNIQUE(renewal_id, window_key) — insert-first-then-send (R4.3).
 */

import cron from 'node-cron';
import { supabase, handleDbError } from '../repositories/baseRepository';
import { runCampaignTick } from './campaignService';

export interface SchedulerLock {
  acquire(): Promise<boolean>;
  release(): Promise<void>;
}

export interface CampaignSchedulerHandle {
  stop(): void;
}

interface CronTaskLike {
  stop(): void;
}

export interface CampaignSchedulerDeps {
  enabled: boolean;
  /** node-cron expression, e.g. '0 6 * * *'. */
  schedule: string;
  tick: () => Promise<unknown>;
  lock: SchedulerLock;
  /** Injectable for tests; defaults to node-cron. */
  scheduleFn?: (expression: string, fn: () => Promise<void>) => CronTaskLike;
}

export function createCampaignScheduler(
  deps: CampaignSchedulerDeps
): CampaignSchedulerHandle | null {
  if (!deps.enabled) {
    return null;
  }
  const scheduleFn =
    deps.scheduleFn ??
    ((expression: string, fn: () => Promise<void>) => cron.schedule(expression, fn));

  const task = scheduleFn(deps.schedule, async () => {
    const acquired = await deps.lock.acquire();
    if (!acquired) {
      return;
    }
    try {
      await deps.tick();
    } finally {
      await deps.lock.release();
    }
  });

  return { stop: () => task.stop() };
}

/** Stable advisory-lock key for the campaign scheduler (arbitrary constant). */
const CAMPAIGN_LOCK_KEY = 727401;

/**
 * Production leader lock: per-tick Postgres advisory lock via the migration
 * 027 RPC functions (service-role only). Non-blocking — losers skip the tick.
 */
export function createSupabaseAdvisoryLock(lockKey: number = CAMPAIGN_LOCK_KEY): SchedulerLock {
  return {
    async acquire() {
      const { data, error } = await supabase.rpc(
        'try_acquire_campaign_lock' as never,
        {
          lock_key: lockKey,
        } as never
      );
      if (error) {
        handleDbError(error, 'Failed to acquire campaign scheduler lock');
      }
      return data === true;
    },
    async release() {
      const { error } = await supabase.rpc(
        'release_campaign_lock' as never,
        {
          lock_key: lockKey,
        } as never
      );
      if (error) {
        handleDbError(error, 'Failed to release campaign scheduler lock');
      }
    },
  };
}

let activeScheduler: CampaignSchedulerHandle | null = null;

/**
 * Guarded entry point, called once from server bootstrap. Disabled by
 * default; enable with CAMPAIGN_SCHEDULER_ENABLED=true. The cron expression
 * can be overridden with CAMPAIGN_SCHEDULER_CRON (default: daily 06:00).
 */
export function startCampaignScheduler(
  env: NodeJS.ProcessEnv = process.env
): CampaignSchedulerHandle | null {
  if (activeScheduler) {
    return activeScheduler;
  }
  const scheduler = createCampaignScheduler({
    enabled: env.CAMPAIGN_SCHEDULER_ENABLED === 'true',
    schedule: env.CAMPAIGN_SCHEDULER_CRON || '0 6 * * *',
    tick: () => runCampaignTick({}),
    lock: createSupabaseAdvisoryLock(),
  });
  activeScheduler = scheduler;
  if (scheduler) {
    console.log('🕐 [campaignScheduler] started with advisory-lock leader election');
  }
  return scheduler;
}
