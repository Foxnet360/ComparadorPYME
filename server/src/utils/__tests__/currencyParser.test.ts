import { describe, it, expect } from 'vitest';
import { parseColombianCurrency } from '../currencyParser';

describe('currencyParser - parseColombianCurrency', () => {
  it('should parse standard Colombian currency format with decimals', () => {
    expect(parseColombianCurrency('$1.134.400,00')).toBe(1134400.0);
    expect(parseColombianCurrency('1.134.400,50')).toBe(1134400.5);
  });

  it('should parse standard Colombian currency format without decimals', () => {
    expect(parseColombianCurrency('$1.134.400')).toBe(1134400.0);
    expect(parseColombianCurrency('1.134.400')).toBe(1134400.0);
  });

  it('should parse raw float with dot decimal', () => {
    expect(parseColombianCurrency('1134400.00')).toBe(1134400.0);
    expect(parseColombianCurrency('1134400.5')).toBe(1134400.5);
  });

  it('should parse single dot and single comma scenarios correctly', () => {
    // Single dot followed by 3 digits is thousands separator in es-CO
    expect(parseColombianCurrency('1.134')).toBe(1134);
    // Single dot followed by 2 digits is decimal
    expect(parseColombianCurrency('1.13')).toBe(1.13);
    // Single comma is decimal separator
    expect(parseColombianCurrency('1134400,00')).toBe(1134400);
    expect(parseColombianCurrency('1,5')).toBe(1.5);
  });

  it('should parse US/International currency format with commas as thousands and dot as decimal', () => {
    expect(parseColombianCurrency('$ 15,000,000.00')).toBe(15000000.0);
    expect(parseColombianCurrency('15,000,000.50')).toBe(15000000.5);
    expect(parseColombianCurrency('1,500,000')).toBe(1500000.0);
  });

  it('should return null for null, undefined, or empty strings', () => {
    expect(parseColombianCurrency(null)).toBeNull();
    expect(parseColombianCurrency(undefined)).toBeNull();
    expect(parseColombianCurrency('')).toBeNull();
    expect(parseColombianCurrency('   ')).toBeNull();
  });

  it('should return null for unparseable or garbage strings instead of invalid numbers', () => {
    expect(parseColombianCurrency('No informado')).toBeNull();
    expect(parseColombianCurrency('N.C.')).toBeNull();
    expect(parseColombianCurrency('Por confirmar')).toBeNull();
    expect(parseColombianCurrency('abc')).toBeNull();
  });
});
