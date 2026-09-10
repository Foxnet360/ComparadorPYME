/**
 * Policy Repository
 * Database operations for the policies table (renovacion-polizas PR-1).
 *
 * AUTH-2: ownership comes ONLY from the session-derived `userId` argument.
 * R1.3: provenance ('analysis' | 'incumbent_pdf' | 'manual') is recorded,
 * with an optional source_analysis_id link for promoted quotes.
 * R1.4: persistence is whitelisted — ramo-specific data lives only in the
 * minimized ramo_details jsonb; extraneous top-level fields are stripped.
 */

import { supabase, handleDbError } from './baseRepository';

/** The 10 ramos supported transversally from day one. */
export const POLICY_RAMOS = [
  'autos',
  'pyme',
  'copropiedades',
  'salud',
  'vida_grupo',
  'transporte',
  'casco',
  'equipo',
  'cumplimiento',
  'hogar',
] as const;

export type PolicyRamo = (typeof POLICY_RAMOS)[number];

export type PolicyProvenance = 'analysis' | 'incumbent_pdf' | 'manual';

/** Minimized per-ramo data (R1.4). Shape validated per ramo at the API layer. */
export type RamoDetails = Record<string, unknown>;

export interface PolicyRecord {
  id: string;
  user_id: string;
  org_id: string | null;
  client_id: string;
  ramo: string;
  insurer: string;
  policy_number: string | null;
  premium: number | null;
  start_date: string | null;
  end_date: string | null;
  coverages: unknown[];
  deductibles: unknown[];
  provenance: PolicyProvenance;
  source_analysis_id: string | null;
  ramo_details: RamoDetails;
  created_at: string;
  updated_at: string;
}

/** Only these fields may be persisted. No ownership columns. */
export interface CreatePolicyInput {
  client_id: string;
  ramo: string;
  insurer: string;
  policy_number?: string | null;
  premium?: number | null;
  start_date?: string | null;
  end_date?: string | null;
  coverages?: unknown[];
  deductibles?: unknown[];
  provenance?: PolicyProvenance;
  source_analysis_id?: string | null;
  ramo_details?: RamoDetails;
}

/** client_id and ownership columns are immutable after creation. */
export interface UpdatePolicyInput {
  ramo?: string;
  insurer?: string;
  policy_number?: string | null;
  premium?: number | null;
  start_date?: string | null;
  end_date?: string | null;
  coverages?: unknown[];
  deductibles?: unknown[];
  provenance?: PolicyProvenance;
  source_analysis_id?: string | null;
  ramo_details?: RamoDetails;
}

const POLICY_COLUMNS = '*';

export async function createPolicy(
  userId: string,
  input: CreatePolicyInput
): Promise<PolicyRecord | null> {
  const payload: Record<string, unknown> = {
    user_id: userId,
    client_id: input.client_id,
    ramo: input.ramo,
    insurer: input.insurer,
    provenance: input.provenance ?? 'manual',
  };
  if (input.policy_number !== undefined) payload.policy_number = input.policy_number;
  if (input.premium !== undefined) payload.premium = input.premium;
  if (input.start_date !== undefined) payload.start_date = input.start_date;
  if (input.end_date !== undefined) payload.end_date = input.end_date;
  if (input.coverages !== undefined) payload.coverages = input.coverages;
  if (input.deductibles !== undefined) payload.deductibles = input.deductibles;
  if (input.source_analysis_id !== undefined) payload.source_analysis_id = input.source_analysis_id;
  if (input.ramo_details !== undefined) payload.ramo_details = input.ramo_details;

  const { data, error } = await supabase
    .from('policies' as never)
    .insert(payload as never)
    .select(POLICY_COLUMNS)
    .single();

  if (error) {
    handleDbError(error, 'Failed to create policy');
  }

  return data as unknown as PolicyRecord | null;
}

export async function listPolicies(userId: string): Promise<PolicyRecord[]> {
  const { data, error } = await supabase
    .from('policies' as never)
    .select(POLICY_COLUMNS)
    .eq('user_id', userId)
    .order('end_date', { ascending: true });

  if (error) {
    handleDbError(error, 'Failed to list policies');
  }

  return (data as unknown as PolicyRecord[]) || [];
}

export async function getPolicyById(userId: string, id: string): Promise<PolicyRecord | null> {
  const { data, error } = await supabase
    .from('policies' as never)
    .select(POLICY_COLUMNS)
    .eq('id', id)
    .eq('user_id', userId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    handleDbError(error, 'Failed to fetch policy by id');
  }

  return data as unknown as PolicyRecord | null;
}

export async function updatePolicy(
  userId: string,
  id: string,
  input: UpdatePolicyInput
): Promise<PolicyRecord | null> {
  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.ramo !== undefined) payload.ramo = input.ramo;
  if (input.insurer !== undefined) payload.insurer = input.insurer;
  if (input.policy_number !== undefined) payload.policy_number = input.policy_number;
  if (input.premium !== undefined) payload.premium = input.premium;
  if (input.start_date !== undefined) payload.start_date = input.start_date;
  if (input.end_date !== undefined) payload.end_date = input.end_date;
  if (input.coverages !== undefined) payload.coverages = input.coverages;
  if (input.deductibles !== undefined) payload.deductibles = input.deductibles;
  if (input.provenance !== undefined) payload.provenance = input.provenance;
  if (input.source_analysis_id !== undefined) payload.source_analysis_id = input.source_analysis_id;
  if (input.ramo_details !== undefined) payload.ramo_details = input.ramo_details;

  const { data, error } = await supabase
    .from('policies' as never)
    .update(payload as never)
    .eq('id', id)
    .eq('user_id', userId)
    .select(POLICY_COLUMNS)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    handleDbError(error, 'Failed to update policy');
  }

  return data as unknown as PolicyRecord | null;
}

export async function deletePolicy(userId: string, id: string): Promise<boolean> {
  const { error } = await supabase
    .from('policies' as never)
    .delete()
    .eq('id', id)
    .eq('user_id', userId);

  if (error) {
    handleDbError(error, 'Failed to delete policy');
  }

  return true;
}

/**
 * System-job read for the campaign scheduler (renovacion-polizas PR-4):
 * batch fetch of policies by id. Scheduler-only — routes use the
 * user-scoped accessors above.
 */
export async function listPoliciesByIds(ids: string[]): Promise<PolicyRecord[]> {
  if (ids.length === 0) {
    return [];
  }
  const { data, error } = await supabase
    .from('policies' as never)
    .select(POLICY_COLUMNS)
    .in('id', ids);

  if (error) {
    handleDbError(error, 'Failed to list policies by ids');
  }
  return (data as unknown as PolicyRecord[]) || [];
}
