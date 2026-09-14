/**
 * Portfolio Service (renovacion-polizas PR-5, task 1.21)
 *
 * Thin typed layer over apiClient for the renewal portfolio API:
 * /api/clients, /api/policies, /api/renewals, /api/campaigns/config.
 * Ownership is derived from the session server-side (AUTH-2) — this layer
 * never sends userId.
 */

import { apiClient } from './apiClient';
import type {
  CampaignConfig,
  PortfolioClient,
  PortfolioPolicy,
  PortfolioRenewal,
  RenewalEvent,
  RenewalState,
  RenewalTransitionInput,
} from '../types';

const JSON_HEADERS = { 'Content-Type': 'application/json' };

async function parseJson<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

// --- Clients (R1.1) ---

export async function listClients(): Promise<PortfolioClient[]> {
  return parseJson(await apiClient.fetch('/clients', { method: 'GET' }));
}

export async function createClient(
  input: Pick<PortfolioClient, 'name'> & Partial<Pick<PortfolioClient, 'tax_id' | 'contact'>>
): Promise<PortfolioClient> {
  return parseJson(
    await apiClient.fetch('/clients', {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify(input),
    })
  );
}

export async function updateClient(
  id: string,
  input: Partial<Pick<PortfolioClient, 'name' | 'tax_id' | 'contact'>>
): Promise<PortfolioClient> {
  return parseJson(
    await apiClient.fetch(`/clients/${id}`, {
      method: 'PATCH',
      headers: JSON_HEADERS,
      body: JSON.stringify(input),
    })
  );
}

export async function deleteClient(id: string): Promise<void> {
  await apiClient.fetch(`/clients/${id}`, { method: 'DELETE' });
}

// --- Policies (R1.1/R1.4) ---

export type CreatePolicyInput = Pick<PortfolioPolicy, 'client_id' | 'ramo' | 'insurer'> &
  Partial<
    Pick<
      PortfolioPolicy,
      | 'policy_number'
      | 'premium'
      | 'start_date'
      | 'end_date'
      | 'provenance'
      | 'source_analysis_id'
      | 'ramo_details'
    >
  >;

export async function listPolicies(): Promise<PortfolioPolicy[]> {
  return parseJson(await apiClient.fetch('/policies', { method: 'GET' }));
}

export async function createPolicy(input: CreatePolicyInput): Promise<PortfolioPolicy> {
  return parseJson(
    await apiClient.fetch('/policies', {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify(input),
    })
  );
}

export async function updatePolicy(
  id: string,
  input: Partial<Omit<CreatePolicyInput, 'client_id'>>
): Promise<PortfolioPolicy> {
  return parseJson(
    await apiClient.fetch(`/policies/${id}`, {
      method: 'PATCH',
      headers: JSON_HEADERS,
      body: JSON.stringify(input),
    })
  );
}

export async function deletePolicy(id: string): Promise<void> {
  await apiClient.fetch(`/policies/${id}`, { method: 'DELETE' });
}

// --- Renewals (R3.1/R3.2) ---

export async function listRenewals(state?: RenewalState): Promise<PortfolioRenewal[]> {
  const query = state ? `?state=${encodeURIComponent(state)}` : '';
  return parseJson(await apiClient.fetch(`/renewals${query}`, { method: 'GET' }));
}

export async function transitionRenewal(
  id: string,
  input: RenewalTransitionInput
): Promise<PortfolioRenewal> {
  return parseJson(
    await apiClient.fetch(`/renewals/${id}/transition`, {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify(input),
    })
  );
}

/** R3.1: auditable event history (who/when/from→to) for one renewal. */
export async function listRenewalEvents(renewalId: string): Promise<RenewalEvent[]> {
  return parseJson(await apiClient.fetch(`/renewals/${renewalId}/events`, { method: 'GET' }));
}

// --- Campaigns (R4.1/R4.2) ---

export async function getCampaignConfig(): Promise<CampaignConfig> {
  return parseJson(await apiClient.fetch('/campaigns/config', { method: 'GET' }));
}

export async function saveCampaignConfig(config: CampaignConfig): Promise<CampaignConfig> {
  return parseJson(
    await apiClient.fetch('/campaigns/config', {
      method: 'PUT',
      headers: JSON_HEADERS,
      body: JSON.stringify(config),
    })
  );
}

export async function sendCampaignWindow(renewalId: string, windowDays: number): Promise<unknown> {
  return parseJson(
    await apiClient.fetch(`/renewals/${renewalId}/campaigns/${windowDays}/send`, { method: 'POST' })
  );
}

export async function skipCampaignWindow(renewalId: string, windowDays: number): Promise<unknown> {
  return parseJson(
    await apiClient.fetch(`/renewals/${renewalId}/campaigns/${windowDays}/skip`, { method: 'POST' })
  );
}

export async function rescheduleCampaignWindow(
  renewalId: string,
  windowDays: number
): Promise<unknown> {
  return parseJson(
    await apiClient.fetch(`/renewals/${renewalId}/campaigns/${windowDays}/reschedule`, {
      method: 'POST',
    })
  );
}
