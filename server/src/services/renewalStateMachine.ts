/**
 * Renewal Lifecycle State Machine (renovacion-polizas PR-4, task 1.16)
 *
 * Design Q2 (obs #117): states detected → notified → in_review → quoted →
 * closed (terminal). A new cycle opens a NEW renewal row, never a reopen.
 *
 * R3.1: every accepted transition yields a plan the repository persists as a
 * renewal_events audit row (from/to/actor/timestamp).
 * R3.2: closing requires an outcome; final_premium is required except when
 * lost; loss_reason is required when lost and forbidden otherwise.
 *
 * This module is pure: no I/O, no clock. Callers (routes, scheduler) supply
 * the current state and the requested input and persist the returned plan.
 */

export const RENEWAL_STATES = ['detected', 'notified', 'in_review', 'quoted', 'closed'] as const;

export type RenewalState = (typeof RENEWAL_STATES)[number];

export const RENEWAL_OUTCOMES = ['renewed_same_insurer', 'renewed_competitor', 'lost'] as const;

export type RenewalOutcome = (typeof RENEWAL_OUTCOMES)[number];

export interface TransitionInput {
  to: RenewalState;
  outcome?: RenewalOutcome | null;
  final_premium?: number | null;
  loss_reason?: string | null;
}

export interface TransitionPatch {
  state: RenewalState;
  outcome?: RenewalOutcome;
  final_premium?: number;
  loss_reason?: string;
}

export interface TransitionPlan {
  from: RenewalState;
  to: RenewalState;
  patch: TransitionPatch;
}

export interface TransitionErrorDetail {
  field: string;
  message: string;
}

export class InvalidTransitionError extends Error {
  readonly details: TransitionErrorDetail[];

  constructor(message: string, details: TransitionErrorDetail[] = []) {
    super(message);
    this.name = 'InvalidTransitionError';
    this.details = details;
  }
}

export function isRenewalState(value: unknown): value is RenewalState {
  return typeof value === 'string' && (RENEWAL_STATES as readonly string[]).includes(value);
}

export function isRenewalOutcome(value: unknown): value is RenewalOutcome {
  return typeof value === 'string' && (RENEWAL_OUTCOMES as readonly string[]).includes(value);
}

/** Adjacent forward edges of the lifecycle; `closed` has none (terminal). */
const ALLOWED_TRANSITIONS: Readonly<Record<RenewalState, readonly RenewalState[]>> = {
  detected: ['notified'],
  notified: ['in_review'],
  in_review: ['quoted'],
  quoted: ['closed'],
  closed: [],
};

function fail(message: string, details: TransitionErrorDetail[]): never {
  throw new InvalidTransitionError(message, details);
}

/**
 * Validates a requested transition against the machine and the R3.2 outcome
 * rules, returning the persistence patch when legal. Pure and total: every
 * illegal combination throws InvalidTransitionError with field details.
 */
export function planTransition(current: RenewalState, input: TransitionInput): TransitionPlan {
  if (!isRenewalState(current)) {
    fail(`Unknown current state: ${String(current)}`, [
      { field: 'from', message: 'unknown renewal state' },
    ]);
  }
  if (!isRenewalState(input.to)) {
    fail(`Unknown target state: ${String(input.to)}`, [
      { field: 'to', message: 'unknown renewal state' },
    ]);
  }

  const allowed = ALLOWED_TRANSITIONS[current];
  if (!allowed.includes(input.to)) {
    const reason =
      current === 'closed'
        ? 'closed is terminal; start a new cycle instead'
        : `allowed from ${current}: ${allowed.join(', ') || 'none'}`;
    fail(`Illegal transition ${current} → ${input.to}: ${reason}`, [
      { field: 'to', message: reason },
    ]);
  }

  const closing = input.to === 'closed';
  const hasOutcomePayload =
    input.outcome != null || input.final_premium != null || input.loss_reason != null;

  if (!closing && hasOutcomePayload) {
    fail('Outcome fields are only valid when closing a renewal', [
      { field: 'outcome', message: 'outcome/final_premium/loss_reason require to=closed' },
    ]);
  }

  if (!closing) {
    return { from: current, to: input.to, patch: { state: input.to } };
  }

  if (!isRenewalOutcome(input.outcome)) {
    fail('Closing a renewal requires a valid outcome', [
      {
        field: 'outcome',
        message: `outcome must be one of: ${RENEWAL_OUTCOMES.join(', ')}`,
      },
    ]);
  }
  const outcome = input.outcome;

  if (outcome === 'lost') {
    const reason = typeof input.loss_reason === 'string' ? input.loss_reason.trim() : '';
    if (reason.length === 0) {
      fail('loss_reason is required when the outcome is lost', [
        { field: 'loss_reason', message: 'required when outcome=lost (R3.2)' },
      ]);
    }
    const patch: TransitionPatch = { state: 'closed', outcome, loss_reason: reason };
    if (input.final_premium != null) {
      patch.final_premium = assertPremium(input.final_premium);
    }
    return { from: current, to: 'closed', patch };
  }

  // renewed_same_insurer | renewed_competitor
  if (input.loss_reason != null) {
    fail('loss_reason is only meaningful when the outcome is lost', [
      { field: 'loss_reason', message: 'forbidden unless outcome=lost' },
    ]);
  }
  if (input.final_premium == null) {
    fail('final_premium is required for a renewed outcome', [
      { field: 'final_premium', message: 'required unless outcome=lost (R3.2)' },
    ]);
  }
  return {
    from: current,
    to: 'closed',
    patch: { state: 'closed', outcome, final_premium: assertPremium(input.final_premium) },
  };
}

function assertPremium(value: number): number {
  if (typeof value !== 'number' || Number.isNaN(value) || value < 0) {
    fail('final_premium must be a non-negative number', [
      { field: 'final_premium', message: 'must be a non-negative number' },
    ]);
  }
  return value;
}
