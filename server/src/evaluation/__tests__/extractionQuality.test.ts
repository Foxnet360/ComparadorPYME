import { describe, it, expect } from 'vitest';
import path from 'path';
import {
  normalizeCellValue,
  compareCellValues,
  calculateMatchRate,
  matrixRowsToFlatResult,
  runExtractionQualityEval,
  type ExtractionQualityFixture,
} from '../extractionQualityEval';
import type { FlatComparisonResult } from '../../services/unifiedComparison/comparisonSchema';
import type { MatrixRow } from '../../types';

function makeFlatResult(
  insurers: string[],
  overrides: Partial<Record<string, Record<string, string | null>>> = {}
): FlatComparisonResult {
  const rows = ['Bienes Asegurados', 'Deducibles', 'Prima con IVA', 'Forma de Pago'];
  return {
    metadata: {
      generatedAt: new Date().toISOString(),
      model: 'gemini-test',
      pdfCount: insurers.length,
      processingTimeMs: 100,
      confidence: 0.9,
      needsHumanReview: false,
    },
    insurers,
    rows: rows.map((label) => ({
      label,
      cells: insurers.map((insurer) => {
        const value = overrides[label]?.[insurer] ?? 'No informado';
        return {
          insurer,
          value,
          rawText: value ?? undefined,
          notFound: value === null || value === 'No informado' ? true : undefined,
        };
      }),
    })),
    extraRows: [],
    warnings: [],
  };
}

describe('normalizeCellValue', () => {
  it('lowercases, removes accents and collapses whitespace', () => {
    expect(normalizeCellValue('  Prima CON IVA: $1.234.567  ')).toBe('prima con iva 1234567');
  });

  it('treats null and "No informado" as empty', () => {
    expect(normalizeCellValue(null)).toBe('');
    expect(normalizeCellValue('No informado')).toBe('');
    expect(normalizeCellValue('NO INFORMADO')).toBe('');
  });
});

describe('compareCellValues', () => {
  it('considers accent and case differences equivalent', () => {
    expect(compareCellValues('Prima con IVA', 'prima con iva')).toBe(true);
    expect(compareCellValues('Deducibles', 'DEDUCIBLES')).toBe(true);
  });

  it('treats empty and "No informado" as equivalent', () => {
    expect(compareCellValues('', 'No informado')).toBe(true);
    expect(compareCellValues(null, '')).toBe(true);
  });

  it('detects real value mismatches', () => {
    expect(compareCellValues('$1.000.000', '$2.000.000')).toBe(false);
  });
});

describe('calculateMatchRate', () => {
  it('returns a 100% match when baseline and tool agree', () => {
    const baseline = makeFlatResult(['A', 'B']);
    const tool = makeFlatResult(['A', 'B']);
    const report = calculateMatchRate(baseline, tool);

    expect(report.matchRate).toBe(1);
    expect(report.mismatches).toHaveLength(0);
    expect(report.totalCells).toBe(8);
  });

  it('reports mismatches and a fractional match rate', () => {
    const baseline = makeFlatResult(['A', 'B'], {
      'Prima con IVA': { A: '$1.000.000', B: '$2.000.000' },
    });
    const tool = makeFlatResult(['A', 'B'], {
      'Prima con IVA': { A: '$1.000.000', B: '$2.500.000' },
    });
    const report = calculateMatchRate(baseline, tool);

    expect(report.totalCells).toBe(8);
    expect(report.mismatches).toHaveLength(1);
    expect(report.mismatches[0]).toMatchObject({
      row: 'Prima con IVA',
      insurer: 'B',
      baseline: '$2.000.000',
      tool: '$2.500.000',
    });
    expect(report.matchRate).toBeCloseTo(7 / 8, 6);
  });

  it('aligns insurers by normalized name when order differs', () => {
    const baseline = makeFlatResult(['Aseguradora A', 'Aseguradora B'], {
      'Bienes Asegurados': { 'Aseguradora A': 'Edificio', 'Aseguradora B': 'Contenidos' },
    });
    const tool = makeFlatResult(['ASEGURADORA B', 'Aseguradora A'], {
      'Bienes Asegurados': { 'ASEGURADORA B': 'Contenidos', 'Aseguradora A': 'Edificio' },
    });
    const report = calculateMatchRate(baseline, tool);

    expect(report.matchRate).toBe(1);
    expect(report.mismatches).toHaveLength(0);
  });

  it('counts a missing aligned insurer as a mismatch', () => {
    const baseline = makeFlatResult(['A', 'B', 'C']);
    const tool = makeFlatResult(['A', 'B']);
    const report = calculateMatchRate(baseline, tool);

    expect(report.totalCells).toBe(12);
    expect(report.mismatches.length).toBeGreaterThan(0);
  });
});

describe('matrixRowsToFlatResult', () => {
  it('reconstructs a flat result from matrix rows', () => {
    const matrix: MatrixRow[] = [
      {
        type: 'header',
        id: 'client_info',
        label: 'Cotizaciones PYME - Aseguradora A, Aseguradora B',
        sectionId: 0,
        cells: [],
      },
      {
        type: 'header',
        id: 'section_0',
        label: 'INFORMACIÓN GENERAL',
        sectionId: 1,
        cells: [],
      },
      {
        type: 'data',
        id: 'section_0_row_0',
        label: 'Bienes Asegurados',
        sectionId: 1,
        cells: [
          { value: 'Edificio', isExcluded: false, isWinner: false },
          { value: 'Contenidos', isExcluded: false, isWinner: false },
        ],
      },
      {
        type: 'data',
        id: 'section_0_row_1',
        label: 'Deducibles',
        sectionId: 1,
        cells: [
          { value: '10%', isExcluded: false, isWinner: false },
          { value: '5%', isExcluded: false, isWinner: false },
        ],
      },
      {
        type: 'data',
        id: 'section_0_row_2',
        label: 'Prima con IVA',
        sectionId: 1,
        cells: [
          { value: '$1.000.000', isExcluded: false, isWinner: false },
          { value: '$2.000.000', isExcluded: false, isWinner: false },
        ],
      },
      {
        type: 'data',
        id: 'section_0_row_3',
        label: 'Forma de Pago',
        sectionId: 1,
        cells: [
          { value: 'Anual', isExcluded: false, isWinner: false },
          { value: 'Mensual', isExcluded: false, isWinner: false },
        ],
      },
    ];

    const result = matrixRowsToFlatResult(matrix);

    expect(result.insurers).toEqual(['Aseguradora A', 'Aseguradora B']);
    expect(result.rows).toHaveLength(4);
    expect(result.rows.map((r) => r.label)).toEqual([
      'Bienes Asegurados',
      'Deducibles',
      'Prima con IVA',
      'Forma de Pago',
    ]);
    expect(result.rows[0].cells.map((c) => c.value)).toEqual(['Edificio', 'Contenidos']);
  });

  it('fills missing canonical rows with "No informado"', () => {
    const matrix: MatrixRow[] = [
      {
        type: 'header',
        id: 'client_info',
        label: 'Cotizaciones PYME - Aseguradora A',
        sectionId: 0,
        cells: [],
      },
      {
        type: 'data',
        id: 'section_0_row_0',
        label: 'Bienes Asegurados',
        sectionId: 1,
        cells: [{ value: 'Edificio', isExcluded: false, isWinner: false }],
      },
    ];

    const result = matrixRowsToFlatResult(matrix);
    const primaRow = result.rows.find((r) => r.label === 'Prima con IVA');
    expect(primaRow).toBeDefined();
    expect(primaRow!.cells[0].value).toBe('No informado');
    expect(primaRow!.cells[0].notFound).toBe(true);
  });
});

describe('extraction quality regression', () => {
  it('runs the evaluation harness when fixtures and API are available', async () => {
    const fixture: ExtractionQualityFixture = {
      name: 'pyme-3-quotes',
      description: 'Test fixture',
      pdfPaths: [],
      baselineSnapshotPath: path.resolve(
        __dirname,
        '../fixtures/extraction-quality/baseline-snapshot.json'
      ),
    };

    if (!process.env.GEMINI_API_KEY) {
      // The spec requires this suite to run against the real API; skip when unavailable.
      console.log('Skipping extraction quality regression: GEMINI_API_KEY not set');
      return;
    }

    const report = await runExtractionQualityEval(fixture);

    expect(report.fallbackRate).toBeLessThanOrEqual(0.1);
    expect(report.matchRate).toBeGreaterThanOrEqual(0.9);
    expect(report.passed).toBe(true);
  });
});
