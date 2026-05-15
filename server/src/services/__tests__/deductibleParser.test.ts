import { deductibleParser } from '../deductibleParser';

describe('deductibleParser', () => {
  describe('parseSimple', () => {
    it('should parse zero deductible', async () => {
      const result = await deductibleParser.parse('sin deducible');
      expect(result.semantics.isZero).toBe(true);
      expect(result.normalized.minAmount).toBe(0);
    });

    it('should parse percentage deductible', async () => {
      const result = await deductibleParser.parse('10%');
      expect(result.normalized.percentage).toBe(10);
      expect(result.semantics.isComposite).toBe(false);
    });

    it('should parse SMMLV deductible', async () => {
      const result = await deductibleParser.parse('5 SMMLV');
      expect(result.normalized.minAmount).toBe(6500000); // 5 * 1.3M
    });
  });

  describe('parse compound structures', () => {
    it('should parse compound deductible with min and max', async () => {
      const result = await deductibleParser.parse('10% con mínimo de 5 SMMLV y tope de 50 SMMLV');
      expect(result.components).toHaveLength(3);
      expect(result.normalized.percentage).toBe(10);
      expect(result.normalized.minAmount).toBe(6500000);
      expect(result.normalized.maxAmount).toBe(65000000);
      expect(result.semantics.isComposite).toBe(true);
    });

    it('should parse "sin aplicación de deducible"', async () => {
      const result = await deductibleParser.parse('sin aplicación de deducible');
      expect(result.semantics.isZero).toBe(true);
      expect(result.normalized.minAmount).toBe(0);
    });

    it('should parse "Mínimo" as unknown', async () => {
      const result = await deductibleParser.parse('Mínimo');
      expect(result.components[0].type).toBe('unknown');
    });
  });

  describe('validation', () => {
    it('should validate valid structure', () => {
      const structure = {
        components: [{ type: 'percentage', value: 10 }],
        semantics: { isZero: false, hasMinimum: false, hasMaximum: false, isComposite: false },
        normalized: { minAmount: 0, maxAmount: 0, percentage: 10, isPercentageBased: true },
        rawText: '10%'
      };
      
      const validation = deductibleParser.validate(structure as any);
      expect(validation.isValid).toBe(true);
      expect(validation.issues).toHaveLength(0);
    });

    it('should detect invalid percentage', () => {
      const structure = {
        components: [{ type: 'percentage', value: 150 }],
        semantics: { isZero: false, hasMinimum: false, hasMaximum: false, isComposite: false },
        normalized: { minAmount: 0, maxAmount: 0, percentage: 150, isPercentageBased: true },
        rawText: '150%'
      };
      
      const validation = deductibleParser.validate(structure as any);
      expect(validation.isValid).toBe(false);
      expect(validation.issues.length).toBeGreaterThan(0);
    });
  });
});
