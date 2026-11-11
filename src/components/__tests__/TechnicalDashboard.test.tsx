import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import TechnicalDashboard from '../../../components/TechnicalDashboard';
import { storageService } from '../../../services/storageService';
import type { HistoryEntry, ComparisonReport } from '../../../types';

vi.mock('../../../services/storageService', () => ({
  storageService: {
    getHistory: vi.fn(),
    updateStatus: vi.fn(),
  },
}));

const mockHistory: HistoryEntry[] = [
  {
    id: 'comp-1',
    date: '10/11/2026',
    clientName: 'Manufacturas del Valle S.A.S.',
    insurers: ['Seguros Bolívar', 'SURA', 'Mapfre', 'Allianz'],
    bestOption: 'Seguros Bolívar',
    premiumValue: 18500000,
    status: 'SENT',
    fullReport: { id: 'rep-1', quotes: [] } as unknown as ComparisonReport,
  },
  {
    id: 'comp-2',
    date: '09/11/2026',
    clientName: 'Distribuidora Andina',
    insurers: ['Chubb', 'SBS Seguros'],
    bestOption: 'Chubb',
    premiumValue: 9200000,
    status: 'SOLD',
    fullReport: { id: 'rep-2', quotes: [] } as unknown as ComparisonReport,
  },
];

describe('TechnicalDashboard — Responsive History without horizontal overflow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(storageService.getHistory).mockResolvedValue(mockHistory);
  });

  it('renders the Historial de Comparaciones header and KPI statistics', async () => {
    render(<TechnicalDashboard onNewAnalysis={vi.fn()} onViewReport={vi.fn()} />);

    expect(screen.getByText('Historial de Comparaciones')).toBeTruthy();

    await waitFor(() => {
      expect(screen.getAllByText('Manufacturas del Valle S.A.S.').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Distribuidora Andina').length).toBeGreaterThan(0);
    });
  });

  it('filters comparisons by search term', async () => {
    render(<TechnicalDashboard onNewAnalysis={vi.fn()} onViewReport={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getAllByText('Manufacturas del Valle S.A.S.').length).toBeGreaterThan(0);
    });

    const searchInput = screen.getByPlaceholderText('Buscar cliente o aseguradora...');
    fireEvent.change(searchInput, { target: { value: 'Andina' } });

    expect(screen.queryByText('Manufacturas del Valle S.A.S.')).toBeNull();
    expect(screen.getAllByText('Distribuidora Andina').length).toBeGreaterThan(0);
  });

  it('filters comparisons by status filter', async () => {
    render(<TechnicalDashboard onNewAnalysis={vi.fn()} onViewReport={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getAllByText('Manufacturas del Valle S.A.S.').length).toBeGreaterThan(0);
    });

    const statusSelect = screen.getAllByRole('combobox')[0]; // The top filter select
    fireEvent.change(statusSelect, { target: { value: 'SOLD' } });

    expect(screen.queryByText('Manufacturas del Valle S.A.S.')).toBeNull();
    expect(screen.getAllByText('Distribuidora Andina').length).toBeGreaterThan(0);
  });

  it('triggers onViewReport when clicking "Ver Informe"', async () => {
    const onViewReportMock = vi.fn();
    render(<TechnicalDashboard onNewAnalysis={vi.fn()} onViewReport={onViewReportMock} />);

    await waitFor(() => {
      expect(screen.getAllByText('Manufacturas del Valle S.A.S.').length).toBeGreaterThan(0);
    });

    const viewButtons = screen.getAllByRole('button', { name: /Ver Informe/i });
    fireEvent.click(viewButtons[0]);

    expect(onViewReportMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'comp-1' })
    );
  });
});
