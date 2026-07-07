import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { VirtualizedCoverageMatrix } from '../../../components/VirtualizedCoverageMatrix';
import { MatrixRow } from '../../../types';

vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: () => ({
    getVirtualItems: () => [
      { index: 0, start: 0, size: 40 },
      { index: 1, start: 40, size: 60 },
    ],
    getTotalSize: () => 100,
  }),
}));

vi.mock('../../../components/DeductibleBadge', () => ({
  DeductibleBadge: ({ deductible }: { deductible: string }) => <span>{deductible}</span>,
}));

const rows: MatrixRow[] = [
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
];

const quotes = [{ insurerName: 'MAPFRE' }, { insurerName: 'CHUBB' }];

describe('VirtualizedCoverageMatrix', () => {
  it('renders section header spanning all columns', () => {
    render(<VirtualizedCoverageMatrix rows={rows} quotes={quotes as any} />);

    expect(screen.getByText('INFORMACIÓN GENERAL')).toBeTruthy();
  });

  it('renders data row labels and insurer cell values', () => {
    render(<VirtualizedCoverageMatrix rows={rows} quotes={quotes as any} />);

    expect(screen.getByText('Prima con IVA')).toBeTruthy();
    expect(screen.getByText('$ 5.000.000')).toBeTruthy();
    expect(screen.getByText('$ 6.000.000')).toBeTruthy();
  });
});
