/**
 * Renewal scoring tests (task 1.14, spec R5.3).
 *
 * The change-vs-status-quo dimension applies ONLY in renewal mode (when a
 * baseline reference is provided). NEW mode scoring stays byte-identical.
 * Env-touching modules are mocked so the suite runs without secrets.
 */

import { describe, it, expect, vi } from 'vitest';

vi.mock('../../config/domainConstants', () => ({
  getCanonicalCoverageNames: () => ['Incendio', 'Responsabilidad Civil', 'Robo'],
}));
vi.mock('../../config/featureFlags', () => ({
  featureFlags: { isEnabled: () => false },
}));
vi.mock('../hybridDeductibleParser', () => ({ hybridDeductibleParser: {} }));
vi.mock('../clauseCoverageValidator', () => ({ clauseCoverageValidator: {} }));

import { quoteScorer } from '../quoteScorer';
import { ParsedQuote } from '../quoteParser';

function makeQuote(overrides: Partial<ParsedQuote> = {}): ParsedQuote {
  return {
    insurerName: 'MAPFRE',
    policyName: 'PYME',
    priceAnnual: 9_000_000,
    currency: 'COP',
    coverages: [
      { name: 'Incendio', value: '600M', deductible: '10%', confidence: 90 },
      { name: 'Responsabilidad Civil', value: '100M', deductible: '5%', confidence: 90 },
      { name: 'Robo', value: '200M', deductible: '10%', confidence: 90 },
    ],
    specialConditions: [],
    rawText: '',
    parseConfidence: 90,
    ...overrides,
  };
}

const baseline: ParsedQuote = makeQuote({
  insurerName: 'Seguros Bolívar',
  priceAnnual: 8_500_000,
});

describe('quoteScorer — renewal change-vs-status-quo dimension (R5.3)', () => {
  it('leaves new-mode scoring untouched when no renewal context is passed', async () => {
    const quote = makeQuote();
    const base = await quoteScorer.calculateScore(quote, [], [quote]);

    expect(base.breakdown).not.toHaveProperty('changeVsStatusQuo');
    expect(Object.keys(base.breakdown)).toEqual([
      'coverage',
      'deductibles',
      'exclusions',
      'priceRatio',
      'sublimits',
      'warranties',
    ]);
  });

  it('rewards a candidate that improves on the baseline (more coverage, lower premium)', async () => {
    const candidate = makeQuote({
      priceAnnual: 7_500_000,
      coverages: [
        ...makeQuote().coverages,
        { name: 'Terremoto', value: '400M', deductible: '5%', confidence: 90 },
      ],
    });

    const base = await quoteScorer.calculateScore(candidate, [], [candidate]);
    const renewal = await quoteScorer.calculateScore(candidate, [], [candidate], undefined, undefined, 'pyme', {
      baseline,
    });

    // +10 gained coverage (Terremoto), +15 premium decrease → 75
    expect(renewal.breakdown.changeVsStatusQuo).toBe(75);
    // total = base blended with the change dimension at 15% weight
    expect(renewal.totalScore).toBe(Math.round(base.totalScore * 0.85 + 75 * 0.15));
    expect(renewal.totalScore).toBeLessThanOrEqual(100);
  });

  it('penalizes a candidate that worsens vs the baseline (lost coverage, higher premium, worse deductible)', async () => {
    const worse = makeQuote({
      priceAnnual: 10_000_000,
      coverages: [
        { name: 'Incendio', value: '600M', deductible: '20%', confidence: 90 },
        { name: 'Responsabilidad Civil', value: '100M', deductible: '5%', confidence: 90 },
        // Robo lost
      ],
    });

    const base = await quoteScorer.calculateScore(worse, [], [worse]);
    const renewal = await quoteScorer.calculateScore(worse, [], [worse], undefined, undefined, 'pyme', {
      baseline,
    });

    expect(renewal.breakdown.changeVsStatusQuo).toBeLessThan(50);
    expect(renewal.totalScore).toBeLessThan(base.totalScore);
  });

  it('is neutral (50) when the candidate matches the baseline', async () => {
    const same = makeQuote({ priceAnnual: 8_500_000 });

    const renewal = await quoteScorer.calculateScore(same, [], [same], undefined, undefined, 'pyme', {
      baseline,
    });

    expect(renewal.breakdown.changeVsStatusQuo).toBe(50);
  });

  it('ignores the premium effect when the baseline premium is unknown', async () => {
    const noPremiumBaseline = makeQuote({ priceAnnual: 0 });
    const candidate = makeQuote();

    const renewal = await quoteScorer.calculateScore(
      candidate,
      [],
      [candidate],
      undefined,
      undefined,
      'pyme',
      { baseline: noPremiumBaseline }
    );

    // same coverages and no price signal → neutral
    expect(renewal.breakdown.changeVsStatusQuo).toBe(50);
  });
});
