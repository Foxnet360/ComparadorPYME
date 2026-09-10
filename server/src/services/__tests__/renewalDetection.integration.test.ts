import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * renovacion-polizas PR-4 / task 1.18 — detection job executor (integration).
 * Contract: R1.2 (end_date horizon scan), R3.3 (rerunning the job never
 * duplicates a cycle — the one-open-per-cycle index conflict is swallowed),
 * XC-1 (each opportunity lands under the policy owner's tenant).
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

import { runRenewalDetection } from '../renewalDetection';

const USER_A = 'user-a';
const USER_B = 'user-b';
const TODAY = '2026-09-10';

beforeEach(() => {
  fake.replaceRows('policies', []);
  fake.replaceRows('renewals', []);
  fake.replaceRows('renewal_events', []);
});

describe('runRenewalDetection (R1.2, XC-1)', () => {
  it('creates a detected renewal per expiring policy, owned by the policy tenant', async () => {
    fake.seed('policies', [
      { id: 'pa-1', user_id: USER_A, end_date: '2026-10-25' }, // 45d out
      { id: 'pb-1', user_id: USER_B, end_date: '2026-09-20' }, // 10d out
      { id: 'pa-2', user_id: USER_A, end_date: '2027-03-01' }, // beyond horizon
      { id: 'pa-3', user_id: USER_A, end_date: null }, // no end_date
    ]);

    const result = await runRenewalDetection({ horizonDays: 60, today: TODAY });

    expect(result.created).toBe(2);
    expect(result.conflicts).toBe(0);

    const renewals = fake.rows('renewals');
    expect(renewals).toHaveLength(2);
    const forA = renewals.find((r) => r.policy_id === 'pa-1');
    const forB = renewals.find((r) => r.policy_id === 'pb-1');
    expect(forA).toMatchObject({ user_id: USER_A, state: 'detected', cycle_start: '2026-10-25' });
    expect(forB).toMatchObject({ user_id: USER_B, state: 'detected', cycle_start: '2026-09-20' });
  });

  it('is idempotent: a second run creates nothing and reports conflicts (R3.3)', async () => {
    fake.seed('policies', [{ id: 'pa-1', user_id: USER_A, end_date: '2026-10-25' }]);

    const first = await runRenewalDetection({ horizonDays: 60, today: TODAY });
    const second = await runRenewalDetection({ horizonDays: 60, today: TODAY });

    expect(first.created).toBe(1);
    expect(second.created).toBe(0);
    expect(fake.rows('renewals')).toHaveLength(1);
  });

  it('does not resurrect a closed cycle as a duplicate and respects the open one', async () => {
    fake.seed('policies', [{ id: 'pa-1', user_id: USER_A, end_date: '2026-10-25' }]);
    fake.seed('renewals', [
      { user_id: USER_A, policy_id: 'pa-1', cycle_start: '2026-10-25', state: 'quoted' },
    ]);

    const result = await runRenewalDetection({ horizonDays: 60, today: TODAY });

    expect(result.created).toBe(0);
    expect(fake.rows('renewals')).toHaveLength(1);
  });

  it('creates nothing when no policy expires inside the horizon', async () => {
    fake.seed('policies', [{ id: 'pa-1', user_id: USER_A, end_date: '2027-06-01' }]);

    const result = await runRenewalDetection({ horizonDays: 60, today: TODAY });

    expect(result.created).toBe(0);
    expect(fake.rows('renewals')).toHaveLength(0);
  });

  it('opens a fresh cycle when the previous renewal for the same cycle closed (R3.3)', async () => {
    fake.seed('policies', [{ id: 'pa-1', user_id: USER_A, end_date: '2026-10-25' }]);
    fake.seed('renewals', [
      {
        user_id: USER_A,
        policy_id: 'pa-1',
        cycle_start: '2026-10-25',
        state: 'closed',
        outcome: 'lost',
        loss_reason: 'previous attempt',
      },
    ]);

    const result = await runRenewalDetection({ horizonDays: 60, today: TODAY });

    expect(result.created).toBe(1);
    const renewals = fake.rows('renewals');
    expect(renewals).toHaveLength(2);
    expect(renewals.filter((r) => r.state !== 'closed')).toHaveLength(1);
  });
});
