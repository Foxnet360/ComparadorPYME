import { describe, it, expect } from 'vitest';
import { auditQuote, detectMissingCoverages } from '../quoteBasedAuditor';

describe('quoteBasedAuditor - domain parameterization', () => {
  const mockPymeQuote = {
    insurerName: 'SURA',
    policyName: 'Póliza PYME',
    priceAnnual: 10000000,
    currency: 'COP',
    coverages: [
      { name: 'Incendio y Terremoto', value: '$500M' },
    ],
    alerts: [],
  };

  const mockAutosQuote = {
    insurerName: 'ALLIANZ',
    policyName: 'Póliza Autos',
    priceAnnual: 2500000,
    currency: 'COP',
    coverages: [
      { name: 'Responsabilidad Civil Extracontractual Vehicular', value: '$1000M' },
    ],
    alerts: [],
  };

  describe('detectMissingCoverages', () => {
    it('uses canonical PYME categories when domain is pyme or undefined', () => {
      const missingUndefined = detectMissingCoverages(mockPymeQuote);
      const categoryNamesUndefined = missingUndefined.map((m) => m.categoryName);

      expect(categoryNamesUndefined).toContain('Responsabilidad Civil (RCE)');
      expect(categoryNamesUndefined).toContain('Sustracción / Hurto');
      expect(categoryNamesUndefined).not.toContain('Pérdida Total (hurto, daños, PT)');

      const missingPyme = detectMissingCoverages(mockPymeQuote, 'pyme');
      const categoryNamesPyme = missingPyme.map((m) => m.categoryName);
      expect(categoryNamesPyme).toEqual(categoryNamesUndefined);
    });

    it('dynamically resolves categories from autos taxonomy when domain is autos', () => {
      const missingAutos = detectMissingCoverages(mockAutosQuote, 'autos');
      const categoryNamesAutos = missingAutos.map((m) => m.categoryName);

      // Autos category names from taxonomy.json
      expect(categoryNamesAutos).toContain('Pérdida Total (hurto, daños, PT)');
      expect(categoryNamesAutos).not.toContain('Incendio (Edificio y Contenidos)');
      expect(categoryNamesAutos).not.toContain('Sustracción / Hurto');
    });

    it('falls back to CANONICAL_CATEGORIES when domain is unknown or taxonomy cannot be loaded', () => {
      const missingFallback = detectMissingCoverages(mockPymeQuote, 'unknown_domain_xyz');
      const categoryNames = missingFallback.map((m) => m.categoryName);

      expect(categoryNames).toContain('Responsabilidad Civil (RCE)');
      expect(categoryNames).toContain('Sustracción / Hurto');
    });
  });

  describe('auditQuote', () => {
    it('propagates domain to detectMissingCoverages and alerts', () => {
      const auditAutos = auditQuote(mockAutosQuote, [mockAutosQuote], 'autos');

      const missingNames = auditAutos.missingCoverages.map((m) => m.categoryName);
      expect(missingNames).toContain('Pérdida Total (hurto, daños, PT)');
      expect(missingNames).not.toContain('Incendio (Edificio y Contenidos)');
    });
  });
});
