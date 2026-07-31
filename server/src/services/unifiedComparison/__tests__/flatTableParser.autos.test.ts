import { describe, it, expect } from 'vitest';
import { flatTableParser, normalizeAlias } from '../flatTableParser';
import { FlatComparisonSchemaV2 } from '../comparisonSchema';

const baseOptions = { pdfCount: 2, model: 'gemini-test' };

describe('flatTableParser.parseV2 - autos domain taxonomy aliases', () => {
  it('normalizes an autos RCE alias to the autos taxonomy canonical name', async () => {
    const input = JSON.stringify({
      insurers: ['MAPFRE'],
      rows: [
        {
          label: 'RCE vehicular',
          cells: [{ insurer: 'MAPFRE', value: '$2.000M' }],
        },
      ],
    });

    const result = await flatTableParser.parseV2(input, { ...baseOptions, domain: 'autos' });

    expect(FlatComparisonSchemaV2.safeParse(result).success).toBe(true);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].label).toBe('Responsabilidad Civil Extracontractual Vehicular');
    expect(result.rows[0].section).toBe('COBERTURAS');
  });

  it('normalizes autos PT/PP aliases using the autos taxonomy', async () => {
    const input = JSON.stringify({
      insurers: ['SBS'],
      rows: [
        { label: 'PT', cells: [{ insurer: 'SBS', value: 'Incluido' }] },
        { label: 'PP', cells: [{ insurer: 'SBS', value: 'Incluido' }] },
      ],
    });

    const result = await flatTableParser.parseV2(input, { ...baseOptions, domain: 'autos' });

    const labels = result.rows.map((r) => r.label);
    expect(labels).toContain('Pérdida Total (hurto, daños, PT)');
    expect(labels).toContain('Pérdida Parcial (colisión, PP)');
  });

  it('keeps pyme alias normalization unchanged when domain is omitted', async () => {
    const input = JSON.stringify({
      insurers: ['MAPFRE'],
      rows: [
        {
          label: 'RCE',
          cells: [{ insurer: 'MAPFRE', value: 'Incluido' }],
        },
      ],
    });

    const result = await flatTableParser.parseV2(input, baseOptions);

    expect(result.rows[0].label).toBe('Responsabilidad Civil Extracontractual (RCE)');
    expect(result.rows[0].section).toBe('COBERTURAS');
  });

  it('routes ambiguous autos labels to extraRows', async () => {
    const input = JSON.stringify({
      insurers: ['MAPFRE'],
      rows: [
        {
          label: 'Cobertura especial no listada',
          cells: [{ insurer: 'MAPFRE', value: 'Incluido' }],
        },
      ],
    });

    const result = await flatTableParser.parseV2(input, { ...baseOptions, domain: 'autos' });

    expect(result.rows).toHaveLength(0);
    expect(result.extraRows).toHaveLength(1);
    expect(result.extraRows[0].label).toBe('Cobertura especial no listada');
  });
});

describe('normalizeAlias - domain-aware', () => {
  it('maps "Carro taller" to the autos canonical name when domain is autos', () => {
    const result = normalizeAlias('Carro taller', 'autos');

    expect(result).toBeDefined();
    expect(result!.canonical).toBe('Carro Taller / Vehículo de Reemplazo');
  });

  it('maps "Carro taller" to undefined when domain is pyme', () => {
    const result = normalizeAlias('Carro taller', 'pyme');

    expect(result).toBeUndefined();
  });

  it('defaults to pyme behavior when domain is omitted', () => {
    const result = normalizeAlias('Valor Edificio');

    expect(result).toBeDefined();
    expect(result!.canonical).toBe('Edificio');
  });
});
