import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
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
  apiClient: { fetch: vi.fn() },
}));

const sampleQuotes: QuoteAnalysis[] = [
  {
    insurerName: 'SURA',
    policyName: 'PYME SURA',
    priceMonthly: 400000,
    priceAnnual: 4800000,
    currency: 'COP',
    deductibles: '10%',
    coverages: [],
    alerts: [],
    scoringBreakdown: { price: 85, coverage: 90, deductibles: 80, insurerFinancialStrength: 95 },
    clientAnalysis: 'Completa',
    technicalAnalysis: 'Óptima',
    score: 88,
  },
];

function makeRows(count: number): MatrixRow[] {
  return Array.from({ length: count }, (_, idx) => ({
    type: 'data' as const,
    id: `cov_row_${idx + 1}`,
    label: `Cobertura ${idx + 1}`,
    sectionId: 1,
    cells: [{ value: `$ ${(idx + 1) * 1000000}`, isExcluded: false, isWinner: idx === 0 }],
  }));
}

describe('P3-T3: UnifiedCoverageMatrix Virtualization (>150 rows) (S3)', () => {
  it('renders <=150 rows directly without virtualization spacers', () => {
    const { container } = render(
      <AnalysisProvider>
        <UnifiedCoverageMatrix quotes={sampleQuotes} rows={makeRows(20)} />
      </AnalysisProvider>
    );

    expect(screen.getByText('Cobertura 1')).toBeTruthy();
    expect(screen.getByText('Cobertura 20')).toBeTruthy();
    expect(container.querySelector('[data-virtual-spacer="top"]')).toBeNull();
    expect(screen.queryByTestId('matrix-virtualization-bar')).toBeNull();
  });

  it('virtualizes >150 rows into a bounded DOM window and shifts visible rows on scroll', () => {
    const { container } = render(
      <AnalysisProvider>
        <UnifiedCoverageMatrix quotes={sampleQuotes} rows={makeRows(220)} />
      </AnalysisProvider>
    );

    const bar = screen.getByTestId('matrix-virtualization-bar');
    expect(bar.textContent).toContain('220');

    const renderedDataRows = container.querySelectorAll('tbody tr[role="row"]');
    expect(renderedDataRows.length).toBeLessThan(60);
    expect(screen.getByText('Cobertura 1')).toBeTruthy();
    expect(screen.queryByText('Cobertura 220')).toBeNull();

    const scrollContainer = screen.getByTestId('matrix-scroll-container');
    Object.defineProperty(scrollContainer, 'clientHeight', { value: 600, configurable: true });
    scrollContainer.scrollTop = 5200; // ~row 100
    fireEvent.scroll(scrollContainer);

    expect(screen.queryByText('Cobertura 1')).toBeNull();
    expect(screen.getByText('Cobertura 105')).toBeTruthy();

    const topSpacer = container.querySelector('[data-virtual-spacer="top"]') as HTMLElement | null;
    expect(topSpacer).not.toBeNull();
    expect(parseInt(topSpacer!.style.height || '0', 10)).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: /ver todas/i }));
    expect(container.querySelectorAll('tbody tr[role="row"]').length).toBe(220);
    expect(screen.getByText('Cobertura 220')).toBeTruthy();
  });
});
