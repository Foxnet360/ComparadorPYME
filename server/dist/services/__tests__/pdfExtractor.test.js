"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const pdfExtractor_1 = require("../pdfExtractor");
(0, vitest_1.describe)('pdfExtractor', () => {
    (0, vitest_1.describe)('cleanText', () => {
        (0, vitest_1.it)('should remove extra whitespaces', () => {
            const text = 'This   is  a test';
            (0, vitest_1.expect)(pdfExtractor_1.pdfExtractor.cleanText(text)).toBe('This is a test');
        });
        (0, vitest_1.it)('should remove isolated page numbers', () => {
            const text = 'Página 1\n45\n\nAlgo más';
            (0, vitest_1.expect)(pdfExtractor_1.pdfExtractor.cleanText(text)).toBe('Página 1\n\nAlgo más');
        });
        (0, vitest_1.it)('should collapse multiple newlines into two', () => {
            const text = 'Line 1\n\n\nLine 2';
            (0, vitest_1.expect)(pdfExtractor_1.pdfExtractor.cleanText(text)).toBe('Line 1\n\nLine 2');
        });
    });
    (0, vitest_1.describe)('formatExtractedText', () => {
        (0, vitest_1.it)('should format extracted text properly', () => {
            const formatted = pdfExtractor_1.pdfExtractor.formatExtractedText('content', 'test-file.pdf', 'COTIZACIÓN');
            (0, vitest_1.expect)(formatted).toContain('=== INICIO COTIZACIÓN: test-file ===');
            (0, vitest_1.expect)(formatted).toContain('content');
            (0, vitest_1.expect)(formatted).toContain('=== FIN COTIZACIÓN ===');
        });
    });
    (0, vitest_1.describe)('combineExtractedTexts', () => {
        (0, vitest_1.it)('should combine multiple texts properly', () => {
            const doc1 = { text: 'Doc1 Text', filename: '', type: 'COTIZACIÓN', metadata: { pageCount: 1 }, pages: [] };
            const doc2 = { text: 'Doc2 Text', filename: '', type: 'COTIZACIÓN', metadata: { pageCount: 1 }, pages: [] };
            (0, vitest_1.expect)(pdfExtractor_1.pdfExtractor.combineExtractedTexts([doc1, doc2])).toBe('Doc1 Text\n\nDoc2 Text');
        });
    });
    (0, vitest_1.describe)('validatePdf', () => {
        // We would mock fs to properly test validatePdf without a real file,
        // but a basic invalid file path text is fine for the unit test's error response.
        (0, vitest_1.it)('should return invalid for nonexistent file', () => {
            const result = pdfExtractor_1.pdfExtractor.validatePdf('non-existent-file.pdf');
            (0, vitest_1.expect)(result.valid).toBe(false);
            (0, vitest_1.expect)(result.error).toContain('File does not exist');
        });
    });
});
