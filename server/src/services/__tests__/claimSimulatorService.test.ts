import { describe, it, expect } from 'vitest';
import {
  calculateClaimDeductible,
  simulateClaimScenario,
  extractDeductibleComponents,
} from '../claimSimulatorService';

describe('claimSimulatorService', () => {
  const SMMLV_2025 = 1423500;

  describe('extractDeductibleComponents', () => {
    it('detects exempt / no deductible', () => {
      const res = extractDeductibleComponents(
        { insurerName: 'Test', deductibleText: 'Sin deducible' },
        SMMLV_2025
      );
      expect(res.isExempt).toBe(true);
      expect(res.percentage).toBe(0);
      expect(res.minAmountCOP).toBe(0);
    });

    it('extracts percentage and minimum in SMMLV', () => {
      const res = extractDeductibleComponents(
        { insurerName: 'Test', deductibleText: '10% de la pérdida, mín. 5 SMMLV' },
        SMMLV_2025
      );
      expect(res.isExempt).toBe(false);
      expect(res.percentage).toBe(10);
      expect(res.minAmountCOP).toBe(5 * SMMLV_2025);
      expect(res.maxAmountCOP).toBe(0);
    });

    it('extracts percentage, minimum and maximum', () => {
      const res = extractDeductibleComponents(
        { insurerName: 'Test', deductibleText: '10% valor pérdida, mín. 3 SMMLV, máx. 25 SMMLV' },
        SMMLV_2025
      );
      expect(res.percentage).toBe(10);
      expect(res.minAmountCOP).toBe(3 * SMMLV_2025);
      expect(res.maxAmountCOP).toBe(25 * SMMLV_2025);
    });
  });

  describe('calculateClaimDeductible', () => {
    it('applies minimum SMMLV when percentage is below minimum', () => {
      // 10% of 50M = 5M. But min is 5 SMMLV = 7.117.500 COP
      const input = {
        insurerName: 'SURA',
        deductibleText: '10% de la pérdida, mín. 5 SMMLV',
      };
      const res = calculateClaimDeductible(50000000, input, SMMLV_2025);
      expect(res.raisedByMinimum).toBe(true);
      expect(res.cappedByMaximum).toBe(false);
      expect(res.payableDeductibleCOP).toBe(5 * SMMLV_2025);
      expect(res.netIndemnificationCOP).toBe(50000000 - 5 * SMMLV_2025);
    });

    it('applies percentage when between minimum and maximum', () => {
      // 10% of 100M = 10M. Min is 5 SMMLV (7.1M), Max is 20 SMMLV (28.4M)
      const input = {
        insurerName: 'Bolívar',
        deductibleText: '10% de la pérdida, mín. 5 SMMLV, máx. 20 SMMLV',
      };
      const res = calculateClaimDeductible(100000000, input, SMMLV_2025);
      expect(res.raisedByMinimum).toBe(false);
      expect(res.cappedByMaximum).toBe(false);
      expect(res.payableDeductibleCOP).toBe(10000000);
      expect(res.netIndemnificationCOP).toBe(90000000);
    });

    it('caps deductible at maximum when percentage exceeds maximum', () => {
      // 10% of 350M = 35M. Max is 20 SMMLV = 28.470.000 COP
      const input = {
        insurerName: 'Chubb',
        deductibleText: '10% de la pérdida, mín. 5 SMMLV, máx. 20 SMMLV',
      };
      const res = calculateClaimDeductible(350000000, input, SMMLV_2025);
      expect(res.cappedByMaximum).toBe(true);
      expect(res.payableDeductibleCOP).toBe(20 * SMMLV_2025);
      expect(res.netIndemnificationCOP).toBe(350000000 - 20 * SMMLV_2025);
    });

    it('handles exempt coverage (0 deductible)', () => {
      const input = {
        insurerName: 'Allianz',
        deductibleText: 'Sin deducible',
      };
      const res = calculateClaimDeductible(50000000, input, SMMLV_2025);
      expect(res.isExempt).toBe(true);
      expect(res.payableDeductibleCOP).toBe(0);
      expect(res.netIndemnificationCOP).toBe(50000000);
    });
  });

  describe('simulateClaimScenario', () => {
    it('compares multiple insurers, identifies the best option and calculates client savings', () => {
      const inputs = [
        { insurerName: 'Aseguradora A', deductibleText: '10% mín. 5 SMMLV' },
        { insurerName: 'Aseguradora B', deductibleText: 'Sin deducible' },
        { insurerName: 'Aseguradora C', deductibleText: '15% mín. 8 SMMLV' },
      ];

      const report = simulateClaimScenario(60000000, inputs);
      expect(report.results).toHaveLength(3);

      // Best option should be Aseguradora B (0 deductible)
      expect(report.results[0].insurerName).toBe('Aseguradora B');
      expect(report.results[0].isBestOption).toBe(true);
      expect(report.results[0].payableDeductibleCOP).toBe(0);

      // Best option report calculations
      expect(report.bestOption).toBeDefined();
      expect(report.bestOption?.insurerName).toBe('Aseguradora B');
      expect(report.bestOption?.savingsComparedToWorstCOP).toBeGreaterThan(0);
    });
  });
});
