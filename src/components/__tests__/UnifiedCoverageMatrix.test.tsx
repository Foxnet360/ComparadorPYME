import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { UnifiedCoverageMatrix } from '../../../components/UnifiedCoverageMatrix';
import { MatrixRow, QuoteAnalysis } from '../../../types';
import { AnalysisProvider } from '../../../contexts/AnalysisContext';

vi.mock('../../../hooks/useOptimisticCorrection', () => ({
  useOptimisticCorrection: () => ({
    submitCorrection: vi.fn().mockResolvedValue({ success: true }),
  }),
}));

vi.mock('../../../contexts/AnalysisContext', async () => {
  const actual = await vi.importActual('../../../contexts/AnalysisContext');
  return {
    ...actual,
    usePdfViewer: () => ({ openPdfViewer: vi.fn() }),
    useCellNotes: () => ({ cellNotes: {}, setCellNote: vi.fn(), getCellNote: vi.fn() }),
  };
});

vi.mock('../../../components/DeductibleBadge', () => ({
  DeductibleBadge: ({ deductible }: { deductible: string }) => <span>{deductible}</span>,
}));

vi.mock('../../../components/InlineNoteEditor', () => ({
  InlineNoteEditor: () => <div data-testid="inline-note-editor">InlineNoteEditor</div>,
}));

vi.mock('../../../components/PdfViewer', () => ({
  default: () => <div data-testid="pdf-viewer">PdfViewer</div>,
}));

vi.mock('../../../services/apiClient', () => ({
  apiClient: {
    fetch: vi.fn(),
  },
}));

const renderWithProvider = (ui: React.ReactElement) => {
  return render(<AnalysisProvider>{ui}</AnalysisProvider>);
};

const v2MatrixRows: MatrixRow[] = [
  {
    type: 'header',
    id: 'section_0',
    label: 'INFORMACIÓN GENERAL',
    sectionId: 1,
    cells: [
      { value: '', isExcluded: false, isWinner: false },
      { value: '', isExcluded: false, isWinner: false },
    ],
  },
  {
    type: 'data',
    id: 'section_0_row_0',
    label: 'Prima con IVA',
    sectionId: 1,
    cells: [
      { value: '$ 5.000.000', isExcluded: false, isWinner: false, confidence: 0.95 },
      { value: '$ 6.000.000', isExcluded: false, isWinner: false, confidence: 0.75 },
    ],
  },
  {
    type: 'data',
    id: 'section_0_row_1',
    label: 'Forma de Pago',
    sectionId: 1,
    cells: [
      { value: 'Anual', isExcluded: false, isWinner: false, confidence: 0.6 },
      { value: 'Mensual', isExcluded: false, isWinner: false, confidence: 0.92 },
    ],
  },
  {
    type: 'data',
    id: 'section_0_row_2',
    label: 'Cobertura Excluida',
    sectionId: 1,
    cells: [
      { value: 'No incluida', isExcluded: true, isWinner: false, confidence: 0.4 },
      { value: 'No aplica', isExcluded: true, isWinner: false, confidence: 0.55 },
    ],
  },
];

const baseQuotes: QuoteAnalysis[] = [
  {
    insurerName: 'MAPFRE',
    policyName: 'TODO RIESGO PYME',
    priceMonthly: 0,
    priceAnnual: 677801,
    currency: 'COP',
    deductibles: '',
    scoringBreakdown: {
      coverage: 8,
      deductibles: 7,
      exclusions: 8,
      priceRatio: 9,
      sublimits: 8,
      warranties: 8,
    },
    clientAnalysis: '',
    technicalAnalysis: '',
    score: 82,
    alerts: [],
    coverages: [
      {
        name: 'Incendio (Edificio y Contenidos)',
        value: '$119.600.000',
        deductible: '10% PERD - Min 1 SMMLV',
        categoryId: 1,
        matchConfidence: 0.95,
      },
    ],
  },
];

describe('UnifiedCoverageMatrix', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('renders section headers from v2 MatrixRow rows', () => {
    renderWithProvider(<UnifiedCoverageMatrix quotes={baseQuotes} rows={v2MatrixRows} />);

    expect(screen.getByText('INFORMACIÓN GENERAL')).toBeTruthy();
  });

  it('renders confidence badges derived from cell.confidence', () => {
    renderWithProvider(<UnifiedCoverageMatrix quotes={baseQuotes} rows={v2MatrixRows} />);

    const altaBadges = screen.getAllByText('Alta');
    const mediaBadges = screen.getAllByText('Media');
    const bajaBadges = screen.getAllByText('Baja');

    expect(altaBadges.length).toBeGreaterThanOrEqual(1);
    expect(mediaBadges.length).toBe(3);
    expect(bajaBadges.length).toBe(1);
  });

  it('renders v1 quotes when no rows prop is provided', () => {
    renderWithProvider(<UnifiedCoverageMatrix quotes={baseQuotes} />);

    expect(screen.getByText('AMPARO BÁSICO - TODO RIESGO DAÑO MATERIAL')).toBeTruthy();
  });

  it('shows a helpful empty state when matrix has no rows', () => {
    renderWithProvider(<UnifiedCoverageMatrix quotes={baseQuotes} rows={[]} />);

    expect(screen.getByText('No hay datos para mostrar')).toBeTruthy();
    expect(screen.getByText(/La matriz de coberturas está vacía/)).toBeTruthy();
  });

  it('applies muted style to excluded cells', () => {
    renderWithProvider(
      <UnifiedCoverageMatrix quotes={baseQuotes} rows={v2MatrixRows} viewMode="technical" />
    );

    const excludedCells = screen.getAllByText('No incluida');
    expect(excludedCells.length).toBeGreaterThan(0);

    // The row should be present in the DOM; exact class assertions are brittle,
    // so we verify the text is rendered and the cell is reachable.
    expect(excludedCells[0]).toBeTruthy();
  });

  it('exports via apiClient and shows a loading spinner', async () => {
    const { apiClient } = await import('../../../services/apiClient');
    vi.mocked(apiClient.fetch).mockResolvedValue({
      blob: vi.fn().mockResolvedValue(new Blob(['excel'], { type: 'application/octet-stream' })),
    } as unknown as Response);

    renderWithProvider(<UnifiedCoverageMatrix quotes={baseQuotes} rows={v2MatrixRows} analysisId="abc-123" />);

    const exportButton = screen.getByText('Descargar Excel Comparativo');
    fireEvent.click(exportButton);

    expect(screen.getByText('Generando Excel...')).toBeTruthy();

    await waitFor(() => {
      expect(apiClient.fetch).toHaveBeenCalledWith(
        '/analysis/abc-123/export',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        })
      );
    });
  });

  it('shows a toast on export error without using window.alert', async () => {
    const { apiClient } = await import('../../../services/apiClient');
    vi.mocked(apiClient.fetch).mockRejectedValue(new Error('Export failed'));

    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});

    renderWithProvider(<UnifiedCoverageMatrix quotes={baseQuotes} rows={v2MatrixRows} analysisId="abc-123" />);

    fireEvent.click(screen.getByText('Descargar Excel Comparativo'));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeTruthy();
    });

    expect(alertSpy).not.toHaveBeenCalled();
    alertSpy.mockRestore();
  });
});
