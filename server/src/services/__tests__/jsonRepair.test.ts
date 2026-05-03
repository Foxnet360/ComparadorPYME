import { describe, it, expect } from 'vitest';
import {
  parseJsonWithRepair,
  isTruncated,
  sanitizeJsonText,
} from '../jsonRepair';

describe('jsonRepair', () => {
  describe('parseJsonWithRepair', () => {
    it('should parse valid JSON without repair', () => {
      const json = '{"name": "test", "value": 123}';
      const result = parseJsonWithRepair(json);

      expect(result.success).toBe(true);
      expect(result.wasRepaired).toBe(false);
      expect(result.data).toEqual({ name: 'test', value: 123 });
    });

    it('should detect unterminated strings as truncated', () => {
      // Unterminated strings are detected as truncated since they can't be parsed
      const json = '{"name": "test';
      expect(isTruncated(json)).toBe(true);
    });

    it('should repair trailing commas', () => {
      const json = '{"name": "test", "items": [1, 2, ], }';
      const result = parseJsonWithRepair(json);

      expect(result.success).toBe(true);
      expect(result.wasRepaired).toBe(true);
      expect(result.repairType).toBe('repairTrailingCommas');
    });

    it('should repair truncated JSON', () => {
      // Use a case where all strings are terminated but structure is incomplete
      const json = '{"name": "test", "items": [1, 2, 3]';
      const result = parseJsonWithRepair(json);

      expect(result.success).toBe(true);
      expect(result.wasRepaired).toBe(true);
      expect(result.repairType).toBe('repairTruncatedJson');
    });

    it('should extract partial data when all repairs fail', () => {
      const json = '{"insurerName": "Test", "priceAnnual": 5000000, "coverages": [';
      const result = parseJsonWithRepair(json);

      expect(result.success).toBe(true);
      expect(result.wasRepaired).toBe(true);
      expect(result.repairType).toBe('partial_extraction');
      expect(result.data.insurerName).toBe('Test');
      expect(result.data.priceAnnual).toBe(5000000);
    });

    it('should handle completely invalid JSON', () => {
      const json = 'not json at all';
      const result = parseJsonWithRepair(json);

      expect(result.success).toBe(false);
      expect(result.data).toBeNull();
      expect(result.error).toBeDefined();
    });

    it('should repair invalid escapes', () => {
      const json = '{"description": "Line 1\\nLine 2\\x20test"}';
      const result = parseJsonWithRepair(json);

      expect(result.success).toBe(true);
      expect(result.wasRepaired).toBe(true);
    });

    it('should handle nested objects', () => {
      const json = '{"quote": {"insurer": "Test", "coverages": [{"name": "Fire", "value": "100M"}]}}';
      const result = parseJsonWithRepair(json);

      expect(result.success).toBe(true);
      expect(result.wasRepaired).toBe(false);
      expect(result.data.quote.insurer).toBe('Test');
    });
  });

  describe('isTruncated', () => {
    it('should detect unclosed strings', () => {
      expect(isTruncated('{"name": "test')).toBe(true);
    });

    it('should detect unclosed objects', () => {
      expect(isTruncated('{"name": "test", "value": {')).toBe(true);
    });

    it('should detect unclosed arrays', () => {
      expect(isTruncated('{"items": [1, 2, 3')).toBe(true);
    });

    it('should detect trailing commas', () => {
      expect(isTruncated('{"name": "test",')).toBe(true);
    });

    it('should not flag complete JSON', () => {
      expect(isTruncated('{"name": "test"}')).toBe(false);
      expect(isTruncated('[1, 2, 3]')).toBe(false);
    });
  });

  describe('sanitizeJsonText', () => {
    it('should remove control characters', () => {
      const input = '{"name": "te\\x00st"}';
      const result = sanitizeJsonText(input);
      expect(result).not.toContain('\x00');
    });

    it('should normalize line endings', () => {
      // Use actual control characters (CRLF and CR)
      const input = 'Line1\r\nLine2\rLine3';
      const result = sanitizeJsonText(input);
      expect(result).toContain('\n');
      expect(result).not.toContain('\r');
      expect(result).toBe('Line1\nLine2\nLine3');
    });

    it('should remove replacement characters', () => {
      const input = '{"name": "te\\uFFFDst"}';
      const result = sanitizeJsonText(input);
      expect(result).not.toContain('\uFFFD');
    });
  });
});
