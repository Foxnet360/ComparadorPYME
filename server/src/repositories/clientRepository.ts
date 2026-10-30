/**
 * Client Repository
 * Database operations for the clients table (renovacion-polizas PR-1).
 *
 * AUTH-2: ownership comes ONLY from the session-derived `userId` argument.
 * Client-supplied user_id / userId / org_id / id in payloads is never
 * honored. R1.4: persistence is whitelisted — extraneous fields are stripped.
 */

import { supabase, handleDbError } from './baseRepository';
import type { TablesInsert, TablesUpdate, Json } from '../types/database';

export interface ClientContact {
  email?: string;
  phone?: string;
  [key: string]: unknown;
}

export interface ClientRecord {
  id: string;
  user_id: string;
  org_id: string | null;
  name: string;
  tax_id: string | null;
  contact: ClientContact;
  created_at: string;
  updated_at: string;
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

export async function listClients(userId: string, orgId?: string | null): Promise<ClientRecord[]> {
  let query = supabase.from('clients').select(CLIENT_COLUMNS);

  if (orgId) {
    query = query.or(`org_id.eq.${orgId},user_id.eq.${userId}`);
  } else {
    query = query.eq('user_id', userId);
  }

  const { data, error } = await query.order('created_at', { ascending: false });

  if (error) {
    handleDbError(error, 'Failed to list clients');
  }

  return (data as unknown as ClientRecord[]) || [];
}

export async function getClientById(
  userId: string,
  id: string,
  orgId?: string | null
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

  return data as unknown as ClientRecord | null;
}

export async function updateClient(
  userId: string,
  id: string,
  input: UpdateClientInput,
  orgId?: string | null
): Promise<ClientRecord | null> {
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
  orgId?: string | null
): Promise<boolean> {
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
