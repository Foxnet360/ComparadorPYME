import { describe, it, expect, vi } from 'vitest';

describe('QuoteExtractionSchemaV2 required fields', () => {
  it('requires rawTextSnippet and pageNumber on rawCoverages when strict mode is enabled', async () => {
    vi.resetModules();
    process.env.ZOD_SCHEMA_VERSION = 'v2';

    const { QuoteExtractionSchemaV2 } = await import('../../server/src/schemas/extractionSchemas');

    const valid = {
      insurerName: 'SBS',
      policyName: 'PYME',
      formatFamily: 'TABLE-DOUBLE',
      premium: { totalPayable: 5_000_000, currency: 'COP' },
      rawCoverages: [
        {
          rawName: 'Incendio y Riesgos Aliados',
          insuredAmount: 100_000_000,
          deductible: '10%',
          rawTextSnippet: 'Cobertura Incendio y Riesgos Aliados por valor de cien millones',
          pageNumber: 1,
        },
      ],
    };

    expect(() => QuoteExtractionSchemaV2.parse(valid)).not.toThrow();

    const missingSnippet = {
      ...valid,
      rawCoverages: [{ ...valid.rawCoverages[0], rawTextSnippet: undefined }],
    };
    expect(() => QuoteExtractionSchemaV2.parse(missingSnippet)).toThrow(/rawTextSnippet/);

    const missingPage = {
      ...valid,
      rawCoverages: [{ ...valid.rawCoverages[0], pageNumber: undefined }],
    };
    expect(() => QuoteExtractionSchemaV2.parse(missingPage)).toThrow(/pageNumber/);
  });

  it('includes formatFamily in the V2 schema', async () => {
    vi.resetModules();
    process.env.ZOD_SCHEMA_VERSION = 'v2';

    const { QuoteExtractionSchemaV2 } = await import('../../server/src/schemas/extractionSchemas');

    const parsed = QuoteExtractionSchemaV2.parse({
      insurerName: 'SBS',
      policyName: 'PYME',
      formatFamily: 'SECTIONS',
      premium: { totalPayable: 5_000_000, currency: 'COP' },
      rawCoverages: [
        {
          rawName: 'Incendio',
          rawTextSnippet: 'texto de cobertura extraido del pdf',
          pageNumber: 1,
        },
      ],
    });

    expect(parsed.formatFamily).toBe('SECTIONS');
  });
});
