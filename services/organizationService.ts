/**
 * Organization Service (Frontend)
 * Communicates with /api/organizations endpoints to manage real multi-tenant organizations and members.
 */

import { apiClient } from './apiClient';
import { supabase } from './authService';
import { Ally, UserRole } from '../types';

export interface OrganizationMember {
  id: string;
  org_id: string;
  user_id: string;
  role: UserRole;
  created_at: string;
}

export interface DirectoryUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  allyId: string;
  allyName: string;
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: string;
}

export interface CurrentOrgResponse {
  organization: Ally | null;
  role: UserRole;
  orgId: string | null;
}

export const organizationService = {
  /**
   * Get the current user's organization and assigned role.
   */
  getCurrentOrganization: async (): Promise<CurrentOrgResponse> => {
    try {
      const res = await apiClient.fetch('/api/organizations/current');
      if (!res.ok) {
        throw new Error('Failed to fetch current organization');
      }
      return await res.json();
    } catch (err) {
      console.warn('Using fallback current organization', err);
      return {
        organization: null,
        role: 'ally_technical',
        orgId: null,
      };
    }
  },

  /**
   * List all organizations (Super Admin only).
   */
  listOrganizations: async (): Promise<Ally[]> => {
    try {
      // 1. Direct Supabase query with active user session
      const { data, error } = await supabase
        .from('organizations')
        .select('*')
        .order('name');
      if (!error && Array.isArray(data) && data.length > 0) {
        return data.map((org: any) => ({
          id: org.id,
          name: org.name,
          nit: org.nit || undefined,
          createdAt: org.created_at ? org.created_at.split('T')[0] : undefined,
        }));
      }
    } catch (err) {
      console.warn('Direct Supabase organizations query failed, trying API fallback', err);
    }

    try {
      // 2. Fallback to Express API
      const res = await apiClient.fetch('/api/organizations');
      if (res.ok) {
        const data = await res.json();
        return data.map((org: any) => ({
          id: org.id,
          name: org.name,
          nit: org.nit,
          createdAt: org.created_at ? org.created_at.split('T')[0] : undefined,
        }));
      }
    } catch (err) {
      console.warn('Failed to list organizations from API', err);
    }

    return [];
  },

  /**
   * Get full user directory across organizations.
   * Super Admins see all users; Ally Admins see only their team.
   */
  getDirectory: async (): Promise<DirectoryUser[]> => {
    try {
      // 1. Direct Supabase RPC
      const { data, error } = await supabase.rpc('get_organization_directory');
      if (!error && Array.isArray(data) && data.length > 0) {
        return data.map((item: any) => ({
          id: item.id || item.user_id,
          name: item.name || item.email?.split('@')[0] || 'Usuario',
          email: item.email || '',
          role: item.role as UserRole,
          allyId: item.org_id,
          allyName: item.org_name || 'Correduría Aliada',
          status: (item.status as 'ACTIVE' | 'INACTIVE') || 'ACTIVE',
          createdAt: item.created_at ? item.created_at.split('T')[0] : '2026-01-01',
        }));
      }
    } catch (err) {
      console.warn('Direct Supabase RPC directory failed, trying API fallback', err);
    }

    try {
      // 2. Fallback to Express API
      const res = await apiClient.fetch('/api/organizations/directory');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          return data.map((item: any) => ({
            id: item.id || item.user_id,
            name: item.name || item.email?.split('@')[0] || 'Usuario',
            email: item.email || '',
            role: item.role as UserRole,
            allyId: item.org_id,
            allyName: item.org_name || 'Correduría Aliada',
            status: (item.status as 'ACTIVE' | 'INACTIVE') || 'ACTIVE',
            createdAt: item.created_at ? item.created_at.split('T')[0] : '2026-01-01',
          }));
        }
      }
    } catch (err) {
      console.warn('API directory failed', err);
    }

    return [];
  },

  /**
   * Create a new organization.
   */
  createOrganization: async (input: {
    name: string;
    nit?: string;
    contact_email?: string;
    phone?: string;
  }): Promise<Ally | null> => {
    const res = await apiClient.fetch('/api/organizations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });

    if (!res.ok) {
      throw new Error('Failed to create organization');
    }

    const data = await res.json();
    return {
      id: data.id,
      name: data.name,
      nit: data.nit,
      contact_email: data.contact_email,
      phone: data.phone,
      status: data.status,
      createdAt: data.created_at ? data.created_at.split('T')[0] : undefined,
    };
  },

  /**
   * Update an organization (Super Admin only).
   */
  updateOrganization: async (
    id: string,
    input: {
      name?: string;
      nit?: string;
      contact_email?: string;
      phone?: string;
      status?: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
    }
  ): Promise<Ally> => {
    const res = await apiClient.fetch(`/api/organizations/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });

    if (!res.ok) {
      throw new Error('Failed to update organization');
    }

    const data = await res.json();
    return {
      id: data.id,
      name: data.name,
      nit: data.nit,
      contact_email: data.contact_email,
      phone: data.phone,
      status: data.status,
      createdAt: data.created_at ? data.created_at.split('T')[0] : undefined,
    };
  },

  /**
   * Delete an organization (Super Admin only).
   */
  deleteOrganization: async (id: string): Promise<boolean> => {
    const res = await apiClient.fetch(`/api/organizations/${id}`, {
      method: 'DELETE',
    });

    return res.ok;
  },

  /**
   * Invite or create a user in Supabase Auth & Organization.
   */
  inviteUser: async (input: {
    email: string;
    name: string;
    role: UserRole;
    orgId: string;
    password?: string;
  }): Promise<{ user: any; member: any }> => {
    const res = await apiClient.fetch('/api/organizations/users/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.message || 'Error al invitar usuario');
    }

    return await res.json();
  },

  /**
   * List members of an organization.
   */
  listMembers: async (orgId: string): Promise<OrganizationMember[]> => {
    try {
      const res = await apiClient.fetch(`/api/organizations/${orgId}/members`);
      if (!res.ok) {
        return [];
      }
      return await res.json();
    } catch (err) {
      console.warn(`Failed to list members for org ${orgId}`, err);
      return [];
    }
  },

  /**
   * Add a member to an organization.
   */
  addMember: async (
    orgId: string,
    member: { user_id: string; role: UserRole }
  ): Promise<OrganizationMember | null> => {
    const res = await apiClient.fetch(`/api/organizations/${orgId}/members`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(member),
    });

    if (!res.ok) {
      throw new Error('Failed to add organization member');
    }

    return await res.json();
  },

  /**
   * Remove a member from an organization.
   */
  removeMember: async (orgId: string, userId: string): Promise<boolean> => {
    const res = await apiClient.fetch(`/api/organizations/${orgId}/members/${userId}`, {
      method: 'DELETE',
    });

    return res.ok;
  },
};
