import { describe, it, expect } from 'vitest';
import {
  flatTableParser,
  FlatTableParseError,
  FLAT_ROW_LABELS,
  normalizeAlias,
  computeCellConfidence,
} from '../flatTableParser';
import { FlatComparisonSchema, FlatComparisonSchemaV2 } from '../comparisonSchema';

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

  it('maps "Eq. Eléctrico" to canonical "Equipo Eléctrico"', () => {
    const result = normalizeAlias('Eq. Eléctrico');

    expect(result).toBeDefined();
    expect(result!.canonical).toBe('Equipo Eléctrico');
  });

  it('prefers the most specific alias match', () => {
    const result = normalizeAlias('Prima total con IVA');

    expect(result).toBeDefined();
    expect(result!.canonical).toBe('Prima con IVA');
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

describe('flatTableParser.parseV2', () => {
  it('normalizes row labels and assigns sections for canonical labels', () => {
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

    const result = flatTableParser.parseV2(input, baseOptions);

    expect(FlatComparisonSchemaV2.safeParse(result).success).toBe(true);
    expect(result.schemaVersion).toBe(2);
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0].label).toBe('Edificio');
    expect(result.rows[0].section).toBe('BIENES ASEGURADOS');
    expect(result.rows[1].section).toBe('INFORMACIÓN GENERAL');
  });

  it('routes ambiguous labels to extraRows with isAmbiguous flag', () => {
    const input = JSON.stringify({
      insurers: ['MAPFRE'],
      rows: [
        {
          label: 'Equipo',
          cells: [{ insurer: 'MAPFRE', value: 'Incluido' }],
        },
      ],
    });

    const result = flatTableParser.parseV2(input, baseOptions);

    expect(result.rows).toHaveLength(0);
    expect(result.extraRows).toHaveLength(1);
    expect(result.extraRows[0].label).toBe('Equipo');
    expect(result.extraRows[0].cells[0].isAmbiguous).toBe(true);
  });

  it('assigns derived confidence to each cell', () => {
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

    const result = flatTableParser.parseV2(input, baseOptions);

    expect(result.rows[0].cells[0].confidence).toBeGreaterThan(0.7);
    expect(result.rows[0].cells[1].confidence).toBeLessThan(0.5);
  });

  it('keeps unmapped rows as extraRows without isAmbiguous when no alias matches', () => {
    const input = JSON.stringify({
      insurers: ['MAPFRE'],
      rows: [
        {
          label: 'Comentarios adicionales',
          cells: [{ insurer: 'MAPFRE', value: 'Revisar' }],
        },
      ],
    });

    const result = flatTableParser.parseV2(input, baseOptions);

    expect(result.extraRows).toHaveLength(1);
    expect(result.extraRows[0].label).toBe('Comentarios adicionales');
    expect(result.extraRows[0].cells[0].isAmbiguous).toBeUndefined();
  });
});
