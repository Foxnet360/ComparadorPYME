/**
 * Matrix Transformer Tests
 * Pure function tests for FlatComparisonResult → MatrixRow[] and
 * ParsedQuote[] → MatrixRow[] transformations.
 */

import { describe, it, expect } from 'vitest';
import {
  flatResultToMatrixRows,
  flatResultToMatrixRowsV2,
  quotesToMatrixRows,
  FINANCIAL_SECTION_ID,
} from '../matrixTransformer';
import { FlatComparisonResult, FlatComparisonResultV2, SchemaSection } from '../comparisonSchema';
import { ParsedQuote } from '../../quoteParser';

function makeFlatResult(overrides: Partial<FlatComparisonResult> = {}): FlatComparisonResult {
  return {
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
          { insurer: 'CHUBB', value: 'Mensual', notFound: false },
        ],
      },
    ],
    extraRows: [],
    warnings: [],
    ...overrides,
  };
}

function makeFlatResultV2(overrides: Partial<FlatComparisonResultV2> = {}): FlatComparisonResultV2 {
  return {
    metadata: {
      generatedAt: '2026-07-01T00:00:00Z',
      model: 'gemini-3.5-flash',
      pdfCount: 2,
      processingTimeMs: 1200,
      confidence: 0.92,
      needsHumanReview: false,
    },
    insurers: ['MAPFRE', 'CHUBB'],
    schemaVersion: 2,
    rows: [
      {
        label: 'Edificio',
        section: SchemaSection.BIENES_ASEGURADOS,
        cells: [
          { insurer: 'MAPFRE', value: '$500M', rawText: '$500M', confidence: 0.92 },
          { insurer: 'CHUBB', value: '$600M', rawText: '$600M', confidence: 0.9 },
        ],
      },
      {
        label: 'Contenidos',
        section: SchemaSection.BIENES_ASEGURADOS,
        cells: [
          { insurer: 'MAPFRE', value: '$200M', rawText: '$200M', confidence: 0.88 },
          { insurer: 'CHUBB', value: '$250M', rawText: '$250M', confidence: 0.85 },
        ],
      },
      {
        label: 'Prima con IVA',
        section: SchemaSection.INFORMACION_GENERAL,
        cells: [
          { insurer: 'MAPFRE', value: '$8.5M', rawText: '$8.5M', confidence: 0.95 },
          { insurer: 'CHUBB', value: '$9.2M', rawText: '$9.2M', confidence: 0.94 },
        ],
      },
    ],
    extraRows: [],
    warnings: [],
    ...overrides,
  };
}

function makeParsedQuote(overrides: Partial<ParsedQuote> = {}): ParsedQuote {
  return {
    insurerName: 'BBVA',
    policyName: 'PYME',
    priceAnnual: 8_500_000,
    currency: 'COP',
    coverages: [
      {
        name: 'Incendio (Edificio y Contenidos)',
        canonicalName: 'Incendio (Edificio y Contenidos)',
        value: '500M',
        deductible: '10%',
        confidence: 95,
      },
      {
        name: 'Responsabilidad Civil (RCE)',
        canonicalName: 'Responsabilidad Civil (RCE)',
        value: '100M',
        deductible: '5 SMMLV',
        confidence: 90,
      },
    ],
    specialConditions: ['Cláusula de ajuste'],
    rawText: '',
    parseConfidence: 92,
    ...overrides,
  };
}

describe('flatResultToMatrixRows', () => {
  it('creates a header row with insurer names', () => {
    const result = makeFlatResult();
    const matrix = flatResultToMatrixRows(result);

    const header = matrix[0];
    expect(header.type).toBe('header');
    expect(header.id).toBe('client_info');
    expect(header.label).toContain('MAPFRE');
    expect(header.label).toContain('CHUBB');
  });

  it('emits one data row per requested flat row', () => {
    const result = makeFlatResult();
    const matrix = flatResultToMatrixRows(result);

    const dataRows = matrix.filter((r) => r.type === 'data' && r.id.startsWith('section_0_row_'));
    expect(dataRows).toHaveLength(4);
    expect(dataRows.map((r) => r.label)).toEqual([
      'Bienes Asegurados',
      'Deducibles',
      'Prima con IVA',
      'Forma de Pago',
    ]);
  });

  it('marks cells with notFound or null value as excluded', () => {
    const result = makeFlatResult({
      rows: [
        {
          label: 'Bienes Asegurados',
          cells: [
            { insurer: 'MAPFRE', value: 'Edificio $500M' },
            { insurer: 'CHUBB', value: null, notFound: true },
          ],
        },
      ],
    });
    const matrix = flatResultToMatrixRows(result);

    const row = matrix.find((r) => r.type === 'data' && r.label === 'Bienes Asegurados')!;
    expect(row.cells[0].isExcluded).toBe(false);
    expect(row.cells[1].isExcluded).toBe(true);
    expect(row.cells[1].value).toBe('No informado');
  });

  it('places extra rows after the core rows', () => {
    const result = makeFlatResult({
      extraRows: [
        {
          label: 'Asistencia',
          cells: [
            { insurer: 'MAPFRE', value: 'Incluida' },
            { insurer: 'CHUBB', value: 'No incluida' },
          ],
        },
      ],
    });
    const matrix = flatResultToMatrixRows(result);

    const extra = matrix.find((r) => r.type === 'data' && r.id.startsWith('section_0_extra_'));
    expect(extra).toBeDefined();
    expect(extra?.label).toBe('Asistencia');
  });

  it('maps Prima con IVA to premium_total row', () => {
    const result = makeFlatResult();
    const matrix = flatResultToMatrixRows(result);

    const premium = matrix.find((r) => r.id === 'premium_total');
    expect(premium).toBeDefined();
    expect(premium?.label).toBe('TOTAL A PAGAR');
    expect(premium?.cells[0].value).toBe('$ 8.500.000');
    expect(premium?.cells[1].value).toBe('$ 9.200.000');
  });

  it('maps Forma de Pago to meta_payment row', () => {
    const result = makeFlatResult();
    const matrix = flatResultToMatrixRows(result);

    const payment = matrix.find((r) => r.id === 'meta_payment');
    expect(payment).toBeDefined();
    expect(payment?.label).toBe('Forma de Pago');
    expect(payment?.cells.map((c) => c.value)).toEqual(['Anual', 'Mensual']);
  });

  it('renders warnings as alert rows', () => {
    const result = makeFlatResult({ warnings: ['Falta deducible CHUBB'] });
    const matrix = flatResultToMatrixRows(result);

    const warningHeader = matrix.find((r) => r.id === 'warnings');
    const warningRow = matrix.find((r) => r.id === 'warning_0');
    expect(warningHeader).toBeDefined();
    expect(warningRow).toBeDefined();
    expect(warningRow?.label).toBe('Falta deducible CHUBB');
  });
});

describe('flatResultToMatrixRowsV2', () => {
  it('creates a header row with insurer names', () => {
    const result = makeFlatResultV2();
    const matrix = flatResultToMatrixRowsV2(result);

    const header = matrix[0];
    expect(header.type).toBe('header');
    expect(header.id).toBe('client_info');
    expect(header.label).toContain('MAPFRE');
    expect(header.label).toContain('CHUBB');
  });

  it('emits a section header row for each distinct section', () => {
    const result = makeFlatResultV2();
    const matrix = flatResultToMatrixRowsV2(result);

    const sectionHeaders = matrix.filter((r) => r.type === 'header' && r.id.startsWith('section_'));
    expect(sectionHeaders).toHaveLength(2);
    expect(sectionHeaders.map((r) => r.label)).toContain('BIENES ASEGURADOS');
    expect(sectionHeaders.map((r) => r.label)).toContain('PRIMAS Y COSTOS');
  });

  it('places data rows directly under their section header', () => {
    const result = makeFlatResultV2();
    const matrix = flatResultToMatrixRowsV2(result);

    const bienesHeaderIndex = matrix.findIndex(
      (r) => r.type === 'header' && r.label === 'BIENES ASEGURADOS'
    );
    expect(bienesHeaderIndex).toBeGreaterThan(-1);
    expect(matrix[bienesHeaderIndex + 1].label).toBe('Edificio');
    expect(matrix[bienesHeaderIndex + 2].label).toBe('Contenidos');
  });

  it('preserves cell confidence on data rows', () => {
    const result = makeFlatResultV2();
    const matrix = flatResultToMatrixRowsV2(result);

    const edificioRow = matrix.find((r) => r.label === 'Edificio')!;
    expect(edificioRow.cells[0].confidence).toBe(0.92);
    expect(edificioRow.cells[1].confidence).toBe(0.9);
  });

  it('places extra rows in a dedicated section at the end', () => {
    const result = makeFlatResultV2({
      extraRows: [
        {
          label: 'Asistencia',
          cells: [
            { insurer: 'MAPFRE', value: 'Incluida', confidence: 0.7 },
            { insurer: 'CHUBB', value: 'No incluida', confidence: 0.6 },
          ],
        },
      ],
    });
    const matrix = flatResultToMatrixRowsV2(result);

    const extraSectionHeader = matrix.find((r) => r.type === 'header' && r.label === 'OTROS');
    expect(extraSectionHeader).toBeDefined();
    const extraHeaderIndex = matrix.indexOf(extraSectionHeader!);
    expect(matrix[extraHeaderIndex + 1].label).toBe('Asistencia');
  });

  it('tags v2 financial rows with FINANCIAL_SECTION_ID', () => {
    const result = makeFlatResultV2({
      rows: [
        {
          label: 'Prima con IVA',
          section: SchemaSection.INFORMACION_GENERAL,
          cells: [
            { insurer: 'MAPFRE', value: '$8.5M', rawText: '$8.5M', confidence: 0.95 },
            { insurer: 'CHUBB', value: '$9.2M', rawText: '$9.2M', confidence: 0.94 },
          ],
        },
        {
          label: 'Forma de Pago',
          section: SchemaSection.INFORMACION_GENERAL,
          cells: [
            { insurer: 'MAPFRE', value: 'Anual', rawText: 'Anual', confidence: 0.9 },
            { insurer: 'CHUBB', value: 'Mensual', rawText: 'Mensual', confidence: 0.9 },
          ],
        },
      ],
    });
    const matrix = flatResultToMatrixRowsV2(result);

    const financialHeader = matrix.find(
      (r) => r.type === 'header' && r.sectionId === FINANCIAL_SECTION_ID
    );
    expect(financialHeader).toBeDefined();
    expect(financialHeader!.label).toBe('PRIMAS Y COSTOS');

    const premiumRow = matrix.find((r) => r.type === 'data' && r.label === 'Prima con IVA');
    expect(premiumRow).toBeDefined();
    expect(premiumRow!.sectionId).toBe(FINANCIAL_SECTION_ID);

    const paymentRow = matrix.find((r) => r.type === 'data' && r.label === 'Forma de Pago');
    expect(paymentRow).toBeDefined();
    expect(paymentRow!.sectionId).toBe(FINANCIAL_SECTION_ID);
  });

  it('carries deductible rawText as notes on v2 matrix cells', () => {
    const result = makeFlatResultV2({
      rows: [
        {
          label: 'Edificio',
          section: SchemaSection.DEDUCIBLES,
          cells: [
            {
              insurer: 'MAPFRE',
              value: '10%',
              rawText: '10% PERD - Min 1 SMMLV',
              confidence: 0.92,
            },
            { insurer: 'CHUBB', value: '5%', rawText: '5% siniestro', confidence: 0.9 },
          ],
        },
      ],
    });
    const matrix = flatResultToMatrixRowsV2(result);

    const row = matrix.find((r) => r.label === 'Edificio')!;
    expect(row.cells[0].notes).toBe('10% PERD - Min 1 SMMLV');
    expect(row.cells[1].notes).toBe('5% siniestro');
  });
});

describe('quotesToMatrixRows', () => {
  it('creates a header row with insurer names from parsed quotes', () => {
    const quotes = [
      makeParsedQuote({ insurerName: 'BBVA' }),
      makeParsedQuote({ insurerName: 'AXA' }),
    ];
    const matrix = quotesToMatrixRows(quotes);

    expect(matrix[0].label).toContain('BBVA');
    expect(matrix[0].label).toContain('AXA');
  });

  it('emits one data row per unique canonical coverage', () => {
    const quotes = [
      makeParsedQuote({ insurerName: 'BBVA' }),
      makeParsedQuote({
        insurerName: 'AXA',
        coverages: [
          {
            name: 'Responsabilidad Civil (RCE)',
            canonicalName: 'Responsabilidad Civil (RCE)',
            value: '150M',
            deductible: '3 SMMLV',
            confidence: 88,
          },
          {
            name: 'Terremoto y Eventos Catastróficos',
            canonicalName: 'Terremoto y Eventos Catastróficos',
            value: '200M',
            deductible: '20%',
            confidence: 85,
          },
        ],
      }),
    ];
    const matrix = quotesToMatrixRows(quotes);

    const dataRows = matrix.filter((r) => r.type === 'data' && r.id.startsWith('section_0_row_'));
    expect(dataRows).toHaveLength(3);
    expect(dataRows.map((r) => r.label)).toEqual([
      'Incendio (Edificio y Contenidos)',
      'Responsabilidad Civil (RCE)',
      'Terremoto y Eventos Catastróficos',
    ]);
  });

  it('marks missing coverage values as excluded', () => {
    const quotes = [
      makeParsedQuote({
        insurerName: 'BBVA',
        coverages: [
          {
            name: 'Incendio (Edificio y Contenidos)',
            canonicalName: 'Incendio (Edificio y Contenidos)',
            value: 'NO ESPECIFICADO',
            deductible: 'No aplica',
            confidence: 0,
          },
        ],
      }),
    ];
    const matrix = quotesToMatrixRows(quotes);

    const row = matrix.find((r) => r.label === 'Incendio (Edificio y Contenidos)')!;
    expect(row.cells[0].isExcluded).toBe(true);
    expect(row.cells[0].value).toBe('NO ESPECIFICADO');
  });

  it('maps priceAnnual to premium_total row', () => {
    const quotes = [makeParsedQuote({ priceAnnual: 9_200_000 })];
    const matrix = quotesToMatrixRows(quotes);

    const premium = matrix.find((r) => r.id === 'premium_total')!;
    expect(premium.cells[0].value).toBe('$9.200.000');
    expect(premium.cells[0].isExcluded).toBe(false);
  });

  it('renders special conditions as warning rows', () => {
    const quotes = [
      makeParsedQuote({ specialConditions: ['Condición especial A', 'Condición especial B'] }),
    ];
    const matrix = quotesToMatrixRows(quotes);

    const warnings = matrix.filter((r) => r.id.startsWith('warning_'));
    expect(warnings).toHaveLength(2);
    expect(warnings.map((r) => r.label)).toEqual(['Condición especial A', 'Condición especial B']);
  });
});
