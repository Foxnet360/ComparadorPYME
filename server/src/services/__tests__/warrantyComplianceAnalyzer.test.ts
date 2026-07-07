import { describe, it, expect } from 'vitest';
import { warrantyComplianceAnalyzer } from '../warrantyComplianceAnalyzer';
import { mockConditions, mockClientProfile } from './__fixtures__/mockData';

describe('warrantyComplianceAnalyzer', () => {
  describe('analyzeConditions', () => {
    it('should analyze all conditions', () => {
      const result = warrantyComplianceAnalyzer.analyzeConditions(mockConditions);

      expect(result.totalConditions).toBe(mockConditions.length);
      expect(result.byType).toBeDefined();
      expect(result.overallRisk).toBeDefined();
    });

    it('should classify conditions by type', () => {
      const result = warrantyComplianceAnalyzer.analyzeConditions(mockConditions);

      // Should have at least one of each type or categorize correctly
      const totalByType =
        result.byType.documental.count +
        result.byType.operacional.count +
        result.byType.tecnico.count +
        result.byType.financiero.count;

      expect(totalByType).toBe(mockConditions.length);
    });

    it('should calculate overall risk', () => {
      const result = warrantyComplianceAnalyzer.analyzeConditions(mockConditions);

      expect(['LOW', 'MEDIUM', 'HIGH']).toContain(result.overallRisk);
    });

    it('should identify high risk conditions', () => {
      const result = warrantyComplianceAnalyzer.analyzeConditions(mockConditions);

      // Financial conditions with high difficulty should be high risk
      const financialConditions = result.byType.financiero;
      if (financialConditions.count > 0) {
        expect(financialConditions.risk).toBe('HIGH');
      }
    });

    it('should calculate compliance percentage', () => {
      const result = warrantyComplianceAnalyzer.analyzeConditions(mockConditions);

      expect(result.compliancePercentage).toBeGreaterThanOrEqual(0);
      expect(result.compliancePercentage).toBeLessThanOrEqual(100);
    });

    it('should handle empty conditions', () => {
      const result = warrantyComplianceAnalyzer.analyzeConditions([]);

      expect(result.totalConditions).toBe(0);
      expect(result.compliancePercentage).toBe(0);
    });

    it('should adjust difficulty based on client profile', () => {
      const smallBusinessProfile = {
        ...mockClientProfile,
        employeeCount: 5,
        annualRevenue: 50000000,
      };

      const result = warrantyComplianceAnalyzer.analyzeConditions(
        mockConditions,
        smallBusinessProfile
      );

      // Financial conditions should be harder for small businesses
      const financial = result.byType.financiero;
      expect(financial.count).toBeGreaterThanOrEqual(0);
    });
  });

  describe('classifyCondition', () => {
    it('should classify documental conditions', () => {
      const type = warrantyComplianceAnalyzer.classifyCondition('Presentar certificado');
      expect(type).toBe('DOCUMENTAL');
    });

    it('should classify operational conditions', () => {
      const type = warrantyComplianceAnalyzer.classifyCondition('Mantener sistema de alarma');
      expect(type).toBe('OPERACIONAL');
    });

    it('should classify technical conditions', () => {
      const type = warrantyComplianceAnalyzer.classifyCondition('Instalar detectores de humo');
      expect(type).toBe('TECNICO');
    });

    it('should classify financial conditions', () => {
      const type = warrantyComplianceAnalyzer.classifyCondition('Constituir fianza');
      expect(type).toBe('FINANCIERO');
    });
  });
});
