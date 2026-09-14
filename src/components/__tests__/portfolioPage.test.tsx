import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import Portfolio from '../../../pages/Portfolio';
import { PortfolioProvider } from '../../../contexts/PortfolioContext';
import * as portfolioService from '../../../services/portfolioService';
import type { PortfolioClient, PortfolioPolicy, PortfolioRenewal } from '../../../types';

vi.mock('../../../services/portfolioService');

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
  state: 'in_review',
  outcome: null,
  final_premium: null,
  loss_reason: null,
  created_at: '2026-09-01',
  updated_at: '2026-09-01',
};

const renderPage = (onOpenRenewal = vi.fn()) => {
  render(
    <PortfolioProvider>
      <Portfolio onOpenRenewal={onOpenRenewal} />
    </PortfolioProvider>
  );
  return onOpenRenewal;
};

describe('Portfolio page', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubGlobal('confirm', vi.fn(() => true));
    vi.mocked(portfolioService.listClients).mockResolvedValue([client]);
    vi.mocked(portfolioService.listPolicies).mockResolvedValue([policy]);
    vi.mocked(portfolioService.listRenewals).mockResolvedValue([renewal]);
  });

  it('renders clients with their policies and renewal state', async () => {
    renderPage();

    expect(await screen.findByText('Acme SAS')).toBeTruthy();
    expect(screen.getByText('Sura')).toBeTruthy();
    expect(screen.getByText('autos')).toBeTruthy();
    expect(screen.getByText('in_review')).toBeTruthy();
  });

  it('shows an empty-state message when there are no clients', async () => {
    vi.mocked(portfolioService.listClients).mockResolvedValue([]);
    vi.mocked(portfolioService.listPolicies).mockResolvedValue([]);
    vi.mocked(portfolioService.listRenewals).mockResolvedValue([]);

    renderPage();

    expect(await screen.findByText(/sin clientes/i)).toBeTruthy();
  });

  it('creates a client from the new-client form', async () => {
    vi.mocked(portfolioService.createClient).mockResolvedValue({
      ...client,
      id: 'c2',
      name: 'Nueva Ltda',
    });
    renderPage();
    await screen.findByText('Acme SAS');

    fireEvent.change(screen.getByLabelText(/nombre del cliente/i), {
      target: { value: 'Nueva Ltda' },
    });
    fireEvent.click(screen.getByRole('button', { name: /crear cliente/i }));

    await waitFor(() =>
      expect(portfolioService.createClient).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Nueva Ltda' })
      )
    );
    expect(await screen.findByText('Nueva Ltda')).toBeTruthy();
  });

  it('creates a policy for a client from the policy form', async () => {
    vi.mocked(portfolioService.createPolicy).mockResolvedValue({
      ...policy,
      id: 'p2',
      insurer: 'Allianz',
      ramo: 'pyme',
    });
    renderPage();
    await screen.findByText('Acme SAS');

    fireEvent.change(screen.getByLabelText(/aseguradora/i), { target: { value: 'Allianz' } });
    fireEvent.change(screen.getByLabelText(/ramo/i), { target: { value: 'pyme' } });
    fireEvent.click(screen.getByRole('button', { name: /agregar póliza/i }));

    await waitFor(() =>
      expect(portfolioService.createPolicy).toHaveBeenCalledWith(
        expect.objectContaining({ client_id: 'c1', insurer: 'Allianz', ramo: 'pyme' })
      )
    );
    expect(await screen.findByText('Allianz')).toBeTruthy();
  });

  it('deletes a policy after confirmation', async () => {
    vi.mocked(portfolioService.deletePolicy).mockResolvedValue(undefined);
    renderPage();
    await screen.findByText('Sura');

    fireEvent.click(screen.getByRole('button', { name: /eliminar póliza POL-1/i }));

    await waitFor(() => expect(portfolioService.deletePolicy).toHaveBeenCalledWith('p1'));
    await waitFor(() => expect(screen.queryByText('Sura')).toBeNull());
  });

  it('deletes a client after confirmation', async () => {
    vi.mocked(portfolioService.deleteClient).mockResolvedValue(undefined);
    renderPage();
    await screen.findByText('Acme SAS');

    fireEvent.click(screen.getByRole('button', { name: /eliminar cliente Acme SAS/i }));

    await waitFor(() => expect(portfolioService.deleteClient).toHaveBeenCalledWith('c1'));
    await waitFor(() => expect(screen.queryByText('Acme SAS')).toBeNull());
  });

  it('opens the renewal detail via onOpenRenewal', async () => {
    const onOpenRenewal = renderPage();
    await screen.findByText('Acme SAS');

    fireEvent.click(screen.getByRole('button', { name: /ver renovación/i }));

    expect(onOpenRenewal).toHaveBeenCalledWith('r1');
  });
});
