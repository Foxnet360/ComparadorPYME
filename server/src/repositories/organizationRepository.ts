/**
 * Organization Repository
 * Database operations for public.organizations and public.organization_members
 */

import { supabase, handleDbError } from './baseRepository';

export interface OrganizationRecord {
  id: string;
  name: string;
  nit: string | null;
  contact_email: string | null;
  phone: string | null;
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  settings: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface OrganizationMemberRecord {
  id: string;
  org_id: string;
  user_id: string;
  role: 'super_admin' | 'ally_admin' | 'ally_technical';
  created_at: string;
  updated_at: string;
}

export interface CreateOrganizationInput {
  name: string;
  nit?: string | null;
  contact_email?: string | null;
  phone?: string | null;
  settings?: Record<string, unknown>;
}

export interface AddMemberInput {
  org_id: string;
  user_id: string;
  role: 'super_admin' | 'ally_admin' | 'ally_technical';
}

const ORG_COLUMNS = '*';
const MEMBER_COLUMNS = '*';

export async function createOrganization(
  input: CreateOrganizationInput
): Promise<OrganizationRecord | null> {
  const payload: Record<string, unknown> = {
    name: input.name,
    status: 'ACTIVE',
    settings: input.settings || {},
  };
  if (input.nit !== undefined) payload.nit = input.nit;
  if (input.contact_email !== undefined) payload.contact_email = input.contact_email;
  if (input.phone !== undefined) payload.phone = input.phone;

  const { data, error } = await supabase
    .from('organizations' as never)
    .insert(payload as never)
    .select(ORG_COLUMNS)
    .single();

  if (error) {
    handleDbError(error, 'Failed to create organization');
  }

  return data as unknown as OrganizationRecord | null;
}

export async function getOrganizationById(id: string): Promise<OrganizationRecord | null> {
  const { data, error } = await supabase
    .from('organizations' as never)
    .select(ORG_COLUMNS)
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    handleDbError(error, 'Failed to fetch organization by id');
  }

  return data as unknown as OrganizationRecord | null;
}

export async function listOrganizations(): Promise<OrganizationRecord[]> {
  const { data, error } = await supabase
    .from('organizations' as never)
    .select(ORG_COLUMNS)
    .order('created_at', { ascending: false });

  if (error) {
    handleDbError(error, 'Failed to list organizations');
  }

  return (data as unknown as OrganizationRecord[]) || [];
}

export async function addOrganizationMember(
  input: AddMemberInput
): Promise<OrganizationMemberRecord | null> {
  const { data, error } = await supabase
    .from('organization_members' as never)
    .insert({
      org_id: input.org_id,
      user_id: input.user_id,
      role: input.role,
    } as never)
    .select(MEMBER_COLUMNS)
    .single();

  if (error) {
    handleDbError(error, 'Failed to add organization member');
  }

  return data as unknown as OrganizationMemberRecord | null;
}

export async function listOrganizationMembers(
  orgId: string
): Promise<OrganizationMemberRecord[]> {
  const { data, error } = await supabase
    .from('organization_members' as never)
    .select(MEMBER_COLUMNS)
    .eq('org_id', orgId)
    .order('created_at', { ascending: false });

  if (error) {
    handleDbError(error, 'Failed to list organization members');
  }

  return (data as unknown as OrganizationMemberRecord[]) || [];
}

export async function removeOrganizationMember(
  orgId: string,
  userId: string
): Promise<boolean> {
  const { error } = await supabase
    .from('organization_members' as never)
    .delete()
    .eq('org_id', orgId)
    .eq('user_id', userId);

  if (error) {
    handleDbError(error, 'Failed to remove organization member');
  }

  return true;
}

export async function getUserOrganization(
  userId: string
): Promise<{ organization: OrganizationRecord; role: string } | null> {
  const { data: member, error: memberError } = await supabase
    .from('organization_members' as never)
    .select('*')
    .eq('user_id', userId)
    .single();

  if (memberError || !member) {
    return null;
  }

  const typedMember = member as unknown as OrganizationMemberRecord;
  const org = await getOrganizationById(typedMember.org_id);
  if (!org) {
    return null;
  }

  return {
    organization: org,
    role: typedMember.role,
  };
}

export interface DirectoryMemberRecord {
  id: string;
  user_id: string;
  email: string;
  name: string;
  role: 'super_admin' | 'ally_admin' | 'ally_technical';
  org_id: string;
  org_name: string;
  status: string;
  created_at: string;
}

export async function getOrganizationDirectory(): Promise<DirectoryMemberRecord[]> {
  const { data, error } = await supabase.rpc('get_organization_directory');
  if (error) {
    handleDbError(error, 'Failed to fetch organization directory');
  }
  return (data as unknown as DirectoryMemberRecord[]) || [];
}
