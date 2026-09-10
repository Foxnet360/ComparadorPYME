/**
 * v3 matrix transformer tests (task 1.12, spec R2.2/R5.2).
 *
 * In renewal mode the matrix prepends a "Póliza Actual" baseline column:
 * every row gains a leading baseline cell flagged isBaseline, and a marker
 * header row carries isBaseline so consumers can render the baseline badge.
 * Without a reference quote the v3 output is the plain v2 matrix.
 */

import { describe, it, expect } from 'vitest';
import {
  flatResultToMatrixRowsV2,
  flatResultToMatrixRowsV3,
  FINANCIAL_SECTION_ID,
} from '../matrixTransformer';
import { FlatComparisonResultV2, SchemaSection } from '../comparisonSchema';
import { ParsedQuote } from '../../quoteParser';

function makeV2Result(): FlatComparisonResultV2 {
  return {
    schemaVersion: 2,
    metadata: {
      generatedAt: '2026-07-01T00:00:00Z',
      model: 'gemini-3.7-flash',
      pdfCount: 2,
      processingTimeMs: 100,
      confidence: 0.9,
      needsHumanReview: false,
    },
    insurers: ['MAPFRE', 'CHUBB'],
    rows: [
      {
        label: 'Incendio',
        section: SchemaSection.COBERTURAS,
        canonicalName: 'Incendio',
        cells: [
          { insurer: 'MAPFRE', value: '500M', confidence: 0.9 },
          { insurer: 'CHUBB', value: '600M', confidence: 0.9 },
        ],
      },
    ],
    extraRows: [
      {
        label: 'Prima total',
        section: SchemaSection.FINANCIAL,
        cells: [
          { insurer: 'MAPFRE', value: '$ 9.000.000' },
          { insurer: 'CHUBB', value: '$ 9.500.000' },
        ],
      },
    ],
    warnings: [],
  };
}

function makeReferenceQuote(): ParsedQuote {
  return {
    insurerName: 'Seguros Bolívar',
    policyName: 'PYME Empresarial',
    priceAnnual: 8_500_000,
    currency: 'COP',
    coverages: [
      {
        name: 'Incendio',
        canonicalName: 'Incendio',
        value: '450M',
        deductible: '10%',
        confidence: 95,
      },
    ],
    specialConditions: [],
    rawText: '',
    parseConfidence: 90,
  };
}

describe('flatResultToMatrixRowsV3 (R2.2 baseline column)', () => {
  it('matches the v2 matrix exactly when no reference quote is provided', () => {
    const v2 = flatResultToMatrixRowsV2(makeV2Result(), 'pyme');
    const v3 = flatResultToMatrixRowsV3(makeV2Result(), 'pyme');
    expect(v3).toEqual(v2);
  });

  it('prepends a baseline cell flagged isBaseline to every row', () => {
    const matrix = flatResultToMatrixRowsV3(makeV2Result(), 'pyme', makeReferenceQuote());
    for (const row of matrix) {
      expect(row.isBaseline).toBe(true);
      // candidate cells count + 1 baseline cell
      expect(row.cells[0]!.isBaseline).toBe(true);
    }
    const dataRow = matrix.find((r) => r.type === 'data' && r.label === 'Incendio');
    expect(dataRow).toBeDefined();
    expect(dataRow!.cells).toHaveLength(3);
    expect(dataRow!.cells[0]!.value).toBe('450M');
    expect(dataRow!.cells[1]!.value).toBe('500M');
    expect(dataRow!.cells[2]!.value).toBe('600M');
  });

  it('emits a "Póliza Actual" marker header row carrying isBaseline', () => {
    const matrix = flatResultToMatrixRowsV3(makeV2Result(), 'pyme', makeReferenceQuote());
    const marker = matrix.find((r) => r.id === 'baseline_column');
    expect(marker).toBeDefined();
    expect(marker!.type).toBe('header');
    expect(marker!.label).toContain('Póliza Actual');
    expect(marker!.isBaseline).toBe(true);
  });

  it('includes the incumbent name in the top header label', () => {
    const matrix = flatResultToMatrixRowsV3(makeV2Result(), 'pyme', makeReferenceQuote());
    const header = matrix.find((r) => r.id === 'client_info');
    expect(header!.label).toContain('Seguros Bolívar');
    expect(header!.label).toContain('MAPFRE');
  });

  it('fills the premium baseline cell from the reference priceAnnual', () => {
    const matrix = flatResultToMatrixRowsV3(makeV2Result(), 'pyme', makeReferenceQuote());
    const premiumRow = matrix.find(
      (r) => r.type === 'data' && r.sectionId === FINANCIAL_SECTION_ID
    );
    expect(premiumRow).toBeDefined();
    expect(premiumRow!.cells[0]!.value).toContain('8.500.000');
  });

  it('marks the baseline cell as not found when the reference lacks the coverage', () => {
    const reference = makeReferenceQuote();
    reference.coverages = [];
    const matrix = flatResultToMatrixRowsV3(makeV2Result(), 'pyme', reference);
    const dataRow = matrix.find((r) => r.type === 'data' && r.label === 'Incendio');
    expect(dataRow!.cells[0]!.value).toBe('No informado');
    expect(dataRow!.cells[0]!.isExcluded).toBe(true);
  });
});
