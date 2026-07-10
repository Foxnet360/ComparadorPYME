import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DeductibleMatrix } from '../../../components/DeductibleMatrix';
import { QuoteAnalysis } from '../../../types';

const CATEGORY_NAME = 'Incendio (Edificio y Contenidos)';

const makeQuote = (
  insurerName: string,
  deductible: string | undefined,
  categoryName: string = CATEGORY_NAME
): QuoteAnalysis => ({
  insurerName,
  policyName: 'TODO RIESGO PYME',
  priceMonthly: 50000,
  priceAnnual: 600000,
  currency: 'COP',
  deductibles: deductible || 'No especificado',
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
  score: 80,
  alerts: [],
  coverages: [
    {
      name: categoryName,
      value: '$100.000.000',
      deductible: deductible || 'No especificado',
      canonicalName: categoryName,
    },
  ],
});

describe('DeductibleMatrix', () => {
  it('counts unspecified deductibles case-insensitively', () => {
    const quotes = [
      makeQuote('Aseguradora A', '10% PERD - Min 1 SMMLV'),
      makeQuote('Aseguradora B', 'NO ESPECIFICADO'),
      makeQuote('Aseguradora C', 'No Especificado'),
    ];

    render(<DeductibleMatrix quotes={quotes} />);

    // Two insurers have unspecified deductibles
    expect(screen.getByText('2 aseguradoras con deducibles no especificados')).toBeTruthy();
    // Aseguradora A is the only one with a specified deductible, so it should appear in the summary
    expect(screen.getAllByText('Aseguradora A').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Mejor Opción').length).toBeGreaterThan(0);
  });

  it('normalizes S.M.M.L.V. dotted variations to SMMLV in display', () => {
    const quotes = [makeQuote('Aseguradora A', '10% PERD - Min 1 S.M.M.L.V.')];

    render(<DeductibleMatrix quotes={quotes} />);

    // The normalized text should be rendered instead of the dotted variant
    expect(screen.getByText(/1 SMMLV/)).toBeTruthy();
  });

  it('renders a fallback for missing deductibles', () => {
    const quotes = [makeQuote('Aseguradora A', undefined)];

    render(<DeductibleMatrix quotes={quotes} />);

    expect(screen.getByText('1 aseguradoras con deducibles no especificados')).toBeTruthy();
  });
});
