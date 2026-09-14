/**
 * Renewal Opportunity Detection Job (renovacion-polizas PR-4, task 1.18)
 *
 * R1.2: scans policies whose end_date falls inside a configurable horizon
 * (default 60 days) and surfaces a renewal opportunity to the policy owner.
 * R3.3: at most one open renewal per (policy, cycle); reruns are idempotent —
 * the planner suppresses known open cycles and the unique partial index is
 * the last line of defense (23505 → counted as conflict, never an error).
 * XC-1: opportunities are tenant-scoped by construction: each renewal row
 * carries the user_id of the policy it was detected from.
 *
 * cycle_start = the policy's end_date: the renewal cycle begins the day the
 * current cycle ends.
 */

import {
  createRenewal,
  listOpenRenewalsForPolicies,
  listPoliciesWithEndDate,
} from '../repositories/renewalRepository';

export interface DetectionPolicy {
  id: string;
  user_id: string;
  end_date: string | null;
}

export interface OpenRenewalRef {
  policy_id: string;
  cycle_start: string;
}

export interface PlannedDetection {
  policy_id: string;
  user_id: string;
  cycle_start: string;
}

export interface DetectionPlanInput {
  policies: DetectionPolicy[];
  openRenewals: OpenRenewalRef[];
  /** ISO date (YYYY-MM-DD) the job runs at. */
  today: string;
  horizonDays: number;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function daysBetween(fromIso: string, toIso: string): number {
  const from = Date.parse(`${fromIso}T00:00:00Z`);
  const to = Date.parse(`${toIso}T00:00:00Z`);
  return Math.round((to - from) / MS_PER_DAY);
}

/**
 * Pure planner: which (policy, cycle) pairs should open a renewal right now.
 * A policy is eligible when its end_date is in [today, today + horizonDays];
 * already-expired policies are excluded (lapsed policies are a separate
 * concern, not a renewal opportunity).
 */
export function planRenewalDetections(input: DetectionPlanInput): PlannedDetection[] {
  const openCycles = new Set(input.openRenewals.map((r) => `${r.policy_id}::${r.cycle_start}`));

  const planned: PlannedDetection[] = [];
  for (const policy of input.policies) {
    if (!policy.end_date) {
      continue;
    }
    const daysUntilEnd = daysBetween(input.today, policy.end_date);
    if (daysUntilEnd < 0 || daysUntilEnd > input.horizonDays) {
      continue;
    }
    if (openCycles.has(`${policy.id}::${policy.end_date}`)) {
      continue;
    }
    planned.push({
      policy_id: policy.id,
      user_id: policy.user_id,
      cycle_start: policy.end_date,
    });
  }
  return planned;
}

export interface DetectionRunResult {
  created: number;
  conflicts: number;
}

/**
 * Job entry point: scan → plan → insert. The insert honors the one-open
 * unique index; a conflict means a concurrent run (or a broker-created row)
 * already opened the cycle, so it is counted and skipped.
 */
export async function runRenewalDetection(options: {
  horizonDays: number;
  today?: string;
}): Promise<DetectionRunResult> {
  const today = options.today ?? new Date().toISOString().slice(0, 10);

  const policies = await listPoliciesWithEndDate();
  const openRenewals = await listOpenRenewalsForPolicies(policies.map((p) => p.id));

  const planned = planRenewalDetections({
    policies,
    openRenewals,
    today,
    horizonDays: options.horizonDays,
  });

  let created = 0;
  let conflicts = 0;
  for (const item of planned) {
    const result = await createRenewal(item.user_id, {
      policy_id: item.policy_id,
      cycle_start: item.cycle_start,
    });
    if (result.kind === 'created') {
      created += 1;
    } else {
      conflicts += 1;
    }
  }
  return { created, conflicts };
}
