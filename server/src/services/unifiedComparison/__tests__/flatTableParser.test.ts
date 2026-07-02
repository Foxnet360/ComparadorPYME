import { describe, it, expect } from 'vitest';
import { flatTableParser, FlatTableParseError, FLAT_ROW_LABELS } from '../flatTableParser';
import { FlatComparisonSchema } from '../comparisonSchema';

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
        { label: 'Deducibles', cells: [{ insurer: 'MAPFRE', value: '10%' }, { insurer: 'CHUBB', value: '5%' }] },
        { label: 'Prima con IVA', cells: [{ insurer: 'MAPFRE', value: '$1M' }, { insurer: 'CHUBB', value: '$1.2M' }] },
        { label: 'Forma de Pago', cells: [{ insurer: 'MAPFRE', value: 'Anual' }, { insurer: 'CHUBB', value: 'Mensual' }] },
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
    expect(result.rows[0].cells.map((cell) => cell.value)).toEqual(['Edificio y contenidos', 'Mercancías y muebles']);
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
    expect(result.extraRows[0].cells.map((cell) => cell.value)).toEqual(['Revisar clausulado', 'Ninguna']);
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
    expect(() => flatTableParser.parse('esto no es una tabla', baseOptions)).toThrow(FlatTableParseError);
  });

  it('throws FlatTableParseError for malformed JSON', () => {
    expect(() => flatTableParser.parse('{ insurers: [MAPFRE] }', baseOptions)).toThrow(FlatTableParseError);
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
