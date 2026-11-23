import { apiClient } from './apiClient';

export type LeadStatus = 'nuevo' | 'asignado' | 'en_gestion' | 'cotizado' | 'cerrado' | 'perdido';

export interface OrgMemberSummary {
  user_id: string;
  email?: string;
  full_name?: string;
  name?: string;
  role: string;
  status: string;
}

export interface ClientShare {
  id: string;
  client_id: string;
  org_id: string;
  shared_with_user_id: string;
  shared_by_user_id: string;
  permission: 'view' | 'edit';
  created_at: string;
}

export interface DelegationAuditEntry {
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

export interface OrgDirectoryEntry {
  id: string;
  name: string;
  tax_id: string | null;
  lead_status: string;
  assigned_to: string | null;
}

export const clientDelegationService = {
  async listOrgMembers(orgId: string): Promise<OrgMemberSummary[]> {
    const res = await apiClient.fetch(`/organizations/${orgId}/members`);
    if (!res.ok) return [];
    const data = (await res.json()) as OrgMemberSummary[];
    return Array.isArray(data) ? data : [];
  },

  async listClientShares(clientId: string): Promise<ClientShare[]> {
    const res = await apiClient.fetch(`/clients/${clientId}/shares`);
    if (!res.ok) return [];
    return (await res.json()) as ClientShare[];
  },

  async shareClient(
    clientId: string,
    sharedWithUserId: string,
    permission: 'view' | 'edit' = 'edit'
  ): Promise<ClientShare> {
    const res = await apiClient.fetch(`/clients/${clientId}/share`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sharedWithUserId, permission }),
    });
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { message?: string; error?: string };
      throw new Error(err.message || err.error || 'No se pudo compartir el cliente.');
    }
    return (await res.json()) as ClientShare;
  },

  async unshareClient(clientId: string, targetUserId: string): Promise<void> {
    const res = await apiClient.fetch(`/clients/${clientId}/share/${targetUserId}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      throw new Error('No se pudo revocar el acceso compartido.');
    }
  },

  async delegateClient(
    clientId: string,
    payload: {
      primaryAdvisorId: string;
      sharedAdvisorIds?: string[];
      notes?: string;
    }
  ): Promise<void> {
    const res = await apiClient.fetch(`/clients/${clientId}/delegate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { message?: string; error?: string };
      throw new Error(err.message || err.error || 'No se pudo delegar el cliente.');
    }
  },

  async updateLeadStatus(clientId: string, leadStatus: LeadStatus, notes?: string): Promise<void> {
    const res = await apiClient.fetch(`/clients/${clientId}/lead-status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ leadStatus, notes }),
    });
    if (!res.ok) {
      throw new Error('No se pudo actualizar el estado del lead.');
    }
  },

  async getDelegationAudit(params?: {
    clientId?: string;
    advisorId?: string;
  }): Promise<DelegationAuditEntry[]> {
    const qs = new URLSearchParams();
    if (params?.clientId) qs.set('clientId', params.clientId);
    if (params?.advisorId) qs.set('advisorId', params.advisorId);
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    const res = await apiClient.fetch(`/clients/delegations/audit${suffix}`);
    if (!res.ok) return [];
    return (await res.json()) as DelegationAuditEntry[];
  },

  async searchOrgDirectory(search: string): Promise<OrgDirectoryEntry[]> {
    const res = await apiClient.fetch(`/clients/directory?search=${encodeURIComponent(search)}`);
    if (!res.ok) return [];
    return (await res.json()) as OrgDirectoryEntry[];
  },
};
