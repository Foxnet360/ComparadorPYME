import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * renovacion-polizas PR-4 / task 1.19 — campaign scheduler (integration).
 * Contract: design Q3 (node-cron guarded entry + DB advisory-lock leader),
 * R4.3 (insert-first-then-send on UNIQUE(renewal_id, window_key): a second
 * tick for the same pair never re-sends), R4.4 (automated scheduling),
 * design Q2 (system fires detected→notified on campaign send, actor 'system').
 */

import type { FakeSupabase } from '../../../../tests/server/helpers/fakeSupabase';

const holder = vi.hoisted(() => ({ fake: null as unknown as FakeSupabase }));

vi.mock('../../config/database', async () => {
  const { createFakeSupabase, RENEWAL_UNIQUE_CONSTRAINTS } =
    await import('../../../../tests/server/helpers/fakeSupabase');
  holder.fake = createFakeSupabase();
  for (const constraint of RENEWAL_UNIQUE_CONSTRAINTS) {
    holder.fake.registerUnique(constraint.table, constraint);
  }
  return { supabase: holder.fake.client };
});

const fake = holder.fake;

import { runCampaignTick, type CampaignNotifier } from '../campaignService';
import { createCampaignScheduler, startCampaignScheduler } from '../campaignScheduler';

const USER_A = 'user-a';
const TODAY = '2026-09-10';

function notifierSpy() {
  const calls: Array<{ renewalId: string; windowKey: string; channel: string }> = [];
  const notifier: CampaignNotifier = {
    async send(input) {
      calls.push({
        renewalId: input.renewalId,
        windowKey: input.windowKey,
        channel: input.channel,
      });
    },
  };
  return { notifier, calls };
}

function seedExpiringRenewal(overrides: Record<string, unknown> = {}): void {
  fake.seed('policies', [{ id: 'p1', user_id: USER_A, end_date: '2026-10-05' }]);
  fake.seed('renewals', [
    {
      id: 'r1',
      user_id: USER_A,
      policy_id: 'p1',
      cycle_start: '2026-10-05',
      state: 'detected',
      ...overrides,
    },
  ]);
  fake.seed('campaign_configs', [{ user_id: USER_A, windows: [30, 7], enabled: true }]);
}

beforeEach(() => {
  fake.replaceRows('policies', []);
  fake.replaceRows('renewals', []);
  fake.replaceRows('renewal_events', []);
  fake.replaceRows('campaign_configs', []);
  fake.replaceRows('campaign_deliveries', []);
});

describe('runCampaignTick (R4.3/R4.4)', () => {
  it('inserts the delivery first, then sends, then marks it sent', async () => {
    seedExpiringRenewal();
    const { notifier, calls } = notifierSpy();

    const result = await runCampaignTick({ today: TODAY, notifier });

    expect(result.sent).toBe(1); // only the 30d window is due (25 days out)
    expect(calls).toEqual([{ renewalId: 'r1', windowKey: '30', channel: 'email' }]);
    const delivery = fake.rows('campaign_deliveries')[0];
    expect(delivery).toMatchObject({ renewal_id: 'r1', window_key: '30', status: 'sent' });
    expect(typeof delivery.sent_at).toBe('string');
  });

  it('is idempotent: a second tick never re-sends the same (renewal, window)', async () => {
    seedExpiringRenewal();
    const { notifier, calls } = notifierSpy();

    await runCampaignTick({ today: TODAY, notifier });
    const second = await runCampaignTick({ today: TODAY, notifier });

    expect(second.sent).toBe(0);
    expect(calls).toHaveLength(1);
    expect(fake.rows('campaign_deliveries')).toHaveLength(1);
  });

  it('fires detected → notified with actor system on the first send (design Q2)', async () => {
    seedExpiringRenewal();
    const { notifier } = notifierSpy();

    const result = await runCampaignTick({ today: TODAY, notifier });

    expect(result.transitioned).toBe(1);
    expect(fake.rows('renewals')[0].state).toBe('notified');
    expect(fake.rows('renewal_events')[0]).toMatchObject({
      renewal_id: 'r1',
      from_state: 'detected',
      to_state: 'notified',
      actor_id: 'system',
    });
  });

  it('sends without re-transitioning a renewal already past detected', async () => {
    seedExpiringRenewal({ state: 'in_review' });
    const { notifier, calls } = notifierSpy();

    const result = await runCampaignTick({ today: TODAY, notifier });

    expect(result.sent).toBe(1);
    expect(result.transitioned).toBe(0);
    expect(calls).toHaveLength(1);
    expect(fake.rows('renewals')[0].state).toBe('in_review');
    expect(fake.rows('renewal_events')).toHaveLength(0);
  });

  it('does not send for closed renewals or disabled configs', async () => {
    seedExpiringRenewal({ state: 'closed', outcome: 'lost', loss_reason: 'x' });
    // Open but not due: expires in 2027, outside the [30,7] windows.
    fake.seed('policies', [{ id: 'p3', user_id: USER_A, end_date: '2027-10-05' }]);
    fake.seed('renewals', [
      { id: 'r2', user_id: USER_A, policy_id: 'p3', cycle_start: '2027-10-05', state: 'detected' },
    ]);
    // Due but disabled config (user B).
    fake.seed('policies', [{ id: 'p2', user_id: 'user-b', end_date: '2026-10-05' }]);
    fake.seed('renewals', [
      {
        id: 'r3',
        user_id: 'user-b',
        policy_id: 'p2',
        cycle_start: '2026-10-05',
        state: 'detected',
      },
    ]);
    fake.seed('campaign_configs', [{ user_id: 'user-b', windows: [30], enabled: false }]);
    const { notifier, calls } = notifierSpy();

    const result = await runCampaignTick({ today: TODAY, notifier });

    expect(result.sent).toBe(0);
    expect(calls).toHaveLength(0);
    expect(fake.rows('campaign_deliveries')).toHaveLength(0);
  });
});

describe('campaignScheduler guarded entry + leader election (design Q3)', () => {
  it('returns null and schedules nothing when disabled', () => {
    const scheduleFn = vi.fn();
    const scheduler = createCampaignScheduler({
      enabled: false,
      schedule: '* * * * *',
      tick: async () => {},
      lock: { acquire: async () => true, release: async () => {} },
      scheduleFn,
    });

    expect(scheduler).toBeNull();
    expect(scheduleFn).not.toHaveBeenCalled();
  });

  it('runs the tick only when the advisory lock is acquired (leader)', async () => {
    const fired: Array<() => Promise<void>> = [];
    const scheduleFn = vi.fn((_expr: string, fn: () => Promise<void>) => {
      fired.push(fn);
      return { stop: () => {} };
    });
    const tick = vi.fn(async () => {});
    const lock = { acquire: vi.fn(async () => true), release: vi.fn(async () => {}) };

    const scheduler = createCampaignScheduler({
      enabled: true,
      schedule: '* * * * *',
      tick,
      lock,
      scheduleFn,
    });

    expect(scheduler).not.toBeNull();
    expect(scheduleFn).toHaveBeenCalledTimes(1);

    await fired[0]();
    expect(lock.acquire).toHaveBeenCalledTimes(1);
    expect(tick).toHaveBeenCalledTimes(1);
    expect(lock.release).toHaveBeenCalledTimes(1);

    scheduler?.stop();
  });

  it('skips the tick when another instance holds the lock', async () => {
    const fired: Array<() => Promise<void>> = [];
    const scheduleFn = vi.fn((_expr: string, fn: () => Promise<void>) => {
      fired.push(fn);
      return { stop: () => {} };
    });
    const tick = vi.fn(async () => {});
    const lock = { acquire: vi.fn(async () => false), release: vi.fn(async () => {}) };

    createCampaignScheduler({
      enabled: true,
      schedule: '* * * * *',
      tick,
      lock,
      scheduleFn,
    });

    await fired[0]();
    expect(tick).not.toHaveBeenCalled();
    expect(lock.release).not.toHaveBeenCalled();
  });

  it('releases the lock even when the tick throws', async () => {
    const fired: Array<() => Promise<void>> = [];
    const scheduleFn = vi.fn((_expr: string, fn: () => Promise<void>) => {
      fired.push(fn);
      return { stop: () => {} };
    });
    const lock = { acquire: vi.fn(async () => true), release: vi.fn(async () => {}) };

    createCampaignScheduler({
      enabled: true,
      schedule: '* * * * *',
      tick: async () => {
        throw new Error('boom');
      },
      lock,
      scheduleFn,
    });

    await expect(fired[0]()).rejects.toThrow('boom');
    expect(lock.release).toHaveBeenCalledTimes(1);
  });

  it('startCampaignScheduler is a no-op unless CAMPAIGN_SCHEDULER_ENABLED=true', () => {
    expect(startCampaignScheduler({} as NodeJS.ProcessEnv)).toBeNull();
    expect(
      startCampaignScheduler({ CAMPAIGN_SCHEDULER_ENABLED: 'false' } as NodeJS.ProcessEnv)
    ).toBeNull();
  });
});
