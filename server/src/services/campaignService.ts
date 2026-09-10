/**
 * Campaign Service (renovacion-polizas PR-4, task 1.19)
 *
 * R4.1/R4.4: per-user campaign windows (e.g. 60/30/7 days before end_date),
 * executed by the scheduler tick.
 * R4.3: insert-first-then-send — the delivery row claims the
 * (renewal, window) pair BEFORE the notification goes out; a unique
 * conflict means the pair is already handled and is never re-sent.
 * Design Q2: the first automated send fires detected → notified with
 * actor 'system'.
 *
 * planDueDeliveries is pure; runCampaignTick is the effectful executor.
 */

import {
  listEnabledCampaignConfigs,
  listDeliveriesForRenewals,
  insertDelivery,
  markDeliverySent,
} from '../repositories/campaignRepository';
import { listOpenRenewals, applyTransition } from '../repositories/renewalRepository';
import { listPoliciesByIds } from '../repositories/policyRepository';
import { planTransition, type RenewalState } from './renewalStateMachine';

export interface CampaignRenewalRef {
  id: string;
  user_id: string;
  policy_id: string;
  state: RenewalState;
}

export interface CampaignPolicyRef {
  id: string;
  end_date: string | null;
}

export interface DueDelivery {
  renewal_id: string;
  window_key: string;
}

export interface DuePlanInput {
  renewals: CampaignRenewalRef[];
  policiesById: Record<string, CampaignPolicyRef>;
  windows: number[];
  /** ISO date (YYYY-MM-DD) the tick runs at. */
  today: string;
  existingDeliveries: Array<{ renewal_id: string; window_key: string }>;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function daysBetween(fromIso: string, toIso: string): number {
  return Math.round(
    (Date.parse(`${toIso}T00:00:00Z`) - Date.parse(`${fromIso}T00:00:00Z`)) / MS_PER_DAY
  );
}

/**
 * Pure planner: window w is due for a renewal when the policy expires in
 * [0, w] days and no delivery exists for (renewal, String(w)). Expired
 * policies and missing end_dates produce nothing.
 */
export function planDueDeliveries(input: DuePlanInput): DueDelivery[] {
  const delivered = new Set(
    input.existingDeliveries.map((d) => `${d.renewal_id}::${d.window_key}`)
  );

  const due: DueDelivery[] = [];
  for (const renewal of input.renewals) {
    const policy = input.policiesById[renewal.policy_id];
    if (!policy || !policy.end_date) {
      continue;
    }
    const daysUntilEnd = daysBetween(input.today, policy.end_date);
    if (daysUntilEnd < 0) {
      continue;
    }
    for (const window of [...input.windows].sort((a, b) => b - a)) {
      const windowKey = String(window);
      if (daysUntilEnd <= window && !delivered.has(`${renewal.id}::${windowKey}`)) {
        due.push({ renewal_id: renewal.id, window_key: windowKey });
      }
    }
  }
  return due;
}

/**
 * Delivery boundary. The codebase has no mailer yet, so the default is a
 * structured log line; a real channel plugs in here without touching the
 * idempotency flow.
 */
export interface CampaignNotifier {
  send(input: {
    renewalId: string;
    userId: string;
    windowKey: string;
    channel: string;
  }): Promise<void>;
}

export const consoleNotifier: CampaignNotifier = {
  async send({ renewalId, userId, windowKey, channel }) {
    console.log(
      `📨 [campaign] ${channel} renewal=${renewalId} window=${windowKey}d user=${userId}`
    );
  },
};

export interface CampaignTickResult {
  sent: number;
  conflicts: number;
  transitioned: number;
}

/**
 * One scheduler tick across all tenants with campaigns enabled. Per tenant:
 * plan due windows, claim each (renewal, window) pair, then send. R4.3: a
 * claimed pair is never sent twice, even across overlapping leaders.
 */
export async function runCampaignTick(options: {
  today?: string;
  notifier?: CampaignNotifier;
}): Promise<CampaignTickResult> {
  const today = options.today ?? new Date().toISOString().slice(0, 10);
  const notifier = options.notifier ?? consoleNotifier;

  const result: CampaignTickResult = { sent: 0, conflicts: 0, transitioned: 0 };
  const configs = await listEnabledCampaignConfigs();

  for (const config of configs) {
    const renewals = await listOpenRenewals(config.user_id);
    if (renewals.length === 0) {
      continue;
    }
    const policies = await listPoliciesByIds(renewals.map((r) => r.policy_id));
    const policiesById = Object.fromEntries(policies.map((p) => [p.id, p]));
    const existingDeliveries = await listDeliveriesForRenewals(renewals.map((r) => r.id));

    const due = planDueDeliveries({
      renewals,
      policiesById,
      windows: config.windows,
      today,
      existingDeliveries,
    });

    for (const item of due) {
      const insert = await insertDelivery({
        renewal_id: item.renewal_id,
        window_key: item.window_key,
      });
      if (insert.kind === 'conflict') {
        result.conflicts += 1;
        continue;
      }

      await notifier.send({
        renewalId: item.renewal_id,
        userId: config.user_id,
        windowKey: item.window_key,
        channel: insert.delivery.channel,
      });
      await markDeliverySent(insert.delivery.id);
      result.sent += 1;

      // Design Q2: the first campaign send advances detected → notified.
      const renewal = renewals.find((r) => r.id === item.renewal_id);
      if (renewal && renewal.state === 'detected') {
        const plan = planTransition('detected', { to: 'notified' });
        const transitioned = await applyTransition(config.user_id, renewal.id, plan, 'system');
        if (transitioned) {
          renewal.state = 'notified';
          result.transitioned += 1;
        }
      }
    }
  }

  return result;
}
