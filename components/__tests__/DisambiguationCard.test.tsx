import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import DisambiguationCard from '../report/DisambiguationCard';
import type { QuoteAnalysis } from '../../types';

describe('DisambiguationCard Component', () => {
  const mockQuotesWithAmbiguity: QuoteAnalysis[] = [
    {
      insurerName: 'Chubb',
      policyName: 'Empresarial Chubb',
      priceMonthly: 500000,
      priceAnnual: 6000000,
      currency: 'COP',
      deductibles: '10% mín. 5 SMMLV',
      score: 85,
      clientAnalysis: '',
      technicalAnalysis: '',
      alerts: [],
      scoringBreakdown: {
        coverage: 85,
        deductibles: 85,
        exclusions: 80,
        priceRatio: 75,
        sublimits: 80,
        warranties: 85,
      },
      coverages: [
        {
          name: 'Gastos de Preservación',
          value: '$50.000.000',
          canonicalName: 'Gastos de Extinción del Siniestro',
          matchConfidence: 0.68,
          needsHumanReview: true,
          justification: 'Equivalente funcional a salvamento de bienes.',
        },
      ],
    },
  ];

  it('renders nothing when there are no ambiguous coverages', () => {
    const cleanQuotes: QuoteAnalysis[] = [
      {
        ...mockQuotesWithAmbiguity[0]!,
        coverages: [
          {
            name: 'Incendio',
            value: '$100.000.000',
            canonicalName: 'Incendio',
            matchConfidence: 0.98,
            needsHumanReview: false,
          },
        ],
      },
    ];

    const { container } = render(<DisambiguationCard quotes={cleanQuotes} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders suggestions for coverages with ambiguous certainty', () => {
    render(<DisambiguationCard quotes={mockQuotesWithAmbiguity} />);

    expect(screen.getByText(/validación activa de ontología/i)).toBeTruthy();
    expect(screen.getByText('"Gastos de Preservación"')).toBeTruthy();
    expect(screen.getByText('Gastos de Extinción del Siniestro')).toBeTruthy();
    expect(screen.getByText('68% certeza')).toBeTruthy();
  });

  it('triggers onDisambiguate callback on 1-click confirmation and updates state', async () => {
    const handleDisambiguate = vi.fn().mockResolvedValue(undefined);

    render(
      <DisambiguationCard
        quotes={mockQuotesWithAmbiguity}
        onDisambiguate={handleDisambiguate}
      />
    );

    const confirmBtn = screen.getByRole('button', { name: /confirmar/i });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(handleDisambiguate).toHaveBeenCalledWith(
        'Gastos de Preservación',
        'Chubb',
        'Gastos de Extinción del Siniestro',
        'confirm'
      );
    });

    expect(screen.getByText(/asociada a "gastos de extinción del siniestro"/i)).toBeTruthy();
  });

  it('triggers onDisambiguate when choosing to keep coverage autonomous', async () => {
    const handleDisambiguate = vi.fn().mockResolvedValue(undefined);

    render(
      <DisambiguationCard
        quotes={mockQuotesWithAmbiguity}
        onDisambiguate={handleDisambiguate}
      />
    );

    const independentBtn = screen.getByRole('button', { name: /independiente/i });
    fireEvent.click(independentBtn);

    await waitFor(() => {
      expect(handleDisambiguate).toHaveBeenCalledWith(
        'Gastos de Preservación',
        'Chubb',
        'Gastos de Extinción del Siniestro',
        'keep_autonomous'
      );
    });

    expect(screen.getByText(/preservada como amparo independiente/i)).toBeTruthy();
  });
});
