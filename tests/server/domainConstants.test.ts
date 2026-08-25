import { describe, it, expect, vi } from 'vitest';

vi.mock('../../server/src/config/env', () => ({
  env: {
    SMMLV_VALUE: 1423500,
    UVT_VALUE: 42412,
    CURRENCY: 'COP',
  },
}));

const {
  getDomainConstants,
  getCanonicalCoverageNames,
  getCanonicalCoverageName,
  resolveValueToCOP,
} = await import('../../server/src/config/domainConstants');

describe('domainConstants', () => {
  it('returns authoritative SMMLV and UVT values from env', () => {
    const constants = getDomainConstants();
    expect(constants.smmlv).toBe(1423500);
    expect(constants.uvt).toBe(42412);
    expect(constants.currency).toBe('COP');
  });

  it('loads the 16 canonical PYME coverage names from taxonomy.json', () => {
    const names = getCanonicalCoverageNames();
    expect(names).toHaveLength(16);
    expect(names[0]).toBe('Incendio (Edificio y Contenidos)');
    expect(names[5]).toBe('Responsabilidad Civil Extracontractual (RCE)');
  });

  it('resolves SMMLV values to COP', () => {
    expect(resolveValueToCOP(5, 'SMMLV')).toBe(5 * 1423500);
  });

  it('resolves UVT values to COP', () => {
    expect(resolveValueToCOP(10, 'UVT')).toBe(10 * 42412);
  });

  it('returns the raw value for COP / missing unit', () => {
    expect(resolveValueToCOP(1_000_000, 'COP')).toBe(1_000_000);
    expect(resolveValueToCOP(1_000_000, null)).toBe(1_000_000);
  });

  it('looks up canonical coverage names by stable index', () => {
    expect(getCanonicalCoverageName('pyme', 0)).toBe('Incendio (Edificio y Contenidos)');
    expect(getCanonicalCoverageName('pyme', 5)).toBe('Responsabilidad Civil Extracontractual (RCE)');
    expect(() => getCanonicalCoverageName('pyme', 99)).toThrow(/out of range/);
  });

  it('caches constants per domain', () => {
    const first = getDomainConstants('pyme');
    const second = getDomainConstants('pyme');
    expect(first).toBe(second);
  });
});
