import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import { PortfolioProvider, usePortfolio } from '../../contexts/PortfolioContext';
import * as portfolioService from '../../services/portfolioService';
import type { PortfolioClient, PortfolioPolicy, PortfolioRenewal } from '../../types';

vi.mock('../../services/portfolioService');

const client: PortfolioClient = {
  id: 'c1',
  name: 'Acme SAS',
  tax_id: '900111',
  contact: null,
  created_at: '2026-01-01',
  updated_at: '2026-01-01',
};

const policy: PortfolioPolicy = {
  id: 'p1',
  client_id: 'c1',
  ramo: 'autos',
  insurer: 'Sura',
  policy_number: 'POL-1',
  premium: 1500000,
  start_date: '2025-10-01',
  end_date: '2026-10-01',
  provenance: 'manual',
  coverages: null,
  deductibles: null,
  source_analysis_id: null,
  ramo_details: null,
  created_at: '2026-01-01',
  updated_at: '2026-01-01',
};

const renewal: PortfolioRenewal = {
  id: 'r1',
  policy_id: 'p1',
  cycle_start: '2026-10-01',
  state: 'detected',
  outcome: null,
  final_premium: null,
  loss_reason: null,
  created_at: '2026-09-01',
  updated_at: '2026-09-01',
};

const Probe: React.FC<{ onReady?: (api: ReturnType<typeof usePortfolio>) => void }> = ({
  onReady,
}) => {
  const api = usePortfolio();
  React.useEffect(() => {
    onReady?.(api);
  });
  return (
    <div>
      <span data-testid="loading">{String(api.loading)}</span>
      <span data-testid="clients">{api.clients.map((c) => c.name).join(',')}</span>
      <span data-testid="policies">{api.policies.map((p) => p.insurer).join(',')}</span>
      <span data-testid="renewals">{api.renewals.map((r) => r.state).join(',')}</span>
      <span data-testid="error">{api.error ?? ''}</span>
    </div>
  );
};

describe('PortfolioContext', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('loads clients, policies and renewals on mount', async () => {
    vi.mocked(portfolioService.listClients).mockResolvedValue([client]);
    vi.mocked(portfolioService.listPolicies).mockResolvedValue([policy]);
    vi.mocked(portfolioService.listRenewals).mockResolvedValue([renewal]);

    render(
      <PortfolioProvider>
        <Probe />
      </PortfolioProvider>
    );

    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'));
    expect(screen.getByTestId('clients').textContent).toBe('Acme SAS');
    expect(screen.getByTestId('policies').textContent).toBe('Sura');
    expect(screen.getByTestId('renewals').textContent).toBe('detected');
  });

  it('surfaces a load failure as error state without throwing', async () => {
    vi.mocked(portfolioService.listClients).mockRejectedValue(new Error('boom'));
    vi.mocked(portfolioService.listPolicies).mockResolvedValue([]);
    vi.mocked(portfolioService.listRenewals).mockResolvedValue([]);

    render(
      <PortfolioProvider>
        <Probe />
      </PortfolioProvider>
    );

    await waitFor(() => expect(screen.getByTestId('error').textContent).toContain('boom'));
    expect(screen.getByTestId('loading').textContent).toBe('false');
  });

  it('addClient appends the created client to state', async () => {
    vi.mocked(portfolioService.listClients).mockResolvedValue([]);
    vi.mocked(portfolioService.listPolicies).mockResolvedValue([]);
    vi.mocked(portfolioService.listRenewals).mockResolvedValue([]);
    vi.mocked(portfolioService.createClient).mockResolvedValue(client);

    let api: ReturnType<typeof usePortfolio> | undefined;
    render(
      <PortfolioProvider>
        <Probe
          onReady={(a) => {
            api = a;
          }}
        />
      </PortfolioProvider>
    );
    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'));

    await act(async () => {
      await api!.addClient({ name: 'Acme SAS', tax_id: '900111' });
    });

    expect(portfolioService.createClient).toHaveBeenCalledWith({ name: 'Acme SAS', tax_id: '900111' });
    expect(screen.getByTestId('clients').textContent).toBe('Acme SAS');
  });

  it('removeClient deletes the client and drops it from state', async () => {
    vi.mocked(portfolioService.listClients).mockResolvedValue([client]);
    vi.mocked(portfolioService.listPolicies).mockResolvedValue([]);
    vi.mocked(portfolioService.listRenewals).mockResolvedValue([]);
    vi.mocked(portfolioService.deleteClient).mockResolvedValue(undefined);

    let api: ReturnType<typeof usePortfolio> | undefined;
    render(
      <PortfolioProvider>
        <Probe
          onReady={(a) => {
            api = a;
          }}
        />
      </PortfolioProvider>
    );
    await waitFor(() => expect(screen.getByTestId('clients').textContent).toBe('Acme SAS'));

    await act(async () => {
      await api!.removeClient('c1');
    });

    expect(portfolioService.deleteClient).toHaveBeenCalledWith('c1');
    expect(screen.getByTestId('clients').textContent).toBe('');
  });

  it('addPolicy appends the created policy to state', async () => {
    vi.mocked(portfolioService.listClients).mockResolvedValue([client]);
    vi.mocked(portfolioService.listPolicies).mockResolvedValue([]);
    vi.mocked(portfolioService.listRenewals).mockResolvedValue([]);
    vi.mocked(portfolioService.createPolicy).mockResolvedValue(policy);

    let api: ReturnType<typeof usePortfolio> | undefined;
    render(
      <PortfolioProvider>
        <Probe
          onReady={(a) => {
            api = a;
          }}
        />
      </PortfolioProvider>
    );
    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'));

    await act(async () => {
      await api!.addPolicy({ client_id: 'c1', ramo: 'autos', insurer: 'Sura' });
    });

    expect(screen.getByTestId('policies').textContent).toBe('Sura');
  });

  it('applyRenewalTransition replaces the renewal in state', async () => {
    vi.mocked(portfolioService.listClients).mockResolvedValue([]);
    vi.mocked(portfolioService.listPolicies).mockResolvedValue([]);
    vi.mocked(portfolioService.listRenewals).mockResolvedValue([renewal]);
    vi.mocked(portfolioService.transitionRenewal).mockResolvedValue({
      ...renewal,
      state: 'in_review',
    });

    let api: ReturnType<typeof usePortfolio> | undefined;
    render(
      <PortfolioProvider>
        <Probe
          onReady={(a) => {
            api = a;
          }}
        />
      </PortfolioProvider>
    );
    await waitFor(() => expect(screen.getByTestId('renewals').textContent).toBe('detected'));

    await act(async () => {
      await api!.applyRenewalTransition('r1', { to: 'in_review' });
    });

    expect(portfolioService.transitionRenewal).toHaveBeenCalledWith('r1', { to: 'in_review' });
    expect(screen.getByTestId('renewals').textContent).toBe('in_review');
  });

  it('usePortfolio throws outside the provider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Probe />)).toThrow('usePortfolio must be used within a PortfolioProvider');
    spy.mockRestore();
  });
});
