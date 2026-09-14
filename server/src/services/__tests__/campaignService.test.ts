import { describe, it, expect } from 'vitest';

/**
 * renovacion-polizas PR-4 / task 1.19 — campaign due-window planner.
 * Contract: R4.1 (per-user windows, e.g. 60/30/7 days before end_date),
 * R4.3 (a (renewal, window) pair with an existing delivery is never
 * replanned — insert-first-then-send idempotency starts in the planner).
 *
 * Pure planner: window w is due when 0 <= daysUntil(end_date) <= w and no
 * delivery exists yet for (renewal, String(w)).
 */

import { planDueDeliveries, type CampaignRenewalRef } from '../campaignService';

const TODAY = '2026-09-10';

function renewal(id: string, policyId: string): CampaignRenewalRef {
  return { id, policy_id: policyId, user_id: 'user-a', state: 'detected' };
}

describe('planDueDeliveries (R4.1/R4.3)', () => {
  it('plans every window whose threshold covers the days remaining', () => {
    // 25 days out: inside the 60 and 30 windows, outside the 7 window.
    const due = planDueDeliveries({
      renewals: [renewal('r1', 'p1')],
      policiesById: { p1: { id: 'p1', end_date: '2026-10-05' } },
      windows: [60, 30, 7],
      today: TODAY,
      existingDeliveries: [],
    });

    expect(due).toEqual([
      { renewal_id: 'r1', window_key: '60' },
      { renewal_id: 'r1', window_key: '30' },
    ]);
  });

  it('plans the last-chance window on the expiry day itself', () => {
    const due = planDueDeliveries({
      renewals: [renewal('r1', 'p1')],
      policiesById: { p1: { id: 'p1', end_date: TODAY } },
      windows: [60, 30, 7],
      today: TODAY,
      existingDeliveries: [],
    });

    expect(due).toHaveLength(3);
  });

  it('plans nothing when every window is still far away', () => {
    const due = planDueDeliveries({
      renewals: [renewal('r1', 'p1')],
      policiesById: { p1: { id: 'p1', end_date: '2027-01-01' } },
      windows: [60, 30, 7],
      today: TODAY,
      existingDeliveries: [],
    });

    expect(due).toEqual([]);
  });

  it('plans nothing for an already-expired policy', () => {
    const due = planDueDeliveries({
      renewals: [renewal('r1', 'p1')],
      policiesById: { p1: { id: 'p1', end_date: '2026-09-01' } },
      windows: [60, 30, 7],
      today: TODAY,
      existingDeliveries: [],
    });

    expect(due).toEqual([]);
  });

  it('skips (renewal, window) pairs that already have a delivery (R4.3)', () => {
    const due = planDueDeliveries({
      renewals: [renewal('r1', 'p1')],
      policiesById: { p1: { id: 'p1', end_date: '2026-10-05' } },
      windows: [60, 30, 7],
      today: TODAY,
      existingDeliveries: [{ renewal_id: 'r1', window_key: '60' }],
    });

    expect(due).toEqual([{ renewal_id: 'r1', window_key: '30' }]);
  });

  it('skips renewals whose policy is missing or has no end_date', () => {
    const due = planDueDeliveries({
      renewals: [renewal('r1', 'p-missing'), renewal('r2', 'p2')],
      policiesById: { p2: { id: 'p2', end_date: null } },
      windows: [60],
      today: TODAY,
      existingDeliveries: [],
    });

    expect(due).toEqual([]);
  });

  it('handles multiple renewals across tenants independently', () => {
    const due = planDueDeliveries({
      renewals: [renewal('r1', 'p1'), { ...renewal('r2', 'p2'), user_id: 'user-b' }],
      policiesById: {
        p1: { id: 'p1', end_date: '2026-10-05' },
        p2: { id: 'p2', end_date: '2026-09-12' },
      },
      windows: [30, 7],
      today: TODAY,
      existingDeliveries: [],
    });

    expect(due).toContainEqual({ renewal_id: 'r1', window_key: '30' });
    expect(due).toContainEqual({ renewal_id: 'r2', window_key: '7' });
    expect(due).toHaveLength(3);
  });
});
