import { describe, it, expect, vi } from 'vitest';

function setRequiredEnv() {
  process.env.GEMINI_API_KEY = 'dummy';
  process.env.SUPABASE_URL = 'https://test.supabase.co';
  process.env.SUPABASE_ANON_KEY = 'dummy';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'dummy';
  process.env.SUPABASE_JWT_SECRET = 'dummy';
  process.env.SMMLV_VALUE = '1423500';
  process.env.UVT_VALUE = '42412';
}

describe('extractionSchemas ZOD_SCHEMA_VERSION gating', () => {
  it('strips unknown keys in v1 mode (default)', async () => {
    vi.resetModules();
    setRequiredEnv();
    process.env.ZOD_SCHEMA_VERSION = 'v1';

    const { QuoteExtractionSchemaV2 } = await import('../../server/src/schemas/extractionSchemas');

    const parsed = QuoteExtractionSchemaV2.parse({
      insurerName: 'SBS',
      policyName: 'PYME',
      premium: { totalPayable: 5_000_000, currency: 'COP' },
      rawCoverages: [
        {
          rawName: 'Incendio',
          insuredAmount: 100_000_000,
          deductible: '10%',
          rawTextSnippet: 'snippet text here',
          pageNumber: 1,
        },
      ],
      extraUnknownField: 'should be stripped',
    });

    expect(parsed.insurerName).toBe('SBS');
    expect((parsed as unknown as Record<string, unknown>).extraUnknownField).toBeUndefined();
  });

  it('rejects unknown keys in v2 mode', async () => {
    vi.resetModules();
    setRequiredEnv();
    process.env.ZOD_SCHEMA_VERSION = 'v2';

    const { QuoteExtractionSchemaV2 } = await import('../../server/src/schemas/extractionSchemas');

    expect(() =>
      QuoteExtractionSchemaV2.parse({
        insurerName: 'SBS',
        policyName: 'PYME',
        premium: { totalPayable: 5_000_000, currency: 'COP' },
        rawCoverages: [
          {
            rawName: 'Incendio',
            insuredAmount: 100_000_000,
            deductible: '10%',
            rawTextSnippet: 'snippet text here',
            pageNumber: 1,
          },
        ],
        extraUnknownField: 'should fail',
      })
    ).toThrow();
  });

  it('treats unrecognized schema version values as v1', async () => {
    vi.resetModules();
    setRequiredEnv();
    process.env.ZOD_SCHEMA_VERSION = 'v9';

    const { QuoteExtractionSchemaV2 } = await import('../../server/src/schemas/extractionSchemas');

    expect(() =>
      QuoteExtractionSchemaV2.parse({
        insurerName: 'SBS',
        policyName: 'PYME',
        premium: { totalPayable: 5_000_000, currency: 'COP' },
        rawCoverages: [
          {
            rawName: 'Incendio',
            insuredAmount: 100_000_000,
            deductible: '10%',
            rawTextSnippet: 'snippet text here',
            pageNumber: 1,
          },
        ],
        extraUnknownField: 'should be stripped',
      })
    ).not.toThrow();
  });
});
