import { describe, it, expect } from 'vitest';
import { extractCanonicalInsurerName, isKnownCanonicalInsurer } from '../insurerSanitizer';

describe('extractCanonicalInsurerName', () => {
  it('extracts corporate brand when customer and product are concatenated', () => {
    expect(extractCanonicalInsurerName('ALLIANZ HOGAR ISABEL CRISTINA VASCO')).toBe('ALLIANZ');
    expect(extractCanonicalInsurerName('SBS HOGAR ISABEL CRISTINA VASCO')).toBe('SBS');
    expect(extractCanonicalInsurerName('SURA HOGAR ISABEL CRISTINA VASCO')).toBe('SURA');
  });

  it('extracts brand from PDF filenames', () => {
    expect(extractCanonicalInsurerName('COTIZACION - SURA SEGUROS.pdf')).toBe('SURA');
    expect(extractCanonicalInsurerName('mapfre_copropiedades_cot.pdf')).toBe('MAPFRE');
    expect(extractCanonicalInsurerName('AXA_Colpatria_PYME_2026.pdf')).toBe('AXA COLPATRIA');
    expect(extractCanonicalInsurerName('Chubb Seguros Colombia.pdf')).toBe('CHUBB');
    expect(extractCanonicalInsurerName('Seguros Bolivar Cotizacion.pdf')).toBe('BOLÍVAR');
    expect(extractCanonicalInsurerName('COTIZACION HDI SEGUROS PYME.pdf')).toBe('HDI');
    expect(extractCanonicalInsurerName('HDI_Seguros_Pyme.pdf')).toBe('HDI');
    expect(extractCanonicalInsurerName('PdfPolizaPrima (2).pdf')).toBe('HDI');
    expect(extractCanonicalInsurerName('PdfPolizaPrima.pdf')).toBe('HDI');
    expect(extractCanonicalInsurerName('Liberty Seguros Cotizacion.pdf')).toBe('LIBERTY');
  });

  it('resolves co-branded HDI / Liberty documents to HDI', () => {
    expect(extractCanonicalInsurerName('HDI Seguros - Antes Liberty Seguros S.A.')).toBe('HDI');
  });

  it('identifies known canonical insurers via isKnownCanonicalInsurer', () => {
    expect(isKnownCanonicalInsurer('HDI')).toBe(true);
    expect(isKnownCanonicalInsurer('BOLÍVAR')).toBe(true);
    expect(isKnownCanonicalInsurer('ZURICH')).toBe(true);
    expect(isKnownCanonicalInsurer('cotizacion 1')).toBe(false);
    expect(isKnownCanonicalInsurer('')).toBe(false);
  });

  it('handles unknown insurers gracefully without crashing', () => {
    expect(extractCanonicalInsurerName('')).toBe('Desconocido');
    expect(extractCanonicalInsurerName(null as unknown as string)).toBe('Desconocido');
    expect(extractCanonicalInsurerName('Aseguradora Regional')).toBe('Aseguradora Regional');
  });
});
