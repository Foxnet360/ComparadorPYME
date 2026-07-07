import { describe, it, expect } from 'vitest';
import { contextualRiskAnalyzer } from '../contextualRiskAnalyzer';
import {
  mockClientProfile,
  mockClientProfileMountain,
  mockExclusions,
} from './__fixtures__/mockData';

describe('contextualRiskAnalyzer', () => {
  describe('contextualizeExclusions', () => {
    it('should contextualize exclusions with client profile', () => {
      const result = contextualRiskAnalyzer.contextualizeExclusions(
        mockExclusions,
        mockClientProfile
      );

      expect(result.hasProfile).toBe(true);
      expect(result.exclusions).toHaveLength(mockExclusions.length);
      expect(result.criticalCount + result.highCount + result.mediumCount + result.lowCount).toBe(
        mockExclusions.length
      );
    });

    it('should mark flood exclusion as CRITICAL for coastal client', () => {
      const result = contextualRiskAnalyzer.contextualizeExclusions(
        ['No cubre inundación en zonas costeras'],
        mockClientProfile
      );

      expect(result.criticalCount).toBeGreaterThan(0);
      const critical = result.exclusions.find((e) => e.contextualRiskLevel === 'CRITICAL');
      expect(critical).toBeDefined();
      expect(critical!.explanation).toContain('costera');
    });

    it('should mark flood exclusion as LOW for mountain client', () => {
      const result = contextualRiskAnalyzer.contextualizeExclusions(
        ['No cubre inundación en zonas costeras'],
        mockClientProfileMountain
      );

      expect(result.lowCount).toBeGreaterThan(0);
      const low = result.exclusions.find((e) => e.contextualRiskLevel === 'LOW');
      expect(low).toBeDefined();
    });

    it('should mark supplier exclusion as CRITICAL for single supplier', () => {
      const profile = { ...mockClientProfile, hasSingleSupplier: true };

      const result = contextualRiskAnalyzer.contextualizeExclusions(
        ['No cubre falla de proveedor único'],
        profile
      );

      const critical = result.exclusions.find((e) => e.contextualRiskLevel === 'CRITICAL');
      expect(critical).toBeDefined();
      expect(critical!.explanation).toContain('proveedor');
    });

    it('should work in degraded mode without profile', () => {
      const result = contextualRiskAnalyzer.contextualizeExclusions(mockExclusions);

      expect(result.hasProfile).toBe(false);
      expect(result.exclusions).toHaveLength(mockExclusions.length);
      expect(result.mediumCount).toBe(mockExclusions.length);
    });

    it('should provide mitigation suggestions', () => {
      const result = contextualRiskAnalyzer.contextualizeExclusions(
        ['No cubre inundación en zonas costeras'],
        mockClientProfile
      );

      const exclusion = result.exclusions[0];
      expect(exclusion.mitigationSuggestions).toBeDefined();
      expect(exclusion.mitigationSuggestions.length).toBeGreaterThan(0);
    });

    it('should handle construction exclusion for construction industry', () => {
      const profile = { ...mockClientProfile, industryType: 'construccion' as const };

      const result = contextualRiskAnalyzer.contextualizeExclusions(
        ['No cubre daños por construcción adyacente'],
        profile
      );

      expect(result.highCount + result.criticalCount).toBeGreaterThan(0);
    });

    it('should return empty array for no exclusions', () => {
      const result = contextualRiskAnalyzer.contextualizeExclusions([], mockClientProfile);

      expect(result.exclusions).toEqual([]);
      expect(result.criticalCount).toBe(0);
      expect(result.highCount).toBe(0);
    });
  });

  describe('calculateContextualRisk', () => {
    it('should return correct risk level', () => {
      const risk = contextualRiskAnalyzer.calculateContextualRisk(
        'No cubre inundación',
        mockClientProfile
      );

      expect(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).toContain(risk);
    });
  });

  describe('suggestMitigation', () => {
    it('should return suggestions', () => {
      const suggestions = contextualRiskAnalyzer.suggestMitigation(
        'No cubre inundación',
        mockClientProfile
      );

      expect(suggestions).toBeDefined();
      expect(suggestions.length).toBeGreaterThan(0);
    });
  });
});
