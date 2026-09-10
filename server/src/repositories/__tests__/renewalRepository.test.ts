import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * renovacion-polizas PR-4 / task 1.16 — renewal repository.
 * Contract: R3.1 (every transition persists a renewal_events audit row with
 * from/to/actor/timestamp), AUTH-2 (every read/write is scoped by the
 * session-derived user_id — the fake applies the .eq filters for real).
 */

import type { FakeSupabase } from '../../../../../tests/server/helpers/fakeSupabase';

const holder = vi.hoisted(() => ({ fake: null as unknown as FakeSupabase }));

vi.mock('../../config/database', async () => {
  const { createFakeSupabase } = await import('../../../../../tests/server/helpers/fakeSupabase');
  holder.fake = createFakeSupabase();
  return { supabase: holder.fake.client };
});

const fake = holder.fake;

import {
  listRenewals,
  getRenewalById,
  applyTransition,
  listRenewalEvents,
} from '../renewalRepository';
import { planTransition } from '../../services/renewalStateMachine';

const USER_A = 'user-a';
const USER_B = 'user-b';

function seedRenewal(overrides: Record<string, unknown> = {}): string {
  const row = fake.insertRow('renewals', {
    user_id: USER_A,
    policy_id: 'pol-1',
    cycle_start: '2026-11-01',
    state: 'detected',
    outcome: null,
    final_premium: null,
    loss_reason: null,
    ...overrides,
  });
  return row.id as string;
}

beforeEach(() => {
  fake.replaceRows('renewals', []);
  fake.replaceRows('renewal_events', []);
});

describe('listRenewals', () => {
  it('lists only the session user renewals, optionally filtered by state', async () => {
    fake.seed('renewals', [
      { user_id: USER_A, policy_id: 'p1', cycle_start: '2026-11-01', state: 'detected' },
      { user_id: USER_A, policy_id: 'p2', cycle_start: '2026-12-01', state: 'quoted' },
      { user_id: USER_B, policy_id: 'p3', cycle_start: '2026-11-01', state: 'detected' },
    ]);

    const all = await listRenewals(USER_A);
    expect(all).toHaveLength(2);

    const detectedOnly = await listRenewals(USER_A, 'detected');
    expect(detectedOnly).toHaveLength(1);
    expect(detectedOnly[0].policy_id).toBe('p1');
  });
});

describe('getRenewalById', () => {
  it('returns the renewal when owned, null for another user (no existence leak)', async () => {
    const id = seedRenewal();
    expect((await getRenewalById(USER_A, id))?.id).toBe(id);
    expect(await getRenewalById(USER_B, id)).toBeNull();
  });
});

describe('applyTransition (R3.1 audit)', () => {
  it('updates the renewal and persists the audit event with actor and from→to', async () => {
    const id = seedRenewal();
    const plan = planTransition('detected', { to: 'notified' });

    const updated = await applyTransition(USER_A, id, plan, USER_A);

    expect(updated?.state).toBe('notified');
    const events = fake.rows('renewal_events');
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      renewal_id: id,
      from_state: 'detected',
      to_state: 'notified',
      actor_id: USER_A,
    });
    expect(typeof events[0].created_at).toBe('string');
  });

  it('persists outcome payload when closing as lost', async () => {
    const id = seedRenewal({ state: 'quoted' });
    const plan = planTransition('quoted', {
      to: 'closed',
      outcome: 'lost',
      loss_reason: 'Tomador desapareció',
    });

    const updated = await applyTransition(USER_A, id, plan, USER_A);

    expect(updated?.state).toBe('closed');
    expect(updated?.outcome).toBe('lost');
    expect(updated?.loss_reason).toBe('Tomador desapareció');
    expect(fake.rows('renewal_events')[0].payload).toMatchObject({ outcome: 'lost' });
  });

  it('returns null and writes nothing when the renewal belongs to another user', async () => {
    const id = seedRenewal();
    const plan = planTransition('detected', { to: 'notified' });

    const result = await applyTransition(USER_B, id, plan, USER_B);

    expect(result).toBeNull();
    expect(fake.rows('renewal_events')).toHaveLength(0);
    expect(fake.rows('renewals')[0].state).toBe('detected');
  });
});

describe('listRenewalEvents', () => {
  it('returns the audit trail for a renewal', async () => {
    const id = seedRenewal();
    await applyTransition(USER_A, id, planTransition('detected', { to: 'notified' }), USER_A);
    await applyTransition(USER_A, id, planTransition('notified', { to: 'in_review' }), USER_A);

    const events = await listRenewalEvents(id);
    expect(events.map((e) => `${e.from_state}->${e.to_state}`)).toEqual([
      'detected->notified',
      'notified->in_review',
    ]);
  });
});
