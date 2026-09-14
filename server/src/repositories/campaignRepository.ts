/**
 * Campaign Repository (renovacion-polizas PR-4, tasks 1.19/1.20)
 * Database operations for `campaign_configs` + `campaign_deliveries`.
 *
 * R4.1: per-user configs (windows + enabled), keyed by user_id.
 * R4.3: insertDelivery maps the UNIQUE(renewal_id, window_key) violation
 * (23505) to a domain conflict — the core of insert-first-then-send
 * idempotency.
 * AUTH-2: session-scoped functions take the session userId; the
 * system-job reads (listEnabledCampaignConfigs, listDeliveriesForRenewals)
 * are scheduler-only and never called from routes.
 */

import { supabase, handleDbError } from './baseRepository';

export interface CampaignConfigRecord {
  user_id: string;
  windows: number[];
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export type DeliveryStatus = 'pending' | 'sent' | 'skipped';

export interface CampaignDeliveryRecord {
  id: string;
  renewal_id: string;
  window_key: string;
  channel: string;
  status: DeliveryStatus;
  sent_at: string | null;
  created_at: string;
}

const COLUMNS = '*';
const UNIQUE_VIOLATION = '23505';

export const DEFAULT_CAMPAIGN_WINDOWS: readonly number[] = [60, 30, 7];

export async function getCampaignConfig(userId: string): Promise<CampaignConfigRecord | null> {
  const { data, error } = await supabase
    .from('campaign_configs' as never)
    .select(COLUMNS)
    .eq('user_id', userId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    handleDbError(error, 'Failed to fetch campaign config');
  }
  return data as unknown as CampaignConfigRecord | null;
}

/**
 * Upsert by primary key: update-first so an existing row keeps created_at;
 * when nothing matched, insert. (Single-owner row — last writer wins.)
 */
export async function saveCampaignConfig(
  userId: string,
  input: { windows: number[]; enabled: boolean }
): Promise<CampaignConfigRecord> {
  const { data: updated, error: updateError } = await supabase
    .from('campaign_configs' as never)
    .update({
      windows: input.windows,
      enabled: input.enabled,
      updated_at: new Date().toISOString(),
    } as never)
    .eq('user_id', userId)
    .select(COLUMNS);

  if (updateError) {
    handleDbError(updateError, 'Failed to update campaign config');
  }
  const updatedRows = (updated as unknown as CampaignConfigRecord[]) || [];
  if (updatedRows.length > 0 && updatedRows[0]) {
    return updatedRows[0];
  }

  const { data: inserted, error: insertError } = await supabase
    .from('campaign_configs' as never)
    .insert({ user_id: userId, windows: input.windows, enabled: input.enabled } as never)
    .select(COLUMNS)
    .single();

  if (insertError) {
    handleDbError(insertError, 'Failed to create campaign config');
  }
  return inserted as unknown as CampaignConfigRecord;
}

/** Scheduler-only: every tenant config with campaigns enabled. */
export async function listEnabledCampaignConfigs(): Promise<CampaignConfigRecord[]> {
  const { data, error } = await supabase
    .from('campaign_configs' as never)
    .select(COLUMNS)
    .eq('enabled', true);

  if (error) {
    handleDbError(error, 'Failed to list enabled campaign configs');
  }
  return (data as unknown as CampaignConfigRecord[]) || [];
}

export type InsertDeliveryResult =
  | { kind: 'created'; delivery: CampaignDeliveryRecord }
  | { kind: 'conflict' };

/**
 * R4.3 insert-first: claiming the (renewal, window) pair BEFORE sending. A
 * 23505 means the pair was already claimed (by a prior tick, a concurrent
 * leader, or a manual action) and MUST NOT be sent again.
 */
export async function insertDelivery(input: {
  renewal_id: string;
  window_key: string;
  channel?: string;
  status?: DeliveryStatus;
}): Promise<InsertDeliveryResult> {
  const { data, error } = await supabase
    .from('campaign_deliveries' as never)
    .insert({
      renewal_id: input.renewal_id,
      window_key: input.window_key,
      channel: input.channel ?? 'email',
      status: input.status ?? 'pending',
    } as never)
    .select(COLUMNS)
    .single();

  if (error) {
    if (error.code === UNIQUE_VIOLATION) {
      return { kind: 'conflict' };
    }
    handleDbError(error, 'Failed to insert campaign delivery');
  }
  return { kind: 'created', delivery: data as unknown as CampaignDeliveryRecord };
}

export async function getDelivery(
  renewalId: string,
  windowKey: string
): Promise<CampaignDeliveryRecord | null> {
  const { data, error } = await supabase
    .from('campaign_deliveries' as never)
    .select(COLUMNS)
    .eq('renewal_id', renewalId)
    .eq('window_key', windowKey)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    handleDbError(error, 'Failed to fetch campaign delivery');
  }
  return data as unknown as CampaignDeliveryRecord | null;
}

/** Scheduler-only: existing deliveries for a batch of renewals. */
export async function listDeliveriesForRenewals(
  renewalIds: string[]
): Promise<Array<{ renewal_id: string; window_key: string }>> {
  if (renewalIds.length === 0) {
    return [];
  }
  const { data, error } = await supabase
    .from('campaign_deliveries' as never)
    .select('renewal_id, window_key')
    .in('renewal_id', renewalIds);

  if (error) {
    handleDbError(error, 'Failed to list campaign deliveries');
  }
  return (data as unknown as Array<{ renewal_id: string; window_key: string }>) || [];
}

export async function markDeliverySent(id: string): Promise<void> {
  const { error } = await supabase
    .from('campaign_deliveries' as never)
    .update({ status: 'sent', sent_at: new Date().toISOString() } as never)
    .eq('id', id);

  if (error) {
    handleDbError(error, 'Failed to mark campaign delivery sent');
  }
}

/**
 * R4.2 reschedule support: releases the (renewal, window) pair so the next
 * scheduler tick plans it again. Only non-sent deliveries may be removed;
 * the route enforces that rule before calling.
 */
export async function deleteDelivery(renewalId: string, windowKey: string): Promise<void> {
  const { error } = await supabase
    .from('campaign_deliveries' as never)
    .delete()
    .eq('renewal_id', renewalId)
    .eq('window_key', windowKey);

  if (error) {
    handleDbError(error, 'Failed to delete campaign delivery');
  }
}
