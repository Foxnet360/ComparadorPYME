import { describe, it, expect } from 'vitest';
import {
  transformQuotesToMatrix,
  parseNumericValue,
  isExcludedValue,
  formatMatrixValue,
} from '../matrixTransformer';
import { QuoteAnalysis } from '../../types';

describe('matrixTransformer', () => {
  describe('Helper Functions', () => {
    it('should correctly identify excluded values', () => {
      expect(isExcludedValue('No incluida')).toBe(true);
      expect(isExcludedValue('no incluido')).toBe(true);
      expect(isExcludedValue('N.C.')).toBe(true);
      expect(isExcludedValue('no aplica')).toBe(true);
      expect(isExcludedValue('excluido')).toBe(true);
      expect(isExcludedValue('')).toBe(true);
      expect(isExcludedValue(null)).toBe(true);

      expect(isExcludedValue('$10.000.000')).toBe(false);
      expect(isExcludedValue('SI')).toBe(false);
    });

    it('should parse numeric values from strings correctly', () => {
      expect(parseNumericValue('$119.600.000')).toBe(119600000);
      expect(parseNumericValue('$ 45,000,000')).toBe(45000000);
      expect(parseNumericValue('No contratado')).toBe(0);
      expect(parseNumericValue('N.C.')).toBe(0);
      expect(parseNumericValue('')).toBe(0);
    });

    it('should format numeric matrix values as COP', () => {
      expect(formatMatrixValue('119600000')).toBe('$119.600.000');
      expect(formatMatrixValue('50000000')).toBe('$50.000.000');
      expect(formatMatrixValue('$119.600.000')).toBe('$119.600.000');
    });

    it('should preserve non-numeric matrix values', () => {
      expect(formatMatrixValue('Incluido')).toBe('Incluido');
      expect(formatMatrixValue('No aplica')).toBe('No aplica');
      expect(formatMatrixValue('NO ESPECIFICADO')).toBe('NO ESPECIFICADO');
      expect(formatMatrixValue('No contratado')).toBe('No contratado');
      expect(formatMatrixValue('')).toBe('No informado');
      expect(formatMatrixValue(null)).toBe('No informado');
    });
  });

  describe('transformQuotesToMatrix', () => {
    const mockQuotes: QuoteAnalysis[] = [
      {
        insurerName: 'MAPFRE',
        policyName: 'TODO RIESGO PYME INTEGRAL',
        priceMonthly: 0,
        priceAnnual: 677801,
        currency: 'COP',
        deductibles: '',
        scoringBreakdown: {
          coverage: 8,
          deductibles: 7,
          exclusions: 8,
          priceRatio: 9,
          sublimits: 8,
          warranties: 8,
        },
        clientAnalysis: '',
        technicalAnalysis: 'Vigencia de 30 días. Modalidad ocurrencia.',
        score: 82,
        alerts: [],
        coverages: [
          {
            name: 'Incendio (Edificio y Contenidos)',
            value: '$119.600.000',
            deductible: '10% PERD - Min 1 SMMLV',
            description: 'Incendio, explosion, danos por agua, anegacion',
            categoryId: 1,
            matchConfidence: 0.95,
          },
          {
            name: 'Terremoto y Eventos Catastróficos',
            value: '$119.600.000',
            deductible: '10% PERD - Min 3 SMMLV',
            categoryId: 14,
            matchConfidence: 0.9,
          },
          {
            name: 'Responsabilidad Civil (RCE)',
            value: '$300.000.000',
            deductible: '10% PERD - Min 2 SMMLV',
            description: 'Amparo basico RCE',
            categoryId: 6,
            matchConfidence: 0.92,
          },
          {
            name: 'Asistencia PYME',
            value: 'Incluido',
            deductible: 'No aplica',
            description: 'SI - Asistencia Domiciliaria PYME',
            categoryId: 11,
            matchConfidence: 0.88,
          },
          // Exclusive Coverage
          {
            name: 'Amparo Especial Mapfre VIP',
            value: '$10.000.000',
            deductible: 'No aplica',
            description: 'Exclusivo de Mapfre',
            categoryId: null,
            matchConfidence: 0.3,
          },
        ],
      },
      {
        insurerName: 'CHUBB',
        policyName: 'Pymes',
        priceMonthly: 0,
        priceAnnual: 1320000,
        currency: 'COP',
        deductibles: '',
        scoringBreakdown: {
          coverage: 7,
          deductibles: 8,
          exclusions: 8,
          priceRatio: 6,
          sublimits: 7,
          warranties: 7,
        },
        clientAnalysis: '',
        technicalAnalysis: 'Vigencia de 30 días.',
        score: 72,
        alerts: [],
        coverages: [
          {
            name: 'Incendio (Edificio y Contenidos)',
            value: '$45.000.000',
            deductible: '5% siniestro - Min 1 SMMLV',
            description: 'Incendio, explosion, rayo',
            categoryId: 1,
            matchConfidence: 0.95,
          },
          {
            name: 'Terremoto y Eventos Catastróficos',
            value: '$45.000.000',
            deductible: 'No aplica', // Winner deductible!
            categoryId: 14,
            matchConfidence: 0.9,
          },
          {
            name: 'Responsabilidad Civil (RCE)',
            value: '$250.000.000',
            deductible: '10% perdida - Min 1 SMMLV',
            categoryId: 6,
            matchConfidence: 0.92,
          },
        ],
      },
    ];

    it('should generate row-grouped headers and data rows for canonical categories', () => {
      const matrix = transformQuotesToMatrix(mockQuotes);

      // Verify that we have header for "Incendio (Edificio y Contenidos)"
      const incendioHeader = matrix.find((row) => row.type === 'header' && row.sectionId === 1);
      expect(incendioHeader).toBeDefined();
      expect(incendioHeader?.label).toBe('AMPARO BÁSICO - TODO RIESGO DAÑO MATERIAL');

      // Verify "Valor Asegurado" row for Incendio
      const incendioValue = matrix.find((row) => row.id === 'section_1_row_value');
      expect(incendioValue).toBeDefined();
      expect(incendioValue?.cells[0].value).toBe('$119.600.000');
      expect(incendioValue?.cells[1].value).toBe('$45.000.000');

      // MAPFRE has a higher sum insured, so it should be the winner
      expect(incendioValue?.cells[0].isWinner).toBe(true);
      expect(incendioValue?.cells[1].isWinner).toBe(false);

      // Verify "Deducible" row for Terremoto
      const terremotoDeductible = matrix.find((row) => row.id === 'section_14_row_deductible');
      expect(terremotoDeductible).toBeDefined();
      expect(terremotoDeductible?.cells[0].value).toBe('10% PERD - Min 3 SMMLV');
      expect(terremotoDeductible?.cells[1].value).toBe('No aplica');

      // CHUBB has "No aplica" deductible, so it should be marked as winner
      expect(terremotoDeductible?.cells[0].isWinner).toBe(false);
      expect(terremotoDeductible?.cells[1].isWinner).toBe(true);
    });

    it('should isolate exclusive coverages into a dedicated section', () => {
      const matrix = transformQuotesToMatrix(mockQuotes);

      // Should have section 99 header
      const exclusiveHeader = matrix.find((row) => row.type === 'header' && row.sectionId === 99);
      expect(exclusiveHeader).toBeDefined();
      expect(exclusiveHeader?.label).toBe('AMPAROS EXCLUSIVOS / VENTAJAS COMPETITIVAS');

      // Should contain a row for "Amparo Especial Mapfre VIP"
      const vipRow = matrix.find((row) => row.type === 'data' && row.sectionId === 99);
      expect(vipRow).toBeDefined();
      expect(vipRow?.label).toBe('Amparo Especial Mapfre VIP');
      expect(vipRow?.cells[0].value).toBe('$10.000.000');
      expect(vipRow?.cells[1].value).toBe('No incluida');
      expect(vipRow?.cells[0].isExcluded).toBe(false);
      expect(vipRow?.cells[1].isExcluded).toBe(true);
    });

    it('should format raw numeric exclusive values as COP while preserving deductible text', () => {
      const quotesWithRawExclusive: QuoteAnalysis[] = [
        {
          insurerName: 'SBS',
          policyName: 'PYME',
          priceMonthly: 0,
          priceAnnual: 500000,
          currency: 'COP',
          deductibles: '',
          scoringBreakdown: {
            coverage: 7,
            deductibles: 7,
            exclusions: 7,
            priceRatio: 7,
            sublimits: 7,
            warranties: 7,
          },
          clientAnalysis: '',
          technicalAnalysis: '',
          score: 70,
          alerts: [],
          coverages: [
            {
              name: 'Incendio (Edificio y Contenidos)',
              value: '$100.000.000',
              deductible: 'No aplica',
              categoryId: 1,
              matchConfidence: 0.95,
            },
            {
              name: 'Amparo Adicional SBS',
              value: '119600000',
              deductible: '10% del siniestro',
              categoryId: null,
              matchConfidence: 0.3,
            },
          ],
        },
      ];

      const matrix = transformQuotesToMatrix(quotesWithRawExclusive);
      const exclusiveRow = matrix.find((row) => row.type === 'data' && row.sectionId === 99);
      expect(exclusiveRow).toBeDefined();
      expect(exclusiveRow?.cells[0].value).toBe('$119.600.000 (Ded: 10% del siniestro)');
    });

    it('should format raw numeric canonical values as COP in value rows', () => {
      const quotesWithRawValue: QuoteAnalysis[] = [
        {
          insurerName: 'SBS',
          policyName: 'PYME',
          priceMonthly: 0,
          priceAnnual: 500000,
          currency: 'COP',
          deductibles: '',
          scoringBreakdown: {
            coverage: 7,
            deductibles: 7,
            exclusions: 7,
            priceRatio: 7,
            sublimits: 7,
            warranties: 7,
          },
          clientAnalysis: '',
          technicalAnalysis: '',
          score: 70,
          alerts: [],
          coverages: [
            {
              name: 'Incendio (Edificio y Contenidos)',
              value: '119600000',
              deductible: 'No aplica',
              categoryId: 1,
              matchConfidence: 0.95,
            },
          ],
        },
      ];

      const matrix = transformQuotesToMatrix(quotesWithRawValue);
      const incendioValue = matrix.find((row) => row.id === 'section_1_row_value');
      expect(incendioValue?.cells[0].value).toBe('$119.600.000');
    });

    it('should inject correct financial computations in Primas y Costos section', () => {
      const matrix = transformQuotesToMatrix(mockQuotes);

      // Financial header should exist
      const finHeader = matrix.find((row) => row.id === 'section_financial_header');
      expect(finHeader).toBeDefined();

      // Check net premium values
      const netRow = matrix.find((row) => row.id === 'financial_net_premium');
      expect(netRow).toBeDefined();
      expect(netRow?.cells[0].value).toContain('677.801');
      expect(netRow?.cells[1].value).toContain('1.320.000');

      // Expenses mapping
      const expRow = matrix.find((row) => row.id === 'financial_expenses');
      expect(expRow).toBeDefined();
      expect(expRow?.cells[0].value).toContain('10.000'); // MAPFRE default expense
      expect(expRow?.cells[1].value).toContain('12.000'); // CHUBB default expense

      // Subtotal
      const subRow = matrix.find((row) => row.id === 'financial_subtotal');
      expect(subRow?.cells[0].value).toContain('687.801');
      expect(subRow?.cells[1].value).toContain('1.332.000');

      // VAT 19%
      const ivaRow = matrix.find((row) => row.id === 'financial_iva');
      expect(ivaRow?.cells[0].value).toContain('130.682');
      expect(ivaRow?.cells[1].value).toContain('253.080');

      // Total to pay
      const totalRow = matrix.find((row) => row.id === 'financial_total');
      expect(totalRow?.cells[0].value).toContain('818.483');
      expect(totalRow?.cells[1].value).toContain('1.585.080');

      // MAPFRE is cheaper, so it should be winner
      expect(totalRow?.cells[0].isWinner).toBe(true);
      expect(totalRow?.cells[1].isWinner).toBe(false);

      // Check ratio
      const ratioRow = matrix.find((row) => row.id === 'financial_ratio');
      expect(ratioRow).toBeDefined();
      // MAPFRE total: 818483 / 119600000 = 0.684% -> formatted
      expect(ratioRow?.cells[0].value).toBe('0,68%');
    });
  });
});
