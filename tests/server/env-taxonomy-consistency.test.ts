import { describe, it, expect, vi, beforeEach } from 'vitest';

process.env.GEMINI_API_KEY = 'dummy';
process.env.SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_ANON_KEY = 'dummy';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'dummy';
process.env.SUPABASE_JWT_SECRET = 'dummy';
process.env.SMMLV_VALUE = '1423500';
process.env.UVT_VALUE = '42412';

const mockLoadDomainJson = vi.fn();
const mockLogger = {
  error: vi.fn(),
  warn: vi.fn(),
  info: vi.fn(),
  debug: vi.fn(),
};

vi.mock(import('../../server/src/config/env'), async (importOriginal) => {
  const actual = (await importOriginal()) as { env: Record<string, unknown> };
  return {
    ...actual,
    env: {
      ...actual.env,
      SMMLV_VALUE: 1423500,
      UVT_VALUE: 42412,
      CURRENCY: 'COP',
    },
  };
});

vi.mock('../../server/src/services/domainBundleLoader', () => ({
  loadDomainJson: (...args: unknown[]) => mockLoadDomainJson(...args),
}));

vi.mock('../../server/src/config/logger', () => ({
  default: mockLogger,
}));

const { checkEnvTaxonomyConsistency, env } = await import('../../server/src/config/env');

describe('checkEnvTaxonomyConsistency', () => {
  beforeEach(() => {
    mockLoadDomainJson.mockReset();
    mockLogger.warn.mockReset();
    mockLogger.error.mockReset();
  });

  function makeConfig(smmlv: number, uvt: number) {
    return {
      ...env,
      SMMLV_VALUE: smmlv,
      UVT_VALUE: uvt,
    };
  }

  it('does not warn when env values match taxonomy metadata within 1%', () => {
    mockLoadDomainJson.mockReturnValue({
      metadata: {
        salaryValue2024: 1423500,
        uvtValue2024: 42412,
        source: 'test',
      },
    });

    checkEnvTaxonomyConsistency(makeConfig(1423500, 42412));
    expect(mockLogger.warn).not.toHaveBeenCalled();
  });

  it('warns when SMMLV drifts by more than 1%', () => {
    mockLoadDomainJson.mockReturnValue({
      metadata: {
        salaryValue2024: 1300000,
        uvtValue2024: 42412,
        source: 'test',
      },
    });

    checkEnvTaxonomyConsistency(makeConfig(1423500, 42412));
    expect(mockLogger.warn).toHaveBeenCalled();
    const warning = mockLogger.warn.mock.calls.find((call) => call[0].includes('SMMLV_VALUE'));
    expect(warning).toBeDefined();
  });

  it('warns when UVT drifts by more than 1%', () => {
    mockLoadDomainJson.mockReturnValue({
      metadata: {
        salaryValue2024: 1423500,
        uvtValue2024: 38000,
        source: 'test',
      },
    });

    checkEnvTaxonomyConsistency(makeConfig(1423500, 42412));
    const warning = mockLogger.warn.mock.calls.find((call) => call[0].includes('UVT_VALUE'));
    expect(warning).toBeDefined();
  });

  it('warns when SMMLV env var is missing and taxonomy metadata is used', () => {
    mockLoadDomainJson.mockReturnValue({
      metadata: {
        salaryValue2024: 1423500,
        uvtValue2024: 42412,
        source: 'test',
      },
    });

    const config = makeConfig(1423500, 42412);
    process.env.SMMLV_VALUE = '';
    checkEnvTaxonomyConsistency(config);
    process.env.SMMLV_VALUE = '1423500';

    const warning = mockLogger.warn.mock.calls.find((call) =>
      call[0].includes('SMMLV_VALUE not set')
    );
    expect(warning).toBeDefined();
  });

  it('throws when both env and taxonomy metadata are missing for SMMLV', () => {
    mockLoadDomainJson.mockReturnValue({
      metadata: {},
    });

    const config = makeConfig(1423500, 42412);
    process.env.SMMLV_VALUE = '';
    process.env.UVT_VALUE = '42412';
    expect(() => checkEnvTaxonomyConsistency(config)).toThrow(/SMMLV_VALUE/);
    process.env.SMMLV_VALUE = '1423500';
  });
});
