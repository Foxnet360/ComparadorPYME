import { describe, it, expect } from 'vitest';
import { formatMatrixValue, transformQuotesToMatrix } from '../../../components/UnifiedCoverageMatrix';
import { QuoteAnalysis } from '../../../types';

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

describe('transformQuotesToMatrix (frontend exclusive formatting)', () => {
  it('should format raw numeric exclusive values as COP while preserving deductible text', () => {
    const quotes: QuoteAnalysis[] = [
      {
        insurerName: 'SBS',
        policyName: 'PYME',
        priceMonthly: 0,
        priceAnnual: 500000,
        currency: 'COP',
        deductibles: '',
        scoringBreakdown: { coverage: 7, deductibles: 7, exclusions: 7, priceRatio: 7, sublimits: 7, warranties: 7 },
        clientAnalysis: '',
        technicalAnalysis: '',
        score: 70,
        alerts: [],
        coverages: [
          {
            name: 'Amparo Adicional SBS',
            value: '119600000',
            deductible: '10% del siniestro',
            categoryId: null,
            matchConfidence: 0.30
          }
        ]
      }
    ];

    const matrix = transformQuotesToMatrix(quotes);
    const exclusiveRow = matrix.find(row => row.type === 'data' && row.sectionId === 99);
    expect(exclusiveRow).toBeDefined();
    expect(exclusiveRow?.cells[0].value).toBe('$119.600.000 (Ded: 10% del siniestro)');
  });
});
