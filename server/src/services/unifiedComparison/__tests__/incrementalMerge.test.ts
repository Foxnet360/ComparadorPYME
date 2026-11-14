import { describe, it, expect } from 'vitest';
import { mergeComparisonResults } from '../incrementalMerge';
import type { ComparisonResult } from '../../../controllers/analysisController';
import type { MatrixRow } from '../../../types';

describe('mergeComparisonResults', () => {
  it('appends new quotes, positional MatrixRow.cells, quoteMetadata and deductibleComparison', () => {
    const existing = {
      quotes: [
        {
          insurerName: 'SURA',
          policyName: 'PYME SURA',
          priceAnnual: 5000000,
          currency: 'COP',
          coverages: [{ name: 'Incendio', value: '100000000', deductible: '5%' }],
          alerts: [],
          score: 82,
        },
      ],
      matrix: [
        {
          type: 'header',
          id: 'h-1',
          label: 'Coberturas',
          sectionId: 1,
          cells: [{ value: 'SURA', isExcluded: false, isWinner: false }],
        },
        {
          type: 'data',
          id: 'row-incendio',
          label: 'Incendio',
          canonicalName: 'Incendio',
          sectionId: 1,
          cells: [{ value: '$100.000.000', isExcluded: false, isWinner: false }],
        },
        {
          type: 'data',
          id: 'row-terremoto',
          label: 'Terremoto',
          canonicalName: 'Terremoto',
          sectionId: 1,
          cells: [{ value: '$100.000.000', isExcluded: false, isWinner: false }],
        },
      ] as MatrixRow[],
      quoteMetadata: [{ insurer: 'SURA', vigencia: '2026-2027' }],
      deductibleComparison: [{ insurer: 'SURA', deductibleText: 'Incendio: 5%' }],
      recommendation: 'SURA',
      marketAnalysis: '',
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
          coverages: [{ name: 'Incendio', value: '120000000', deductible: '1 SMMLV' }],
          alerts: [],
          score: 89,
        },
      ],
      matrix: [
        {
          type: 'header',
          id: 'h-1',
          label: 'Coberturas',
          sectionId: 1,
          cells: [{ value: 'ALLIANZ', isExcluded: false, isWinner: false }],
        },
        {
          type: 'data',
          id: 'row-incendio',
          label: 'Incendio',
          canonicalName: 'Incendio',
          sectionId: 1,
          cells: [{ value: '$120.000.000', isExcluded: false, isWinner: true }],
        },
        {
          type: 'data',
          id: 'row-lucro',
          label: 'Lucro Cesante',
          canonicalName: 'Lucro Cesante',
          sectionId: 2,
          cells: [{ value: '$50.000.000', isExcluded: false, isWinner: false }],
        },
      ] as MatrixRow[],
      quoteMetadata: [{ insurer: 'ALLIANZ', vigencia: '2026-2027' }],
      deductibleComparison: [{ insurer: 'ALLIANZ', deductibleText: 'Incendio: 1 SMMLV' }],
      recommendation: 'ALLIANZ',
      marketAnalysis: '',
      timestamp: '2026-11-14T01:00:00Z',
      analysisVersion: '2.0',
    } as unknown as ComparisonResult & Record<string, unknown>;

    const merged = mergeComparisonResults(existing, incoming);
    expect(merged.quotes).toHaveLength(2);
    expect(merged.quotes.map((q) => q.insurerName)).toEqual(['SURA', 'ALLIANZ']);

    const matrix = merged.matrix as MatrixRow[];
    expect(matrix).toHaveLength(4); // header + Incendio + Terremoto + Lucro Cesante
    expect(matrix[0]!.cells.map((c) => c.value)).toEqual(['SURA', 'ALLIANZ']);
    expect(matrix[1]!.cells.map((c) => c.value)).toEqual(['$100.000.000', '$120.000.000']);
    expect(matrix[2]!.cells.map((c) => c.value)).toEqual(['$100.000.000', 'No cotizada']);
    expect(matrix[3]!.cells.map((c) => c.value)).toEqual(['No cotizada', '$50.000.000']);

    expect((merged.quoteMetadata as Array<{ insurer: string }>).map((m) => m.insurer)).toEqual([
      'SURA',
      'ALLIANZ',
    ]);
    expect(merged.deductibleComparison).toHaveLength(2);
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
