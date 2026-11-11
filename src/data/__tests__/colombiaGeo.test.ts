import { describe, it, expect } from 'vitest';
import {
  COLOMBIA_DEPARTMENTS,
  getAllDepartments,
  getMunicipalitiesByDepartment,
  findGeoByCity,
  searchMunicipalities,
} from '../colombiaGeo';

describe('colombiaGeo National Catalog', () => {
  it('contains exactly 33 political-administrative divisions (32 departments + Bogotá D.C.)', () => {
    expect(COLOMBIA_DEPARTMENTS.length).toBe(33);
    const depts = getAllDepartments();
    expect(depts).toContain('Bogotá D.C.');
    expect(depts).toContain('Antioquia');
    expect(depts).toContain('Valle del Cauca');
    expect(depts).toContain('San Andrés y Providencia');
    expect(depts).toContain('Amazonas');
  });

  it('contains all 1.122 official DIVIPOLA municipalities of Colombia', () => {
    const totalMunicipalities = COLOMBIA_DEPARTMENTS.reduce(
      (sum, d) => sum + d.municipalities.length,
      0
    );
    expect(totalMunicipalities).toBe(1122);
  });

  it('all municipalities have valid Colombian geographical coordinates and NSR-10 zones', () => {
    for (const dept of COLOMBIA_DEPARTMENTS) {
      for (const m of dept.municipalities) {
        expect(['Alta', 'Intermedia', 'Baja']).toContain(m.zone);
        // Colombia latitude range: ~ -4.3 (Leticia) to ~ 13.4 (Providencia)
        expect(m.lat).toBeGreaterThanOrEqual(-5);
        expect(m.lat).toBeLessThanOrEqual(14);
        // Colombia longitude range: ~ -82 to ~ -66
        expect(m.lng).toBeGreaterThanOrEqual(-82);
        expect(m.lng).toBeLessThanOrEqual(-66);
      }
    }
  });

  describe('findGeoByCity with alias and accent tolerance', () => {
    it('resolves capital cities with or without official suffix', () => {
      const bogota = findGeoByCity('Bogotá');
      expect(bogota).not.toBeNull();
      expect(bogota?.dept).toBe('Bogotá D.C.');

      const cali = findGeoByCity('Cali');
      expect(cali).not.toBeNull();
      expect(cali?.dept).toBe('Valle del Cauca');
      expect(cali?.zone).toBe('Alta');

      const pasto = findGeoByCity('Pasto');
      expect(pasto).not.toBeNull();
      expect(pasto?.dept).toBe('Nariño');

      const cartagena = findGeoByCity('Cartagena');
      expect(cartagena).not.toBeNull();
      expect(cartagena?.dept).toBe('Bolívar');
    });

    it('resolves accent-insensitive city searches', () => {
      const medellin = findGeoByCity('medellin');
      expect(medellin).not.toBeNull();
      expect(medellin?.dept).toBe('Antioquia');
      expect(medellin?.lat).toBeCloseTo(6.2466, 1);
    });
  });

  describe('searchMunicipalities', () => {
    it('filters municipalities within a department', () => {
      const results = searchMunicipalities('rionegro', 'Antioquia');
      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results[0]?.name).toBe('Rionegro');
      expect(results[0]?.department).toBe('Antioquia');
    });

    it('finds municipalities across the entire country when department is not specified', () => {
      const results = searchMunicipalities('villavicencio');
      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results[0]?.name).toBe('Villavicencio');
      expect(results[0]?.department).toBe('Meta');
      expect(results[0]?.zone).toBe('Alta');
    });
  });
});
