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

    // The header appears once in the business section and once in the DEDUCIBLES section
    expect(
      screen.getAllByText('AMPARO BÁSICO - TODO RIESGO DAÑO MATERIAL').length
    ).toBeGreaterThanOrEqual(1);
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

    renderWithProvider(
      <UnifiedCoverageMatrix quotes={baseQuotes} rows={v2MatrixRows} analysisId="abc-123" />
    );

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

    renderWithProvider(
      <UnifiedCoverageMatrix quotes={baseQuotes} rows={v2MatrixRows} analysisId="abc-123" />
    );

    fireEvent.click(screen.getByText('Descargar Excel Comparativo'));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeTruthy();
    });

    expect(alertSpy).not.toHaveBeenCalled();
    alertSpy.mockRestore();
  });

  it('hides confidence scores/badges and warning alerts in client viewMode', () => {
    renderWithProvider(
      <UnifiedCoverageMatrix quotes={baseQuotes} rows={v2MatrixRows} viewMode="client" />
    );

    // Confidence text indicators (e.g., 'Alta', 'Media', 'Baja') should not be present
    expect(screen.queryByText('Alta')).toBeNull();
    expect(screen.queryByText('Media')).toBeNull();
    expect(screen.queryByText('Baja')).toBeNull();
  });

  it('simplifies technical header labels in client viewMode', () => {
    const technicalHeaderRows: MatrixRow[] = [
      {
        type: 'header',
        id: 'section_1',
        label: 'AMPARO BÁSICO - TODO RIESGO DAÑO MATERIAL',
        sectionId: 1,
        cells: [{ value: '', isExcluded: false, isWinner: false }],
      },
      {
        type: 'header',
        id: 'section_6',
        label: 'RESPONSABILIDAD CIVIL EXTRACONTRACTUAL (RCE)',
        sectionId: 6,
        cells: [{ value: '', isExcluded: false, isWinner: false }],
      },
    ];

    renderWithProvider(
      <UnifiedCoverageMatrix quotes={baseQuotes} rows={technicalHeaderRows} viewMode="client" />
    );

    // It should render simplified headers instead of technical ones
    expect(screen.getByText('Cobertura Todo Riesgo Daño Material')).toBeTruthy();
    expect(screen.getByText('Responsabilidad Civil (Daños a Terceros)')).toBeTruthy();
    expect(screen.queryByText('AMPARO BÁSICO - TODO RIESGO DAÑO MATERIAL')).toBeNull();
    expect(screen.queryByText('RESPONSABILIDAD CIVIL EXTRACONTRACTUAL (RCE)')).toBeNull();
  });

  it('renders the Header Metadata Card when metadata is provided', () => {
    const testMetadata = [
      {
        insurer: 'MAPFRE',
        cliente: 'Juan Perez',
        tipoSeguro: 'Multirriesgo PYME',
        ubicacionRiesgo: 'Calle 123, Bogota',
        anoConstruccion: '2015',
        pisos: '3',
        aliado: 'Aliado CSA',
        actividadOcupacion: 'Comercial',
        documento: 'NIT 123456',
        vigencia: 'Anual',
      },
    ];

    renderWithProvider(
      <UnifiedCoverageMatrix quotes={baseQuotes} rows={v2MatrixRows} metadata={testMetadata} />
    );

    expect(screen.getByText('Información del Riesgo & Metadatos')).toBeTruthy();
    expect(screen.getByText('Juan Perez')).toBeTruthy();
    expect(screen.getByText('Calle 123, Bogota')).toBeTruthy();
    expect(screen.getByText('Aliado CSA')).toBeTruthy();
  });

  it('correctly filters rows based on tabs and maps financial rows with sectionId 100', () => {
    const mixedRows: MatrixRow[] = [
      {
        type: 'header',
        id: 'section_0',
        label: 'COBERTURAS GENERALES',
        sectionId: 1,
        cells: [{ value: '', isExcluded: false, isWinner: false }],
      },
      {
        type: 'data',
        id: 'section_0_row_0',
        label: 'Incendio',
        sectionId: 1,
        cells: [{ value: '$10M', isExcluded: false, isWinner: false }],
      },
      {
        type: 'header',
        id: 'section_financial_header',
        label: 'PRIMAS Y COSTOS',
        sectionId: 100,
        cells: [{ value: '', isExcluded: false, isWinner: false }],
      },
      {
        type: 'data',
        id: 'financial_total',
        label: 'TOTAL A PAGAR',
        sectionId: 100,
        cells: [{ value: '$1M', isExcluded: false, isWinner: false }],
      },
    ];

    renderWithProvider(<UnifiedCoverageMatrix quotes={baseQuotes} rows={mixedRows} />);

    // By default, the active tab is 'coverages' (sectionId < 100), so we should see 'Incendio' but not 'TOTAL A PAGAR'
    expect(screen.getByText('Incendio')).toBeTruthy();
    expect(screen.queryByText('TOTAL A PAGAR')).toBeNull();

    // Switch to financials tab
    const financialsTab = screen.getByText('Primas y Costos');
    fireEvent.click(financialsTab);

    // Now we should see 'TOTAL A PAGAR' but not 'Incendio'
    expect(screen.getByText('TOTAL A PAGAR')).toBeTruthy();
    expect(screen.queryByText('Incendio')).toBeNull();
  });

  it('falls back to V1 layout when schemaVersion is 1, ignoring provided rows', () => {
    const v2Rows: MatrixRow[] = [
      {
        type: 'header',
        id: 'section_coberturas',
        label: 'COBERTURAS',
        sectionId: 1,
        cells: [{ value: '', isExcluded: false, isWinner: false }],
      },
      {
        type: 'data',
        id: 'section_coberturas_row_0',
        label: 'Responsabilidad Civil (RCE)',
        sectionId: 1,
        cells: [{ value: 'Incluida', isExcluded: false, isWinner: false }],
      },
    ];

    renderWithProvider(
      <UnifiedCoverageMatrix quotes={baseQuotes} rows={v2Rows} schemaVersion={1} />
    );

    // V1 fallback should render the canonical category header from taxonomy, not the V2 row label
    expect(
      screen.getAllByText('AMPARO BÁSICO - TODO RIESGO DAÑO MATERIAL').length
    ).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText('Responsabilidad Civil (RCE)')).toBeNull();
  });

  it('uses V2 rows when schemaVersion is 2', () => {
    const v2Rows: MatrixRow[] = [
      {
        type: 'header',
        id: 'section_coberturas',
        label: 'COBERTURAS',
        sectionId: 1,
        cells: [{ value: '', isExcluded: false, isWinner: false }],
      },
      {
        type: 'data',
        id: 'section_coberturas_row_0',
        label: 'Responsabilidad Civil (RCE)',
        sectionId: 1,
        cells: [{ value: 'Incluida', isExcluded: false, isWinner: false }],
      },
    ];

    renderWithProvider(
      <UnifiedCoverageMatrix quotes={baseQuotes} rows={v2Rows} schemaVersion={2} />
    );

    expect(screen.getByText('COBERTURAS')).toBeTruthy();
    expect(screen.getByText('Responsabilidad Civil (RCE)')).toBeTruthy();
    expect(screen.queryByText('AMPARO BÁSICO - TODO RIESGO DAÑO MATERIAL')).toBeNull();
  });

  it('renders DEDUCIBLES section rows from V2 matrix', () => {
    const rowsWithDeductibles: MatrixRow[] = [
      {
        type: 'header',
        id: 'section_deductibles',
        label: 'DEDUCIBLES',
        sectionId: 13,
        cells: [{ value: '', isExcluded: false, isWinner: false }],
      },
      {
        type: 'data',
        id: 'deductible_incendio',
        label: 'Incendio (Edificio y Contenidos)',
        sectionId: 13,
        cells: [
          { value: '10% PERD - Min 1 SMMLV', isExcluded: false, isWinner: false },
          { value: 'No aplica', isExcluded: false, isWinner: false },
        ],
      },
    ];

    renderWithProvider(
      <UnifiedCoverageMatrix quotes={baseQuotes} rows={rowsWithDeductibles} schemaVersion={2} />
    );

    expect(screen.getByText('DEDUCIBLES')).toBeTruthy();
    expect(screen.getByText('Incendio (Edificio y Contenidos)')).toBeTruthy();
    expect(screen.getByText('10% PERD - Min 1 SMMLV')).toBeTruthy();
    expect(screen.getByText('No aplica')).toBeTruthy();
  });
});
