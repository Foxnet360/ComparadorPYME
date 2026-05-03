"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const textPreprocessor_1 = require("../textPreprocessor");
(0, vitest_1.describe)('textPreprocessor', () => {
    (0, vitest_1.describe)('detectComplexity', () => {
        (0, vitest_1.it)('should detect simple documents', () => {
            (0, vitest_1.expect)((0, textPreprocessor_1.detectComplexity)('short text', 3)).toBe('simple');
            (0, vitest_1.expect)((0, textPreprocessor_1.detectComplexity)('medium text', 5)).toBe('simple');
        });
        (0, vitest_1.it)('should detect medium documents', () => {
            (0, vitest_1.expect)((0, textPreprocessor_1.detectComplexity)('medium text', 8)).toBe('medium');
            (0, vitest_1.expect)((0, textPreprocessor_1.detectComplexity)('medium text', 10)).toBe('medium');
        });
        (0, vitest_1.it)('should detect complex documents', () => {
            // Dense documents (>2500 chars/page) with >10 pages are complex
            (0, vitest_1.expect)((0, textPreprocessor_1.detectComplexity)('A'.repeat(30000), 11)).toBe('complex');
            // Sparse documents with >10 pages are medium
            (0, vitest_1.expect)((0, textPreprocessor_1.detectComplexity)('short', 50)).toBe('medium');
        });
    });
    (0, vitest_1.describe)('fixEncoding', () => {
        (0, vitest_1.it)('should fix CotizaciÃ³n encoding', () => {
            const input = 'CotizaciÃ³n de PÃ³liza';
            const result = (0, textPreprocessor_1.fixEncoding)(input);
            (0, vitest_1.expect)(result).toBe('Cotización de Póliza');
        });
        (0, vitest_1.it)('should fix multiple encoding issues', () => {
            const input = 'Cobertura de Incendio y GarantÃ­a';
            const result = (0, textPreprocessor_1.fixEncoding)(input);
            (0, vitest_1.expect)(result).toBe('Cobertura de Incendio y Garantía');
        });
        (0, vitest_1.it)('should not change properly encoded text', () => {
            const input = 'Cotización normal con tildes';
            const result = (0, textPreprocessor_1.fixEncoding)(input);
            (0, vitest_1.expect)(result).toBe(input);
        });
        (0, vitest_1.it)('should fix common insurance terms', () => {
            const input = 'Responsabilidad Extracontractual y CatastrÃ³fico';
            const result = (0, textPreprocessor_1.fixEncoding)(input);
            (0, vitest_1.expect)(result).toBe('Responsabilidad Extracontractual y Catastrófico');
        });
    });
    (0, vitest_1.describe)('normalizeColombianNumbers', () => {
        (0, vitest_1.it)('should normalize numbers with thousand separators', () => {
            (0, vitest_1.expect)((0, textPreprocessor_1.normalizeColombianNumbers)('8.500.000')).toBe('8500000');
            (0, vitest_1.expect)((0, textPreprocessor_1.normalizeColombianNumbers)('1.234.567')).toBe('1234567');
        });
        (0, vitest_1.it)('should normalize numbers with decimal places', () => {
            (0, vitest_1.expect)((0, textPreprocessor_1.normalizeColombianNumbers)('1.234.567,89')).toBe('1234567.89');
            (0, vitest_1.expect)((0, textPreprocessor_1.normalizeColombianNumbers)('100.000,50')).toBe('100000.50');
        });
        (0, vitest_1.it)('should handle text with multiple numbers', () => {
            const input = 'Prima: $ 8.500.000 y deducible: 10.000,50';
            const result = (0, textPreprocessor_1.normalizeColombianNumbers)(input);
            (0, vitest_1.expect)(result).toBe('Prima: $ 8500000 y deducible: 10000.50');
        });
        (0, vitest_1.it)('should not change numbers without thousand separators', () => {
            (0, vitest_1.expect)((0, textPreprocessor_1.normalizeColombianNumbers)('5000')).toBe('5000');
            (0, vitest_1.expect)((0, textPreprocessor_1.normalizeColombianNumbers)('100')).toBe('100');
        });
        (0, vitest_1.it)('should handle edge cases', () => {
            (0, vitest_1.expect)((0, textPreprocessor_1.normalizeColombianNumbers)('1.000')).toBe('1000');
            (0, vitest_1.expect)((0, textPreprocessor_1.normalizeColombianNumbers)('10.000.000')).toBe('10000000');
        });
    });
    (0, vitest_1.describe)('removeArtifacts', () => {
        (0, vitest_1.it)('should remove standalone page numbers', () => {
            const input = 'Some text\n\n5\n\nMore text';
            const result = (0, textPreprocessor_1.removeArtifacts)(input);
            (0, vitest_1.expect)(result).not.toContain('\n5\n');
        });
        (0, vitest_1.it)('should remove dash lines', () => {
            const input = 'Text\n---\nMore text';
            const result = (0, textPreprocessor_1.removeArtifacts)(input);
            (0, vitest_1.expect)(result).not.toContain('---');
        });
        (0, vitest_1.it)('should remove excessive empty lines', () => {
            const input = 'Line 1\n\n\n\n\nLine 2';
            const result = (0, textPreprocessor_1.removeArtifacts)(input);
            (0, vitest_1.expect)(result).not.toContain('\n\n\n\n\n');
        });
        (0, vitest_1.it)('should trim whitespace', () => {
            const input = '  Text with spaces  ';
            const result = (0, textPreprocessor_1.removeArtifacts)(input);
            (0, vitest_1.expect)(result).toBe('Text with spaces');
        });
    });
    (0, vitest_1.describe)('extractRelevantSections', () => {
        (0, vitest_1.it)('should extract coverage sections', () => {
            const input = 'Header\n\nCOBERTURAS\nIncendio: 500M\n\nFooter';
            const result = (0, textPreprocessor_1.extractRelevantSections)(input);
            (0, vitest_1.expect)(result).toContain('COBERTURAS');
            (0, vitest_1.expect)(result).toContain('Incendio');
        });
        (0, vitest_1.it)('should truncate long texts without relevant sections', () => {
            const input = 'A'.repeat(15000);
            const result = (0, textPreprocessor_1.extractRelevantSections)(input);
            (0, vitest_1.expect)(result.length).toBeLessThan(13000);
            (0, vitest_1.expect)(result).toContain('[... contenido truncado');
        });
        (0, vitest_1.it)('should return short texts unchanged', () => {
            const input = 'Short text';
            const result = (0, textPreprocessor_1.extractRelevantSections)(input);
            (0, vitest_1.expect)(result).toBe(input);
        });
    });
    (0, vitest_1.describe)('preprocessText', () => {
        (0, vitest_1.it)('should process text with all options', () => {
            const input = 'CotizaciÃ³n: $ 8.500.000\n\n\nPÃ³liza de Incendio';
            const result = (0, textPreprocessor_1.preprocessText)(input, 5);
            (0, vitest_1.expect)(result.text).toContain('Cotización');
            (0, vitest_1.expect)(result.text).toContain('8500000');
            (0, vitest_1.expect)(result.metadata.complexity).toBe('simple');
            (0, vitest_1.expect)(result.metadata.changes.length).toBeGreaterThan(0);
        });
        (0, vitest_1.it)('should handle complex documents', () => {
            const input = 'A'.repeat(60000); // Dense text: 60000 chars / 20 pages = 3000 chars/page
            const result = (0, textPreprocessor_1.preprocessText)(input, 20);
            (0, vitest_1.expect)(result.metadata.complexity).toBe('complex');
            (0, vitest_1.expect)(result.metadata.pageCount).toBe(20);
        });
        (0, vitest_1.it)('should respect options', () => {
            const input = 'CotizaciÃ³n: $ 8.500.000';
            const result = (0, textPreprocessor_1.preprocessText)(input, 5, {
                fixEncoding: false,
                normalizeNumbers: false,
                removeArtifacts: false,
            });
            (0, vitest_1.expect)(result.text).toBe('CotizaciÃ³n: $ 8.500.000');
            (0, vitest_1.expect)(result.metadata.changes).toHaveLength(0);
        });
    });
    (0, vitest_1.describe)('containsColombianFormat', () => {
        (0, vitest_1.it)('should detect Colombian format', () => {
            (0, vitest_1.expect)((0, textPreprocessor_1.containsColombianFormat)('8.500.000')).toBe(true);
            (0, vitest_1.expect)((0, textPreprocessor_1.containsColombianFormat)('1.234.567,89')).toBe(true);
        });
        (0, vitest_1.it)('should not detect international format', () => {
            (0, vitest_1.expect)((0, textPreprocessor_1.containsColombianFormat)('1,234,567.89')).toBe(false);
            (0, vitest_1.expect)((0, textPreprocessor_1.containsColombianFormat)('5000')).toBe(false);
        });
    });
    (0, vitest_1.describe)('detectNumberFormat', () => {
        (0, vitest_1.it)('should detect Colombian format', () => {
            (0, vitest_1.expect)((0, textPreprocessor_1.detectNumberFormat)('8.500.000 y 1.234.567,89')).toBe('colombian');
        });
        (0, vitest_1.it)('should detect international format', () => {
            (0, vitest_1.expect)((0, textPreprocessor_1.detectNumberFormat)('1,234,567.89 and 5,000.50')).toBe('international');
        });
        (0, vitest_1.it)('should handle ambiguous cases', () => {
            (0, vitest_1.expect)((0, textPreprocessor_1.detectNumberFormat)('5000')).toBe('ambiguous');
        });
    });
    (0, vitest_1.describe)('calculateContentDensity', () => {
        (0, vitest_1.it)('should calculate density correctly', () => {
            (0, vitest_1.expect)((0, textPreprocessor_1.calculateContentDensity)('A'.repeat(10000), 4)).toBe(2500);
            (0, vitest_1.expect)((0, textPreprocessor_1.calculateContentDensity)('A'.repeat(5000), 2)).toBe(2500);
        });
        (0, vitest_1.it)('should return 0 for 0 pages', () => {
            (0, vitest_1.expect)((0, textPreprocessor_1.calculateContentDensity)('test', 0)).toBe(0);
        });
    });
    (0, vitest_1.describe)('detectComplexity with density', () => {
        (0, vitest_1.it)('should classify dense documents >10 pages as complex', () => {
            const denseText = 'A'.repeat(31000); // 31000 chars / 12 pages = ~2583 chars/page > 2500
            (0, vitest_1.expect)((0, textPreprocessor_1.detectComplexity)(denseText, 12)).toBe('complex');
        });
        (0, vitest_1.it)('should classify sparse documents >10 pages as medium', () => {
            const sparseText = 'A'.repeat(15000); // 15000 chars / 10 pages = 1500 chars/page
            (0, vitest_1.expect)((0, textPreprocessor_1.detectComplexity)(sparseText, 10)).toBe('medium');
        });
        (0, vitest_1.it)('should still classify <=5 pages as simple', () => {
            (0, vitest_1.expect)((0, textPreprocessor_1.detectComplexity)('A'.repeat(10000), 5)).toBe('simple');
        });
    });
    (0, vitest_1.describe)('extractRelevantSections', () => {
        (0, vitest_1.it)('should extract coverage sections', () => {
            const text = 'Header\n\nCOBERTURAS\nIncendio: 500M\n\nFooter';
            const result = (0, textPreprocessor_1.extractRelevantSections)(text);
            (0, vitest_1.expect)(result).toContain('COBERTURAS');
            (0, vitest_1.expect)(result).toContain('Incendio');
        });
        (0, vitest_1.it)('should extract premium sections', () => {
            const text = 'Header\n\nTOTAL A PAGAR\nPrima: 1.000.000 COP\n\nFooter';
            const result = (0, textPreprocessor_1.extractRelevantSections)(text);
            (0, vitest_1.expect)(result).toContain('TOTAL A PAGAR');
            (0, vitest_1.expect)(result).toContain('1.000.000');
        });
        (0, vitest_1.it)('should concatenate multiple sections', () => {
            const text = 'Header\n\nCOBERTURAS\nIncendio: 500M\n\nPRIMA\nTotal: 1.000.000\n\nFooter';
            const result = (0, textPreprocessor_1.extractRelevantSections)(text);
            (0, vitest_1.expect)(result).toContain('COBERTURAS');
            (0, vitest_1.expect)(result).toContain('PRIMA');
        });
        (0, vitest_1.it)('should meet minimum extraction size', () => {
            // Text without recognizable sections should use fallback
            const text = 'Some random text without coverage sections';
            const result = (0, textPreprocessor_1.extractRelevantSections)(text);
            // Should return the text as-is since it's short
            (0, vitest_1.expect)(result.length).toBe(text.length);
        });
        (0, vitest_1.it)('should include premium info in fallback', () => {
            const text = 'Some text\n\nPrima total: 2.500.000 COP\n\nMore text';
            const result = (0, textPreprocessor_1.extractRelevantSections)(text);
            (0, vitest_1.expect)(result).toContain('Prima');
            (0, vitest_1.expect)(result).toContain('2.500.000');
        });
        (0, vitest_1.it)('should truncate very long extracted text', () => {
            const text = 'COBERTURAS\n' + 'A'.repeat(20000);
            const result = (0, textPreprocessor_1.extractRelevantSections)(text);
            (0, vitest_1.expect)(result.length).toBeLessThanOrEqual(13000); // 12000 + truncation message
        });
    });
});
