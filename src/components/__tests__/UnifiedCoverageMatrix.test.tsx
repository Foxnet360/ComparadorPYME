import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
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
  it('renders section headers from v2 MatrixRow rows', () => {
    renderWithProvider(<UnifiedCoverageMatrix quotes={baseQuotes} rows={v2MatrixRows} />);

    expect(screen.getByText('INFORMACIÓN GENERAL')).toBeTruthy();
  });

  it('renders confidence badges derived from cell.confidence', () => {
    renderWithProvider(<UnifiedCoverageMatrix quotes={baseQuotes} rows={v2MatrixRows} />);

    const exactoBadges = screen.getAllByText('Exacto');
    const aproximadoBadges = screen.getAllByText('Aproximado');
    const revisarBadges = screen.getAllByText('Revisar');

    expect(exactoBadges.length).toBeGreaterThanOrEqual(1);
    expect(aproximadoBadges.length).toBe(1);
    expect(revisarBadges.length).toBe(1);
  });

  it('renders v1 quotes when no rows prop is provided', () => {
    renderWithProvider(<UnifiedCoverageMatrix quotes={baseQuotes} />);

    expect(screen.getByText('AMPARO BÁSICO - TODO RIESGO DAÑO MATERIAL')).toBeTruthy();
  });
});
