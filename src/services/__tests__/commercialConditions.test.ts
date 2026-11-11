import { describe, it, expect, vi } from 'vitest';
import {
  COMMERCIAL_CONDITION_FIELDS,
  extractCommercialConditionsFromReport,
  applyCommercialConditionsToReport,
} from '../../data/commercialPolicies';
import { generatePDF } from '../../../services/pdfService';
import type { ComparisonReport, MatrixRow, QuoteAnalysis } from '../../../types';

describe('Commercial Conditions in Quotes', () => {
  it('defines the 5 canonical commercial condition fields', () => {
    const keys = COMMERCIAL_CONDITION_FIELDS.map((f) => f.key);
    expect(keys).toEqual([
      'validezOferta',
      'formaPago',
      'inspeccionPrevia',
      'requisitosEmision',
      'otrasCondiciones',
    ]);
  });

  it('extracts commercial conditions from matrix rows and quote paymentTerms', () => {
    const mockMatrix: MatrixRow[] = [
      {
        type: 'data',
        id: 'r1',
        label: 'Validez de la Oferta',
        sectionId: 1,
        cells: [
          { value: '30 días calendario', isExcluded: false, isWinner: false },
          { value: '15 días', isExcluded: false, isWinner: false },
        ],
      },
      {
        type: 'data',
        id: 'r2',
        label: 'Inspección Previa y Garantías',
        sectionId: 1,
        cells: [
          { value: 'Inspección virtual requerida', isExcluded: false, isWinner: false },
          { value: 'Exenta con póliza previa', isExcluded: false, isWinner: false },
        ],
      },
    ];

    const mockReport: Partial<ComparisonReport> = {
      quotes: [
        { insurerName: 'Seguros SURA', paymentTerms: '10 cuotas mensuales sin interés' } as unknown as QuoteAnalysis,
        { insurerName: 'AXA Colpatria', paymentTerms: 'Contado 5% descuento' } as unknown as QuoteAnalysis,
      ],
      matrix: mockMatrix,
    };

    const extracted = extractCommercialConditionsFromReport(mockReport);

    expect(extracted['Seguros SURA']).toBeDefined();
    expect(extracted['Seguros SURA'].validezOferta).toBe('30 días calendario');
    expect(extracted['Seguros SURA'].inspeccionPrevia).toBe('Inspección virtual requerida');
    expect(extracted['Seguros SURA'].formaPago).toBe('10 cuotas mensuales sin interés');

    expect(extracted['AXA Colpatria']).toBeDefined();
    expect(extracted['AXA Colpatria'].validezOferta).toBe('15 días');
    expect(extracted['AXA Colpatria'].inspeccionPrevia).toBe('Exenta con póliza previa');
    expect(extracted['AXA Colpatria'].formaPago).toBe('Contado 5% descuento');
  });

  it('applies edited commercial conditions to the report matrix and updates commercialConditions object', () => {
    const mockReport: Partial<ComparisonReport> = {
      quotes: [
        { insurerName: 'Seguros Bolívar' } as unknown as QuoteAnalysis,
      ],
      matrix: [],
    };

    const updated = applyCommercialConditionsToReport(mockReport, {
      'Seguros Bolívar': {
        validezOferta: '45 días calendario',
        formaPago: 'Financiación Davivienda 12 cuotas',
        inspeccionPrevia: 'Informe técnico previo',
        requisitosEmision: 'SARLAFT + RUT',
        otrasCondiciones: 'Cláusula de no revocación a 1 año',
      },
    });

    expect(updated.commercialConditions?.['Seguros Bolívar'].validezOferta).toBe('45 días calendario');
    expect(updated.matrix).toHaveLength(5);

    const validezRow = updated.matrix!.find((r) => r.label === 'Validez de la Oferta');
    expect(validezRow).toBeDefined();
    expect(validezRow!.cells[0].value).toBe('45 días calendario');
    expect((validezRow as any).section).toBe('CONDICIONES COMERCIALES');
  });

  it('generates PDF with commercial conditions table without throwing', () => {
    // jsPDF in node/happy-dom environment
    const quotes = [
      {
        id: 'q1',
        insurerName: 'Seguros SURA',
        policyName: 'Pyme Global',
        priceAnnual: 12000000,
        priceMonthly: 1000000,
        currency: 'COP',
        deductibles: '10% mín 2 SMMLV',
        coverages: [{ name: 'Incendio', value: '100.000.000', deductible: '10%' }],
      } as unknown as QuoteAnalysis,
      {
        id: 'q2',
        insurerName: 'AXA Colpatria',
        policyName: 'Integral Pyme',
        priceAnnual: 11500000,
        priceMonthly: 980000,
        currency: 'COP',
        deductibles: '10% mín 3 SMMLV',
        coverages: [{ name: 'Incendio', value: '100.000.000', deductible: '10%' }],
      } as unknown as QuoteAnalysis,
    ];

    const report: ComparisonReport = {
      quotes,
      recommendation: 'Recomendamos SURA por mejores garantías',
      marketAnalysis: 'Mercado competitivo',
      deductibleComparison: [],
      matrix: [
        {
          type: 'data',
          id: 'val',
          label: 'Validez de la Oferta',
          sectionId: 1,
          cells: [
            { value: '30 días', isExcluded: false, isWinner: false },
            { value: '15 días', isExcluded: false, isWinner: false },
          ],
        },
      ],
      commercialConditions: {
        'Seguros SURA': { validezOferta: '30 días', formaPago: '10 cuotas' },
        'AXA Colpatria': { validezOferta: '15 días', formaPago: '6 cuotas' },
      },
    };

    expect(() => {
      generatePDF(report, {
        customTitle: 'Comparativa de Condiciones Comerciales',
        primaryColor: [79, 70, 229],
      });
    }).not.toThrow();
  });
});
