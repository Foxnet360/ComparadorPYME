import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { CampaignWindowConfig } from '../../../components/CampaignWindowConfig';
import * as portfolioService from '../../../services/portfolioService';

vi.mock('../../../services/portfolioService');

describe('CampaignWindowConfig (R4.1)', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('loads and renders the persisted windows and enabled flag', async () => {
    vi.mocked(portfolioService.getCampaignConfig).mockResolvedValue({
      windows: [60, 30, 7],
      enabled: true,
    });

    render(<CampaignWindowConfig />);

    const input = (await screen.findByLabelText(/ventanas/i)) as HTMLInputElement;
    expect(input.value).toBe('60, 30, 7');
    const toggle = screen.getByLabelText(/campañas automáticas/i) as HTMLInputElement;
    expect(toggle.checked).toBe(true);
  });

  it('saves edited windows and the enabled toggle', async () => {
    vi.mocked(portfolioService.getCampaignConfig).mockResolvedValue({
      windows: [60, 30, 7],
      enabled: true,
    });
    vi.mocked(portfolioService.saveCampaignConfig).mockResolvedValue({
      windows: [45, 15],
      enabled: false,
    });

    render(<CampaignWindowConfig />);
    await screen.findByLabelText(/ventanas/i);

    fireEvent.change(screen.getByLabelText(/ventanas/i), { target: { value: '45, 15' } });
    fireEvent.click(screen.getByLabelText(/campañas automáticas/i));
    fireEvent.click(screen.getByRole('button', { name: /guardar/i }));

    await waitFor(() =>
      expect(portfolioService.saveCampaignConfig).toHaveBeenCalledWith({
        windows: [45, 15],
        enabled: false,
      })
    );
  });

  it('rejects invalid windows without calling the API', async () => {
    vi.mocked(portfolioService.getCampaignConfig).mockResolvedValue({
      windows: [60, 30, 7],
      enabled: true,
    });

    render(<CampaignWindowConfig />);
    await screen.findByLabelText(/ventanas/i);

    fireEvent.change(screen.getByLabelText(/ventanas/i), { target: { value: '60, cero, -5' } });
    fireEvent.click(screen.getByRole('button', { name: /guardar/i }));

    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(portfolioService.saveCampaignConfig).not.toHaveBeenCalled();
  });

  it('surfaces a save failure', async () => {
    vi.mocked(portfolioService.getCampaignConfig).mockResolvedValue({
      windows: [60, 30, 7],
      enabled: true,
    });
    vi.mocked(portfolioService.saveCampaignConfig).mockRejectedValue(new Error('servidor caído'));

    render(<CampaignWindowConfig />);
    await screen.findByLabelText(/ventanas/i);

    fireEvent.click(screen.getByRole('button', { name: /guardar/i }));

    expect(await screen.findByRole('alert')).toBeTruthy();
  });
});
