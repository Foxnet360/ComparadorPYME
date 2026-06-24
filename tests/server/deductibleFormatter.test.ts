import { describe, it, expect } from 'vitest';
import {
  formatDeductibleForDisplay,
  deductibleEquals,
  extractDeductibleContext,
  extractDeductibleFromClauseText,
} from '../../server/src/services/deductibleFormatter';
import { DeductibleStructure } from '../../server/src/schemas/extractionSchemas';

function makeStructure(overrides: Partial<DeductibleStructure>): DeductibleStructure {
  return {
    components: [{ type: 'unknown', value: 0 }],
    compoundOperator: 'none',
    isZero: false,
    hasMinimum: false,
    hasMaximum: false,
    isComposite: false,
    rawText: '',
    ...overrides,
  };
}

describe('deductibleFormatter', () => {
  describe('formatDeductibleForDisplay', () => {
    it('formats zero deductible as "No aplica"', () => {
      const structure = makeStructure({
        isZero: true,
        components: [{ type: 'na', value: 0 }],
        rawText: 'No aplica',
      });

      expect(formatDeductibleForDisplay(structure)).toBe('No aplica');
    });

    it('formats simple percentage', () => {
      const structure = makeStructure({
        components: [{ type: 'percentage', value: 10 }],
        rawText: '10%',
      });

      expect(formatDeductibleForDisplay(structure)).toBe('10%');
    });

    it('formats SMMLV amount', () => {
      const structure = makeStructure({
        components: [{ type: 'smmlv', value: 5 }],
        rawText: '5 SMMLV',
      });

      expect(formatDeductibleForDisplay(structure)).toBe('5 SMMLV');
    });

    it('formats fixed amount without separators', () => {
      const structure = makeStructure({
        components: [{ type: 'fixed', value: 500000, currency: 'COP' }],
        rawText: '$500,000',
      });

      expect(formatDeductibleForDisplay(structure)).toBe('$500000');
    });

    it('preserves raw text for compound deductibles', () => {
      const rawText = '10% / Mín. 2 SMMLV (aplica sobre pérdida)';
      const structure = makeStructure({
        isComposite: true,
        components: [
          { type: 'percentage', value: 10 },
          { type: 'minimum', value: 2, currency: 'SMMLV' },
        ],
        rawText,
      });

      expect(formatDeductibleForDisplay(structure)).toBe(rawText);
    });

    it('returns raw text for unknown structures', () => {
      const structure = makeStructure({
        components: [{ type: 'unknown', value: 0 }],
        rawText: 'cualquier cosa',
      });

      expect(formatDeductibleForDisplay(structure)).toBe('cualquier cosa');
    });
  });

  describe('extractDeductibleContext', () => {
    it('returns the text after the leading percentage', () => {
      const context = extractDeductibleContext('10% / Mín. 2 SMMLV (aplica sobre pérdida)');

      expect(context).toBe('/ Mín. 2 SMMLV (aplica sobre pérdida)');
    });

    it('returns undefined when there is no leading percentage', () => {
      expect(extractDeductibleContext('5 SMMLV')).toBeUndefined();
    });
  });

  describe('extractDeductibleFromClauseText', () => {
    it('extracts a deductible snippet from a clause sentence', () => {
      const text = 'Deducible: 10% del valor del siniestro. No cubre terremoto.';
      const extracted = extractDeductibleFromClauseText(text);

      expect(extracted).toBe('10% del valor del siniestro');
    });

    it('returns undefined when no deductible snippet is found', () => {
      expect(extractDeductibleFromClauseText('Cobertura total sin deducible explícito.')).toBeUndefined();
    });
  });

  describe('deductibleEquals', () => {
    it('considers identical percentage structures equal', () => {
      const a = makeStructure({ components: [{ type: 'percentage', value: 10 }], rawText: '10%' });
      const b = makeStructure({ components: [{ type: 'percentage', value: 10 }], rawText: '10%' });

      expect(deductibleEquals(a, b)).toBe(true);
    });

    it('detects different percentages as not equal', () => {
      const a = makeStructure({ components: [{ type: 'percentage', value: 10 }], rawText: '10%' });
      const b = makeStructure({ components: [{ type: 'percentage', value: 15 }], rawText: '15%' });

      expect(deductibleEquals(a, b)).toBe(false);
    });

    it('considers equal SMMLV amounts equal regardless of order', () => {
      const a = makeStructure({
        components: [
          { type: 'percentage', value: 10 },
          { type: 'minimum', value: 2, currency: 'SMMLV' },
        ],
        compoundOperator: 'greater_of',
        isComposite: true,
        rawText: '10% / mín. 2 SMMLV',
      });
      const b = makeStructure({
        components: [
          { type: 'minimum', value: 2, currency: 'SMMLV' },
          { type: 'percentage', value: 10 },
        ],
        compoundOperator: 'greater_of',
        isComposite: true,
        rawText: 'mín. 2 SMMLV y 10%',
      });

      expect(deductibleEquals(a, b)).toBe(true);
    });

    it('treats zero and non-zero deductibles as not equal', () => {
      const a = makeStructure({ isZero: true, components: [{ type: 'na', value: 0 }], rawText: 'No aplica' });
      const b = makeStructure({ components: [{ type: 'percentage', value: 10 }], rawText: '10%' });

      expect(deductibleEquals(a, b)).toBe(false);
    });

    it('treats unknown deductibles as not equal', () => {
      const a = makeStructure({ components: [{ type: 'unknown', value: 0 }], rawText: '?' });
      const b = makeStructure({ components: [{ type: 'unknown', value: 0 }], rawText: '?' });

      expect(deductibleEquals(a, b)).toBe(false);
    });

    it('treats different compound operators as not equal', () => {
      const a = makeStructure({
        components: [
          { type: 'percentage', value: 10 },
          { type: 'fixed', value: 500000 },
        ],
        compoundOperator: 'greater_of',
        isComposite: true,
        rawText: '10% y $500000',
      });
      const b = makeStructure({
        components: [
          { type: 'percentage', value: 10 },
          { type: 'fixed', value: 500000 },
        ],
        compoundOperator: 'lesser_of',
        isComposite: true,
        rawText: 'menor entre 10% y $500000',
      });

      expect(deductibleEquals(a, b)).toBe(false);
    });
  });
});
