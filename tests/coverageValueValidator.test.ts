import { describe, it, expect } from 'vitest';
import { parseCoverageValue } from '../server/src/services/coverageValueValidator';

describe('parseCoverageValue', () => {
  it('should parse simple numbers', () => {
    expect(parseCoverageValue('500000000')).toBe(500000000);
    expect(parseCoverageValue('1000000')).toBe(1000000);
  });

  it('should parse Colombian format with dots as thousand separators', () => {
    expect(parseCoverageValue('1.500.000')).toBe(1500000);
    expect(parseCoverageValue('500.000.000')).toBe(500000000);
    expect(parseCoverageValue('1.000.000.000')).toBe(1000000000);
  });

  it('should parse US format with commas as thousand separators', () => {
    expect(parseCoverageValue('1,500,000')).toBe(1500000);
    expect(parseCoverageValue('500,000,000')).toBe(500000000);
  });

  it('should parse abbreviations with M (millions)', () => {
    expect(parseCoverageValue('500M')).toBe(500000000);
    expect(parseCoverageValue('1.5M')).toBe(1500000);
    expect(parseCoverageValue('2.3M')).toBe(2300000);
    expect(parseCoverageValue('$1.5M')).toBe(1500000);
  });

  it('should parse abbreviations with B (billions)', () => {
    expect(parseCoverageValue('1B')).toBe(1000000000);
    expect(parseCoverageValue('2.5B')).toBe(2500000000);
  });

  it('should parse abbreviations with K (thousands)', () => {
    expect(parseCoverageValue('500K')).toBe(500000);
    expect(parseCoverageValue('1.5K')).toBe(1500);
  });

  it('should handle currency symbols', () => {
    expect(parseCoverageValue('$500.000.000')).toBe(500000000);
    expect(parseCoverageValue('$1.5M')).toBe(1500000);
  });

  it('should return null for non-numeric values', () => {
    expect(parseCoverageValue('No aplica')).toBeNull();
    expect(parseCoverageValue('Incluido')).toBeNull();
    expect(parseCoverageValue('NO ESPECIFICADO')).toBeNull();
    expect(parseCoverageValue('')).toBeNull();
  });

  it('should not corrupt decimal abbreviations (critical bug fix)', () => {
    // This was the bug: "1.5M" was being parsed as 15,000,000 instead of 1,500,000
    const result = parseCoverageValue('1.5M');
    expect(result).toBe(1500000);
    expect(result).not.toBe(15000000);
  });

  it('should handle edge cases', () => {
    expect(parseCoverageValue('0')).toBe(0);
    expect(parseCoverageValue('0M')).toBe(0);
    expect(parseCoverageValue('000')).toBe(0);
  });
});
