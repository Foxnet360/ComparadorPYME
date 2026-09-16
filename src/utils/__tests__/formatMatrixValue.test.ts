import { describe, it, expect } from 'vitest';
import { formatMatrixValue } from '../../../components/UnifiedCoverageMatrix';

describe('formatMatrixValue (frontend)', () => {
  it('should format numeric values as COP', () => {
    expect(formatMatrixValue('119600000')).toBe('$119.600.000');
    expect(formatMatrixValue('50000000')).toBe('$50.000.000');
    expect(formatMatrixValue('$119.600.000')).toBe('$119.600.000');
  });

  it('should preserve non-numeric values', () => {
    expect(formatMatrixValue('Incluido')).toBe('Incluido');
    expect(formatMatrixValue('No aplica')).toBe('No aplica');
    expect(formatMatrixValue('NO ESPECIFICADO')).toBe('NO ESPECIFICADO');
    expect(formatMatrixValue('No contratado')).toBe('No contratado');
    expect(formatMatrixValue('')).toBe('No informado');
    expect(formatMatrixValue(null)).toBe('No informado');
  });
});
