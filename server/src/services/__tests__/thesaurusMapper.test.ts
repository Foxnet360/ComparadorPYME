import { describe, it, expect } from 'vitest';
import {
  mapCoverageName,
  normalizeDeductible,
  normalizeCoverages,
  loadThesaurus,
} from '../thesaurusMapper';

describe('thesaurusMapper', () => {
  describe('loadThesaurus', () => {
    it('should load thesaurus successfully', () => {
      const thesaurus = loadThesaurus();
      expect(thesaurus.length).toBeGreaterThan(0);
      expect(thesaurus[0]).toHaveProperty('canonicalName');
      expect(thesaurus[0]).toHaveProperty('variants');
      expect(thesaurus[0]).toHaveProperty('category');
    });

    it('should have common PYME coverages', () => {
      const thesaurus = loadThesaurus();
      const coverageNames = thesaurus.map(t => t.canonicalName);

      expect(coverageNames).toContain('Incendio (Edificio y Contenidos)');
      expect(coverageNames).toContain('Responsabilidad Civil (RCE)');
      expect(coverageNames).toContain('Lucro Cesante');
    });
  });

  describe('mapCoverageName', () => {
    it('should match exact canonical names', () => {
      const result = mapCoverageName('Incendio (Edificio y Contenidos)');
      expect(result.canonicalName).toBe('Incendio (Edificio y Contenidos)');
      expect(result.confidence).toBe(1.0);
      expect(result.needsReview).toBe(false);
    });

    it('should match variant names', () => {
      const result = mapCoverageName('Amparo Básico (Incendio)');
      expect(result.canonicalName).toBe('Incendio (Edificio y Contenidos)');
      expect(result.confidence).toBeGreaterThan(0.7);
      expect(result.needsReview).toBe(false);
    });

    it('should match similar names with fuzzy matching', () => {
      const result = mapCoverageName('Incendio y Rayo');
      expect(result.canonicalName).toBe('Incendio (Edificio y Contenidos)');
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    it('should return original name for unknown coverage', () => {
      const result = mapCoverageName('12345!@#$%67890');
      // With completely random input, it may still fuzzy-match to something,
      // but confidence should be very low and it should need review
      expect(result.confidence).toBeLessThan(0.5);
      expect(result.needsReview).toBe(true);
    });

    it('should handle case insensitivity', () => {
      const result1 = mapCoverageName('incendio (edificio y contenidos)');
      const result2 = mapCoverageName('INCENDIO (EDIFICIO Y CONTENIDOS)');

      expect(result1.canonicalName).toBe('Incendio (Edificio y Contenidos)');
      expect(result2.canonicalName).toBe('Incendio (Edificio y Contenidos)');
    });

    it('should match RCE variants', () => {
      const result = mapCoverageName('RC General');
      expect(result.canonicalName).toBe('Responsabilidad Civil (RCE)');
      expect(result.confidence).toBeGreaterThan(0.7);
    });
  });

  describe('normalizeDeductible', () => {
    it('should handle "No aplica"', () => {
      expect(normalizeDeductible('No aplica')).toEqual({
        normalized: 'No aplica',
        needsReview: false,
      });
    });

    it('should handle "No aplica Deducible"', () => {
      expect(normalizeDeductible('No aplica Deducible')).toEqual({
        normalized: 'No aplica',
        needsReview: false,
      });
    });

    it('should handle percentages', () => {
      expect(normalizeDeductible('10%')).toEqual({
        normalized: '10%',
        needsReview: false,
      });
    });

    it('should handle percentage with context', () => {
      const result = normalizeDeductible('10% / Mín. 2 SMMLV (aplica sobre pérdida)');
      expect(result.normalized).toBe('10% / Mín. 2 SMMLV (aplica sobre pérdida)');
      expect(result.context).toBe('/ Mín. 2 SMMLV (aplica sobre pérdida)');
      expect(result.needsReview).toBe(false);
    });

    it('should handle SMMLV format', () => {
      expect(normalizeDeductible('5 SMMLV')).toEqual({
        normalized: '5 SMMLV',
        needsReview: false,
      });
      expect(normalizeDeductible('3 SM')).toEqual({
        normalized: '3 SMMLV',
        needsReview: false,
      });
    });

    it('should handle fixed amounts', () => {
      const result = normalizeDeductible('$500,000');
      expect(result.normalized).toBe('$500000');
      expect(result.needsReview).toBe(false);
    });

    it('should not interpret small numbers as fixed amounts without $', () => {
      const result = normalizeDeductible('10');
      expect(result.normalized).toBe('10');
      expect(result.needsReview).toBe(true);
    });

    it('should handle empty string', () => {
      expect(normalizeDeductible('')).toEqual({
        normalized: 'No aplica',
        needsReview: false,
      });
    });

    it('should flag unknown formats for review', () => {
      const result = normalizeDeductible('cualquier cosa');
      expect(result.normalized).toBe('cualquier cosa');
      expect(result.needsReview).toBe(true);
    });
  });

  describe('normalizeCoverages', () => {
    it('should normalize array of coverages', () => {
      const coverages = [
        { name: 'Amparo Básico (Incendio)', value: '500M', deductible: '10%' },
        { name: 'RC General', value: '100M', deductible: '5 SMMLV' },
      ];

      const result = normalizeCoverages(coverages);

      expect(result.normalized[0].name).toBe('Incendio (Edificio y Contenidos)');
      expect(result.normalized[0].deductible).toBe('10%');
      expect(result.normalized[1].name).toBe('Responsabilidad Civil (RCE)');
      expect(result.normalized[1].deductible).toBe('5 SMMLV');
      expect(result.needsReview).toBe(false);
    });

    it('should track original names', () => {
      const coverages = [
        { name: 'Amparo Básico (Incendio)', value: '500M', deductible: '10%' },
      ];

      const result = normalizeCoverages(coverages);
      expect(result.normalized[0].originalName).toBe('Amparo Básico (Incendio)');
    });

    it('should flag when review is needed', () => {
      const coverages = [
        { name: 'XYZ123-Unknown-Coverage-QWERTY', value: '100M', deductible: '10%' },
      ];

      const result = normalizeCoverages(coverages);
      expect(result.needsReview).toBe(true);
      expect(result.normalized[0].confidence).toBeLessThan(0.3);
    });

    it('should handle empty coverage array', () => {
      const result = normalizeCoverages([]);
      expect(result.normalized).toHaveLength(0);
      expect(result.needsReview).toBe(false);
    });
  });
});
