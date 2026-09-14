import { describe, it, expect } from 'vitest';

/**
 * renovacion-polizas PR-4 / task 1.18 — renewal opportunity detection planner.
 * Contract: R1.2 (policies with end_date within a configurable horizon surface
 * a renewal opportunity), R3.3 (at most one open renewal per policy cycle),
 * XC-1 (opportunities are tenant-scoped: the plan carries the policy owner).
 *
 * Pure planner: dates in, planned detections out. cycle_start = the policy's
 * end_date (the renewal cycle begins when the current cycle ends).
 */

import { planRenewalDetections, type DetectionPolicy } from '../renewalDetection';

const TODAY = '2026-09-10';

function policy(id: string, endDate: string | null, userId = 'user-a'): DetectionPolicy {
  return { id, user_id: userId, end_date: endDate };
}

describe('planRenewalDetections (R1.2)', () => {
  it('plans a renewal for a policy expiring inside the horizon', () => {
    const planned = planRenewalDetections({
      policies: [policy('p1', '2026-10-25')], // 45 days out
      openRenewals: [],
      today: TODAY,
      horizonDays: 60,
    });

    expect(planned).toEqual([{ policy_id: 'p1', user_id: 'user-a', cycle_start: '2026-10-25' }]);
  });

  it('includes a policy expiring exactly at the horizon boundary', () => {
    const planned = planRenewalDetections({
      policies: [policy('p1', '2026-11-09')], // exactly 60 days out
      openRenewals: [],
      today: TODAY,
      horizonDays: 60,
    });
    expect(planned).toHaveLength(1);
  });

  it('excludes policies expiring beyond the horizon', () => {
    const planned = planRenewalDetections({
      policies: [policy('p1', '2027-03-01')],
      openRenewals: [],
      today: TODAY,
      horizonDays: 60,
    });
    expect(planned).toEqual([]);
  });

  it('excludes policies without an end_date', () => {
    const planned = planRenewalDetections({
      policies: [policy('p1', null)],
      openRenewals: [],
      today: TODAY,
      horizonDays: 60,
    });
    expect(planned).toEqual([]);
  });

  it('excludes already-expired policies (lapsed is a different concern)', () => {
    const planned = planRenewalDetections({
      policies: [policy('p1', '2026-09-01')], // expired 9 days ago
      openRenewals: [],
      today: TODAY,
      horizonDays: 60,
    });
    expect(planned).toEqual([]);
  });

  it('suppresses cycles that already have an open renewal (R3.3)', () => {
    const planned = planRenewalDetections({
      policies: [policy('p1', '2026-10-25')],
      openRenewals: [{ policy_id: 'p1', cycle_start: '2026-10-25' }],
      today: TODAY,
      horizonDays: 60,
    });
    expect(planned).toEqual([]);
  });

  it('plans a new cycle when the open renewal belongs to a different cycle', () => {
    const planned = planRenewalDetections({
      policies: [policy('p1', '2026-10-25')],
      openRenewals: [{ policy_id: 'p1', cycle_start: '2025-10-25' }],
      today: TODAY,
      horizonDays: 60,
    });
    expect(planned).toHaveLength(1);
  });

  it('keeps tenant ownership on every planned detection (XC-1)', () => {
    const planned = planRenewalDetections({
      policies: [policy('p1', '2026-10-01', 'user-a'), policy('p2', '2026-09-30', 'user-b')],
      openRenewals: [],
      today: TODAY,
      horizonDays: 60,
    });

    expect(planned).toHaveLength(2);
    expect(planned.find((p) => p.policy_id === 'p1')?.user_id).toBe('user-a');
    expect(planned.find((p) => p.policy_id === 'p2')?.user_id).toBe('user-b');
  });

  it('returns an empty plan when there are no policies', () => {
    expect(
      planRenewalDetections({ policies: [], openRenewals: [], today: TODAY, horizonDays: 60 })
    ).toEqual([]);
  });
});
