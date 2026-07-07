/**
 * Matrix Transformer Tests
 * Pure function tests for FlatComparisonResult → MatrixRow[] and
 * ParsedQuote[] → MatrixRow[] transformations.
 */

import { describe, it, expect } from 'vitest';
import { flatResultToMatrixRows, quotesToMatrixRows } from '../matrixTransformer';
import { FlatComparisonResult } from '../comparisonSchema';
import { ParsedQuote } from '../../quoteParser';

function makeFlatResult(overrides: Partial<FlatComparisonResult> = {}): FlatComparisonResult {
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
    expect(header.cells).toHaveLength(2);
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
