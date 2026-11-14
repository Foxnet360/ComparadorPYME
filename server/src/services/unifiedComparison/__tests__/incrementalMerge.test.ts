import { describe, it, expect } from 'vitest';
import { mergeComparisonResults } from '../incrementalMerge';
import type { ComparisonResult } from '../../../controllers/analysisController';

describe('mergeComparisonResults', () => {
  it('appends new quotes and merges aligned matrix rows without losing existing insurers', () => {
    const existing = {
      quotes: [
        {
          insurerName: 'SURA',
          policyName: 'PYME SURA',
          priceAnnual: 5000000,
          currency: 'COP',
          coverages: [],
          alerts: [],
          score: 82,
        },
      ],
      matrix: [
        {
          categoryName: 'Incendio',
          canonicalName: 'Incendio',
          coverages: { SURA: { value: '100000000', deductible: '5%' } },
        },
      ],
      recommendation: 'SURA',
      marketAnalysis: '',
      deductibleComparison: [],
      timestamp: '2026-11-14T00:00:00Z',
      analysisVersion: '2.0',
    } as unknown as ComparisonResult & Record<string, unknown>;

    const incoming = {
      quotes: [
        {
          insurerName: 'ALLIANZ',
          policyName: 'PYME ALLIANZ',
          priceAnnual: 4800000,
          currency: 'COP',
          coverages: [],
          alerts: [],
          score: 89,
        },
      ],
      matrix: [
        {
          categoryName: 'Incendio',
          canonicalName: 'Incendio',
          coverages: { ALLIANZ: { value: '120000000', deductible: '1 SMMLV' } },
        },
        {
          categoryName: 'Lucro Cesante',
          canonicalName: 'Lucro Cesante',
          coverages: { ALLIANZ: { value: '50000000', deductible: 'No aplica' } },
        },
      ],
      recommendation: 'ALLIANZ',
      marketAnalysis: '',
      deductibleComparison: [],
      timestamp: '2026-11-14T01:00:00Z',
      analysisVersion: '2.0',
    } as unknown as ComparisonResult & Record<string, unknown>;

    const merged = mergeComparisonResults(existing, incoming);
    expect(merged.quotes).toHaveLength(2);
    expect(merged.quotes.map((q) => q.insurerName)).toEqual(['SURA', 'ALLIANZ']);

    const matrix = merged.matrix as Array<{
      canonicalName: string;
      coverages: Record<string, unknown>;
    }>;
    expect(matrix).toHaveLength(2);
    expect(Object.keys(matrix[0]!.coverages)).toEqual(['SURA', 'ALLIANZ']);
    expect(matrix[1]!.canonicalName).toBe('Lucro Cesante');
    expect(merged.recommendation).toContain('ALLIANZ');
    expect((merged.metadata as Record<string, unknown>).quoteCount).toBe(2);
  });

  it('disambiguates duplicate insurer names when adding another option from the same insurer', () => {
    const existing = {
      quotes: [
        {
          insurerName: 'SURA',
          policyName: 'Plan Básico',
          priceAnnual: 4000000,
          currency: 'COP',
          coverages: [],
          alerts: [],
          score: 75,
        },
      ],
      recommendation: '',
      marketAnalysis: '',
      deductibleComparison: [],
      timestamp: '',
      analysisVersion: '2.0',
    } as unknown as ComparisonResult & Record<string, unknown>;

    const incoming = {
      quotes: [
        {
          insurerName: 'SURA',
          policyName: 'Plan Plus',
          priceAnnual: 5500000,
          currency: 'COP',
          coverages: [],
          alerts: [],
          score: 85,
        },
      ],
      recommendation: '',
      marketAnalysis: '',
      deductibleComparison: [],
      timestamp: '',
      analysisVersion: '2.0',
    } as unknown as ComparisonResult & Record<string, unknown>;

    const merged = mergeComparisonResults(existing, incoming);
    expect(merged.quotes.map((q) => q.insurerName)).toEqual(['SURA', 'SURA (Opción 2)']);
  });
});
