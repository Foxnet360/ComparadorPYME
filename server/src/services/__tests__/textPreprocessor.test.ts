import { describe, it, expect } from 'vitest';
import {
  preprocessText,
  fixEncoding,
  normalizeColombianNumbers,
  removeArtifacts,
  extractRelevantSections,
  detectComplexity,
  containsColombianFormat,
  detectNumberFormat,
  calculateContentDensity,
} from '../textPreprocessor';

describe('textPreprocessor', () => {
  describe('detectComplexity', () => {
    it('should detect simple documents', () => {
      expect(detectComplexity('short text', 3)).toBe('simple');
      expect(detectComplexity('medium text', 5)).toBe('simple');
    });

    it('should detect medium documents', () => {
      expect(detectComplexity('medium text', 8)).toBe('medium');
      expect(detectComplexity('medium text', 10)).toBe('medium');
    });

    it('should detect complex documents', () => {
      // Dense documents (>2500 chars/page) with >10 pages are complex
      expect(detectComplexity('A'.repeat(30000), 11)).toBe('complex');
      // Sparse documents with >10 pages are medium
      expect(detectComplexity('short', 50)).toBe('medium');
    });
  });

  describe('fixEncoding', () => {
    it('should fix CotizaciÃ³n encoding', () => {
      const input = 'CotizaciÃ³n de PÃ³liza';
      const result = fixEncoding(input);
      expect(result).toBe('Cotización de Póliza');
    });

    it('should fix multiple encoding issues', () => {
      const input = 'Cobertura de Incendio y GarantÃ­a';
      const result = fixEncoding(input);
      expect(result).toBe('Cobertura de Incendio y Garantía');
    });

    it('should not change properly encoded text', () => {
      const input = 'Cotización normal con tildes';
      const result = fixEncoding(input);
      expect(result).toBe(input);
    });

    it('should fix common insurance terms', () => {
      const input = 'Responsabilidad Extracontractual y CatastrÃ³fico';
      const result = fixEncoding(input);
      expect(result).toBe('Responsabilidad Extracontractual y Catastrófico');
    });
  });

  describe('normalizeColombianNumbers', () => {
    it('should normalize numbers with thousand separators', () => {
      expect(normalizeColombianNumbers('8.500.000')).toBe('8500000');
      expect(normalizeColombianNumbers('1.234.567')).toBe('1234567');
    });

    it('should normalize numbers with decimal places', () => {
      expect(normalizeColombianNumbers('1.234.567,89')).toBe('1234567.89');
      expect(normalizeColombianNumbers('100.000,50')).toBe('100000.50');
    });

    it('should handle text with multiple numbers', () => {
      const input = 'Prima: $ 8.500.000 y deducible: 10.000,50';
      const result = normalizeColombianNumbers(input);
      expect(result).toBe('Prima: $ 8500000 y deducible: 10000.50');
    });

    it('should not change numbers without thousand separators', () => {
      expect(normalizeColombianNumbers('5000')).toBe('5000');
      expect(normalizeColombianNumbers('100')).toBe('100');
    });

    it('should handle edge cases', () => {
      expect(normalizeColombianNumbers('1.000')).toBe('1000');
      expect(normalizeColombianNumbers('10.000.000')).toBe('10000000');
    });
  });

  describe('removeArtifacts', () => {
    it('should remove standalone page numbers', () => {
      const input = 'Some text\n\n5\n\nMore text';
      const result = removeArtifacts(input);
      expect(result).not.toContain('\n5\n');
    });

    it('should remove dash lines', () => {
      const input = 'Text\n---\nMore text';
      const result = removeArtifacts(input);
      expect(result).not.toContain('---');
    });

    it('should remove excessive empty lines', () => {
      const input = 'Line 1\n\n\n\n\nLine 2';
      const result = removeArtifacts(input);
      expect(result).not.toContain('\n\n\n\n\n');
    });

    it('should trim whitespace', () => {
      const input = '  Text with spaces  ';
      const result = removeArtifacts(input);
      expect(result).toBe('Text with spaces');
    });
  });

  describe('extractRelevantSections', () => {
    it('should extract coverage sections', () => {
      const input = 'Header\n\nCOBERTURAS\nIncendio: 500M\n\nFooter';
      const result = extractRelevantSections(input);
      expect(result).toContain('COBERTURAS');
      expect(result).toContain('Incendio');
    });

    it('should truncate long texts without relevant sections', () => {
      const input = 'A'.repeat(15000);
      const result = extractRelevantSections(input);
      expect(result.length).toBeLessThan(13000);
      expect(result).toContain('[... contenido truncado');
    });

    it('should return short texts unchanged', () => {
      const input = 'Short text';
      const result = extractRelevantSections(input);
      expect(result).toBe(input);
    });
  });

  describe('preprocessText', () => {
    it('should process text with all options', () => {
      const input = 'CotizaciÃ³n: $ 8.500.000\n\n\nPÃ³liza de Incendio';
      const result = preprocessText(input, 5);

      expect(result.text).toContain('Cotización');
      expect(result.text).toContain('8500000');
      expect(result.metadata.complexity).toBe('simple');
      expect(result.metadata.changes.length).toBeGreaterThan(0);
    });

    it('should handle complex documents', () => {
      const input = 'A'.repeat(60000); // Dense text: 60000 chars / 20 pages = 3000 chars/page
      const result = preprocessText(input, 20);

      expect(result.metadata.complexity).toBe('complex');
      expect(result.metadata.pageCount).toBe(20);
    });

    it('should respect options', () => {
      const input = 'CotizaciÃ³n: $ 8.500.000';
      const result = preprocessText(input, 5, {
        fixEncoding: false,
        normalizeNumbers: false,
        removeArtifacts: false,
      });

      expect(result.text).toBe('CotizaciÃ³n: $ 8.500.000');
      expect(result.metadata.changes).toHaveLength(0);
    });
  });

  describe('containsColombianFormat', () => {
    it('should detect Colombian format', () => {
      expect(containsColombianFormat('8.500.000')).toBe(true);
      expect(containsColombianFormat('1.234.567,89')).toBe(true);
    });

    it('should not detect international format', () => {
      expect(containsColombianFormat('1,234,567.89')).toBe(false);
      expect(containsColombianFormat('5000')).toBe(false);
    });
  });

  describe('detectNumberFormat', () => {
    it('should detect Colombian format', () => {
      expect(detectNumberFormat('8.500.000 y 1.234.567,89')).toBe('colombian');
    });

    it('should detect international format', () => {
      expect(detectNumberFormat('1,234,567.89 and 5,000.50')).toBe('international');
    });

    it('should handle ambiguous cases', () => {
      expect(detectNumberFormat('5000')).toBe('ambiguous');
    });
  });

  describe('calculateContentDensity', () => {
    it('should calculate density correctly', () => {
      expect(calculateContentDensity('A'.repeat(10000), 4)).toBe(2500);
      expect(calculateContentDensity('A'.repeat(5000), 2)).toBe(2500);
    });

    it('should return 0 for 0 pages', () => {
      expect(calculateContentDensity('test', 0)).toBe(0);
    });
  });

  describe('detectComplexity with density', () => {
    it('should classify dense documents >10 pages as complex', () => {
      const denseText = 'A'.repeat(31000); // 31000 chars / 12 pages = ~2583 chars/page > 2500
      expect(detectComplexity(denseText, 12)).toBe('complex');
    });

    it('should classify sparse documents >10 pages as medium', () => {
      const sparseText = 'A'.repeat(15000); // 15000 chars / 10 pages = 1500 chars/page
      expect(detectComplexity(sparseText, 10)).toBe('medium');
    });

    it('should still classify <=5 pages as simple', () => {
      expect(detectComplexity('A'.repeat(10000), 5)).toBe('simple');
    });
  });

  describe('extractRelevantSections', () => {
    it('should extract coverage sections', () => {
      const text = 'Header\n\nCOBERTURAS\nIncendio: 500M\n\nFooter';
      const result = extractRelevantSections(text);
      expect(result).toContain('COBERTURAS');
      expect(result).toContain('Incendio');
    });

    it('should extract premium sections', () => {
      const text = 'Header\n\nTOTAL A PAGAR\nPrima: 1.000.000 COP\n\nFooter';
      const result = extractRelevantSections(text);
      expect(result).toContain('TOTAL A PAGAR');
      expect(result).toContain('1.000.000');
    });

    it('should concatenate multiple sections', () => {
      const text = 'Header\n\nCOBERTURAS\nIncendio: 500M\n\nPRIMA\nTotal: 1.000.000\n\nFooter';
      const result = extractRelevantSections(text);
      expect(result).toContain('COBERTURAS');
      expect(result).toContain('PRIMA');
    });

    it('should meet minimum extraction size', () => {
      // Text without recognizable sections should use fallback
      const text = 'Some random text without coverage sections';
      const result = extractRelevantSections(text);
      // Should return the text as-is since it's short
      expect(result.length).toBe(text.length);
    });

    it('should include premium info in fallback', () => {
      const text = 'Some text\n\nPrima total: 2.500.000 COP\n\nMore text';
      const result = extractRelevantSections(text);
      expect(result).toContain('Prima');
      expect(result).toContain('2.500.000');
    });

    it('should truncate very long extracted text', () => {
      const text = 'COBERTURAS\n' + 'A'.repeat(20000);
      const result = extractRelevantSections(text);
      expect(result.length).toBeLessThanOrEqual(13000); // 12000 + truncation message
    });
  });
});
