import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import RenewalAnalysisSection from '../../../components/report/RenewalAnalysisSection';
import type { CandidateRenewalAnalytics, RenewalBaseline } from '../../../types';

const baseline: RenewalBaseline = {
  insurerName: 'Seguros Bolívar',
  priceAnnual: 8500000,
  coverages: [{ name: 'Incendio', value: '100%', deductible: '5 SMMLV' }],
};

const analytics: CandidateRenewalAnalytics[] = [
  {
    insurer: 'Allianz',
    gaps: {
      coveragesLost: ['RC Familiar'],
      coveragesGained: ['Asistencia Jurídica'],
      deductibleWorsening: ['Incendio'],
      newExclusions: [],
    },
    premiumDelta: { absolute: -500000, percentage: -5.9, direction: 'decrease' },
    friction: ['Carencias: los períodos de carencia reinician al cambiar de aseguradora.'],
  },
  {
    insurer: 'MAPFRE',
    gaps: {
      coveragesLost: [],
      coveragesGained: [],
      deductibleWorsening: [],
      newExclusions: ['Terremoto'],
    },
    premiumDelta: { absolute: 300000, percentage: 3.5, direction: 'increase' },
    friction: [],
  },
];

describe('RenewalAnalysisSection (task 1.24, R2.2/R2.3)', () => {
  it('renders the baseline badge with insurer and annual premium', () => {
    render(<RenewalAnalysisSection baseline={baseline} analytics={analytics} />);

    expect(screen.getByText('Póliza Actual')).toBeTruthy();
    expect(screen.getByText(/Seguros Bolívar/)).toBeTruthy();
    expect(screen.getByText(/8500000/)).toBeTruthy();
  });

  it('renders one gap/delta panel per candidate', () => {
    render(<RenewalAnalysisSection baseline={baseline} analytics={analytics} />);

    expect(screen.getByLabelText('Análisis de brechas — Allianz')).toBeTruthy();
    expect(screen.getByLabelText('Análisis de brechas — MAPFRE')).toBeTruthy();
    expect(screen.getByText('RC Familiar')).toBeTruthy();
    expect(screen.getByText('Terremoto')).toBeTruthy();
  });

  it('renders nothing when neither baseline nor analytics are present', () => {
    const { container } = render(<RenewalAnalysisSection />);

    expect(container.firstChild).toBeNull();
  });

  it('renders baseline-only payload without candidate panels', () => {
    render(<RenewalAnalysisSection baseline={baseline} />);

    expect(screen.getByText('Póliza Actual')).toBeTruthy();
    expect(screen.queryByLabelText(/Análisis de brechas/)).toBeNull();
  });
});
