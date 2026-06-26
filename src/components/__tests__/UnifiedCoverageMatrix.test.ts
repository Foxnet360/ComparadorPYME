import { describe, it, expect } from 'vitest';
import { QuoteAnalysis } from '../../../types';
import { formatMatrixValue, buildExportNotes, transformQuotesToMatrix, CATEGORY_CONFIGS } from '../../../components/UnifiedCoverageMatrix';

describe('UnifiedCoverageMatrix - Pure Functions', () => {
  describe('formatMatrixValue', () => {
    it('should return "No informado" for null', () => {
      expect(formatMatrixValue(null)).toBe('No informado');
    });

    it('should return "No informado" for undefined', () => {
      expect(formatMatrixValue(undefined)).toBe('No informado');
    });

    it('should return "No informado" for empty string', () => {
      expect(formatMatrixValue('')).toBe('No informado');
    });

    it('should return original value for excluded values', () => {
      expect(formatMatrixValue('No incluida')).toBe('No incluida');
      expect(formatMatrixValue('NO ESPECIFICADO')).toBe('NO ESPECIFICADO');
      expect(formatMatrixValue('No contratado')).toBe('No contratado');
    });

    it('should format numeric string as Colombian currency', () => {
      expect(formatMatrixValue('119600000')).toBe('$119.600.000');
      expect(formatMatrixValue('$119.600.000')).toBe('$119.600.000');
      expect(formatMatrixValue('45,000,000')).toBe('$45.000.000');
    });

    it('should return original value for non-numeric strings', () => {
      expect(formatMatrixValue('Incluido')).toBe('Incluido');
      expect(formatMatrixValue('No aplica')).toBe('No aplica');
      expect(formatMatrixValue('10% PERD - Min 1 SMMLV')).toBe('10% PERD - Min 1 SMMLV');
    });

    it('should handle strings with numbers and text', () => {
      // Mixed text with numbers should return original (not a simple number)
      expect(formatMatrixValue('Valor de $100 millones')).toBe('Valor de $100 millones');
    });

    it('should handle simple numeric strings with currency symbol', () => {
      expect(formatMatrixValue('$1000000')).toBe('$1.000.000');
    });

    it('should handle zero numeric value', () => {
      expect(formatMatrixValue('0')).toBe('0');
    });
  });

  describe('buildExportNotes', () => {
    it('should return empty object for empty cellNotes', () => {
      const result = buildExportNotes({});
      expect(result).toEqual({});
    });

    it('should filter out notes without content', () => {
      const cellNotes = {
        'row1-0': { content: '' },
        'row1-1': { content: 'Valid note' },
        'row2-0': { content: undefined },
      };
      const result = buildExportNotes(cellNotes);
      expect(result).toEqual({
        'row1-1': 'Valid note'
      });
    });

    it('should include all notes with non-empty content', () => {
      const cellNotes = {
        'row1-0': { content: 'Note 1' },
        'row1-1': { content: 'Note 2' },
        'row2-0': { content: 'Note 3' },
      };
      const result = buildExportNotes(cellNotes);
      expect(result).toEqual({
        'row1-0': 'Note 1',
        'row1-1': 'Note 2',
        'row2-0': 'Note 3'
      });
    });

    it('should handle mixed entries with and without content', () => {
      const cellNotes = {
        'row1-0': { content: 'Keep this' },
        'row1-1': { content: '' },
        'row2-0': { timestamp: 12345 },
        'row2-1': { content: 'Also keep' }
      };
      const result = buildExportNotes(cellNotes);
      expect(result).toEqual({
        'row1-0': 'Keep this',
        'row2-1': 'Also keep'
      });
    });
  });

  describe('Dynamic Category Configuration & Grouping', () => {
    it('should load categories dynamically from taxonomy.json', () => {
      expect(CATEGORY_CONFIGS).toBeDefined();
      expect(CATEGORY_CONFIGS.length).toBeGreaterThan(0);
      
      const incendio = CATEGORY_CONFIGS.find(c => c.id === 1);
      expect(incendio).toBeDefined();
      expect(incendio?.canonicalName).toBe('Incendio (Edificio y Contenidos)');
    });

    it('should group exclusive coverages semantically when similarity is >= 0.70', () => {
      const mockQuotes = [
        {
          insurerName: 'Insurer A',
          coverages: [
            {
              name: 'Robo con Violencia',
              categoryId: null,
              value: '$10.000.000',
              deductible: '10%'
            }
          ]
        },
        {
          insurerName: 'Insurer B',
          coverages: [
            {
              name: 'Robo con Biolencia',
              categoryId: null,
              value: '$8.000.000',
              deductible: '15%'
            }
          ]
        }
      ] as unknown as QuoteAnalysis[];

      const matrix = transformQuotesToMatrix(mockQuotes);

      const exclusiveRows = matrix.filter(r => r.sectionId === 99 && r.type === 'data');
      
      expect(exclusiveRows).toHaveLength(1);
      expect(exclusiveRows[0].label).toBe('Robo con Violencia');
      expect(exclusiveRows[0].cells[0].value).toBe('$10.000.000 (Ded: 10%)');
      expect(exclusiveRows[0].cells[1].value).toBe('$8.000.000 (Ded: 15%)');
    });

    it('should NOT group exclusive coverages when similarity is < 0.70', () => {
      const mockQuotes = [
        {
          insurerName: 'Insurer A',
          coverages: [
            {
              name: 'Robo con Violencia',
              categoryId: null,
              value: '$10.000.000'
            }
          ]
        },
        {
          insurerName: 'Insurer B',
          coverages: [
            {
              name: 'Daños por Agua Raros',
              categoryId: null,
              value: 'Incluido'
            }
          ]
        }
      ] as unknown as QuoteAnalysis[];

      const matrix = transformQuotesToMatrix(mockQuotes);

      const exclusiveRows = matrix.filter(r => r.sectionId === 99 && r.type === 'data');
      
      expect(exclusiveRows).toHaveLength(2);
      expect(exclusiveRows.map(r => r.label)).toContain('Robo con Violencia');
      expect(exclusiveRows.map(r => r.label)).toContain('Daños por Agua Raros');
    });
  });
});
