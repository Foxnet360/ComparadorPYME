/**
 * Organization Service (Frontend)
 * Communicates with /api/organizations endpoints to manage real multi-tenant organizations and members.
 */

import { apiClient } from './apiClient';
import { Ally, UserRole } from '../types';

export interface OrganizationMember {
  id: string;
  org_id: string;
  user_id: string;
  role: UserRole;
  created_at: string;
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
      const res = await apiClient.fetch('/api/organizations');
      if (!res.ok) {
        return [];
      }
      const data = await res.json();
      return data.map((org: any) => ({
        id: org.id,
        name: org.name,
        nit: org.nit,
        createdAt: org.created_at ? org.created_at.split('T')[0] : undefined,
      }));
    } catch (err) {
      console.warn('Failed to list organizations from API', err);
      return [];
    }
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
      createdAt: data.created_at ? data.created_at.split('T')[0] : undefined,
    };
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
