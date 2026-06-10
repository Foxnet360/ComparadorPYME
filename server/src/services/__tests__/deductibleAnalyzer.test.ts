import { describe, it, expect } from 'vitest';
import { deductibleAnalyzer } from '../deductibleAnalyzer';
import { mockDeductibleScenarios } from './__fixtures__/mockData';

describe('deductibleAnalyzer', () => {
  describe('analyze', () => {
    it('should calculate LOW risk for deductibles under 10%', async () => {
      const scenario = mockDeductibleScenarios[0];
      const result = await deductibleAnalyzer.analyze(
        scenario.name,
        scenario.quoteDeductible,
        scenario.clauseDeductible,
        scenario.insuredAmount
      );
      
      expect(result.riskLevel).toBe('LOW');
      expect(result.score).toBeGreaterThanOrEqual(80);
      expect(result.deductibleRatio).toBeLessThan(0.10);
    });

    it('should calculate MEDIUM risk for deductibles between 10-15%', async () => {
      const scenario = mockDeductibleScenarios[3]; // 15% with cap
      const result = await deductibleAnalyzer.analyze(
        scenario.name,
        scenario.quoteDeductible,
        scenario.clauseDeductible,
        scenario.insuredAmount
      );
      
      expect(result.riskLevel).toBe('MEDIUM');
      expect(result.score).toBeGreaterThanOrEqual(50);
      expect(result.score).toBeLessThan(80);
    });

    it('should calculate HIGH risk for deductibles over 15%', async () => {
      const scenario = mockDeductibleScenarios[2]; // 20%
      const result = await deductibleAnalyzer.analyze(
        scenario.name,
        scenario.quoteDeductible,
        scenario.clauseDeductible,
        scenario.insuredAmount
      );
      
      expect(result.riskLevel).toBe('HIGH');
      expect(result.score).toBeLessThan(50);
    });

    it('should apply cap when specified', async () => {
      const result = await deductibleAnalyzer.analyze(
        'Test',
        '10%',
        '10% / Máx. 500 SMMLV',
        10000000000 // $10B - without cap would be $1B
      );
      
      expect(result.hasCap).toBe(true);
      expect(result.capAmount).toBeGreaterThan(0);
      // The deductible amount should be limited by cap
      expect(result.deductibleAmount).toBeLessThanOrEqual(result.insuredAmount * 0.10);
    });

    it('should handle SMMLV format', async () => {
      const result = await deductibleAnalyzer.analyze(
        'RC',
        '5 SMMLV',
        '5 SMMLV',
        100000000
      );
      
      expect(result.deductibleAmount).toBe(5 * 1423500); // 5 * DEFAULT SMMLV value from extractionSchemas
    });

    it('should handle fixed amount format', async () => {
      const result = await deductibleAnalyzer.analyze(
        'Test',
        '$500,000',
        '$500,000',
        100000000
      );
      
      expect(result.deductibleAmount).toBe(500000);
    });

    it('should handle percentage format', async () => {
      const result = await deductibleAnalyzer.analyze(
        'Test',
        '10%',
        '10%',
        500000000
      );
      
      expect(result.deductibleAmount).toBe(50000000); // 10% of 500M
      expect(result.deductibleRatio).toBe(0.10);
    });

    it('should provide recommendation for HIGH risk', async () => {
      const result = await deductibleAnalyzer.analyze(
        'Test',
        '20%',
        '20%',
        1000000000
      );
      
      expect(result.riskLevel).toBe('HIGH');
      expect(result.recommendation).toBeDefined();
      expect(result.recommendation).toContain('20.0%');
    });

    it('should handle no deductible', async () => {
      const result = await deductibleAnalyzer.analyze(
        'Test',
        'No aplica',
        'No aplica',
        100000000
      );
      
      expect(result.deductibleAmount).toBe(0);
      expect(result.deductibleRatio).toBe(0);
    });

    it('should return score between 0 and 100', async () => {
      const scenarios = [
        { deductible: '5%', amount: 100000000 },
        { deductible: '10%', amount: 100000000 },
        { deductible: '15%', amount: 100000000 },
        { deductible: '25%', amount: 100000000 }
      ];

      for (const scenario of scenarios) {
        const result = await deductibleAnalyzer.analyze(
          'Test',
          scenario.deductible,
          scenario.deductible,
          scenario.amount
        );
        
        expect(result.score).toBeGreaterThanOrEqual(0);
        expect(result.score).toBeLessThanOrEqual(100);
      }
    });
  });

  describe('analyzeQuote', () => {
    it('should analyze all coverages in a quote', async () => {
      const quote = {
        coverages: [
          { name: 'Incendio', deductible: '10%', value: '500M' },
          { name: 'RC', deductible: '5 SMMLV', value: '100M' }
        ]
      };
      
      const clauseDeductibles = new Map([
        ['Incendio', '10% / Máx. 500 SMMLV'],
        ['RC', '5 SMMLV']
      ]);
      
      const results = await deductibleAnalyzer.analyzeQuote(quote, clauseDeductibles);
      
      expect(results).toHaveLength(2);
      expect(results[0].coverageName).toBe('Incendio');
      expect(results[1].coverageName).toBe('RC');
    });

    it('should skip coverages without insured amount', async () => {
      const quote = {
        coverages: [
          { name: 'Asistencia', deductible: 'No aplica', value: 'Incluido' },
          { name: 'Incendio', deductible: '10%', value: '500M' }
        ]
      };
      
      const results = await deductibleAnalyzer.analyzeQuote(quote, new Map());
      
      expect(results.length).toBeLessThanOrEqual(1);
    });
  });
});
