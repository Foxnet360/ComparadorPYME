import { describe, it, expect } from 'vitest';
import { FlatComparisonSchema } from '../comparisonSchema';

describe('FlatComparisonSchema', () => {
  const validFlatResult = {
    metadata: {
      generatedAt: '2026-07-01T00:00:00.000Z',
      model: 'gemini-3.5-flash',
      pdfCount: 3,
      processingTimeMs: 1234,
      confidence: 0.95,
      needsHumanReview: false,
    },
    insurers: ['MAPFRE', 'CHUBB', 'BBVA'],
    rows: [
      {
        label: 'Bienes Asegurados',
        cells: [
          { insurer: 'MAPFRE', value: 'Edificio y contenidos' },
          { insurer: 'CHUBB', value: 'Mercancías y muebles' },
          { insurer: 'BBVA', value: null, notFound: true },
        ],
      },
      {
        label: 'Deducibles',
        cells: [
          { insurer: 'MAPFRE', value: '10% mínimo 1 SMMLV' },
          { insurer: 'CHUBB', value: '5%' },
          { insurer: 'BBVA', value: 'No informado' },
        ],
      },
      {
        label: 'Prima con IVA',
        cells: [
          { insurer: 'MAPFRE', value: '$ 1.000.000' },
          { insurer: 'CHUBB', value: '$ 1.200.000' },
          { insurer: 'BBVA', value: '$ 900.000' },
        ],
      },
      {
        label: 'Forma de Pago',
        cells: [
          { insurer: 'MAPFRE', value: 'Anual' },
          { insurer: 'CHUBB', value: 'Trimestral' },
          { insurer: 'BBVA', value: 'Mensual' },
        ],
      },
    ],
    extraRows: [],
    warnings: [],
  };

  it('accepts a valid rows-by-insurers flat result', () => {
    const result = FlatComparisonSchema.safeParse(validFlatResult);
    expect(result.success).toBe(true);
  });

  it('accepts extra rows with the same cell shape', () => {
    const withExtra = {
      ...validFlatResult,
      extraRows: [
        {
          label: 'Observaciones',
          cells: [{ insurer: 'MAPFRE', value: 'Texto libre' }],
        },
      ],
    };
    const result = FlatComparisonSchema.safeParse(withExtra);
    expect(result.success).toBe(true);
  });

  it('rejects the legacy nested canonical schema', () => {
    const legacyResult = {
      metadata: {
        generatedAt: '2026-07-01T00:00:00.000Z',
        model: 'gemini-3.5-flash',
        thinkingLevel: 'high',
        pdfCount: 3,
        totalPages: 9,
        confidence: 0.95,
        needsHumanReview: false,
        processingTimeMs: 1234,
      },
      client: {
        name: 'Acme SAS',
        activity: 'Comercio',
        address: 'Calle 1',
        city: 'Bogotá',
        totalInsuredValue: 1000000000,
      },
      insurers: [
        { name: 'MAPFRE', quoteDate: '2026-01-01', validity: '1 año', product: 'PYME' },
      ],
      coverageMatrix: [
        {
          category: 'Daño Material',
          rows: [
            {
              type: 'value',
              label: 'Amparo Básico',
              cells: [{ value: 'Cobertura total' }],
            },
          ],
        },
      ],
      financials: {
        premiums: [{ insurer: 'MAPFRE', netPremium: 1000000 }],
        metadata: [{ insurer: 'MAPFRE' }],
      },
      analysis: {
        warnings: [],
        missingCoverages: [],
        significantDifferences: [],
      },
    };
    const result = FlatComparisonSchema.safeParse(legacyResult);
    expect(result.success).toBe(false);
  });

  it('rejects a flat result missing required rows', () => {
    const missingRows = {
      ...validFlatResult,
      rows: validFlatResult.rows.slice(0, 2),
    };
    const result = FlatComparisonSchema.safeParse(missingRows);
    expect(result.success).toBe(false);
  });

  it('rejects a flat result with mismatched insurer columns', () => {
    const mismatched = {
      ...validFlatResult,
      rows: [
        {
          label: 'Bienes Asegurados',
          cells: [{ insurer: 'MAPFRE', value: 'ok' }],
        },
        ...validFlatResult.rows.slice(1),
      ],
    };
    const result = FlatComparisonSchema.safeParse(mismatched);
    expect(result.success).toBe(false);
  });
});
