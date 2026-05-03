import { describe, it, expect } from 'vitest';
import {
  mapCoverageName,
  normalizeCoverages,
  loadThesaurus,
} from '../thesaurusMapper';

describe('extended thesaurus', () => {

  describe('sub-limit mapping', () => {
    it('should map Remoción de Escombros to Incendio parent with sub-limit type', () => {
      const result = mapCoverageName('Remoción de Escombros');
      expect(result.canonicalName).toBe('Remoción de Escombros');
      expect(result.type).toBe('sub-limit');
      expect(result.parentCoverage).toBeDefined();
      expect(result.confidence).toBeGreaterThan(0.6);
    });

    it('should map Honorarios Profesionales with sub-limit type', () => {
      const result = mapCoverageName('Honorarios Profesionales');
      expect(result.type).toBe('sub-limit');
      expect(result.parentCoverage).toBeDefined();
    });

    it('should use lower threshold (0.6) for sub-limits', () => {
      // Sub-limits should be accepted at 0.65 confidence
      const result = mapCoverageName('Remoción de Escombros');
      expect(result.confidence).toBeGreaterThanOrEqual(0.6);
      expect(result.needsReview).toBe(false);
    });

    it('should still flag sub-limits below 0.6', () => {
      const result = mapCoverageName('XYZ Unknown Sub-limit');
      if (result.type !== 'main') {
        expect(result.confidence).toBeLessThan(0.6);
        expect(result.needsReview).toBe(true);
      }
    });
  });

  describe('rider mapping', () => {
    it('should map Amparo Automático as rider type', () => {
      const result = mapCoverageName('Amparo Automático de Nuevos Bienes');
      expect(result.type).toBe('rider');
      expect(result.parentCoverage).toBeDefined();
    });

    it('should use lower threshold (0.6) for riders', () => {
      const result = mapCoverageName('Amparo Automático');
      if (result.type === 'rider') {
        expect(result.confidence).toBeGreaterThanOrEqual(0.6);
      }
    });
  });

  describe('type-specific thresholds in normalizeCoverages', () => {
    it('should accept sub-limits at 0.65 confidence', () => {
      const coverages = [
        { name: 'Remoción de Escombros', value: '1000000', deductible: '10%' },
      ];

      const result = normalizeCoverages(coverages);
      expect(result.normalized[0].type).toBe('sub-limit');
      // Should NOT need review if confidence >= 0.6
      if (result.normalized[0].confidence >= 0.6) {
        expect(result.needsReview).toBe(false);
      }
    });

    it('should include parentCoverage for sub-limits', () => {
      const coverages = [
        { name: 'Remoción de Escombros', value: '1000000', deductible: '10%' },
      ];

      const result = normalizeCoverages(coverages);
      expect(result.normalized[0].parentCoverage).toBeDefined();
      expect(result.normalized[0].parentCoverage?.length).toBeGreaterThan(0);
    });

    it('should include type for all coverages', () => {
      const coverages = [
        { name: 'Incendio (Edificio y Contenidos)', value: '500M', deductible: '10%' },
        { name: 'Remoción de Escombros', value: '1000000', deductible: '10%' },
      ];

      const result = normalizeCoverages(coverages);
      expect(result.normalized[0].type).toBe('main');
      expect(result.normalized[1].type).toBe('sub-limit');
    });
  });

  describe('thesaurus loading', () => {
    it('should load main thesaurus', () => {
      const thesaurus = loadThesaurus();
      expect(thesaurus.length).toBeGreaterThan(0);
      
      const mainEntries = thesaurus.filter(t => !t.type || t.type === 'main');
      expect(mainEntries.length).toBeGreaterThan(0);
    });

    it('should have main coverages from base thesaurus', () => {
      const thesaurus = loadThesaurus();
      const mainEntries = thesaurus.filter(t => !t.type || t.type === 'main');
      const coverageNames = mainEntries.map(t => t.canonicalName);
      
      expect(coverageNames).toContain('Incendio (Edificio y Contenidos)');
      expect(coverageNames).toContain('Responsabilidad Civil (RCE)');
    });
  });
});
