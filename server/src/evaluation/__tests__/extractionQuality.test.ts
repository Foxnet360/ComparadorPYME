import { describe, it, expect, vi, afterEach } from 'vitest';
import path from 'path';
import { promises as fs } from 'fs';
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
import { comparisonEngineAdapter } from '../../services/unifiedComparison/comparisonEngineAdapter';
import { featureFlags } from '../../config/featureFlags';

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
    schemaVersion: 2,
    rows: rows.map((label) => ({
      label,
      cells: insurers.map((insurer) => {
        const value = overrides[label]?.[insurer] ?? 'No informado';
        return {
          insurer,
          value,
          rawText: value ?? undefined,
          notFound: value === null || value === 'No informado' ? true : undefined,
          confidence: value === null || value === 'No informado' ? 0 : 0.85,
        };
      }),
    })),
    extraRows: [],
    warnings: [],
  };
}

interface V2RowFixture {
  section: string;
  label: string;
  values: Record<string, string | null>;
}

function makeV2FlatResult(insurers: string[], rows: V2RowFixture[]): FlatComparisonResult {
  return {
    metadata: {
      generatedAt: new Date().toISOString(),
      model: 'gemini-test',
      pdfCount: insurers.length,
      processingTimeMs: 100,
      confidence: 0.92,
      needsHumanReview: false,
    },
    insurers,
    schemaVersion: 2,
    rows: rows.map(({ section, label, values }) => ({
      label,
      section,
      cells: insurers.map((insurer) => {
        const value = values[insurer] ?? 'No informado';
        return {
          insurer,
          value,
          rawText: value ?? undefined,
          notFound: value === null || value === 'No informado' ? true : undefined,
          confidence: value === null || value === 'No informado' ? 0 : 0.85,
        };
      }),
    })),
    extraRows: [],
    warnings: [],
  };
}

function buildFixture(snapshotPath: string): ExtractionQualityFixture {
  return {
    name: 'pyme-3-quotes',
    description: 'Test fixture',
    pdfPaths: [],
    baselineSnapshotPath: snapshotPath,
  };
}

function makeMatchingV2Matrix(): MatrixRow[] {
  return [
    {
      type: 'header',
      id: 'client_info',
      label: 'Cotizaciones PYME - Aseguradora Demo A, Aseguradora Demo B, Aseguradora Demo C',
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
      id: 'row_0',
      label: 'Bienes Asegurados',
      sectionId: 1,
      cells: [
        { value: 'Edificio y contenidos', isExcluded: false, isWinner: false, confidence: 0.92 },
        { value: 'Edificio y contenidos', isExcluded: false, isWinner: false, confidence: 0.9 },
        { value: 'Edificio, contenidos y equipos', isExcluded: false, isWinner: false, confidence: 0.88 },
      ],
    },
    {
      type: 'data',
      id: 'row_1',
      label: 'Prima con IVA',
      sectionId: 1,
      cells: [
        { value: '$ 1.000.000', isExcluded: false, isWinner: false, confidence: 0.95 },
        { value: '$ 1.200.000', isExcluded: false, isWinner: false, confidence: 0.94 },
        { value: '$ 1.150.000', isExcluded: false, isWinner: false, confidence: 0.93 },
      ],
    },
    {
      type: 'header',
      id: 'section_1',
      label: 'BIENES ASEGURADOS',
      sectionId: 2,
      cells: [],
    },
    {
      type: 'data',
      id: 'row_2',
      label: 'Edificio',
      sectionId: 2,
      cells: [
        { value: '$ 500.000.000', isExcluded: false, isWinner: false, confidence: 0.91 },
        { value: '$ 450.000.000', isExcluded: false, isWinner: false, confidence: 0.9 },
        { value: '$ 550.000.000', isExcluded: false, isWinner: false, confidence: 0.89 },
      ],
    },
    {
      type: 'data',
      id: 'row_3',
      label: 'Contenidos',
      sectionId: 2,
      cells: [
        { value: '$ 200.000.000', isExcluded: false, isWinner: false, confidence: 0.91 },
        { value: '$ 180.000.000', isExcluded: false, isWinner: false, confidence: 0.9 },
        { value: '$ 250.000.000', isExcluded: false, isWinner: false, confidence: 0.89 },
      ],
    },
    {
      type: 'header',
      id: 'section_2',
      label: 'DEDUCIBLES',
      sectionId: 3,
      cells: [],
    },
    {
      type: 'data',
      id: 'row_4',
      label: 'Deducibles',
      sectionId: 3,
      cells: [
        { value: '10% sobre el siniestro', isExcluded: false, isWinner: false, confidence: 0.82 },
        { value: '10% sobre el siniestro', isExcluded: false, isWinner: false, confidence: 0.81 },
        { value: '15% sobre el siniestro', isExcluded: false, isWinner: false, confidence: 0.8 },
      ],
    },
  ];
}

afterEach(() => {
  vi.restoreAllMocks();
  featureFlags.updateFlag('granularComparisonSchema', false);
});

function makeV1Matrix(): MatrixRow[] {
  return [
    {
      type: 'header',
      id: 'client_info',
      label: 'Cotizaciones PYME - Aseguradora Demo A, Aseguradora Demo B, Aseguradora Demo C',
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
        { value: 'Edificio y contenidos', isExcluded: false, isWinner: false },
        { value: 'Edificio y contenidos', isExcluded: false, isWinner: false },
        { value: 'Edificio, contenidos y equipos', isExcluded: false, isWinner: false },
      ],
    },
    {
      type: 'data',
      id: 'section_0_row_1',
      label: 'Deducibles',
      sectionId: 1,
      cells: [
        { value: '10% sobre el siniestro', isExcluded: false, isWinner: false },
        { value: '10% sobre el siniestro', isExcluded: false, isWinner: false },
        { value: '15% sobre el siniestro', isExcluded: false, isWinner: false },
      ],
    },
    {
      type: 'data',
      id: 'section_0_row_2',
      label: 'Prima con IVA',
      sectionId: 1,
      cells: [
        { value: '$ 1.000.000', isExcluded: false, isWinner: false },
        { value: '$ 1.200.000', isExcluded: false, isWinner: false },
        { value: '$ 1.150.000', isExcluded: false, isWinner: false },
      ],
    },
    {
      type: 'data',
      id: 'section_0_row_3',
      label: 'Forma de Pago',
      sectionId: 1,
      cells: [
        { value: 'Anual', isExcluded: false, isWinner: false },
        { value: 'Anual', isExcluded: false, isWinner: false },
        { value: 'Mensual', isExcluded: false, isWinner: false },
      ],
    },
  ];
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

  it('matches variable row counts by canonical label for schema v2', () => {
    const baseline = makeV2FlatResult(['A', 'B'], [
      { section: 'INFORMACIÓN GENERAL', label: 'Prima con IVA', values: { A: '$1.000.000', B: '$2.000.000' } },
      { section: 'BIENES ASEGURADOS', label: 'Edificio', values: { A: '$500.000.000', B: '$400.000.000' } },
      { section: 'BIENES ASEGURADOS', label: 'Contenidos', values: { A: '$200.000.000', B: '$150.000.000' } },
    ]);
    const tool = makeV2FlatResult(['A', 'B'], [
      { section: 'BIENES ASEGURADOS', label: 'Contenidos', values: { A: '$200.000.000', B: '$150.000.000' } },
      { section: 'BIENES ASEGURADOS', label: 'Edificio', values: { A: '$500.000.000', B: '$400.000.000' } },
      { section: 'INFORMACIÓN GENERAL', label: 'Prima con IVA', values: { A: '$1.000.000', B: '$2.000.000' } },
    ]);

    const report = calculateMatchRate(baseline, tool);
    expect(report.matchRate).toBe(1);
    expect(report.mismatches).toHaveLength(0);
  });

  it('counts missing baseline rows as mismatches in variable-row comparisons', () => {
    const baseline = makeV2FlatResult(['A'], [
      { section: 'COBERTURAS', label: 'Equipo Eléctrico', values: { A: 'Incluido' } },
    ]);
    const tool = makeV2FlatResult(['A'], []);

    const report = calculateMatchRate(baseline, tool);
    expect(report.totalCells).toBe(1);
    expect(report.matchRate).toBe(0);
    expect(report.mismatches).toHaveLength(1);
    expect(report.mismatches[0]).toMatchObject({
      row: 'Equipo Eléctrico',
      insurer: 'A',
      baseline: 'Incluido',
      tool: 'No informado',
    });
  });
});

describe('matrixRowsToFlatResult', () => {
  it('reconstructs a v1 flat result from matrix rows', () => {
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

    expect(result.schemaVersion).toBe(1);
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

  it('fills missing canonical rows with "No informado" in v1 mode', () => {
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

  it('reconstructs a v2 flat result from section-aware matrix rows', () => {
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
          { value: 'Edificio y contenidos', isExcluded: false, isWinner: false, confidence: 0.92 },
          { value: 'Edificio y contenidos', isExcluded: false, isWinner: false, confidence: 0.9 },
        ],
      },
      {
        type: 'header',
        id: 'section_1',
        label: 'BIENES ASEGURADOS',
        sectionId: 2,
        cells: [],
      },
      {
        type: 'data',
        id: 'section_1_row_0',
        label: 'Edificio',
        sectionId: 2,
        cells: [
          { value: '$500.000.000', isExcluded: false, isWinner: false, confidence: 0.91 },
          { value: '$450.000.000', isExcluded: false, isWinner: false, confidence: 0.9 },
        ],
      },
    ];

    const result = matrixRowsToFlatResult(matrix, 2);

    expect(result.schemaVersion).toBe(2);
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]).toMatchObject({ label: 'Bienes Asegurados', section: 'INFORMACIÓN GENERAL' });
    expect(result.rows[1]).toMatchObject({ label: 'Edificio', section: 'BIENES ASEGURADOS' });
    expect(result.rows[1].cells[0].confidence).toBe(0.91);
  });
});

describe('extraction quality regression', () => {
  it('passes the match-rate and fallback gates with a v2 tool result', async () => {
    vi.spyOn(comparisonEngineAdapter, 'generateComparison').mockResolvedValue({
      matrix: makeMatchingV2Matrix(),
      engine: 'unified',
      schemaVersion: 2,
      correlationId: 'test',
    });

    const fixture = buildFixture(
      path.resolve(__dirname, '../fixtures/extraction-quality/baseline-snapshot.json')
    );

    const report = await runExtractionQualityEval(fixture, { granularComparisonSchema: true });

    expect(report.matchRate).toBeGreaterThanOrEqual(0.9);
    expect(report.fallbackRate).toBeLessThanOrEqual(0.1);
    expect(report.passed).toBe(true);
    expect(report.tool.schemaVersion).toBe(2);
  });

  it('fails when the match rate is below 90%', async () => {
    const mismatchedMatrix: MatrixRow[] = makeMatchingV2Matrix().map((row) => {
      if (row.type !== 'data') return row;
      return {
        ...row,
        cells: row.cells.map((cell, idx) =>
          idx === 0 ? { ...cell, value: 'VALOR INCORRECTO' } : cell
        ),
      };
    });

    vi.spyOn(comparisonEngineAdapter, 'generateComparison').mockResolvedValue({
      matrix: mismatchedMatrix,
      engine: 'unified',
      schemaVersion: 2,
      correlationId: 'test',
    });

    const fixture = buildFixture(
      path.resolve(__dirname, '../fixtures/extraction-quality/baseline-snapshot.json')
    );

    const report = await runExtractionQualityEval(fixture, { granularComparisonSchema: true });

    expect(report.matchRate).toBeLessThan(0.9);
    expect(report.passed).toBe(false);
  });

  it('fails when the production adapter falls back', async () => {
    vi.spyOn(comparisonEngineAdapter, 'generateComparison').mockResolvedValue({
      matrix: makeMatchingV2Matrix(),
      engine: 'fallback',
      schemaVersion: 1,
      fallbackReason: 'unified_disabled_by_flag',
      correlationId: 'test',
    });

    const fixture = buildFixture(
      path.resolve(__dirname, '../fixtures/extraction-quality/baseline-snapshot.json')
    );

    const report = await runExtractionQualityEval(fixture);

    expect(report.fallbackRate).toBe(1);
    expect(report.passed).toBe(false);
  });

  it('defaults to schema v1 when no option is provided', async () => {
    vi.spyOn(comparisonEngineAdapter, 'generateComparison').mockResolvedValue({
      matrix: makeV1Matrix(),
      engine: 'unified',
      schemaVersion: 1,
      correlationId: 'test',
    });

    const fixture = buildFixture(
      path.resolve(__dirname, '../fixtures/extraction-quality/baseline-snapshot.json')
    );

    const report = await runExtractionQualityEval(fixture);

    expect(report.tool.schemaVersion).toBe(1);
    expect(comparisonEngineAdapter.generateComparison).toHaveBeenCalledWith(
      expect.any(Array),
      expect.objectContaining({ granularComparisonSchema: false })
    );
  });

  it('does not mutate the global feature flag when overriding schema version', async () => {
    featureFlags.updateFlag('granularComparisonSchema', false);
    const before = featureFlags.isEnabled('granularComparisonSchema');

    vi.spyOn(comparisonEngineAdapter, 'generateComparison').mockResolvedValue({
      matrix: makeMatchingV2Matrix(),
      engine: 'unified',
      schemaVersion: 2,
      correlationId: 'test',
    });

    const fixture = buildFixture(
      path.resolve(__dirname, '../fixtures/extraction-quality/baseline-snapshot.json')
    );

    await runExtractionQualityEval(fixture, { granularComparisonSchema: true });

    expect(featureFlags.isEnabled('granularComparisonSchema')).toBe(before);
  });

  it('runs the evaluation harness against the real API when fixtures and key are available', async () => {
    const fixture = buildFixture(
      path.resolve(__dirname, '../fixtures/extraction-quality/baseline-snapshot.json')
    );

    if (!process.env.GEMINI_API_KEY) {
      console.log('Skipping extraction quality regression: GEMINI_API_KEY not set');
      return;
    }

    const report = await runExtractionQualityEval(fixture, { granularComparisonSchema: true });

    expect(report.fallbackRate).toBeLessThanOrEqual(0.1);
    expect(report.matchRate).toBeGreaterThanOrEqual(0.9);
    expect(report.passed).toBe(true);
  });
});

describe('baseline fixture', () => {
  it('uses schema v2 with section-aware rows and per-cell confidence', async () => {
    const snapshotPath = path.resolve(
      __dirname,
      '../fixtures/extraction-quality/baseline-snapshot.json'
    );
    const snapshot = JSON.parse(await fs.readFile(snapshotPath, 'utf-8'));

    expect(snapshot.schemaVersion).toBe(2);
    const rowsWithSection = snapshot.rows.filter((r: { section?: string }) => r.section);
    expect(rowsWithSection.length).toBeGreaterThan(0);
    const cellsWithConfidence = snapshot.rows
      .flatMap((r: { cells: Array<{ confidence?: number }> }) => r.cells)
      .filter((c: { confidence?: number }) => typeof c.confidence === 'number');
    expect(cellsWithConfidence.length).toBeGreaterThan(0);
  });
});
