import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { GapDeltaPanel } from '../../../components/GapDeltaPanel';
import type { CandidateRenewalAnalytics } from '../../../types';

const analytics: CandidateRenewalAnalytics = {
  insurer: 'Allianz',
  gaps: {
    coveragesLost: ['RC Familiar'],
    coveragesGained: ['Asistencia Jurídica'],
    deductibleWorsening: ['Incendio'],
    newExclusions: ['Terremoto'],
  },
  premiumDelta: { absolute: 250000, percentage: 12.5, direction: 'increase' },
  friction: ['Carencias: los períodos de carencia reinician al cambiar de aseguradora.'],
};

describe('GapDeltaPanel (R2.3/R2.4/R2.5)', () => {
  it('renders the gap analysis lists for a candidate', () => {
    render(<GapDeltaPanel analytics={analytics} />);

    expect(screen.getByText('Allianz')).toBeTruthy();
    expect(screen.getByText('RC Familiar')).toBeTruthy();
    expect(screen.getByText('Asistencia Jurídica')).toBeTruthy();
    expect(screen.getByText('Incendio')).toBeTruthy();
    expect(screen.getByText('Terremoto')).toBeTruthy();
  });

  it('renders a premium increase with direction and percentage (R2.4)', () => {
    render(<GapDeltaPanel analytics={analytics} />);

    expect(screen.getByText(/12\.5%/)).toBeTruthy();
    expect(screen.getByText(/aumento|incremento/i)).toBeTruthy();
  });

  it('renders a premium decrease for a cheaper candidate', () => {
    render(
      <GapDeltaPanel
        analytics={{
          ...analytics,
          premiumDelta: { absolute: -100000, percentage: -5, direction: 'decrease' },
        }}
      />
    );

    expect(screen.getByText(/5%/)).toBeTruthy();
    expect(screen.getByText(/ahorro|disminución/i)).toBeTruthy();
  });

  it('renders unknown delta when prices are missing', () => {
    render(
      <GapDeltaPanel
        analytics={{
          ...analytics,
          premiumDelta: { absolute: null, percentage: null, direction: 'unknown' },
        }}
      />
    );

    expect(screen.getByText(/no disponible/i)).toBeTruthy();
  });

  it('renders the switching-friction notes (R2.5)', () => {
    render(<GapDeltaPanel analytics={analytics} />);

    expect(screen.getByText(/carencia reinician/i)).toBeTruthy();
  });
});
