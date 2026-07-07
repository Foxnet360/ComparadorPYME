import { describe, it, expect } from 'vitest';

// Import the parseMonetaryValue function from winnerDetection
// Since it's not exported, we'll test it through the public API
import { findWinnerByCategory, findOverallWinner } from '../utils/winnerDetection';
import type { QuoteAnalysis } from '../types';

describe('Winner Detection', () => {
  const createMockQuote = (
    insurerName: string,
    priceAnnual: number,
    coverages: Array<{ name: string; value: string; deductible?: string }>
  ): QuoteAnalysis => ({
    insurerName,
    policyName: 'Test Policy',
    priceMonthly: priceAnnual / 12,
    priceAnnual,
    currency: 'COP',
    deductibles: '',
    coverages: coverages.map((c) => ({
      name: c.name,
      value: c.value,
      deductible: c.deductible || '',
      categoryId: 1,
      canonicalName: c.name,
    })),
    alerts: [],
    scoringBreakdown: {
      coverage: 0,
      deductibles: 0,
      exclusions: 0,
      priceRatio: 0,
      sublimits: 0,
      warranties: 0,
    },
    clientAnalysis: '',
    technicalAnalysis: '',
    score: 0,
  });

  it('should find winner by category with higher sum insured', () => {
    const quotes = [
      createMockQuote('Insurer A', 1000000, [{ name: 'Incendio', value: '500M' }]),
      createMockQuote('Insurer B', 1000000, [{ name: 'Incendio', value: '1000M' }]),
    ];

    const winner = findWinnerByCategory(quotes, 1, 'Incendio');
    expect(winner).not.toBeNull();
    expect(winner?.insurerName).toBe('Insurer B');
  });

  it('should return null for single quote', () => {
    const quotes = [createMockQuote('Insurer A', 1000000, [{ name: 'Incendio', value: '500M' }])];

    const winner = findWinnerByCategory(quotes, 1, 'Incendio');
    expect(winner).toBeNull();
  });

  it('should find overall winner by score', () => {
    const quotes = [
      { ...createMockQuote('Insurer A', 1000000, []), score: 80 },
      { ...createMockQuote('Insurer B', 1200000, []), score: 90 },
      { ...createMockQuote('Insurer C', 900000, []), score: 70 },
    ];

    const winner = findOverallWinner(quotes);
    expect(winner).not.toBeNull();
    expect(winner?.insurerName).toBe('Insurer B');
  });

  it('should handle decimal abbreviations correctly', () => {
    const quotes = [
      createMockQuote('Insurer A', 1000000, [{ name: 'Incendio', value: '1.5M' }]),
      createMockQuote('Insurer B', 1000000, [{ name: 'Incendio', value: '2.3M' }]),
    ];

    const winner = findWinnerByCategory(quotes, 1, 'Incendio');
    expect(winner).not.toBeNull();
    expect(winner?.insurerName).toBe('Insurer B');
  });
});
