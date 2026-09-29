import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ClaimSimulatorPanel from '../report/ClaimSimulatorPanel';
import type { QuoteAnalysis } from '../../types';

describe('ClaimSimulatorPanel Component', () => {
  const mockQuotes: QuoteAnalysis[] = [
    {
      insurerName: 'SURA',
      policyName: 'Pyme Integral',
      priceMonthly: 1000000,
      priceAnnual: 12000000,
      currency: 'COP',
      deductibles: '10% de la pérdida, mín. 5 SMMLV',
      score: 85,
      clientAnalysis: '',
      technicalAnalysis: '',
      alerts: [],
      scoringBreakdown: {
        coverage: 90,
        deductibles: 85,
        exclusions: 80,
        priceRatio: 75,
        sublimits: 80,
        warranties: 85,
      },
      coverages: [
        {
          name: 'Incendio y Terremoto',
          value: '$500.000.000',
          deductible: '10% de la pérdida, mín. 5 SMMLV',
        },
      ],
    },
    {
      insurerName: 'Bolívar',
      policyName: 'Empresarial Bolívar',
      priceMonthly: 950000,
      priceAnnual: 11400000,
      currency: 'COP',
      deductibles: 'Sin deducible',
      score: 90,
      clientAnalysis: '',
      technicalAnalysis: '',
      alerts: [],
      scoringBreakdown: {
        coverage: 90,
        deductibles: 95,
        exclusions: 85,
        priceRatio: 80,
        sublimits: 85,
        warranties: 85,
      },
      coverages: [
        {
          name: 'Amparo Básico',
          value: '$500.000.000',
          deductible: 'Sin deducible',
        },
      ],
    },
  ];

  it('renders simulator header, slider, and quotes cards', () => {
    render(<ClaimSimulatorPanel quotes={mockQuotes} />);

    expect(screen.getByText(/simulador interactivo de siniestro/i)).toBeTruthy();
    expect(screen.getByText('SURA')).toBeTruthy();
    expect(screen.getByText('Bolívar')).toBeTruthy();
  });

  it('identifies the lowest deductible option (Bolívar con Sin deducible)', () => {
    render(<ClaimSimulatorPanel quotes={mockQuotes} />);

    expect(screen.getByText(/menor deducible/i)).toBeTruthy();
  });

  it('updates claim amount when clicking preset buttons', () => {
    render(<ClaimSimulatorPanel quotes={mockQuotes} />);

    const preset100M = screen.getByText('$100M COP');
    fireEvent.click(preset100M);

    expect(screen.getAllByText('$100.000.000 COP').length).toBeGreaterThanOrEqual(1);
  });
});
