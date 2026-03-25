import { describe, it, expect } from 'vitest';
import { pdfExtractor } from '../pdfExtractor';

describe('pdfExtractor', () => {
  describe('cleanText', () => {
    it('should remove extra whitespaces', () => {
      const text = 'This   is  a test';
      expect(pdfExtractor.cleanText(text)).toBe('This is a test');
    });

    it('should remove isolated page numbers', () => {
      const text = 'Página 1\n45\n\nAlgo más';
      expect(pdfExtractor.cleanText(text)).toBe('Página 1\n\nAlgo más');
    });

    it('should collapse multiple newlines into two', () => {
      const text = 'Line 1\n\n\nLine 2';
      expect(pdfExtractor.cleanText(text)).toBe('Line 1\n\nLine 2');
    });
  });

  describe('formatExtractedText', () => {
    it('should format extracted text properly', () => {
      const formatted = pdfExtractor.formatExtractedText('content', 'test-file.pdf', 'COTIZACIÓN');
      expect(formatted).toContain('=== INICIO COTIZACIÓN: test-file ===');
      expect(formatted).toContain('content');
      expect(formatted).toContain('=== FIN COTIZACIÓN ===');
    });
  });

  describe('combineExtractedTexts', () => {
    it('should combine multiple texts properly', () => {
      const doc1 = { text: 'Doc1 Text', filename: '', type: 'COTIZACIÓN' as const, metadata: { pageCount: 1 } };
      const doc2 = { text: 'Doc2 Text', filename: '', type: 'COTIZACIÓN' as const, metadata: { pageCount: 1 } };
      expect(pdfExtractor.combineExtractedTexts([doc1, doc2])).toBe('Doc1 Text\n\nDoc2 Text');
    });
  });

  describe('validatePdf', () => {
    // We would mock fs to properly test validatePdf without a real file,
    // but a basic invalid file path text is fine for the unit test's error response.
    it('should return invalid for nonexistent file', () => {
      const result = pdfExtractor.validatePdf('non-existent-file.pdf');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('ENOENT');
    });
  });
});
