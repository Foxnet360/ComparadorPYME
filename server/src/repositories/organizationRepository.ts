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
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
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

export async function updateOrganization(
  id: string,
  input: Partial<CreateOrganizationInput> & { status?: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' }
): Promise<OrganizationRecord | null> {
  const payload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (input.name !== undefined) payload.name = input.name;
  if (input.nit !== undefined) payload.nit = input.nit;
  if (input.contact_email !== undefined) payload.contact_email = input.contact_email;
  if (input.phone !== undefined) payload.phone = input.phone;
  if (input.status !== undefined) payload.status = input.status;
  if (input.settings !== undefined) payload.settings = input.settings;

  const { data, error } = await supabase
    .from('organizations' as never)
    .update(payload as never)
    .eq('id', id)
    .select(ORG_COLUMNS)
    .single();

  if (error) {
    handleDbError(error, 'Failed to update organization');
  }

  return data as unknown as OrganizationRecord | null;
}

export async function deleteOrganization(id: string): Promise<boolean> {
  const { error } = await supabase
    .from('organizations' as never)
    .delete()
    .eq('id', id);

  if (error) {
    handleDbError(error, 'Failed to delete organization');
  }

  return true;
}

export async function addOrganizationMember(
  input: AddMemberInput
): Promise<OrganizationMemberRecord | null> {
  const { data, error } = await supabase
    .from('organization_members' as never)
    .upsert(
      {
        org_id: input.org_id,
        user_id: input.user_id,
        role: input.role,
        updated_at: new Date().toISOString(),
      } as never,
      { onConflict: 'org_id,user_id' }
    )
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
  const { data: members, error: memberError } = await supabase
    .from('organization_members' as never)
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1);

  if (memberError || !members || members.length === 0) {
    return null;
  }

  const typedMember = members[0] as unknown as OrganizationMemberRecord;
  const org = await getOrganizationById(typedMember.org_id);
  if (!org) {
    return null;
  }

  return {
    organization: org,
    role: typedMember.role,
  };
}

export async function getOrganizationMember(
  userId: string,
  orgId?: string
): Promise<OrganizationMemberRecord | null> {
  let query = supabase
    .from('organization_members' as never)
    .select(MEMBER_COLUMNS)
    .eq('user_id', userId);

  if (orgId) {
    query = query.eq('org_id', orgId);
  }

  const { data, error } = await query
    .order('created_at', { ascending: false })
    .limit(1);

  if (error || !data || data.length === 0) {
    return null;
  }

  return data[0] as unknown as OrganizationMemberRecord;
}

export async function updateOrganizationMember(
  userId: string,
  updates: {
    role?: 'super_admin' | 'ally_admin' | 'ally_technical';
    status?: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
    org_id?: string;
  },
  currentOrgId?: string
): Promise<OrganizationMemberRecord | null> {
  let query = supabase
    .from('organization_members' as never)
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    } as never)
    .eq('user_id', userId);

  if (currentOrgId) {
    query = query.eq('org_id', currentOrgId);
  }

  const { data, error } = await query.select(MEMBER_COLUMNS).limit(1);

  if (error) {
    handleDbError(error, 'Failed to update organization member');
  }

  return data && data.length > 0 ? (data[0] as unknown as OrganizationMemberRecord) : null;
}

export async function updateAuthUser(
  userId: string,
  updates: {
    name?: string;
    email?: string;
    password?: string;
    role?: string;
    org_id?: string;
    org_name?: string;
    phone?: string;
    status?: string;
  }
): Promise<void> {
  // Fetch existing user to preserve other metadata
  const { data: userData, error: getUserError } = await supabase.auth.admin.getUserById(userId);
  if (getUserError || !userData?.user) {
    throw new Error(getUserError?.message || 'User not found in auth');
  }

  const existing = userData.user;
  const newMetadata: Record<string, unknown> = {
    ...existing.user_metadata,
  };
  const newAppMetadata: Record<string, unknown> = {
    ...existing.app_metadata,
  };

  if (updates.name !== undefined) newMetadata.name = updates.name;
  if (updates.role !== undefined) {
    newMetadata.role = updates.role;
    newAppMetadata.role = updates.role;
  }
  if (updates.org_id !== undefined) {
    newMetadata.org_id = updates.org_id;
    newMetadata.ally_id = updates.org_id;
    newAppMetadata.org_id = updates.org_id;
  }
  if (updates.org_name !== undefined) {
    newMetadata.org_name = updates.org_name;
    newMetadata.intermediary_name = updates.org_name;
  }
  if (updates.phone !== undefined) {
    newMetadata.phone = updates.phone;
  }
  if (updates.status !== undefined) {
    newMetadata.status = updates.status;
    newAppMetadata.status = updates.status;
  }

  const authUpdatePayload: Parameters<typeof supabase.auth.admin.updateUserById>[1] = {
    user_metadata: newMetadata,
    app_metadata: newAppMetadata,
  };

  if (updates.email !== undefined && updates.email !== existing.email) {
    authUpdatePayload.email = updates.email;
  }
  if (updates.password !== undefined && updates.password.trim().length > 0) {
    authUpdatePayload.password = updates.password.trim();
  }
  if (updates.phone !== undefined) {
    authUpdatePayload.phone = updates.phone;
  }

  const { error: updateError } = await supabase.auth.admin.updateUserById(userId, authUpdatePayload);
  if (updateError) {
    throw new Error(`Failed to update auth user: ${updateError.message}`);
  }
}

export async function deleteUserFromAuth(userId: string): Promise<boolean> {
  const { error } = await supabase.auth.admin.deleteUser(userId);
  if (error) {
    throw new Error(`Failed to delete user from auth: ${error.message}`);
  }
  return true;
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
