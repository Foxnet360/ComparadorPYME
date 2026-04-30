"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const jsonRepair_1 = require("../jsonRepair");
(0, vitest_1.describe)('jsonRepair', () => {
    (0, vitest_1.describe)('parseJsonWithRepair', () => {
        (0, vitest_1.it)('should parse valid JSON without repair', () => {
            const json = '{"name": "test", "value": 123}';
            const result = (0, jsonRepair_1.parseJsonWithRepair)(json);
            (0, vitest_1.expect)(result.success).toBe(true);
            (0, vitest_1.expect)(result.wasRepaired).toBe(false);
            (0, vitest_1.expect)(result.data).toEqual({ name: 'test', value: 123 });
        });
        (0, vitest_1.it)('should detect unterminated strings as truncated', () => {
            // Unterminated strings are detected as truncated since they can't be parsed
            const json = '{"name": "test';
            (0, vitest_1.expect)((0, jsonRepair_1.isTruncated)(json)).toBe(true);
        });
        (0, vitest_1.it)('should repair trailing commas', () => {
            const json = '{"name": "test", "items": [1, 2, ], }';
            const result = (0, jsonRepair_1.parseJsonWithRepair)(json);
            (0, vitest_1.expect)(result.success).toBe(true);
            (0, vitest_1.expect)(result.wasRepaired).toBe(true);
            (0, vitest_1.expect)(result.repairType).toBe('repairTrailingCommas');
        });
        (0, vitest_1.it)('should repair truncated JSON', () => {
            // Use a case where all strings are terminated but structure is incomplete
            const json = '{"name": "test", "items": [1, 2, 3]';
            const result = (0, jsonRepair_1.parseJsonWithRepair)(json);
            (0, vitest_1.expect)(result.success).toBe(true);
            (0, vitest_1.expect)(result.wasRepaired).toBe(true);
            (0, vitest_1.expect)(result.repairType).toBe('repairTruncatedJson');
        });
        (0, vitest_1.it)('should extract partial data when all repairs fail', () => {
            const json = '{"insurerName": "Test", "priceAnnual": 5000000, "coverages": [';
            const result = (0, jsonRepair_1.parseJsonWithRepair)(json);
            (0, vitest_1.expect)(result.success).toBe(true);
            (0, vitest_1.expect)(result.wasRepaired).toBe(true);
            (0, vitest_1.expect)(result.repairType).toBe('partial_extraction');
            (0, vitest_1.expect)(result.data.insurerName).toBe('Test');
            (0, vitest_1.expect)(result.data.priceAnnual).toBe(5000000);
        });
        (0, vitest_1.it)('should handle completely invalid JSON', () => {
            const json = 'not json at all';
            const result = (0, jsonRepair_1.parseJsonWithRepair)(json);
            (0, vitest_1.expect)(result.success).toBe(false);
            (0, vitest_1.expect)(result.data).toBeNull();
            (0, vitest_1.expect)(result.error).toBeDefined();
        });
        (0, vitest_1.it)('should repair invalid escapes', () => {
            const json = '{"description": "Line 1\\nLine 2\\x20test"}';
            const result = (0, jsonRepair_1.parseJsonWithRepair)(json);
            (0, vitest_1.expect)(result.success).toBe(true);
            (0, vitest_1.expect)(result.wasRepaired).toBe(true);
        });
        (0, vitest_1.it)('should handle nested objects', () => {
            const json = '{"quote": {"insurer": "Test", "coverages": [{"name": "Fire", "value": "100M"}]}}';
            const result = (0, jsonRepair_1.parseJsonWithRepair)(json);
            (0, vitest_1.expect)(result.success).toBe(true);
            (0, vitest_1.expect)(result.wasRepaired).toBe(false);
            (0, vitest_1.expect)(result.data.quote.insurer).toBe('Test');
        });
    });
    (0, vitest_1.describe)('isTruncated', () => {
        (0, vitest_1.it)('should detect unclosed strings', () => {
            (0, vitest_1.expect)((0, jsonRepair_1.isTruncated)('{"name": "test')).toBe(true);
        });
        (0, vitest_1.it)('should detect unclosed objects', () => {
            (0, vitest_1.expect)((0, jsonRepair_1.isTruncated)('{"name": "test", "value": {')).toBe(true);
        });
        (0, vitest_1.it)('should detect unclosed arrays', () => {
            (0, vitest_1.expect)((0, jsonRepair_1.isTruncated)('{"items": [1, 2, 3')).toBe(true);
        });
        (0, vitest_1.it)('should detect trailing commas', () => {
            (0, vitest_1.expect)((0, jsonRepair_1.isTruncated)('{"name": "test",')).toBe(true);
        });
        (0, vitest_1.it)('should not flag complete JSON', () => {
            (0, vitest_1.expect)((0, jsonRepair_1.isTruncated)('{"name": "test"}')).toBe(false);
            (0, vitest_1.expect)((0, jsonRepair_1.isTruncated)('[1, 2, 3]')).toBe(false);
        });
    });
    (0, vitest_1.describe)('sanitizeJsonText', () => {
        (0, vitest_1.it)('should remove control characters', () => {
            const input = '{"name": "te\\x00st"}';
            const result = (0, jsonRepair_1.sanitizeJsonText)(input);
            (0, vitest_1.expect)(result).not.toContain('\x00');
        });
        (0, vitest_1.it)('should normalize line endings', () => {
            // Use actual control characters (CRLF and CR)
            const input = 'Line1\r\nLine2\rLine3';
            const result = (0, jsonRepair_1.sanitizeJsonText)(input);
            (0, vitest_1.expect)(result).toContain('\n');
            (0, vitest_1.expect)(result).not.toContain('\r');
            (0, vitest_1.expect)(result).toBe('Line1\nLine2\nLine3');
        });
        (0, vitest_1.it)('should remove replacement characters', () => {
            const input = '{"name": "te\\uFFFDst"}';
            const result = (0, jsonRepair_1.sanitizeJsonText)(input);
            (0, vitest_1.expect)(result).not.toContain('\uFFFD');
        });
    });
});
