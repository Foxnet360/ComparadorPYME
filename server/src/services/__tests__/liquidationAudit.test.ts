import { describe, it, expect } from 'vitest';
import { generateExcelBuffer } from '../excelGenerator';
import { transformQuotesToMatrix } from '../matrixTransformer';
import { QuoteAnalysis } from '../../types';

describe('Auditoría Integral de Liquidación Financiera PYME (AXA, CHUBB, SBS, SURA)', () => {
  const mockQuotes: QuoteAnalysis[] = [
    {
      insurerName: 'AXA COLPATRIA',
      policyName: 'Póliza PYME Integral',
      priceMonthly: 0,
      priceAnnual: 9579500,
      currency: 'COP',
      deductibles: '10% mínimo 3 SMMLV',
      expenses: 50000,
      fees: 50000,
      financialBreakdown: {
        netPremium: 8000000,
        expenses: 50000,
        subtotal: 8050000,
        iva: 1529500,
        totalPayable: 9579500,
        currency: 'COP',
      },
      coverages: [
        { name: 'Incendio y Terremoto', value: '$ 500.000.000', deductible: '10%' },
        { name: 'RCE Predios', value: '$ 200.000.000', deductible: 'Sin deducible' },
      ],
      alerts: [],
      scoringBreakdown: { coverage: 85, deductibles: 80, exclusions: 90, priceRatio: 85, sublimits: 80, warranties: 85 },
      clientAnalysis: 'Propuesta completa',
      technicalAnalysis: 'Cumple requisitos',
      score: 85,
    },
    {
      insurerName: 'CHUBB SEGUROS',
      policyName: 'Póliza PYME Máster',
      priceMonthly: 0,
      priceAnnual: 4500000,
      currency: 'COP',
      deductibles: '10% mínimo 2 SMMLV',
      financialBreakdown: {
        netPremium: 3781513,
        expenses: 0,
        subtotal: 3781513,
        iva: 718487,
        totalPayable: 4500000,
        currency: 'COP',
      },
      coverages: [
        { name: 'Incendio y Terremoto', value: '$ 450.000.000', deductible: '10%' },
      ],
      alerts: [],
      scoringBreakdown: { coverage: 80, deductibles: 85, exclusions: 85, priceRatio: 90, sublimits: 85, warranties: 80 },
      clientAnalysis: 'Precio competitivo',
      technicalAnalysis: 'Recomendada',
      score: 87,
    },
    {
      insurerName: 'SBS SEGUROS',
      policyName: 'PYME Protegida',
      priceMonthly: 0,
      priceAnnual: 7140000,
      currency: 'COP',
      deductibles: '10% mínimo 3 SMMLV',
      financialBreakdown: {
        netPremium: 6000000,
        expenses: 0,
        subtotal: 6000000,
        iva: 1140000,
        totalPayable: 7140000,
        currency: 'COP',
      },
      coverages: [
        { name: 'Incendio y Terremoto', value: '$ 500.000.000', deductible: '10%' },
      ],
      alerts: [],
      scoringBreakdown: { coverage: 75, deductibles: 75, exclusions: 80, priceRatio: 78, sublimits: 75, warranties: 75 },
      clientAnalysis: 'Opción balanceada',
      technicalAnalysis: 'Estándar',
      score: 78,
    },
    {
      insurerName: 'SEGUROS SURA',
      policyName: 'Solución PYME Multirriesgo',
      priceMonthly: 0,
      priceAnnual: 8603700,
      currency: 'COP',
      deductibles: '5% mínimo 2 SMMLV',
      expenses: 30000,
      fees: 30000,
      financialBreakdown: {
        netPremium: 7200000,
        expenses: 30000,
        subtotal: 7230000,
        iva: 1373700,
        totalPayable: 8603700,
        currency: 'COP',
      },
      coverages: [
        { name: 'Incendio y Terremoto', value: '$ 600.000.000', deductible: '5%' },
      ],
      alerts: [],
      scoringBreakdown: { coverage: 90, deductibles: 90, exclusions: 90, priceRatio: 82, sublimits: 88, warranties: 85 },
      clientAnalysis: 'Mayor cobertura',
      technicalAnalysis: 'Excelente alcance',
      score: 89,
    },
  ];

  it('debe generar la matriz Web sin duplicar IVA y sin valores hardcodeados de Mapfre/Chubb', () => {
    const matrix = transformQuotesToMatrix(mockQuotes);

    const netRow = matrix.find((r) => r.id === 'financial_net_premium');
    const expRow = matrix.find((r) => r.id === 'financial_expenses');
    const subRow = matrix.find((r) => r.id === 'financial_subtotal');
    const ivaRow = matrix.find((r) => r.id === 'financial_iva');
    const totRow = matrix.find((r) => r.id === 'financial_total');

    expect(netRow).toBeDefined();
    expect(expRow).toBeDefined();
    expect(subRow).toBeDefined();
    expect(ivaRow).toBeDefined();
    expect(totRow).toBeDefined();

    // AXA
    expect(netRow?.cells[0].value).toBe('$8.000.000');
    expect(expRow?.cells[0].value).toBe('$50.000');
    expect(subRow?.cells[0].value).toBe('$8.050.000');
    expect(ivaRow?.cells[0].value).toBe('$1.529.500');
    expect(totRow?.cells[0].value).toBe('$9.579.500');

    // CHUBB: No debe tener $12.000 hardcodeados
    expect(netRow?.cells[1].value).toBe('$3.781.513');
    expect(expRow?.cells[1].value).toBe('No informado');
    expect(subRow?.cells[1].value).toBe('$3.781.513');
    expect(ivaRow?.cells[1].value).toBe('$718.487');
    expect(totRow?.cells[1].value).toBe('$4.500.000');

    // SBS
    expect(netRow?.cells[2].value).toBe('$6.000.000');
    expect(expRow?.cells[2].value).toBe('No informado');
    expect(subRow?.cells[2].value).toBe('$6.000.000');
    expect(ivaRow?.cells[2].value).toBe('$1.140.000');
    expect(totRow?.cells[2].value).toBe('$7.140.000');

    // SURA
    expect(netRow?.cells[3].value).toBe('$7.200.000');
    expect(expRow?.cells[3].value).toBe('$30.000');
    expect(subRow?.cells[3].value).toBe('$7.230.000');
    expect(ivaRow?.cells[3].value).toBe('$1.373.700');
    expect(totRow?.cells[3].value).toBe('$8.603.700');
  });

  it('debe generar el Excel para 4 aseguradoras sin errores y con buffer válido', async () => {
    const matrix = transformQuotesToMatrix(mockQuotes);
    const excelBuffer = await generateExcelBuffer(
      mockQuotes,
      'EMPRESA AUDITADA SAS',
      'pyme',
      { matrix } as any
    );

    expect(excelBuffer).toBeDefined();
    expect(excelBuffer.length).toBeGreaterThan(1000);
  });
});
