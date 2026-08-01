import { describe, it, expect, vi } from 'vitest';
import { domainTaxonomyRegistry, resolveInsuranceDomain } from '../domainTaxonomyRegistry';

describe('domainTaxonomyRegistry', () => {
  it('loads the PYME taxonomy (v2) with 16 categories', () => {
    const taxonomy = domainTaxonomyRegistry.getTaxonomy('pyme');
    expect(taxonomy.domain).toBe('pyme');
    expect(taxonomy.categories).toHaveLength(16);

    const names = taxonomy.categories.map((c) => c.name);
    expect(names).toContain('Incendio (Edificio y Contenidos)');
    expect(names).toContain('Daños por Agua, Anegación e Inundación');
    expect(names).toContain('Responsabilidad Civil por Productos (RC Productos)');
    expect(names).toContain('Terremoto y Eventos Catastróficos');
  });

  it('returns the canonical PYME coverage names including new v2 categories', () => {
    const names = domainTaxonomyRegistry.getCanonicalNames('pyme');
    expect(names).toHaveLength(16);
    expect(names).toContain('Responsabilidad Civil Extracontractual (RCE)');
    expect(names).toContain('Daños por Agua, Anegación e Inundación');
  });

  it('loads the autos taxonomy (v2) with 14 categories including SOAT', () => {
    const taxonomy = domainTaxonomyRegistry.getTaxonomy('autos');
    expect(taxonomy.domain).toBe('autos');
    expect(taxonomy.categories).toHaveLength(14);

    const names = taxonomy.categories.map((category) => category.name);
    expect(names).toContain('Responsabilidad Civil Extracontractual Vehicular');
    expect(names).toContain('Pérdida Total (hurto, daños, PT)');
    expect(names).toContain('Deducibles (SMMLV / días de inmovilización / %)');
    expect(names).toContain('SOAT / Seguro Obligatorio de Accidentes de Tránsito');
    expect(names).toContain('Accesorios, Lujos y Blindaje');
  });

  it('loads the copropiedades taxonomy (v2) with 16 categories including Ley 675 obligations', () => {
    const taxonomy = domainTaxonomyRegistry.getTaxonomy('copropiedades');
    expect(taxonomy.domain).toBe('copropiedades');
    expect(taxonomy.categories).toHaveLength(16);

    const names = taxonomy.categories.map((category) => category.name);
    expect(names).toContain('Incendio, Rayo y Explosión sobre Bienes Comunes');
    expect(names).toContain('Terremoto, Temblor y Erupción Volcánica sobre Bienes Comunes');
    expect(names).toContain('Responsabilidad Civil Extracontractual Áreas Comunes');
    expect(names).toContain('RC Directores y Administradores (D&O Copropiedades)');
    expect(names).toContain('Responsabilidad Civil Patronal (Empleados de Zonas Comunes)');
  });

  it('loads the vida_grupo taxonomy (v2) with 16 categories including IPP and Desempleo', () => {
    const taxonomy = domainTaxonomyRegistry.getTaxonomy('vida_grupo');
    expect(taxonomy.domain).toBe('vida_grupo');
    expect(taxonomy.categories).toHaveLength(16);

    const names = taxonomy.categories.map((category) => category.name);
    expect(names).toContain('Amparo Básico por Muerte (Cualquier Causa)');
    expect(names).toContain('Incapacidad Total y Permanente (ITP)');
    expect(names).toContain('Cobertura de Suicidio (Carencia / Día 1)');
    expect(names).toContain('Incapacidad Parcial Permanente (IPP)');
    expect(names).toContain('Renta por Desempleo Involuntario');
  });

  it('loads the salud taxonomy (v2) with 17 categories including preventive care', () => {
    const taxonomy = domainTaxonomyRegistry.getTaxonomy('salud');
    expect(taxonomy.domain).toBe('salud');
    expect(taxonomy.categories).toHaveLength(17);

    const names = taxonomy.categories.map((category) => category.name);
    expect(names).toContain('Plan de Beneficios Base (Complemento o Sustitución del PBS)');
    expect(names).toContain('Oncología (Tratamientos de Alto Costo)');
    expect(names).toContain('Portabilidad y Carencias Regulatorias (Res. 244/2019 · Ley 1438)');
    expect(names).toContain('Hospitalización Domiciliaria y Atención en Casa');
    expect(names).toContain('Medicina Preventiva, Vacunación y Programas de Bienestar');
  });

  it('loads the cumplimiento taxonomy (v2) with 15 categories including Garantía de Mantenimiento', () => {
    const taxonomy = domainTaxonomyRegistry.getTaxonomy('cumplimiento');
    expect(taxonomy.domain).toBe('cumplimiento');
    expect(taxonomy.categories).toHaveLength(15);

    const names = taxonomy.categories.map((category) => category.name);
    expect(names).toContain('Seriedad de Oferta');
    expect(names).toContain('Cumplimiento de Contrato');
    expect(names).toContain('Salarios, Prestaciones e Indemnizaciones Laborales');
    expect(names).toContain(
      'Garantía Única de Cumplimiento (Contratación Estatal — Ley 80/1993 · Decreto 1082/2015)'
    );
    expect(names).toContain('Garantía de Mantenimiento (Post-Obra / Post-Contrato)');
  });

  it('loads the transporte taxonomy (v2) with 16 categories including maritime clauses', () => {
    const taxonomy = domainTaxonomyRegistry.getTaxonomy('transporte');
    expect(taxonomy.domain).toBe('transporte');
    expect(taxonomy.categories).toHaveLength(16);

    const names = taxonomy.categories.map((category) => category.name);
    expect(names).toContain('Daño Material a la Carga (Todo Riesgo / Named Perils)');
    expect(names).toContain('Robo y Hurto (Con y Sin Violencia)');
    expect(names).toContain(
      'Marco Normativo (Decreto 1079/2015 · Código de Comercio · Incoterms 2020)'
    );
    expect(names).toContain('Robo Parcial, Pillaje y Saqueo de la Carga');
    expect(names).toContain('Cláusula de Abandono y Pérdida Total Constructiva (Marítima)');
  });

  it('falls back to pyme for unknown domains and warns', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const taxonomy = domainTaxonomyRegistry.getTaxonomy('hogar' as never);

    expect(taxonomy.domain).toBe('pyme');
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Unknown domain "hogar"'));
    warnSpy.mockRestore();
  });
});

describe('resolveInsuranceDomain', () => {
  it('defaults missing/empty values to pyme', () => {
    expect(resolveInsuranceDomain(undefined)).toBe('pyme');
    expect(resolveInsuranceDomain(null)).toBe('pyme');
    expect(resolveInsuranceDomain('')).toBe('pyme');
  });

  it('accepts all registered domains including transporte', () => {
    expect(resolveInsuranceDomain('pyme')).toBe('pyme');
    expect(resolveInsuranceDomain('autos')).toBe('autos');
    expect(resolveInsuranceDomain('copropiedades')).toBe('copropiedades');
    expect(resolveInsuranceDomain('vida_grupo')).toBe('vida_grupo');
    expect(resolveInsuranceDomain('salud')).toBe('salud');
    expect(resolveInsuranceDomain('cumplimiento')).toBe('cumplimiento');
    expect(resolveInsuranceDomain('transporte')).toBe('transporte');
  });

  it('falls back to pyme for unknown values and warns', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    expect(resolveInsuranceDomain('vida')).toBe('pyme');
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Unknown domain "vida"'));
    warnSpy.mockRestore();
  });
});
