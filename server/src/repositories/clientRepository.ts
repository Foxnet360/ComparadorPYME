/**
 * Client Repository
 * Database operations for the clients table (renovacion-polizas PR-1).
 *
 * AUTH-2: ownership comes ONLY from the session-derived `userId` argument.
 * Client-supplied user_id / userId / org_id / id in payloads is never
 * honored. R1.4: persistence is whitelisted — extraneous fields are stripped.
 */

import { supabase, handleDbError } from './baseRepository';

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
  input: CreateClientInput
): Promise<ClientRecord | null> {
  const payload: Record<string, unknown> = { user_id: userId, name: input.name };
  if (input.tax_id !== undefined) payload.tax_id = input.tax_id;
  if (input.contact !== undefined) payload.contact = input.contact;

  const { data, error } = await supabase
    .from('clients' as never)
    .insert(payload as never)
    .select(CLIENT_COLUMNS)
    .single();

  if (error) {
    handleDbError(error, 'Failed to create client');
  }

  return data as unknown as ClientRecord | null;
}

export async function listClients(userId: string): Promise<ClientRecord[]> {
  const { data, error } = await supabase
    .from('clients' as never)
    .select(CLIENT_COLUMNS)
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    handleDbError(error, 'Failed to list clients');
  }

  return (data as unknown as ClientRecord[]) || [];
}

export async function getClientById(userId: string, id: string): Promise<ClientRecord | null> {
  const { data, error } = await supabase
    .from('clients' as never)
    .select(CLIENT_COLUMNS)
    .eq('id', id)
    .eq('user_id', userId)
    .single();

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
  input: UpdateClientInput
): Promise<ClientRecord | null> {
  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.name !== undefined) payload.name = input.name;
  if (input.tax_id !== undefined) payload.tax_id = input.tax_id;
  if (input.contact !== undefined) payload.contact = input.contact;

  const { data, error } = await supabase
    .from('clients' as never)
    .update(payload as never)
    .eq('id', id)
    .eq('user_id', userId)
    .select(CLIENT_COLUMNS)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    handleDbError(error, 'Failed to update client');
  }

  return data as unknown as ClientRecord | null;
}

export async function deleteClient(userId: string, id: string): Promise<boolean> {
  const { error } = await supabase
    .from('clients' as never)
    .delete()
    .eq('id', id)
    .eq('user_id', userId);

  if (error) {
    handleDbError(error, 'Failed to delete client');
  }

  return true;
}
