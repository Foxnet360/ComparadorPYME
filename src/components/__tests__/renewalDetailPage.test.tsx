import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import RenewalDetail from '../../../pages/RenewalDetail';
import * as portfolioService from '../../../services/portfolioService';
import type { PortfolioRenewal, RenewalEvent } from '../../../types';

vi.mock('../../../services/portfolioService');

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

const events: RenewalEvent[] = [
  {
    id: 'e1',
    renewal_id: 'r1',
    from_state: null,
    to_state: 'detected',
    actor_id: 'system',
    payload: {},
    created_at: '2026-09-01T06:00:00Z',
  },
  {
    id: 'e2',
    renewal_id: 'r1',
    from_state: 'detected',
    to_state: 'in_review',
    actor_id: 'user-a',
    payload: {},
    created_at: '2026-09-02T06:00:00Z',
  },
];

const mockLoad = (row: PortfolioRenewal = renewal, eventRows: RenewalEvent[] = events) => {
  vi.mocked(portfolioService.listRenewals).mockResolvedValue([row]);
  vi.mocked(portfolioService.listRenewalEvents).mockResolvedValue(eventRows);
};

describe('RenewalDetail page (R3.1/R3.2)', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('loads the renewal and renders its state and event history', async () => {
    mockLoad();
    render(<RenewalDetail renewalId="r1" />);

    expect(await screen.findByText('in_review')).toBeTruthy();
    expect(screen.getByText(/detected → in_review/)).toBeTruthy();
    expect(portfolioService.listRenewalEvents).toHaveBeenCalledWith('r1');
  });

  it('shows an error when the renewal does not belong to the portfolio', async () => {
    mockLoad(renewal, []);
    vi.mocked(portfolioService.listRenewals).mockResolvedValue([]);
    render(<RenewalDetail renewalId="unknown" />);

    expect(await screen.findByRole('alert')).toBeTruthy();
  });

  it('advances to the next state via the transition action', async () => {
    mockLoad();
    vi.mocked(portfolioService.transitionRenewal).mockResolvedValue({
      ...renewal,
      state: 'quoted',
    });
    render(<RenewalDetail renewalId="r1" />);
    await screen.findByText('in_review');

    fireEvent.click(screen.getByRole('button', { name: /avanzar a quoted/i }));

    await waitFor(() =>
      expect(portfolioService.transitionRenewal).toHaveBeenCalledWith('r1', { to: 'quoted' })
    );
    expect(await screen.findByText('quoted')).toBeTruthy();
  });

  it('closing as lost requires a loss reason before submitting (R3.2)', async () => {
    mockLoad({ ...renewal, state: 'quoted' });
    render(<RenewalDetail renewalId="r1" />);
    await screen.findByText('quoted');

    fireEvent.click(screen.getByRole('button', { name: /cerrar renovación/i }));
    fireEvent.change(screen.getByLabelText(/resultado/i), { target: { value: 'lost' } });

    const submit = screen.getByRole('button', { name: /confirmar cierre/i });
    expect(submit).toHaveProperty('disabled', true);
    expect(portfolioService.transitionRenewal).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText(/motivo de pérdida/i), {
      target: { value: 'precio no competitivo' },
    });
    expect(screen.getByRole('button', { name: /confirmar cierre/i })).toHaveProperty(
      'disabled',
      false
    );
  });

  it('submits the close transition with outcome, premium and reason', async () => {
    mockLoad({ ...renewal, state: 'quoted' });
    vi.mocked(portfolioService.transitionRenewal).mockResolvedValue({
      ...renewal,
      state: 'closed',
      outcome: 'lost',
      loss_reason: 'precio no competitivo',
    });
    render(<RenewalDetail renewalId="r1" />);
    await screen.findByText('quoted');

    fireEvent.click(screen.getByRole('button', { name: /cerrar renovación/i }));
    fireEvent.change(screen.getByLabelText(/resultado/i), { target: { value: 'lost' } });
    fireEvent.change(screen.getByLabelText(/motivo de pérdida/i), {
      target: { value: 'precio no competitivo' },
    });
    fireEvent.click(screen.getByRole('button', { name: /confirmar cierre/i }));

    await waitFor(() =>
      expect(portfolioService.transitionRenewal).toHaveBeenCalledWith('r1', {
        to: 'closed',
        outcome: 'lost',
        loss_reason: 'precio no competitivo',
      })
    );
  });

  it('a closed renewal shows its outcome and no further actions', async () => {
    mockLoad({
      ...renewal,
      state: 'closed',
      outcome: 'renewed_competitor',
      final_premium: 2400000,
    });
    render(<RenewalDetail renewalId="r1" />);

    expect(await screen.findByText('closed')).toBeTruthy();
    expect(screen.getByText('renewed_competitor')).toBeTruthy();
    expect(screen.getByText(/2400000/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /avanzar/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /cerrar renovación/i })).toBeNull();
  });

  it('invokes onBack when the back action is used', async () => {
    mockLoad();
    const onBack = vi.fn();
    render(<RenewalDetail renewalId="r1" onBack={onBack} />);
    await screen.findByText('in_review');

    fireEvent.click(screen.getByRole('button', { name: /volver/i }));

    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
