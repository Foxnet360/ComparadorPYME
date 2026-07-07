import { describe, it, expect } from 'vitest';
import {
  FlatComparisonSchema,
  FlatComparisonSchemaV1,
  SchemaSection,
  resolveComparisonSchemaVersion,
} from '../comparisonSchema';

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

const legacyNestedResult = {
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
  insurers: [{ name: 'MAPFRE', quoteDate: '2026-01-01', validity: '1 año', product: 'PYME' }],
  coverageMatrix: [
    {
      category: 'Daño Material',
      rows: [{ type: 'value', label: 'Amparo Básico', cells: [{ value: 'Cobertura total' }] }],
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

describe('FlatComparisonSchema (v2)', () => {
  it('accepts a valid four-row flat result as backward-compatible v2', () => {
    const result = FlatComparisonSchema.safeParse(validFlatResult);
    expect(result.success).toBe(true);
  });

  it('accepts a granular result with sections and confidence', () => {
    const result = FlatComparisonSchema.safeParse({
      ...validFlatResult,
      schemaVersion: 2,
      rows: [
        {
          label: 'Edificio',
          section: SchemaSection.BIENES_ASEGURADOS,
          cells: [
            {
              insurer: 'MAPFRE',
              value: '$500M',
              rawText: 'Edificio 500M',
              confidence: 0.92,
              isAmbiguous: false,
            },
            { insurer: 'CHUBB', value: '$600M', confidence: 0.9 },
            { insurer: 'BBVA', value: null, notFound: true, confidence: 0 },
          ],
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('defaults schemaVersion to 2 when omitted', () => {
    const result = FlatComparisonSchema.safeParse({ ...validFlatResult, schemaVersion: undefined });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.schemaVersion).toBe(2);
    }
  });

  it('allows open row count instead of fixed four rows', () => {
    const result = FlatComparisonSchema.safeParse({
      ...validFlatResult,
      rows: validFlatResult.rows.slice(0, 2),
    });
    expect(result.success).toBe(true);
  });

  it('rejects the legacy nested canonical schema', () => {
    const result = FlatComparisonSchema.safeParse(legacyNestedResult);
    expect(result.success).toBe(false);
  });

  it('rejects confidence values outside 0..1', () => {
    const result = FlatComparisonSchema.safeParse({
      ...validFlatResult,
      rows: [
        {
          ...validFlatResult.rows[0],
          cells: [{ ...validFlatResult.rows[0].cells[0], confidence: 1.5 }],
        },
      ],
    });
    expect(result.success).toBe(false);
  });
});

describe('FlatComparisonSchemaV1 backward compatibility', () => {
  it('accepts a legacy four-row flat result', () => {
    const result = FlatComparisonSchemaV1.safeParse(validFlatResult);
    expect(result.success).toBe(true);
  });

  it('rejects a flat result missing required rows', () => {
    const result = FlatComparisonSchemaV1.safeParse({
      ...validFlatResult,
      rows: validFlatResult.rows.slice(0, 2),
    });
    expect(result.success).toBe(false);
  });
});

describe('SchemaSection', () => {
  it('contains the canonical section names', () => {
    expect(SchemaSection.INFORMACION_GENERAL).toBe('INFORMACIÓN GENERAL');
    expect(SchemaSection.BIENES_ASEGURADOS).toBe('BIENES ASEGURADOS');
    expect(SchemaSection.COBERTURAS).toBe('COBERTURAS');
    expect(SchemaSection.DEDUCIBLES).toBe('DEDUCIBLES');
    expect(SchemaSection.CONDICIONES).toBe('CONDICIONES');
  });
});

describe('resolveComparisonSchemaVersion', () => {
  it('returns v2 when flag is enabled and result has schemaVersion 2', () => {
    expect(resolveComparisonSchemaVersion({ schemaVersion: 2 }, true)).toBe(2);
  });

  it('returns v1 when flag is disabled even if result has schemaVersion 2', () => {
    expect(resolveComparisonSchemaVersion({ schemaVersion: 2 }, false)).toBe(1);
  });

  it('returns v1 when result lacks schemaVersion even if flag is enabled', () => {
    expect(resolveComparisonSchemaVersion({}, true)).toBe(1);
  });

  it('returns v1 when result has schemaVersion 1', () => {
    expect(resolveComparisonSchemaVersion({ schemaVersion: 1 }, true)).toBe(1);
  });
});
