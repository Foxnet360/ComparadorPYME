/**
 * Golden fixture regression tests (task 1.15, spec R5.1/R5.2/XC-3).
 *
 * The v1/v2 matrix outputs are pinned to committed golden fixtures so the
 * schemaVersion 3 work (renewal mode) cannot drift the legacy shapes. The
 * fixtures were generated from the base-branch transformers; the v1/v2
 * function bodies are provably unchanged on this branch (additive-only
 * diff), and these tests fail if that ever regresses.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { flatResultToMatrixRows, flatResultToMatrixRowsV2 } from '../matrixTransformer';
import { FlatComparisonResult, FlatComparisonResultV2, SchemaSection } from '../comparisonSchema';

const FIXTURES = join(__dirname, '__fixtures__');

function readFixture(name: string): unknown {
  return JSON.parse(readFileSync(join(FIXTURES, name), 'utf-8'));
}

export const goldenV1Input: FlatComparisonResult = {
  schemaVersion: 1,
  metadata: {
    generatedAt: '2026-07-01T00:00:00Z',
    model: 'gemini-3.5-flash',
    pdfCount: 2,
    processingTimeMs: 1200,
    confidence: 0.92,
    needsHumanReview: false,
  },
  insurers: ['MAPFRE', 'CHUBB'],
  rows: [
    {
      label: 'Bienes Asegurados',
      cells: [
        { insurer: 'MAPFRE', value: 'Edificio $500M' },
        { insurer: 'CHUBB', value: 'Edificio y contenidos $600M' },
      ],
    },
    {
      label: 'Deducibles',
      cells: [
        { insurer: 'MAPFRE', value: '10%' },
        { insurer: 'CHUBB', value: '5%', rawText: 'ded 5%' },
      ],
    },
    {
      label: 'Prima con IVA',
      cells: [
        { insurer: 'MAPFRE', value: '$ 8.500.000' },
        { insurer: 'CHUBB', value: '$ 9.200.000' },
      ],
    },
    {
      label: 'Forma de Pago',
      cells: [
        { insurer: 'MAPFRE', value: 'Anual' },
        { insurer: 'CHUBB', value: 'Mensual' },
      ],
    },
  ],
  extraRows: [],
  warnings: ['Revisar deducible de CHUBB'],
};

export const goldenV2Input: FlatComparisonResultV2 = {
  schemaVersion: 2,
  metadata: {
    generatedAt: '2026-07-01T00:00:00Z',
    model: 'gemini-3.7-flash',
    pdfCount: 2,
    processingTimeMs: 900,
    confidence: 0.95,
    needsHumanReview: false,
  },
  insurers: ['MAPFRE', 'CHUBB'],
  rows: [
    {
      label: 'Incendio',
      section: SchemaSection.COBERTURAS,
      canonicalName: 'Incendio (Edificio y Contenidos)',
      cells: [
        { insurer: 'MAPFRE', value: '500M', confidence: 0.9 },
        { insurer: 'CHUBB', value: '600M', confidence: 0.95 },
      ],
    },
    {
      label: 'Prima total',
      section: SchemaSection.FINANCIAL,
      cells: [
        { insurer: 'MAPFRE', value: '$ 8.500.000' },
        { insurer: 'CHUBB', value: '$ 9.200.000' },
      ],
    },
  ],
  extraRows: [],
  warnings: [],
  quoteMetadata: [{ insurer: 'MAPFRE' }, { insurer: 'CHUBB' }],
};

describe('v1/v2 golden fixtures (R5.1/R5.2)', () => {
  it('v1 matrix output is byte-identical to the golden fixture', () => {
    const matrix = flatResultToMatrixRows(goldenV1Input, 'pyme');
    expect(matrix).toEqual(readFixture('golden-v1-matrix.json'));
    // Byte-identical: serialized form must match exactly.
    expect(JSON.stringify(matrix)).toBe(JSON.stringify(readFixture('golden-v1-matrix.json')));
  });

  it('v2 matrix output is byte-identical to the golden fixture', () => {
    const matrix = flatResultToMatrixRowsV2(goldenV2Input, 'pyme');
    expect(matrix).toEqual(readFixture('golden-v2-matrix.json'));
    expect(JSON.stringify(matrix)).toBe(JSON.stringify(readFixture('golden-v2-matrix.json')));
  });

  it('v1/v2 outputs never carry renewal artifacts (no isBaseline flags)', () => {
    for (const matrix of [
      flatResultToMatrixRows(goldenV1Input, 'pyme'),
      flatResultToMatrixRowsV2(goldenV2Input, 'pyme'),
    ]) {
      expect(matrix.every((row) => row.isBaseline === undefined)).toBe(true);
      expect(matrix.every((row) => row.cells.every((cell) => cell.isBaseline === undefined))).toBe(
        true
      );
      expect(matrix.find((row) => row.id === 'baseline_column')).toBeUndefined();
    }
  });
});
