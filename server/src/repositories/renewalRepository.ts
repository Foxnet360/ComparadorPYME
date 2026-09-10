/**
 * Renewal Repository (renovacion-polizas PR-4, task 1.16)
 * Database operations for `renewals` + `renewal_events`.
 *
 * AUTH-2: every operation is scoped by the session-derived userId argument;
 * ownership is never taken from the client.
 * R3.1: applyTransition persists the state change AND the audit event
 * (from/to/actor/timestamp) so the lifecycle is fully traceable.
 * R3.3: createRenewal maps the one-open-per-(policy, cycle) unique partial
 * index violation (23505) to a domain conflict instead of throwing.
 */

import { supabase, handleDbError } from './baseRepository';
import type { RenewalOutcome, RenewalState, TransitionPlan } from '../services/renewalStateMachine';

export interface RenewalRecord {
  id: string;
  user_id: string;
  org_id: string | null;
  policy_id: string;
  cycle_start: string;
  state: RenewalState;
  outcome: RenewalOutcome | null;
  final_premium: number | null;
  loss_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface RenewalEventRecord {
  id: string;
  renewal_id: string;
  from_state: RenewalState | null;
  to_state: RenewalState;
  actor_id: string | null;
  payload: Record<string, unknown>;
  created_at: string;
}

const COLUMNS = '*';

/** Postgres unique_violation — raised by the one-open-per-cycle index. */
const UNIQUE_VIOLATION = '23505';

export type CreateRenewalResult =
  | { kind: 'created'; renewal: RenewalRecord }
  | { kind: 'conflict' };

export async function listRenewals(userId: string, state?: RenewalState): Promise<RenewalRecord[]> {
  let query = supabase
    .from('renewals' as never)
    .select(COLUMNS)
    .eq('user_id', userId)
    .order('cycle_start', { ascending: true });
  if (state) {
    query = (query as unknown as { eq: (c: string, v: unknown) => typeof query }).eq(
      'state',
      state
    );
  }

  const { data, error } = await query;
  if (error) {
    handleDbError(error, 'Failed to list renewals');
  }
  return (data as unknown as RenewalRecord[]) || [];
}

export async function getRenewalById(userId: string, id: string): Promise<RenewalRecord | null> {
  const { data, error } = await supabase
    .from('renewals' as never)
    .select(COLUMNS)
    .eq('id', id)
    .eq('user_id', userId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    handleDbError(error, 'Failed to fetch renewal by id');
  }
  return data as unknown as RenewalRecord | null;
}

/**
 * R3.3: inserts an open renewal for (policy, cycle). The unique partial index
 * guarantees at most one open row; a violation means the cycle is already
 * tracked and is reported as a conflict, not an error.
 */
export async function createRenewal(
  userId: string,
  input: { policy_id: string; cycle_start: string }
): Promise<CreateRenewalResult> {
  const { data, error } = await supabase
    .from('renewals' as never)
    .insert({
      user_id: userId,
      policy_id: input.policy_id,
      cycle_start: input.cycle_start,
      state: 'detected',
    } as never)
    .select(COLUMNS)
    .single();

  if (error) {
    if (error.code === UNIQUE_VIOLATION) {
      return { kind: 'conflict' };
    }
    handleDbError(error, 'Failed to create renewal');
  }
  return { kind: 'created', renewal: data as unknown as RenewalRecord };
}

/**
 * R3.1: applies a validated transition plan to an owned renewal and appends
 * the audit event. Returns null when the renewal is missing or not owned —
 * no event is written in that case (no existence leak, no orphan audit).
 */
export async function applyTransition(
  userId: string,
  renewalId: string,
  plan: TransitionPlan,
  actorId: string
): Promise<RenewalRecord | null> {
  const patch: Record<string, unknown> = {
    state: plan.patch.state,
    updated_at: new Date().toISOString(),
  };
  if (plan.patch.outcome !== undefined) patch.outcome = plan.patch.outcome;
  if (plan.patch.final_premium !== undefined) patch.final_premium = plan.patch.final_premium;
  if (plan.patch.loss_reason !== undefined) patch.loss_reason = plan.patch.loss_reason;

  const { data, error } = await supabase
    .from('renewals' as never)
    .update(patch as never)
    .eq('id', renewalId)
    .eq('user_id', userId)
    .select(COLUMNS)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    handleDbError(error, 'Failed to apply renewal transition');
  }

  const eventPayload: Record<string, unknown> = {};
  if (plan.patch.outcome !== undefined) eventPayload.outcome = plan.patch.outcome;
  if (plan.patch.final_premium !== undefined) eventPayload.final_premium = plan.patch.final_premium;
  if (plan.patch.loss_reason !== undefined) eventPayload.loss_reason = plan.patch.loss_reason;

  const { error: eventError } = await supabase.from('renewal_events' as never).insert({
    renewal_id: renewalId,
    from_state: plan.from,
    to_state: plan.to,
    actor_id: actorId,
    payload: eventPayload,
  } as never);

  if (eventError) {
    handleDbError(eventError, 'Failed to record renewal event');
  }

  return data as unknown as RenewalRecord;
}

export async function listRenewalEvents(renewalId: string): Promise<RenewalEventRecord[]> {
  const { data, error } = await supabase
    .from('renewal_events' as never)
    .select(COLUMNS)
    .eq('renewal_id', renewalId)
    .order('created_at', { ascending: true });

  if (error) {
    handleDbError(error, 'Failed to list renewal events');
  }
  return (data as unknown as RenewalEventRecord[]) || [];
}
