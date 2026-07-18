import { describe, it, expect, vi } from 'vitest';
import {
  flatTableParser,
  FlatTableParseError,
  FLAT_ROW_LABELS,
  normalizeAlias,
  computeCellConfidence,
} from '../flatTableParser';
import { FlatComparisonSchema, FlatComparisonSchemaV2 } from '../comparisonSchema';
import type { CoverageGraphService } from '../../coverageGraphService';

const baseOptions = { pdfCount: 3, model: 'gemini-test' };

describe('flatTableParser', () => {
  it('parses a Markdown table into the flat schema', () => {
    const input = `
| | MAPFRE | CHUBB | BBVA |
| Bienes Asegurados | Edificio y contenidos | Mercancías y muebles | Inventarios |
| Deducibles | 10% mínimo 1 SMMLV | 5% | 15% |
| Prima con IVA | $ 1.000.000 | $ 1.200.000 | $ 900.000 |
| Forma de Pago | Anual | Trimestral | Mensual |
`;

    const result = flatTableParser.parse(input, baseOptions);

    expect(FlatComparisonSchema.safeParse(result).success).toBe(true);
    expect(result.insurers).toEqual(['MAPFRE', 'CHUBB', 'BBVA']);
    expect(result.rows.map((row) => row.label)).toEqual(FLAT_ROW_LABELS);
    expect(result.rows[0].cells.map((cell) => cell.value)).toEqual([
      'Edificio y contenidos',
      'Mercancías y muebles',
      'Inventarios',
    ]);
  });

  it('parses a CSV table with comma delimiter', () => {
    const input = `Fila,MAPFRE,CHUBB
Bienes Asegurados,Edificio,Mercancía
Deducibles,10%,5%
Prima con IVA,$1000000,$1200000
Forma de Pago,Anual,Trimestral`;

    const result = flatTableParser.parse(input, baseOptions);

    expect(FlatComparisonSchema.safeParse(result).success).toBe(true);
    expect(result.insurers).toEqual(['MAPFRE', 'CHUBB']);
    expect(result.rows[2].cells.map((cell) => cell.value)).toEqual(['$1000000', '$1200000']);
  });

  it('parses a CSV table with semicolon delimiter and quoted cells', () => {
    const input = `"Fila";"MAPFRE";"CHUBB"
"Bienes Asegurados";"Edificio, oficina";"Mercancía"
"Deducibles";"10%";"5%"
"Prima con IVA";"$ 1.000.000";"$ 1.200.000"
"Forma de Pago";"Anual";"Mensual"`;

    const result = flatTableParser.parse(input, baseOptions);

    expect(FlatComparisonSchema.safeParse(result).success).toBe(true);
    expect(result.insurers).toEqual(['MAPFRE', 'CHUBB']);
    expect(result.rows[0].cells[0].value).toBe('Edificio, oficina');
  });

  it('parses a JSON object with insurer/value cells', () => {
    const input = JSON.stringify({
      insurers: ['MAPFRE', 'CHUBB'],
      rows: [
        {
          label: 'Bienes Asegurados',
          cells: [
            { insurer: 'MAPFRE', value: 'Edificio' },
            { insurer: 'CHUBB', value: 'Mercancía' },
          ],
        },
        {
          label: 'Deducibles',
          cells: [
            { insurer: 'MAPFRE', value: '10%' },
            { insurer: 'CHUBB', value: '5%' },
          ],
        },
        {
          label: 'Prima con IVA',
          cells: [
            { insurer: 'MAPFRE', value: '$1M' },
            { insurer: 'CHUBB', value: '$1.2M' },
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
    });

    const result = flatTableParser.parse(input, baseOptions);

    expect(FlatComparisonSchema.safeParse(result).success).toBe(true);
    expect(result.rows[1].cells.map((cell) => cell.value)).toEqual(['10%', '5%']);
  });

  it('parses a JSON object mapping insurers to row values', () => {
    const input = JSON.stringify({
      MAPFRE: {
        'Bienes Asegurados': 'Edificio',
        Deducibles: '10%',
        'Prima con IVA': '$1M',
        'Forma de Pago': 'Anual',
      },
      CHUBB: {
        'Bienes Asegurados': 'Mercancía',
        Deducibles: '5%',
        'Prima con IVA': '$1.2M',
        'Forma de Pago': 'Mensual',
      },
    });

    const result = flatTableParser.parse(input, baseOptions);

    expect(FlatComparisonSchema.safeParse(result).success).toBe(true);
    expect(result.insurers).toEqual(['MAPFRE', 'CHUBB']);
    expect(result.rows[3].cells.map((cell) => cell.value)).toEqual(['Anual', 'Mensual']);
  });

  it('parses a key-value list grouped by row label', () => {
    const input = `
Bienes Asegurados:
MAPFRE: Edificio y contenidos
CHUBB: Mercancías y muebles

Deducibles:
MAPFRE: 10% mínimo 1 SMMLV
CHUBB: 5%

Prima con IVA:
MAPFRE: $ 1.000.000
CHUBB: $ 1.200.000

Forma de Pago:
MAPFRE: Anual
CHUBB: Trimestral
`;

    const result = flatTableParser.parse(input, baseOptions);

    expect(FlatComparisonSchema.safeParse(result).success).toBe(true);
    expect(result.rows[0].cells.map((cell) => cell.value)).toEqual([
      'Edificio y contenidos',
      'Mercancías y muebles',
    ]);
  });

  it('creates missing rows with notFound:true', () => {
    const input = `
| | MAPFRE | CHUBB |
| Bienes Asegurados | Edificio | Mercancía |
| Prima con IVA | $1M | $1.2M |
| Forma de Pago | Anual | Mensual |
`;

    const result = flatTableParser.parse(input, baseOptions);

    const deductiblesRow = result.rows.find((row) => row.label === 'Deducibles');
    expect(deductiblesRow).toBeDefined();
    expect(deductiblesRow!.cells.every((cell) => cell.value === 'No informado')).toBe(true);
    expect(deductiblesRow!.cells.every((cell) => cell.notFound === true)).toBe(true);
    expect(result.warnings.some((warning) => warning.includes('Deducibles'))).toBe(true);
  });

  it('places unexpected rows in extraRows', () => {
    const input = `
| | MAPFRE | CHUBB |
| Bienes Asegurados | Edificio | Mercancía |
| Deducibles | 10% | 5% |
| Prima con IVA | $1M | $1.2M |
| Forma de Pago | Anual | Mensual |
| Observaciones | Revisar clausulado | Ninguna |
`;

    const result = flatTableParser.parse(input, baseOptions);

    expect(result.extraRows).toHaveLength(1);
    expect(result.extraRows[0].label).toBe('Observaciones');
    expect(result.extraRows[0].cells.map((cell) => cell.value)).toEqual([
      'Revisar clausulado',
      'Ninguna',
    ]);
  });

  it('flags empty cells as notFound', () => {
    const input = `
| | MAPFRE | CHUBB |
| Bienes Asegurados | Edificio | |
| Deducibles | 10% | 5% |
| Prima con IVA | $1M | $1.2M |
| Forma de Pago | Anual | Mensual |
`;

    const result = flatTableParser.parse(input, baseOptions);

    const bienesRow = result.rows.find((row) => row.label === 'Bienes Asegurados');
    expect(bienesRow!.cells[1].value).toBe('No informado');
    expect(bienesRow!.cells[1].notFound).toBe(true);
  });

  it('normalizes row labels without regard to case or accents', () => {
    const input = `
| | MAPFRE | CHUBB |
| bienes asegurados | Edificio | Mercancía |
| DEDUCIBLES | 10% | 5% |
| prima con iva | $1M | $1.2M |
| forma de pago | Anual | Mensual |
`;

    const result = flatTableParser.parse(input, baseOptions);

    expect(result.rows.map((row) => row.label)).toEqual(FLAT_ROW_LABELS);
  });

  it('throws FlatTableParseError for unparseable input', () => {
    expect(() => flatTableParser.parse('esto no es una tabla', baseOptions)).toThrow(
      FlatTableParseError
    );
  });

  it('throws FlatTableParseError for malformed JSON', () => {
    expect(() => flatTableParser.parse('{ insurers: [MAPFRE] }', baseOptions)).toThrow(
      FlatTableParseError
    );
  });

  it('keeps unknown rows from JSON in extraRows', () => {
    const input = JSON.stringify({
      insurers: ['MAPFRE'],
      rows: [
        { label: 'Bienes Asegurados', cells: [{ insurer: 'MAPFRE', value: 'Edificio' }] },
        { label: 'Deducibles', cells: [{ insurer: 'MAPFRE', value: '10%' }] },
        { label: 'Prima con IVA', cells: [{ insurer: 'MAPFRE', value: '$1M' }] },
        { label: 'Forma de Pago', cells: [{ insurer: 'MAPFRE', value: 'Anual' }] },
        { label: 'Observaciones', cells: [{ insurer: 'MAPFRE', value: 'Revisar' }] },
      ],
    });

    const result = flatTableParser.parse(input, baseOptions);

    expect(result.extraRows).toHaveLength(1);
    expect(result.extraRows[0].label).toBe('Observaciones');
  });

  it('handles arbitrary row ordering in Markdown', () => {
    const input = `
| | MAPFRE | CHUBB |
| Prima con IVA | $1M | $1.2M |
| Forma de Pago | Anual | Mensual |
| Bienes Asegurados | Edificio | Mercancía |
| Deducibles | 10% | 5% |
`;

    const result = flatTableParser.parse(input, baseOptions);

    expect(result.rows.map((row) => row.label)).toEqual(FLAT_ROW_LABELS);
    expect(result.rows[0].cells.map((cell) => cell.value)).toEqual(['Edificio', 'Mercancía']);
  });
});

describe('normalizeAlias', () => {
  it('maps "Valor Edificio" to canonical "Edificio"', () => {
    const result = normalizeAlias('Valor Edificio');

    expect(result).toBeDefined();
    expect(result!.canonical).toBe('Edificio');
  });

  it('maps "Eq. Eléctrico" to canonical "Equipo eléctrico y electrónico"', () => {
    const result = normalizeAlias('Eq. Eléctrico');

    expect(result).toBeDefined();
    expect(result!.canonical).toBe('Equipo eléctrico y electrónico');
  });

  it('prefers the most specific alias match', () => {
    const result = normalizeAlias('Prima total con IVA');

    expect(result).toBeDefined();
    expect(result!.canonical).toBe('Prima con IVA incluido');
  });

  it('returns undefined for ambiguous labels such as "Equipo"', () => {
    const result = normalizeAlias('Equipo');

    expect(result).toBeUndefined();
  });

  it('is case and accent insensitive', () => {
    const result = normalizeAlias('mercaderías');

    expect(result).toBeDefined();
    expect(result!.canonical).toBe('Mercancías');
  });
});

describe('computeCellConfidence', () => {
  it('returns a high score for a well-formed cell with raw text and matched alias', () => {
    const confidence = computeCellConfidence(
      { insurer: 'MAPFRE', value: '$ 500.000', rawText: '$ 500.000' },
      1
    );

    expect(confidence).toBeGreaterThanOrEqual(0.7);
  });

  it('reduces confidence when notFound is true', () => {
    const notFoundConfidence = computeCellConfidence(
      { insurer: 'MAPFRE', value: 'No informado', notFound: true },
      1
    );
    const foundConfidence = computeCellConfidence(
      { insurer: 'MAPFRE', value: '$ 500.000', rawText: '$ 500.000' },
      1
    );

    expect(notFoundConfidence).toBeLessThan(foundConfidence);
  });

  it('reduces confidence when rawText is missing', () => {
    const noRawTextConfidence = computeCellConfidence({ insurer: 'MAPFRE', value: '$ 500.000' }, 1);
    const rawTextConfidence = computeCellConfidence(
      { insurer: 'MAPFRE', value: '$ 500.000', rawText: '$ 500.000' },
      1
    );

    expect(noRawTextConfidence).toBeLessThan(rawTextConfidence);
  });

  it('reduces confidence when isAmbiguous is true', () => {
    const ambiguousConfidence = computeCellConfidence(
      { insurer: 'MAPFRE', value: '$ 500.000', rawText: '$ 500.000', isAmbiguous: true },
      1
    );
    const cleanConfidence = computeCellConfidence(
      { insurer: 'MAPFRE', value: '$ 500.000', rawText: '$ 500.000' },
      1
    );

    expect(ambiguousConfidence).toBeLessThan(cleanConfidence);
  });

  it('scales with alias quality', () => {
    const highQuality = computeCellConfidence(
      { insurer: 'MAPFRE', value: '$ 500.000', rawText: '$ 500.000' },
      1
    );
    const lowQuality = computeCellConfidence(
      { insurer: 'MAPFRE', value: '$ 500.000', rawText: '$ 500.000' },
      0.5
    );

    expect(lowQuality).toBeLessThan(highQuality);
  });
});

describe('flatTableParser.parseV2', async () => {
  it('normalizes row labels and assigns sections for canonical labels', async () => {
    const input = JSON.stringify({
      insurers: ['MAPFRE', 'CHUBB'],
      rows: [
        {
          label: 'Valor Edificio',
          cells: [
            { insurer: 'MAPFRE', value: '$500M' },
            { insurer: 'CHUBB', value: '$600M' },
          ],
        },
        {
          label: 'Prima con IVA',
          cells: [
            { insurer: 'MAPFRE', value: '$1M' },
            { insurer: 'CHUBB', value: '$1.2M' },
          ],
        },
      ],
    });

    const result = await flatTableParser.parseV2(input, baseOptions);

    expect(FlatComparisonSchemaV2.safeParse(result).success).toBe(true);
    expect(result.schemaVersion).toBe(2);
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0].label).toBe('Edificio');
    expect(result.rows[0].section).toBe('BIENES ASEGURADOS');
    expect(result.rows[1].section).toBe('FINANCIAL');
  });

  it('routes ambiguous labels to extraRows with isAmbiguous flag', async () => {
    const input = JSON.stringify({
      insurers: ['MAPFRE'],
      rows: [
        {
          label: 'Equipo',
          cells: [{ insurer: 'MAPFRE', value: 'Incluido' }],
        },
      ],
    });

    const result = await flatTableParser.parseV2(input, baseOptions);

    expect(result.rows).toHaveLength(0);
    expect(result.extraRows).toHaveLength(1);
    expect(result.extraRows[0].label).toBe('Equipo');
    expect(result.extraRows[0].cells[0].isAmbiguous).toBe(true);
  });

  it('assigns derived confidence to each cell', async () => {
    const input = JSON.stringify({
      insurers: ['MAPFRE', 'CHUBB'],
      rows: [
        {
          label: 'Contenidos',
          cells: [
            { insurer: 'MAPFRE', value: '$200M', rawText: '$200M' },
            { insurer: 'CHUBB', value: null, notFound: true },
          ],
        },
      ],
    });

    const result = await flatTableParser.parseV2(input, baseOptions);

    expect(result.rows[0].cells[0].confidence).toBeGreaterThan(0.7);
    expect(result.rows[0].cells[1].confidence).toBeLessThan(0.5);
  });

  it('keeps unmapped rows as extraRows without isAmbiguous when no alias matches', async () => {
    const input = JSON.stringify({
      insurers: ['MAPFRE'],
      rows: [
        {
          label: 'Comentarios adicionales',
          cells: [{ insurer: 'MAPFRE', value: 'Revisar' }],
        },
      ],
    });

    const result = await flatTableParser.parseV2(input, baseOptions);

    expect(result.extraRows).toHaveLength(1);
    expect(result.extraRows[0].label).toBe('Comentarios adicionales');
    expect(result.extraRows[0].cells[0].isAmbiguous).toBeUndefined();
  });

  it('extracts structured deductible from percentage + minimum SMMLV', async () => {
    const input = JSON.stringify({
      insurers: ['MAPFRE'],
      rows: [
        {
          label: 'Deducible Edificio',
          cells: [{ insurer: 'MAPFRE', value: '10% del valor de la pérdida, mínimo 1 SMMLV' }],
        },
      ],
    });

    const result = await flatTableParser.parseV2(input, baseOptions);

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].section).toBe('DEDUCIBLES');
    expect(result.rows[0].cells[0].deductible).toEqual({
      percentage: 10,
      minimum: 1,
      currency: 'SMMLV',
      type: 'percentage_with_minimum',
    });
    expect(result.rows[0].cells[0].value).toBe('10% del valor de la pérdida, mínimo 1 SMMLV');
    expect(result.rows[0].cells[0].isAmbiguous).toBeUndefined();
  });

  it('extracts percentage-only deductible', async () => {
    const input = JSON.stringify({
      insurers: ['CHUBB'],
      rows: [
        {
          label: 'Deducible Contenidos',
          cells: [{ insurer: 'CHUBB', value: '5% sobre valor asegurado' }],
        },
      ],
    });

    const result = await flatTableParser.parseV2(input, baseOptions);

    expect(result.rows[0].cells[0].deductible).toEqual({
      percentage: 5,
      type: 'percentage',
    });
    expect(result.rows[0].cells[0].isAmbiguous).toBeUndefined();
  });

  it('extracts minimum-only deductible in SMMLV', async () => {
    const input = JSON.stringify({
      insurers: ['BBVA'],
      rows: [
        {
          label: 'Deducible Mercancías',
          cells: [{ insurer: 'BBVA', value: 'mínimo 2 SMMLV' }],
        },
      ],
    });

    const result = await flatTableParser.parseV2(input, baseOptions);

    expect(result.rows[0].cells[0].deductible).toEqual({
      minimum: 2,
      currency: 'SMMLV',
      type: 'minimum',
    });
    expect(result.rows[0].cells[0].isAmbiguous).toBeUndefined();
  });

  it('uses "Ver condiciones" fallback and flags ambiguous when deductible is unclear', async () => {
    const input = JSON.stringify({
      insurers: ['AXA'],
      rows: [
        {
          label: 'Deducible Equipo Eléctrico',
          cells: [{ insurer: 'AXA', value: 'según clausulado' }],
        },
      ],
    });

    const result = await flatTableParser.parseV2(input, baseOptions);

    expect(result.rows[0].cells[0].value).toBe('Ver condiciones');
    expect(result.rows[0].cells[0].deductible).toEqual({ type: 'see_conditions' });
    expect(result.rows[0].cells[0].isAmbiguous).toBe(true);
  });

  it('treats No aplica as a non-ambiguous deductible', async () => {
    const input = JSON.stringify({
      insurers: ['MAPFRE'],
      rows: [
        {
          label: 'Deducible Equipo Eléctrico',
          cells: [{ insurer: 'MAPFRE', value: 'No aplica' }],
        },
      ],
    });

    const result = await flatTableParser.parseV2(input, baseOptions);

    expect(result.rows[0].cells[0].value).toBe('No aplica');
    expect(result.rows[0].cells[0].deductible).toEqual({ type: 'not_applicable' });
    expect(result.rows[0].cells[0].isAmbiguous).toBeUndefined();
  });

  it('extracts quoteMetadata from JSON input', async () => {
    const input = JSON.stringify({
      insurers: ['MAPFRE', 'CHUBB'],
      quoteMetadata: [
        {
          insurer: 'MAPFRE',
          cliente: 'Juan Perez',
          tipoSeguro: 'Pyme',
          ubicacionRiesgo: 'Bogota',
          anoConstruccion: '2010',
          pisos: '3',
          aliado: 'Aliado A',
          actividadOcupacion: 'Comercio',
          documento: '12345',
          vigencia: '1 ano',
        },
        {
          insurer: 'CHUBB',
          cliente: 'Maria Gomez',
          tipoSeguro: 'Multirriesgo',
          ubicacionRiesgo: 'Medellin',
          anoConstruccion: '2015',
          pisos: '5',
          aliado: 'Aliado B',
          actividadOcupacion: 'Servicios',
          documento: '67890',
          vigencia: '2 anos',
        },
      ],
      rows: [
        {
          label: 'Mercancías',
          cells: [
            { insurer: 'MAPFRE', value: '$100M' },
            { insurer: 'CHUBB', value: '$200M' },
          ],
        },
      ],
    });

    const result = await flatTableParser.parseV2(input, baseOptions);

    expect(FlatComparisonSchemaV2.safeParse(result).success).toBe(true);
    expect(result.quoteMetadata).toBeDefined();
    expect(result.quoteMetadata).toHaveLength(2);
    expect(result.quoteMetadata![0].cliente).toBe('Juan Perez');
    expect(result.quoteMetadata![1].ubicacionRiesgo).toBe('Medellin');
  });

  it('classifies new business template sections properly', async () => {
    const input = JSON.stringify({
      insurers: ['MAPFRE'],
      rows: [
        {
          label: 'Muebles y enseres',
          cells: [{ insurer: 'MAPFRE', value: '$50M' }],
        },
        {
          label: 'Todo Riesgo Incendio',
          cells: [{ insurer: 'MAPFRE', value: '10%' }],
        },
        {
          label: 'Sustracción con Violencia',
          cells: [{ insurer: 'MAPFRE', value: 'Incluido' }],
        },
        {
          label: 'Gastos de expedición',
          cells: [{ insurer: 'MAPFRE', value: '$10.000' }],
        },
      ],
    });

    const result = await flatTableParser.parseV2(input, baseOptions);

    const mueblesRow = result.rows.find((r) => r.label === 'Muebles y enseres');
    expect(mueblesRow).toBeDefined();
    expect(mueblesRow!.section).toBe('BIENES ASEGURADOS');

    const incendioRow = result.rows.find((r) => r.label === 'Todo Riesgo Incendio');
    expect(incendioRow).toBeDefined();
    expect(incendioRow!.section).toBe('DEDUCIBLES');

    const sustraccionRow = result.rows.find((r) => r.label === 'Sustracción con Violencia');
    expect(sustraccionRow).toBeDefined();
    expect(sustraccionRow!.section).toBe('SUSTRACCIÓN');

    const gastosRow = result.rows.find((r) => r.label === 'Gastos de expedición');
    expect(gastosRow).toBeDefined();
    expect(gastosRow!.section).toBe('FINANCIAL');
  });

  it('classifies new standard COBERTURAS section and coverages properly', async () => {
    const input = JSON.stringify({
      insurers: ['MAPFRE'],
      rows: [
        {
          label: 'Amparo básico todo riesgo',
          cells: [{ insurer: 'MAPFRE', value: '$100M' }],
        },
        {
          label: 'Responsabilidad Civil Extracontractual (RCE)',
          cells: [{ insurer: 'MAPFRE', value: 'Incluido' }],
        },
        {
          label: 'RC en proceso civil',
          cells: [{ insurer: 'MAPFRE', value: 'Incluido' }],
        },
      ],
    });

    const result = await flatTableParser.parseV2(input, baseOptions);

    const amparoRow = result.rows.find((r) => r.label === 'Amparo básico todo riesgo');
    expect(amparoRow).toBeDefined();
    expect(amparoRow!.section).toBe('COBERTURAS');

    const rceRow = result.rows.find(
      (r) => r.label === 'Responsabilidad Civil Extracontractual (RCE)'
    );
    expect(rceRow).toBeDefined();
    expect(rceRow!.section).toBe('COBERTURAS');

    const rcProcesoRow = result.rows.find((r) => r.label === 'RC en proceso civil');
    expect(rcProcesoRow).toBeDefined();
    expect(rcProcesoRow!.section).toBe('COBERTURAS');
  });
});

describe('flatTableParser.parseV2 graph canonicalization', () => {
  function makeGraphServiceStub(
    overrides: Partial<
      ReturnType<typeof import('../../coverageGraphService').createCoverageGraphService>
    > = {}
  ): CoverageGraphService {
    return {
      query: vi.fn(async (rawName) => ({ mappings: [], composite: false, rawName })),
      queryDeductible: vi.fn(async () => []),
      addEdge: vi.fn(async () => {}),
      addEdges: vi.fn(async () => {}),
      learnCorrection: vi.fn(async () => {}),
      propagate: vi.fn(async () => {}),
      listEdges: vi.fn(async () => []),
      updateEdge: vi.fn(async () => {}),
      deleteEdge: vi.fn(async () => {}),
      invalidateCache: vi.fn(async () => {}),
      ...overrides,
    } as unknown as CoverageGraphService;
  }

  it('attaches graph canonical metadata and preserves the raw label', async () => {
    const graphService = makeGraphServiceStub({
      query: vi.fn(async (rawName, _options) => ({
        rawName,
        mappings: [
          {
            canonicalId: 'amparo-basico-todo-riesgo',
            confidence: 0.92,
            provenance: 'maps_to',
          },
        ],
        composite: false,
      })),
    });

    const input = JSON.stringify({
      insurers: ['BBVA'],
      rows: [
        {
          label: 'Daño Material Global',
          cells: [{ insurer: 'BBVA', value: '$100M' }],
        },
      ],
    });

    const result = await flatTableParser.parseV2(input, {
      ...baseOptions,
      graphEnabled: true,
      graphService,
    });

    expect(FlatComparisonSchemaV2.safeParse(result).success).toBe(true);
    const row = result.rows[0];
    expect(row.label).toBe('Daño Material Global');
    expect(row.canonicalName).toBe('Amparo básico todo riesgo');
    expect(row.canonicalId).toBe('amparo-basico-todo-riesgo');
    expect(row.canonicalSource).toBe('graph');
    expect(row.matchConfidence).toBe(0.92);
    expect(row.cells[0].value).toBe('$100M');
    expect(graphService.query).toHaveBeenCalledWith(
      'Daño Material Global',
      expect.objectContaining({ insurer: 'BBVA', domain: 'pyme' })
    );
  });

  it('marks unknown labels as uncanonicalized and keeps the raw label', async () => {
    const graphService = makeGraphServiceStub();

    const input = JSON.stringify({
      insurers: ['BBVA'],
      rows: [
        {
          label: 'Cobertura Adicional Especial',
          cells: [{ insurer: 'BBVA', value: 'Incluido' }],
        },
      ],
    });

    const result = await flatTableParser.parseV2(input, {
      ...baseOptions,
      graphEnabled: true,
      graphService,
    });

    const row = result.extraRows[0];
    expect(row.label).toBe('Cobertura Adicional Especial');
    expect(row.canonicalName).toBeUndefined();
    expect(row.canonicalSource).toBe('uncanonicalized');
    expect(row.uncanonicalized).toBe(true);
  });

  it('falls back to alias normalization when the graph has no mapping', async () => {
    const graphService = makeGraphServiceStub();

    const input = JSON.stringify({
      insurers: ['MAPFRE'],
      rows: [
        {
          label: 'Valor Edificio',
          cells: [{ insurer: 'MAPFRE', value: '$500M' }],
        },
      ],
    });

    const result = await flatTableParser.parseV2(input, {
      ...baseOptions,
      graphEnabled: true,
      graphService,
    });

    const row = result.rows[0];
    expect(row.label).toBe('Edificio');
    expect(row.canonicalName).toBe('Edificio');
    expect(row.canonicalId).toBe('edificio');
    expect(row.canonicalSource).toBe('alias');
  });

  it('links deductible rows to canonical coverages via queryDeductible', async () => {
    const graphService = makeGraphServiceStub({
      queryDeductible: vi.fn(async (deductibleText, _options) => [
        {
          deductibleText,
          appliesTo: 'Amparo básico todo riesgo',
          confidence: 0.88,
        },
      ]),
    });

    const input = JSON.stringify({
      insurers: ['BBVA'],
      rows: [
        {
          label: 'Deducible Edificio',
          cells: [{ insurer: 'BBVA', value: '10% mínimo 5 SMMLV - Amparo básico' }],
        },
      ],
    });

    const result = await flatTableParser.parseV2(input, {
      ...baseOptions,
      graphEnabled: true,
      graphService,
    });

    const cell = result.rows[0].cells[0];
    expect(cell.value).toBe('10% mínimo 5 SMMLV - Amparo básico');
    expect(cell.deductible).toMatchObject({
      percentage: 10,
      minimum: 5,
      currency: 'SMMLV',
      appliesTo: ['Amparo básico todo riesgo'],
    });
    expect(graphService.queryDeductible).toHaveBeenCalledWith(
      '10% mínimo 5 SMMLV - Amparo básico',
      expect.objectContaining({ insurer: 'BBVA' })
    );
  });

  it('skips graph queries when graphEnabled is false', async () => {
    const graphService = makeGraphServiceStub();

    const input = JSON.stringify({
      insurers: ['BBVA'],
      rows: [
        {
          label: 'Daño Material Global',
          cells: [{ insurer: 'BBVA', value: '$100M' }],
        },
      ],
    });

    const result = await flatTableParser.parseV2(input, {
      ...baseOptions,
      graphEnabled: false,
      graphService,
    });

    expect(result.rows).toHaveLength(0);
    expect(result.extraRows[0].canonicalSource).toBeUndefined();
    expect(graphService.query).not.toHaveBeenCalled();
    expect(graphService.queryDeductible).not.toHaveBeenCalled();
  });
});
