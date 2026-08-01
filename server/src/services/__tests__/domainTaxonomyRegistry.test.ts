import { describe, it, expect, vi } from 'vitest';
import { domainTaxonomyRegistry, resolveInsuranceDomain } from '../domainTaxonomyRegistry';

describe('domainTaxonomyRegistry', () => {
  it('loads the 14 existing PYME categories unchanged', () => {
    const taxonomy = domainTaxonomyRegistry.getTaxonomy('pyme');
    expect(taxonomy.domain).toBe('pyme');
    expect(taxonomy.categories).toHaveLength(14);
    expect(taxonomy.categories[0].name).toBe('Incendio (Edificio y Contenidos)');
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
    expect(names).toContain('Responsabilidad Civil Extracontractual Vehicular');
    expect(names).toContain('Pérdida Total (hurto, daños, PT)');
    expect(names).toContain('Deducibles (SMMLV / días de inmovilización / %)');
  });

  it('loads the copropiedades taxonomy with 14 categories including Ley 675 obligations', () => {
    const taxonomy = domainTaxonomyRegistry.getTaxonomy('copropiedades');
    expect(taxonomy.domain).toBe('copropiedades');
    expect(taxonomy.categories).toHaveLength(14);

    const names = taxonomy.categories.map((category) => category.name);
    expect(names).toContain('Incendio y Terremoto sobre Bienes Comunes');
    expect(names).toContain('Responsabilidad Civil Extracontractual Áreas Comunes');
    expect(names).toContain('RC Directores y Administradores (D&O Copropiedades)');
    expect(names).toContain('Daños por Agua, Anegación e Inundación');
  });

  it('loads the vida_grupo taxonomy with 14 categories', () => {
    const taxonomy = domainTaxonomyRegistry.getTaxonomy('vida_grupo');
    expect(taxonomy.domain).toBe('vida_grupo');
    expect(taxonomy.categories).toHaveLength(14);

    const names = taxonomy.categories.map((category) => category.name);
    expect(names).toContain('Amparo Básico por Muerte (Cualquier Causa)');
    expect(names).toContain('Incapacidad Total y Permanente (ITP)');
    expect(names).toContain('Cobertura de Suicidio (Carencia / Día 1)');
    expect(names).toContain('Auxilio Educativo para Hijos');
  });

  it('loads the salud taxonomy with 15 categories including Res. 244/2019 compliance', () => {
    const taxonomy = domainTaxonomyRegistry.getTaxonomy('salud');
    expect(taxonomy.domain).toBe('salud');
    expect(taxonomy.categories).toHaveLength(15);

    const names = taxonomy.categories.map((category) => category.name);
    expect(names).toContain('Plan de Beneficios Base (Complemento o Sustitución del PBS)');
    expect(names).toContain('Oncología (Tratamientos de Alto Costo)');
    expect(names).toContain('Maternidad y Neonatología');
    expect(names).toContain('Portabilidad y Carencias Regulatorias (Res. 244/2019 · Ley 1438)');
  });

  it('falls back to pyme for unknown domains and warns', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const taxonomy = domainTaxonomyRegistry.getTaxonomy('cumplimiento' as never);

    expect(taxonomy.domain).toBe('pyme');
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Unknown domain "cumplimiento"'));
    warnSpy.mockRestore();
  });
});

describe('resolveInsuranceDomain', () => {
  it('defaults missing/empty values to pyme', () => {
    expect(resolveInsuranceDomain(undefined)).toBe('pyme');
    expect(resolveInsuranceDomain(null)).toBe('pyme');
    expect(resolveInsuranceDomain('')).toBe('pyme');
  });

  it('accepts pyme, autos, copropiedades, vida_grupo, and salud', () => {
    expect(resolveInsuranceDomain('pyme')).toBe('pyme');
    expect(resolveInsuranceDomain('autos')).toBe('autos');
    expect(resolveInsuranceDomain('copropiedades')).toBe('copropiedades');
    expect(resolveInsuranceDomain('vida_grupo')).toBe('vida_grupo');
    expect(resolveInsuranceDomain('salud')).toBe('salud');
  });

  it('falls back to pyme for unknown values and warns', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    expect(resolveInsuranceDomain('vida')).toBe('pyme');
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Unknown domain "vida"'));
    warnSpy.mockRestore();
  });
});
