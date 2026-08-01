import { describe, it, expect } from 'vitest';
import { flatResultToMatrixRowsV2, flatResultToMatrixRows } from '../matrixTransformer';
import { FlatComparisonResultV2, SchemaSection } from '../comparisonSchema';
import { canonicalDisplayToId } from '../flatTableParser';

function makeAutosFlatResultV2(): FlatComparisonResultV2 {
  return {
    metadata: {
      generatedAt: '2026-07-01T00:00:00Z',
      model: 'gemini-3.5-flash',
      pdfCount: 2,
      processingTimeMs: 1200,
      confidence: 0.92,
      needsHumanReview: false,
    },
    insurers: ['SBS', 'MAPFRE'],
    schemaVersion: 2,
    rows: [
      {
        label: 'Responsabilidad Civil Extracontractual Vehicular',
        section: SchemaSection.COBERTURAS,
        canonicalId: 'responsabilidad-civil-extracontractual-vehicular',
        canonicalSource: 'alias',
        matchConfidence: 1,
        cells: [
          { insurer: 'SBS', value: '$2.000M', rawText: '$2.000M', confidence: 0.95 },
          { insurer: 'MAPFRE', value: '$1.500M', rawText: '$1.500M', confidence: 0.94 },
        ],
      },
      {
        label: 'Pérdida Total (hurto, daños, PT)',
        section: SchemaSection.COBERTURAS,
        canonicalId: 'perdida-total-hurto-danos-pt',
        canonicalSource: 'alias',
        matchConfidence: 1,
        cells: [
          { insurer: 'SBS', value: 'Incluido', rawText: 'Incluido', confidence: 0.92 },
          { insurer: 'MAPFRE', value: 'Incluido', rawText: 'Incluido', confidence: 0.92 },
        ],
      },
      {
        label: 'Prima con IVA',
        section: SchemaSection.FINANCIAL,
        cells: [
          { insurer: 'SBS', value: '$2.5M', rawText: '$2.5M', confidence: 0.96 },
          { insurer: 'MAPFRE', value: '$2.8M', rawText: '$2.8M', confidence: 0.95 },
        ],
      },
    ],
    extraRows: [],
    warnings: [],
  };
}

describe('flatResultToMatrixRowsV2 - autos domain', () => {
  it('renders an autos header label', () => {
    const result = makeAutosFlatResultV2();
    const matrix = flatResultToMatrixRowsV2(result, 'autos');

    const header = matrix[0];
    expect(header.label).toContain('AUTOS');
    expect(header.label).not.toContain('PYME');
    expect(header.label).toContain('SBS');
    expect(header.label).toContain('MAPFRE');
  });

  it('sorts autos rows by canonical order from the autos taxonomy', () => {
    const rceName = 'Responsabilidad Civil Extracontractual Vehicular';
    const ptName = 'Pérdida Total (hurto, daños, PT)';
    const ppName = 'Pérdida Parcial (colisión, PP)';

    const result: FlatComparisonResultV2 = {
      ...makeAutosFlatResultV2(),
      rows: [
        {
          label: ppName,
          section: SchemaSection.COBERTURAS,
          canonicalId: canonicalDisplayToId(ppName),
          canonicalSource: 'alias',
          matchConfidence: 1,
          cells: [{ insurer: 'SBS', value: 'Incluido', confidence: 0.9 }],
        },
        {
          label: rceName,
          section: SchemaSection.COBERTURAS,
          canonicalId: canonicalDisplayToId(rceName),
          canonicalSource: 'alias',
          matchConfidence: 1,
          cells: [{ insurer: 'SBS', value: '$2.000M', confidence: 0.95 }],
        },
        {
          label: ptName,
          section: SchemaSection.COBERTURAS,
          canonicalId: canonicalDisplayToId(ptName),
          canonicalSource: 'alias',
          matchConfidence: 1,
          cells: [{ insurer: 'SBS', value: 'Incluido', confidence: 0.92 }],
        },
      ],
    };

    const matrix = flatResultToMatrixRowsV2(result, 'autos');
    const dataRows = matrix.filter((r) => r.type === 'data' && r.sectionId === 1);
    expect(dataRows.map((r) => r.canonicalId)).toEqual([
      canonicalDisplayToId(rceName),
      canonicalDisplayToId(ptName),
      canonicalDisplayToId(ppName),
    ]);
  });

  it('keeps pyme header label when domain is omitted', () => {
    const result = makeAutosFlatResultV2();
    const matrix = flatResultToMatrixRowsV2(result);

    const header = matrix[0];
    expect(header.label).toContain('PYME');
  });
});

describe('flatResultToMatrixRows - autos domain', () => {
  it('renders an autos header label', () => {
    const result = {
      schemaVersion: 1 as const,
      metadata: {
        generatedAt: '2026-07-01T00:00:00Z',
        model: 'gemini-3.5-flash',
        pdfCount: 2,
        processingTimeMs: 1200,
        confidence: 0.92,
        needsHumanReview: false,
      },
      insurers: ['SBS', 'MAPFRE'],
      rows: [
        {
          label: 'Bienes Asegurados',
          cells: [
            { insurer: 'SBS', value: 'Vehículo' },
            { insurer: 'MAPFRE', value: 'Vehículo' },
          ],
        },
        {
          label: 'Prima con IVA',
          cells: [
            { insurer: 'SBS', value: '$2.5M' },
            { insurer: 'MAPFRE', value: '$2.8M' },
          ],
        },
        {
          label: 'Forma de Pago',
          cells: [
            { insurer: 'SBS', value: 'Anual' },
            { insurer: 'MAPFRE', value: 'Anual' },
          ],
        },
        {
          label: 'Deducibles',
          cells: [
            { insurer: 'SBS', value: '10%' },
            { insurer: 'MAPFRE', value: '15%' },
          ],
        },
      ],
      extraRows: [],
      warnings: [],
    };

    const matrix = flatResultToMatrixRows(result, 'autos');

    const header = matrix[0];
    expect(header.label).toContain('AUTOS');
  });
});
