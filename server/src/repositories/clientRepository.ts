/**
 * Client Repository
 * Database operations for the clients table (renovacion-polizas PR-1).
 *
 * AUTH-2: ownership comes ONLY from the session-derived `userId` argument.
 * Client-supplied user_id / userId / org_id / id in payloads is never
 * honored. R1.4: persistence is whitelisted — extraneous fields are stripped.
 */

import { supabase, handleDbError } from './baseRepository';
import { ForbiddenError } from '../errors';
import type { TablesInsert, TablesUpdate, Json } from '../types/database';

export interface ClientContact {
  email?: string;
  phone?: string;
  [key: string]: unknown;
}

export type LeadStatus = 'nuevo' | 'asignado' | 'en_gestion' | 'cotizado' | 'cerrado' | 'perdido';

export interface ClientRecord {
  id: string;
  user_id: string;
  org_id: string | null;
  name: string;
  tax_id: string | null;
  contact: ClientContact;
  assigned_to?: string | null;
  lead_status?: LeadStatus;
  delegated_by?: string | null;
  delegated_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ClientShareRecord {
  id: string;
  client_id: string;
  org_id: string;
  shared_with_user_id: string;
  shared_by_user_id: string;
  permission: 'view' | 'edit';
  created_at: string;
}

export interface DelegationAuditRecord {
  id: string;
  org_id: string;
  client_id: string;
  actor_user_id: string;
  action: 'delegated' | 'reassigned' | 'shared' | 'unshared' | 'status_changed';
  from_user_id: string | null;
  to_user_id: string | null;
  previous_status: string | null;
  new_status: string | null;
  notes: string | null;
  created_at: string;
}

/** Only these fields may be persisted. No ownership columns. */
export interface CreateClientInput {
  name: string;
  tax_id?: string | null;
  contact?: ClientContact;
}

export interface UpdateClientInput {
  name?: string;
  tax_id?: string | null;
  contact?: ClientContact;
}

const CLIENT_COLUMNS = '*';

export async function createClient(
  userId: string,
  input: CreateClientInput,
  orgId?: string | null
): Promise<ClientRecord | null> {
  const payload: TablesInsert<'clients'> = { user_id: userId, name: input.name };
  if (orgId) payload.org_id = orgId;
  if (input.tax_id !== undefined) payload.tax_id = input.tax_id;
  if (input.contact !== undefined) payload.contact = input.contact as unknown as Json;

  const { data, error } = await supabase
    .from('clients')
    .insert(payload)
    .select(CLIENT_COLUMNS)
    .single();

  if (error) {
    handleDbError(error, 'Failed to create client');
  }

  return data as unknown as ClientRecord | null;
}

async function getSharedClientIds(userId: string): Promise<string[]> {
  try {
    const { data, error } = await supabase
      .from('client_shares' as never)
      .select('client_id')
      .eq('shared_with_user_id', userId);
    if (error || !data) return [];
    return (data as Array<{ client_id: string }>).map((r) => r.client_id);
  } catch {
    return [];
  }
}

export async function listClients(
  userId: string,
  orgId?: string | null,
  role?: string | null
): Promise<ClientRecord[]> {
  const isAdmin = role === 'super_admin' || role === 'ally_admin';

  if (role === 'super_admin' && !orgId) {
    const { data, error } = await supabase
      .from('clients')
      .select(CLIENT_COLUMNS)
      .order('created_at', { ascending: false });
    if (error) handleDbError(error, 'Failed to list clients');
    return (data as unknown as ClientRecord[]) || [];
  }

  if (isAdmin && orgId) {
    const { data, error } = await supabase
      .from('clients')
      .select(CLIENT_COLUMNS)
      .or(`org_id.eq.${orgId},user_id.eq.${userId}`)
      .order('created_at', { ascending: false });
    if (error) handleDbError(error, 'Failed to list clients');
    return (data as unknown as ClientRecord[]) || [];
  }

  // Opción A for ally_technical / standard user:
  // sees clients created by them (not reassigned), assigned to them, or shared with them
  const sharedIds = await getSharedClientIds(userId);
  let query = supabase.from('clients').select(CLIENT_COLUMNS);

  if (sharedIds.length > 0) {
    query = query.or(
      `user_id.eq.${userId},assigned_to.eq.${userId},id.in.(${sharedIds.join(',')})`
    );
  } else if (orgId && !role) {
    // Backward compatibility when role is omitted
    query = query.or(`org_id.eq.${orgId},user_id.eq.${userId}`);
  } else if (orgId) {
    query = query.or(`user_id.eq.${userId},assigned_to.eq.${userId}`);
  } else {
    query = query.eq('user_id', userId);
  }

  const { data, error } = await query.order('created_at', { ascending: false });

  if (error) {
    handleDbError(error, 'Failed to list clients');
  }

  const rows = (data as unknown as ClientRecord[]) || [];
  if (role === 'ally_technical') {
    const sharedSet = new Set(sharedIds);
    return rows.filter(
      (c) =>
        c.assigned_to === userId || sharedSet.has(c.id) || (!c.assigned_to && c.user_id === userId)
    );
  }
  return rows;
}

async function canTechnicalAccessClient(userId: string, client: ClientRecord): Promise<boolean> {
  if (client.assigned_to === userId) return true;
  if (!client.assigned_to && client.user_id === userId) return true;
  const sharedIds = await getSharedClientIds(userId);
  return sharedIds.includes(client.id);
}

export async function getClientById(
  userId: string,
  id: string,
  orgId?: string | null,
  role?: string | null
): Promise<ClientRecord | null> {
  let query = supabase.from('clients').select(CLIENT_COLUMNS).eq('id', id);

  if (orgId) {
    query = query.or(`org_id.eq.${orgId},user_id.eq.${userId}`);
  } else {
    query = query.eq('user_id', userId);
  }

  const { data, error } = await query.single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    handleDbError(error, 'Failed to fetch client by id');
  }

  const record = data as unknown as ClientRecord | null;
  if (record && role === 'ally_technical') {
    const allowed = await canTechnicalAccessClient(userId, record);
    if (!allowed) return null;
  }

  return record;
}

export async function updateClient(
  userId: string,
  id: string,
  input: UpdateClientInput,
  orgId?: string | null,
  role?: string | null
): Promise<ClientRecord | null> {
  if (role === 'ally_technical') {
    const existing = await getClientById(userId, id, orgId, role);
    if (!existing) return null;
  }

  const payload: TablesUpdate<'clients'> = { updated_at: new Date().toISOString() };
  if (input.name !== undefined) payload.name = input.name;
  if (input.tax_id !== undefined) payload.tax_id = input.tax_id;
  if (input.contact !== undefined) payload.contact = input.contact as unknown as Json;

  let query = supabase.from('clients').update(payload).eq('id', id);

  if (orgId) {
    query = query.or(`org_id.eq.${orgId},user_id.eq.${userId}`);
  } else {
    query = query.eq('user_id', userId);
  }

  const { data, error } = await query.select(CLIENT_COLUMNS).single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    handleDbError(error, 'Failed to update client');
  }

  return data as unknown as ClientRecord | null;
}

export async function deleteClient(
  userId: string,
  id: string,
  orgId?: string | null,
  role?: string | null
): Promise<boolean> {
  if (role === 'ally_technical') {
    const existing = await getClientById(userId, id, orgId, role);
    if (!existing) return false;
  }

  let query = supabase.from('clients').delete().eq('id', id);

  if (orgId) {
    query = query.or(`org_id.eq.${orgId},user_id.eq.${userId}`);
  } else {
    query = query.eq('user_id', userId);
  }

  const { error } = await query;

  if (error) {
    handleDbError(error, 'Failed to delete client');
  }

  return true;
}

async function assertUsersBelongToOrg(orgId: string, userIds: string[]): Promise<void> {
  const uniqueIds = Array.from(new Set(userIds.filter(Boolean)));
  if (uniqueIds.length === 0) return;

  const { data, error } = await supabase
    .from('organization_members')
    .select('user_id, status')
    .eq('org_id', orgId)
    .in('user_id', uniqueIds);

  if (error) {
    handleDbError(error, 'Failed to verify organization membership');
  }

  const activeSet = new Set(
    ((data as Array<{ user_id: string; status?: string }>) || [])
      .filter((m) => !m.status || m.status === 'ACTIVE')
      .map((m) => m.user_id)
  );

  const missing = uniqueIds.filter((uid) => !activeSet.has(uid));
  if (missing.length > 0) {
    throw new ForbiddenError('El usuario destino no pertenece activamente a la organización');
  }
}

export async function listClientShares(clientId: string): Promise<ClientShareRecord[]> {
  const { data, error } = await supabase
    .from('client_shares' as never)
    .select('*')
    .eq('client_id', clientId)
    .order('created_at', { ascending: true });
  if (error) handleDbError(error, 'Failed to list client shares');
  return (data as unknown as ClientShareRecord[]) || [];
}

export async function recordDelegationAudit(entry: {
  org_id: string;
  client_id: string;
  actor_user_id: string;
  action: DelegationAuditRecord['action'];
  from_user_id?: string | null;
  to_user_id?: string | null;
  previous_status?: string | null;
  new_status?: string | null;
  notes?: string | null;
}): Promise<void> {
  const { error } = await supabase.from('client_delegation_audit' as never).insert({
    org_id: entry.org_id,
    client_id: entry.client_id,
    actor_user_id: entry.actor_user_id,
    action: entry.action,
    from_user_id: entry.from_user_id ?? null,
    to_user_id: entry.to_user_id ?? null,
    previous_status: entry.previous_status ?? null,
    new_status: entry.new_status ?? null,
    notes: entry.notes ?? null,
  } as never);
  if (error) {
    console.warn('⚠️ [ClientRepository] Failed to record delegation audit:', error.message);
  }
}

export async function shareClientWithUser(params: {
  clientId: string;
  orgId: string;
  sharedWithUserId: string;
  sharedByUserId: string;
  permission?: 'view' | 'edit';
}): Promise<ClientShareRecord> {
  await assertUsersBelongToOrg(params.orgId, [params.sharedWithUserId]);

  const { data, error } = await supabase
    .from('client_shares' as never)
    .upsert(
      {
        client_id: params.clientId,
        org_id: params.orgId,
        shared_with_user_id: params.sharedWithUserId,
        shared_by_user_id: params.sharedByUserId,
        permission: params.permission || 'edit',
      } as never,
      { onConflict: 'client_id,shared_with_user_id' }
    )
    .select('*')
    .single();
  if (error) handleDbError(error, 'Failed to share client');

  await recordDelegationAudit({
    org_id: params.orgId,
    client_id: params.clientId,
    actor_user_id: params.sharedByUserId,
    action: 'shared',
    to_user_id: params.sharedWithUserId,
  });

  return data as unknown as ClientShareRecord;
}

export async function unshareClientWithUser(params: {
  clientId: string;
  orgId: string;
  targetUserId: string;
  actorUserId: string;
}): Promise<void> {
  const { error } = await supabase
    .from('client_shares' as never)
    .delete()
    .eq('client_id', params.clientId)
    .eq('org_id', params.orgId)
    .eq('shared_with_user_id', params.targetUserId);
  if (error) handleDbError(error, 'Failed to unshare client');

  await recordDelegationAudit({
    org_id: params.orgId,
    client_id: params.clientId,
    actor_user_id: params.actorUserId,
    action: 'unshared',
    from_user_id: params.targetUserId,
  });
}

export async function delegateClientToAdvisors(params: {
  clientId: string;
  orgId: string;
  actorUserId: string;
  primaryAdvisorId: string;
  sharedAdvisorIds?: string[];
  notes?: string;
}): Promise<ClientRecord | null> {
  await assertUsersBelongToOrg(params.orgId, [
    params.primaryAdvisorId,
    ...(params.sharedAdvisorIds || []),
  ]);

  const { data: existing } = await supabase
    .from('clients')
    .select('*')
    .eq('id', params.clientId)
    .eq('org_id', params.orgId)
    .single();

  const existingRecord = existing as unknown as ClientRecord | null;
  if (!existingRecord) return null;

  const previousAssignee = existingRecord.assigned_to || null;
  const previousStatus = existingRecord.lead_status || 'nuevo';
  const nextStatus: LeadStatus =
    previousStatus === 'nuevo' ? 'asignado' : (previousStatus as LeadStatus);

  const { data: updated, error } = await supabase
    .from('clients')
    .update({
      assigned_to: params.primaryAdvisorId,
      delegated_by: params.actorUserId,
      delegated_at: new Date().toISOString(),
      lead_status: nextStatus,
      updated_at: new Date().toISOString(),
    } as never)
    .eq('id', params.clientId)
    .eq('org_id', params.orgId)
    .select(CLIENT_COLUMNS)
    .single();

  if (error) handleDbError(error, 'Failed to delegate client');

  await recordDelegationAudit({
    org_id: params.orgId,
    client_id: params.clientId,
    actor_user_id: params.actorUserId,
    action: previousAssignee ? 'reassigned' : 'delegated',
    from_user_id: previousAssignee,
    to_user_id: params.primaryAdvisorId,
    previous_status: previousStatus,
    new_status: nextStatus,
    notes: params.notes || null,
  });

  const extraIds = (params.sharedAdvisorIds || []).filter((id) => id !== params.primaryAdvisorId);
  for (const advisorId of extraIds) {
    await shareClientWithUser({
      clientId: params.clientId,
      orgId: params.orgId,
      sharedWithUserId: advisorId,
      sharedByUserId: params.actorUserId,
      permission: 'edit',
    });
  }

  return updated as unknown as ClientRecord;
}

export async function updateClientLeadStatus(params: {
  clientId: string;
  orgId: string;
  actorUserId: string;
  leadStatus: LeadStatus;
  notes?: string;
  role?: string | null;
}): Promise<ClientRecord | null> {
  if (params.role === 'ally_technical') {
    const allowed = await getClientById(
      params.actorUserId,
      params.clientId,
      params.orgId,
      params.role
    );
    if (!allowed) return null;
  }

  const { data: existing } = await supabase
    .from('clients')
    .select('lead_status')
    .eq('id', params.clientId)
    .eq('org_id', params.orgId)
    .single();
  if (!existing) return null;

  const previousStatus = (existing as { lead_status?: string }).lead_status || 'nuevo';

  const { data: updated, error } = await supabase
    .from('clients')
    .update({
      lead_status: params.leadStatus,
      updated_at: new Date().toISOString(),
    } as never)
    .eq('id', params.clientId)
    .eq('org_id', params.orgId)
    .select(CLIENT_COLUMNS)
    .single();

  if (error) handleDbError(error, 'Failed to update lead status');

  await recordDelegationAudit({
    org_id: params.orgId,
    client_id: params.clientId,
    actor_user_id: params.actorUserId,
    action: 'status_changed',
    previous_status: previousStatus,
    new_status: params.leadStatus,
    notes: params.notes || null,
  });

  return updated as unknown as ClientRecord;
}

export async function listDelegationAudit(params: {
  orgId: string;
  clientId?: string;
  advisorId?: string;
  limit?: number;
}): Promise<DelegationAuditRecord[]> {
  let query = supabase
    .from('client_delegation_audit' as never)
    .select('*')
    .eq('org_id', params.orgId)
    .order('created_at', { ascending: false })
    .limit(params.limit || 100);

  if (params.clientId) {
    query = query.eq('client_id', params.clientId);
  }
  if (params.advisorId) {
    query = query.or(`to_user_id.eq.${params.advisorId},from_user_id.eq.${params.advisorId}`);
  }

  const { data, error } = await query;
  if (error) handleDbError(error, 'Failed to list delegation audit');
  return (data as unknown as DelegationAuditRecord[]) || [];
}

export async function searchOrgClientDirectory(
  orgId: string,
  search: string = ''
): Promise<
  Array<{
    id: string;
    name: string;
    tax_id: string | null;
    lead_status: string;
    assigned_to: string | null;
  }>
> {
  let query = supabase
    .from('clients')
    .select('id, name, tax_id, lead_status, assigned_to')
    .eq('org_id', orgId)
    .order('name', { ascending: true })
    .limit(100);

  if (search.trim()) {
    const sanitizedTerm = search
      .trim()
      .replace(/[,()*\\]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (sanitizedTerm) {
      query = query.or(`name.ilike.%${sanitizedTerm}%,tax_id.ilike.%${sanitizedTerm}%`);
    }
  }

  const { data, error } = await query;
  if (error) handleDbError(error, 'Failed to search organization client directory');
  return (
    (data as unknown as Array<{
      id: string;
      name: string;
      tax_id: string | null;
      lead_status: string;
      assigned_to: string | null;
    }>) || []
  );
}
