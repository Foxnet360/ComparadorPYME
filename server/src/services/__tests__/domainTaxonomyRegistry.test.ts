import { describe, it, expect, vi } from 'vitest';
import {
  domainTaxonomyRegistry,
  resolveInsuranceDomain,
} from '../domainTaxonomyRegistry';

describe('domainTaxonomyRegistry', () => {
  it('loads the 14 existing PYME categories unchanged', () => {
    const taxonomy = domainTaxonomyRegistry.getTaxonomy('pyme');
    expect(taxonomy.domain).toBe('pyme');
    expect(taxonomy.categories).toHaveLength(14);
    expect(taxonomy.categories[0].name).toBe(
      'Incendio (Edificio y Contenidos)'
    );
  });

  it('returns the canonical PYME coverage names', () => {
    const names = domainTaxonomyRegistry.getCanonicalNames('pyme');
    expect(names).toHaveLength(14);
    expect(names).toContain('Responsabilidad Civil (RCE)');
  });

  it('loads the autos taxonomy with the expected categories', () => {
    const taxonomy = domainTaxonomyRegistry.getTaxonomy('autos');
    expect(taxonomy.domain).toBe('autos');
    expect(taxonomy.categories.length).toBeGreaterThan(0);

    const names = taxonomy.categories.map((category) => category.name);
    expect(names).toContain(
      'Responsabilidad Civil Extracontractual Vehicular'
    );
    expect(names).toContain('Pérdida Total (hurto, daños, PT)');
    expect(names).toContain(
      'Deducibles (SMMLV / días de inmovilización / %)'
    );
  });

  it('falls back to pyme for unknown domains and warns', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const taxonomy = domainTaxonomyRegistry.getTaxonomy('salud' as never);

    expect(taxonomy.domain).toBe('pyme');
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Unknown domain "salud"')
    );
    warnSpy.mockRestore();
  });
});

describe('resolveInsuranceDomain', () => {
  it('defaults missing/empty values to pyme', () => {
    expect(resolveInsuranceDomain(undefined)).toBe('pyme');
    expect(resolveInsuranceDomain(null)).toBe('pyme');
    expect(resolveInsuranceDomain('')).toBe('pyme');
  });

  it('accepts pyme and autos', () => {
    expect(resolveInsuranceDomain('pyme')).toBe('pyme');
    expect(resolveInsuranceDomain('autos')).toBe('autos');
  });

  it('falls back to pyme for unknown values and warns', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    expect(resolveInsuranceDomain('vida')).toBe('pyme');
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Unknown domain "vida"')
    );
    warnSpy.mockRestore();
  });
});
