import { describe, it, expect, vi, beforeEach } from 'vitest';
import { apiClient } from '../../services/apiClient';
import {
  listClients,
  createClient,
  updateClient,
  deleteClient,
  listPolicies,
  createPolicy,
  updatePolicy,
  deletePolicy,
  listRenewals,
  transitionRenewal,
  listRenewalEvents,
  getCampaignConfig,
  saveCampaignConfig,
  sendCampaignWindow,
  skipCampaignWindow,
  rescheduleCampaignWindow,
} from '../../services/portfolioService';

vi.mock('../../services/apiClient', () => ({
  apiClient: { fetch: vi.fn() },
}));

const jsonResponse = (body: unknown, status = 200): Response =>
  ({ ok: status < 400, status, json: async () => body }) as unknown as Response;

describe('portfolioService', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('listClients GETs /clients and returns the rows', async () => {
    const rows = [{ id: 'c1', name: 'Acme SAS' }];
    vi.mocked(apiClient.fetch).mockResolvedValue(jsonResponse(rows));

    const result = await listClients();

    expect(apiClient.fetch).toHaveBeenCalledWith('/clients', expect.objectContaining({}));
    expect(result).toEqual(rows);
  });

  it('createClient POSTs the payload as JSON and returns the created row', async () => {
    const created = { id: 'c2', name: 'Nueva Ltda', tax_id: '900123' };
    vi.mocked(apiClient.fetch).mockResolvedValue(jsonResponse(created, 201));

    const result = await createClient({ name: 'Nueva Ltda', tax_id: '900123' });

    const [url, options] = vi.mocked(apiClient.fetch).mock.calls[0];
    expect(url).toBe('/clients');
    expect(options?.method).toBe('POST');
    expect(JSON.parse(String(options?.body))).toEqual({ name: 'Nueva Ltda', tax_id: '900123' });
    expect(result).toEqual(created);
  });

  it('updateClient PATCHes only the provided fields', async () => {
    vi.mocked(apiClient.fetch).mockResolvedValue(jsonResponse({ id: 'c1', name: 'Renamed' }));

    await updateClient('c1', { name: 'Renamed' });

    const [url, options] = vi.mocked(apiClient.fetch).mock.calls[0];
    expect(url).toBe('/clients/c1');
    expect(options?.method).toBe('PATCH');
    expect(JSON.parse(String(options?.body))).toEqual({ name: 'Renamed' });
  });

  it('deleteClient issues DELETE and resolves without a body', async () => {
    vi.mocked(apiClient.fetch).mockResolvedValue(jsonResponse({}, 200));

    await expect(deleteClient('c1')).resolves.toBeUndefined();

    const [url, options] = vi.mocked(apiClient.fetch).mock.calls[0];
    expect(url).toBe('/clients/c1');
    expect(options?.method).toBe('DELETE');
  });

  it('listPolicies GETs /policies', async () => {
    const rows = [{ id: 'p1', client_id: 'c1', ramo: 'autos', insurer: 'Sura' }];
    vi.mocked(apiClient.fetch).mockResolvedValue(jsonResponse(rows));

    const result = await listPolicies();

    expect(apiClient.fetch).toHaveBeenCalledWith('/policies', expect.objectContaining({}));
    expect(result).toEqual(rows);
  });

  it('createPolicy POSTs the policy payload', async () => {
    const payload = { client_id: 'c1', ramo: 'pyme', insurer: 'Allianz', premium: 1200000 };
    vi.mocked(apiClient.fetch).mockResolvedValue(jsonResponse({ id: 'p9', ...payload }, 201));

    const result = await createPolicy(payload);

    const [url, options] = vi.mocked(apiClient.fetch).mock.calls[0];
    expect(url).toBe('/policies');
    expect(options?.method).toBe('POST');
    expect(JSON.parse(String(options?.body))).toEqual(payload);
    expect(result.id).toBe('p9');
  });

  it('updatePolicy PATCHes the policy', async () => {
    vi.mocked(apiClient.fetch).mockResolvedValue(jsonResponse({ id: 'p1', premium: 900000 }));

    await updatePolicy('p1', { premium: 900000 });

    const [url, options] = vi.mocked(apiClient.fetch).mock.calls[0];
    expect(url).toBe('/policies/p1');
    expect(options?.method).toBe('PATCH');
  });

  it('deletePolicy issues DELETE on the policy', async () => {
    vi.mocked(apiClient.fetch).mockResolvedValue(jsonResponse({}, 200));

    await expect(deletePolicy('p1')).resolves.toBeUndefined();

    const [url, options] = vi.mocked(apiClient.fetch).mock.calls[0];
    expect(url).toBe('/policies/p1');
    expect(options?.method).toBe('DELETE');
  });

  it('listRenewals without state GETs /renewals', async () => {
    vi.mocked(apiClient.fetch).mockResolvedValue(jsonResponse([]));

    await listRenewals();

    expect(apiClient.fetch).toHaveBeenCalledWith('/renewals', expect.objectContaining({}));
  });

  it('listRenewals with state encodes the state filter', async () => {
    const rows = [{ id: 'r1', state: 'in_review' }];
    vi.mocked(apiClient.fetch).mockResolvedValue(jsonResponse(rows));

    const result = await listRenewals('in_review');

    expect(apiClient.fetch).toHaveBeenCalledWith(
      '/renewals?state=in_review',
      expect.objectContaining({})
    );
    expect(result).toEqual(rows);
  });

  it('transitionRenewal POSTs the transition payload', async () => {
    const updated = { id: 'r1', state: 'closed', outcome: 'lost', loss_reason: 'precio' };
    vi.mocked(apiClient.fetch).mockResolvedValue(jsonResponse(updated));

    const result = await transitionRenewal('r1', { to: 'closed', outcome: 'lost', loss_reason: 'precio' });

    const [url, options] = vi.mocked(apiClient.fetch).mock.calls[0];
    expect(url).toBe('/renewals/r1/transition');
    expect(options?.method).toBe('POST');
    expect(JSON.parse(String(options?.body))).toEqual({
      to: 'closed',
      outcome: 'lost',
      loss_reason: 'precio',
    });
    expect(result).toEqual(updated);
  });

  it('listRenewalEvents GETs the renewal event history', async () => {
    const events = [{ id: 'e1', renewal_id: 'r1', from_state: null, to_state: 'detected' }];
    vi.mocked(apiClient.fetch).mockResolvedValue(jsonResponse(events));

    const result = await listRenewalEvents('r1');

    expect(apiClient.fetch).toHaveBeenCalledWith('/renewals/r1/events', expect.objectContaining({}));
    expect(result).toEqual(events);
  });

  it('getCampaignConfig GETs /campaigns/config', async () => {
    vi.mocked(apiClient.fetch).mockResolvedValue(jsonResponse({ windows: [60, 30, 7], enabled: true }));

    const result = await getCampaignConfig();

    expect(apiClient.fetch).toHaveBeenCalledWith('/campaigns/config', expect.objectContaining({}));
    expect(result).toEqual({ windows: [60, 30, 7], enabled: true });
  });

  it('saveCampaignConfig PUTs the config payload', async () => {
    vi.mocked(apiClient.fetch).mockResolvedValue(jsonResponse({ windows: [45, 15], enabled: false }));

    await saveCampaignConfig({ windows: [45, 15], enabled: false });

    const [url, options] = vi.mocked(apiClient.fetch).mock.calls[0];
    expect(url).toBe('/campaigns/config');
    expect(options?.method).toBe('PUT');
    expect(JSON.parse(String(options?.body))).toEqual({ windows: [45, 15], enabled: false });
  });

  it('sendCampaignWindow POSTs to the send endpoint', async () => {
    vi.mocked(apiClient.fetch).mockResolvedValue(jsonResponse({ id: 'd1', status: 'sent' }));

    await sendCampaignWindow('r1', 30);

    const [url, options] = vi.mocked(apiClient.fetch).mock.calls[0];
    expect(url).toBe('/renewals/r1/campaigns/30/send');
    expect(options?.method).toBe('POST');
  });

  it('skipCampaignWindow POSTs to the skip endpoint', async () => {
    vi.mocked(apiClient.fetch).mockResolvedValue(jsonResponse({ id: 'd1', status: 'skipped' }));

    await skipCampaignWindow('r1', 7);

    const [url, options] = vi.mocked(apiClient.fetch).mock.calls[0];
    expect(url).toBe('/renewals/r1/campaigns/7/skip');
    expect(options?.method).toBe('POST');
  });

  it('rescheduleCampaignWindow POSTs to the reschedule endpoint', async () => {
    vi.mocked(apiClient.fetch).mockResolvedValue(
      jsonResponse({ renewal_id: 'r1', window_key: '60', rescheduled: true })
    );

    await rescheduleCampaignWindow('r1', 60);

    const [url, options] = vi.mocked(apiClient.fetch).mock.calls[0];
    expect(url).toBe('/renewals/r1/campaigns/60/reschedule');
    expect(options?.method).toBe('POST');
  });
});
