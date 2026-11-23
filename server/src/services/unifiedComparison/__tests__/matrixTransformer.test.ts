/**
 * Matrix Transformer Tests
 * Pure function tests for FlatComparisonResult → MatrixRow[] and
 * ParsedQuote[] → MatrixRow[] transformations.
 */

import { describe, it, expect } from 'vitest';
import {
  flatResultToMatrixRows,
  flatResultToMatrixRowsV2,
  quotesToMatrixRows,
  alignInsurerIndices,
  parseNumericValue,
  FINANCIAL_SECTION_ID,
  DEDUCTIBLE_SECTION_ID,
  isFinancialSection,
  getSectionId,
  isFinancialRowLabel,
} from '../matrixTransformer';
import { FlatComparisonResult, FlatComparisonResultV2, SchemaSection } from '../comparisonSchema';
import { ParsedQuote } from '../../quoteParser';

function makeFlatResult(overrides: Partial<FlatComparisonResult> = {}): FlatComparisonResult {
  return {
    schemaVersion: 1,
    metadata: {
      generatedAt: '2026-07-01T00:00:00Z',
      model: 'gemini-3.5-flash',
      pdfCount: 2,
      processingTimeMs: 1200,
      confidence: 0.92,
      needsHumanReview: false,
    },
    insurers: ['MAPFRE', 'CHUBB'],
    rows: [
      {
        label: 'Bienes Asegurados',
        cells: [
          { insurer: 'MAPFRE', value: 'Edificio $500M' },
          { insurer: 'CHUBB', value: 'Edificio y contenidos $600M' },
        ],
      },
      {
        label: 'Deducibles',
        cells: [
          { insurer: 'MAPFRE', value: '10%' },
          { insurer: 'CHUBB', value: '5%', rawText: 'ded 5%' },
        ],
      },
      {
        label: 'Prima con IVA',
        cells: [
          { insurer: 'MAPFRE', value: '$ 8.500.000' },
          { insurer: 'CHUBB', value: '$ 9.200.000' },
        ],
      },
      {
        label: 'Forma de Pago',
        cells: [
          { insurer: 'MAPFRE', value: 'Anual' },
          { insurer: 'CHUBB', value: 'Mensual', notFound: false },
        ],
      },
    ],
    extraRows: [],
    warnings: [],
    ...overrides,
  };
}

function makeFlatResultV2(overrides: Partial<FlatComparisonResultV2> = {}): FlatComparisonResultV2 {
  return {
    metadata: {
      generatedAt: '2026-07-01T00:00:00Z',
      model: 'gemini-3.5-flash',
      pdfCount: 2,
      processingTimeMs: 1200,
      confidence: 0.92,
      needsHumanReview: false,
    },
    insurers: ['MAPFRE', 'CHUBB'],
    schemaVersion: 2,
    rows: [
      {
        label: 'Edificio',
        section: SchemaSection.BIENES_ASEGURADOS,
        cells: [
          { insurer: 'MAPFRE', value: '$500M', rawText: '$500M', confidence: 0.92 },
          { insurer: 'CHUBB', value: '$600M', rawText: '$600M', confidence: 0.9 },
        ],
      },
      {
        label: 'Contenidos',
        section: SchemaSection.BIENES_ASEGURADOS,
        cells: [
          { insurer: 'MAPFRE', value: '$200M', rawText: '$200M', confidence: 0.88 },
          { insurer: 'CHUBB', value: '$250M', rawText: '$250M', confidence: 0.85 },
        ],
      },
      {
        label: 'Prima con IVA',
        section: SchemaSection.INFORMACION_GENERAL,
        cells: [
          { insurer: 'MAPFRE', value: '$8.5M', rawText: '$8.5M', confidence: 0.95 },
          { insurer: 'CHUBB', value: '$9.2M', rawText: '$9.2M', confidence: 0.94 },
        ],
      },
    ],
    extraRows: [],
    warnings: [],
    ...overrides,
  };
}

function makeParsedQuote(overrides: Partial<ParsedQuote> = {}): ParsedQuote {
  return {
    insurerName: 'BBVA',
    policyName: 'PYME',
    priceAnnual: 8_500_000,
    currency: 'COP',
    coverages: [
      {
        name: 'Incendio (Edificio y Contenidos)',
        canonicalName: 'Incendio (Edificio y Contenidos)',
        value: '500M',
        deductible: '10%',
        confidence: 95,
      },
      {
        name: 'Responsabilidad Civil (RCE)',
        canonicalName: 'Responsabilidad Civil (RCE)',
        value: '100M',
        deductible: '5 SMMLV',
        confidence: 90,
      },
    ],
    specialConditions: ['Cláusula de ajuste'],
    rawText: '',
    parseConfidence: 92,
    ...overrides,
  };
}

describe('flatResultToMatrixRows', () => {
  it('creates a header row with insurer names', () => {
    const result = makeFlatResult();
    const matrix = flatResultToMatrixRows(result);

    const header = matrix[0];
    expect(header.type).toBe('header');
    expect(header.id).toBe('client_info');
    expect(header.label).toContain('MAPFRE');
    expect(header.label).toContain('CHUBB');
  });

  it('emits one data row per requested flat row', () => {
    const result = makeFlatResult();
    const matrix = flatResultToMatrixRows(result);

    const dataRows = matrix.filter((r) => r.type === 'data' && r.id.startsWith('section_0_row_'));
    expect(dataRows).toHaveLength(4);
    expect(dataRows.map((r) => r.label)).toEqual([
      'Bienes Asegurados',
      'Deducibles',
      'Prima con IVA',
      'Forma de Pago',
    ]);
  });

  it('marks cells with notFound or null value as excluded', () => {
    const result = makeFlatResult({
      rows: [
        {
          label: 'Bienes Asegurados',
          cells: [
            { insurer: 'MAPFRE', value: 'Edificio $500M' },
            { insurer: 'CHUBB', value: null, notFound: true },
          ],
        },
      ],
    });
    const matrix = flatResultToMatrixRows(result);

    const row = matrix.find((r) => r.type === 'data' && r.label === 'Bienes Asegurados')!;
    expect(row.cells[0].isExcluded).toBe(false);
    expect(row.cells[1].isExcluded).toBe(true);
    expect(row.cells[1].value).toBe('No informado');
  });

  it('places extra rows after the core rows', () => {
    const result = makeFlatResult({
      extraRows: [
        {
          label: 'Asistencia',
          cells: [
            { insurer: 'MAPFRE', value: 'Incluida' },
            { insurer: 'CHUBB', value: 'No incluida' },
          ],
        },
      ],
    });
    const matrix = flatResultToMatrixRows(result);

    const extra = matrix.find((r) => r.type === 'data' && r.id.startsWith('section_0_extra_'));
    expect(extra).toBeDefined();
    expect(extra?.label).toBe('Asistencia');
  });

  it('maps Prima con IVA to premium_total row', () => {
    const result = makeFlatResult();
    const matrix = flatResultToMatrixRows(result);

    const premium = matrix.find((r) => r.id === 'premium_total');
    expect(premium).toBeDefined();
    expect(premium?.label).toBe('TOTAL A PAGAR');
    expect(premium?.cells[0].value).toBe('$ 8.500.000');
    expect(premium?.cells[1].value).toBe('$ 9.200.000');
  });

  it('maps Forma de Pago to meta_payment row', () => {
    const result = makeFlatResult();
    const matrix = flatResultToMatrixRows(result);

    const payment = matrix.find((r) => r.id === 'meta_payment');
    expect(payment).toBeDefined();
    expect(payment?.label).toBe('Forma de Pago');
    expect(payment?.cells.map((c) => c.value)).toEqual(['Anual', 'Mensual']);
  });

  it('renders warnings as alert rows', () => {
    const result = makeFlatResult({ warnings: ['Falta deducible CHUBB'] });
    const matrix = flatResultToMatrixRows(result);

    const warningHeader = matrix.find((r) => r.id === 'warnings');
    const warningRow = matrix.find((r) => r.id === 'warning_0');
    expect(warningHeader).toBeDefined();
    expect(warningRow).toBeDefined();
    expect(warningRow?.label).toBe('Falta deducible CHUBB');
  });
});

describe('flatResultToMatrixRowsV2', () => {
  it('creates a header row with insurer names', () => {
    const result = makeFlatResultV2();
    const matrix = flatResultToMatrixRowsV2(result);

    const header = matrix[0];
    expect(header.type).toBe('header');
    expect(header.id).toBe('client_info');
    expect(header.label).toContain('MAPFRE');
    expect(header.label).toContain('CHUBB');
  });

  it('emits a section header row for each distinct section', () => {
    const result = makeFlatResultV2();
    const matrix = flatResultToMatrixRowsV2(result);

    const sectionHeaders = matrix.filter((r) => r.type === 'header' && r.id.startsWith('section_'));
    expect(sectionHeaders).toHaveLength(2);
    expect(sectionHeaders.map((r) => r.label)).toContain('BIENES ASEGURADOS');
    expect(sectionHeaders.map((r) => r.label)).toContain('PRIMAS Y COSTOS');
  });

  it('places data rows directly under their section header', () => {
    const result = makeFlatResultV2();
    const matrix = flatResultToMatrixRowsV2(result);

    const bienesHeaderIndex = matrix.findIndex(
      (r) => r.type === 'header' && r.label === 'BIENES ASEGURADOS'
    );
    expect(bienesHeaderIndex).toBeGreaterThan(-1);
    expect(matrix[bienesHeaderIndex + 1].label).toBe('Edificio');
    expect(matrix[bienesHeaderIndex + 2].label).toBe('Contenidos');
  });

  it('preserves cell confidence on data rows', () => {
    const result = makeFlatResultV2();
    const matrix = flatResultToMatrixRowsV2(result);

    const edificioRow = matrix.find((r) => r.label === 'Edificio')!;
    expect(edificioRow.cells[0].confidence).toBe(0.92);
    expect(edificioRow.cells[1].confidence).toBe(0.9);
  });

  it('places financial extra rows in the financial section', () => {
    const result = makeFlatResultV2({
      extraRows: [
        {
          label: 'IVA',
          cells: [
            { insurer: 'MAPFRE', value: '$850.000', confidence: 0.95 },
            { insurer: 'CHUBB', value: '$920.000', confidence: 0.94 },
          ],
        },
      ],
    });
    const matrix = flatResultToMatrixRowsV2(result);

    const financialSectionHeader = matrix.find(
      (r) => r.type === 'header' && r.sectionId === FINANCIAL_SECTION_ID
    );
    expect(financialSectionHeader).toBeDefined();
    expect(financialSectionHeader!.label).toBe('PRIMAS Y COSTOS');

    const extraRow = matrix.find((r) => r.type === 'data' && r.label === 'IVA');
    expect(extraRow).toBeDefined();
    expect(extraRow!.sectionId).toBe(FINANCIAL_SECTION_ID);
  });

  it('places non-financial extra rows in a dedicated OTROS section', () => {
    const result = makeFlatResultV2({
      extraRows: [
        {
          label: 'Asistencia',
          cells: [
            { insurer: 'MAPFRE', value: 'Incluida', confidence: 0.7 },
            { insurer: 'CHUBB', value: 'No incluida', confidence: 0.6 },
          ],
        },
      ],
    });
    const matrix = flatResultToMatrixRowsV2(result);

    const otrosSectionHeader = matrix.find((r) => r.type === 'header' && r.label === 'OTROS');
    expect(otrosSectionHeader).toBeDefined();
    expect(otrosSectionHeader!.sectionId).toBe(1);

    const extraRow = matrix.find((r) => r.type === 'data' && r.label === 'Asistencia');
    expect(extraRow).toBeDefined();
    expect(extraRow!.sectionId).toBe(1);
  });

  it('tags v2 financial rows with FINANCIAL_SECTION_ID', () => {
    const result = makeFlatResultV2({
      rows: [
        {
          label: 'Prima con IVA',
          section: SchemaSection.INFORMACION_GENERAL,
          cells: [
            { insurer: 'MAPFRE', value: '$8.5M', rawText: '$8.5M', confidence: 0.95 },
            { insurer: 'CHUBB', value: '$9.2M', rawText: '$9.2M', confidence: 0.94 },
          ],
        },
        {
          label: 'Forma de Pago',
          section: SchemaSection.INFORMACION_GENERAL,
          cells: [
            { insurer: 'MAPFRE', value: 'Anual', rawText: 'Anual', confidence: 0.9 },
            { insurer: 'CHUBB', value: 'Mensual', rawText: 'Mensual', confidence: 0.9 },
          ],
        },
      ],
    });
    const matrix = flatResultToMatrixRowsV2(result);

    const financialHeader = matrix.find(
      (r) => r.type === 'header' && r.sectionId === FINANCIAL_SECTION_ID
    );
    expect(financialHeader).toBeDefined();
    expect(financialHeader!.label).toBe('PRIMAS Y COSTOS');

    const premiumRow = matrix.find((r) => r.type === 'data' && r.label === 'Prima con IVA');
    expect(premiumRow).toBeDefined();
    expect(premiumRow!.sectionId).toBe(FINANCIAL_SECTION_ID);

    const paymentRow = matrix.find((r) => r.type === 'data' && r.label === 'Forma de Pago');
    expect(paymentRow).toBeDefined();
    expect(paymentRow!.sectionId).toBe(FINANCIAL_SECTION_ID);
  });

  it('carries deductible rawText as notes on v2 matrix cells', () => {
    const result = makeFlatResultV2({
      rows: [
        {
          label: 'Edificio',
          section: SchemaSection.DEDUCIBLES,
          cells: [
            {
              insurer: 'MAPFRE',
              value: '10%',
              rawText: '10% PERD - Min 1 SMMLV',
              confidence: 0.92,
            },
            { insurer: 'CHUBB', value: '5%', rawText: '5% siniestro', confidence: 0.9 },
          ],
        },
      ],
    });
    const matrix = flatResultToMatrixRowsV2(result);

    const row = matrix.find((r) => r.label === 'Edificio')!;
    expect(row.cells[0].notes).toBe('10% PERD - Min 1 SMMLV');
    expect(row.cells[1].notes).toBe('5% siniestro');
  });

  it('defaults v2 cell confidence to 0 when missing', () => {
    const result = makeFlatResultV2({
      rows: [
        {
          label: 'Edificio',
          section: SchemaSection.BIENES_ASEGURADOS,
          cells: [
            { insurer: 'MAPFRE', value: '$500M', rawText: '$500M' },
            { insurer: 'CHUBB', value: '$600M', rawText: '$600M', confidence: 0.9 },
          ],
        },
      ],
    });
    const matrix = flatResultToMatrixRowsV2(result);

    const row = matrix.find((r) => r.label === 'Edificio')!;
    expect(row.cells[0].confidence).toBe(0);
    expect(row.cells[1].confidence).toBe(0.9);
  });

  it('preserves empty rawText as notes on v2 matrix cells', () => {
    const result = makeFlatResultV2({
      rows: [
        {
          label: 'Edificio',
          section: SchemaSection.DEDUCIBLES,
          cells: [
            { insurer: 'MAPFRE', value: '10%', rawText: '', confidence: 0.92 },
            { insurer: 'CHUBB', value: '5%', confidence: 0.9 },
          ],
        },
      ],
    });
    const matrix = flatResultToMatrixRowsV2(result);

    const row = matrix.find((r) => r.label === 'Edificio')!;
    expect(row.cells[0].notes).toBe('');
    expect(row.cells[1].notes).toBeUndefined();
  });

  it('verifies FINANCIAL_SECTION_ID is aligned with frontend expectation (100)', () => {
    expect(FINANCIAL_SECTION_ID).toBe(100);
  });

  it('sorts v2 rows by canonicalId within each section while keeping raw labels visible', () => {
    const result = makeFlatResultV2({
      rows: [
        {
          label: 'Terremoto BBVA wording',
          section: SchemaSection.COBERTURAS,
          canonicalId: 'terremoto',
          canonicalSource: 'graph',
          cells: [{ insurer: 'BBVA', value: 'Incluido', confidence: 0.9 }],
        },
        {
          label: 'RCE BBVA wording',
          section: SchemaSection.COBERTURAS,
          canonicalId: 'rce',
          canonicalSource: 'graph',
          cells: [{ insurer: 'BBVA', value: '$1M', confidence: 0.88 }],
        },
        {
          label: 'Amparo básico BBVA wording',
          section: SchemaSection.COBERTURAS,
          canonicalId: 'amparo-basico-todo-riesgo',
          canonicalSource: 'graph',
          cells: [{ insurer: 'BBVA', value: '$100M', confidence: 0.92 }],
        },
      ],
    });

    const matrix = flatResultToMatrixRowsV2(result);
    const sectionRows = matrix.filter((r) => r.type === 'data' && r.sectionId === 1);
    const labels = sectionRows.map((r) => r.label);
    expect(labels).toEqual([
      'Amparo básico BBVA wording',
      'Terremoto BBVA wording',
      'RCE BBVA wording',
    ]);
  });
});

describe('quotesToMatrixRows', () => {
  it('creates a header row with insurer names from parsed quotes', () => {
    const quotes = [
      makeParsedQuote({ insurerName: 'BBVA' }),
      makeParsedQuote({ insurerName: 'AXA' }),
    ];
    const matrix = quotesToMatrixRows(quotes);

    expect(matrix[0].label).toContain('BBVA');
    expect(matrix[0].label).toContain('AXA');
  });

  it('emits one data row per unique canonical coverage', () => {
    const quotes = [
      makeParsedQuote({ insurerName: 'BBVA' }),
      makeParsedQuote({
        insurerName: 'AXA',
        coverages: [
          {
            name: 'Responsabilidad Civil (RCE)',
            canonicalName: 'Responsabilidad Civil (RCE)',
            value: '150M',
            deductible: '3 SMMLV',
            confidence: 88,
          },
          {
            name: 'Terremoto y Eventos Catastróficos',
            canonicalName: 'Terremoto y Eventos Catastróficos',
            value: '200M',
            deductible: '20%',
            confidence: 85,
          },
        ],
      }),
    ];
    const matrix = quotesToMatrixRows(quotes);

    const dataRows = matrix.filter((r) => r.type === 'data' && r.id.startsWith('section_0_row_'));
    expect(dataRows).toHaveLength(3);
    expect(dataRows.map((r) => r.label)).toEqual([
      'Incendio (Edificio y Contenidos)',
      'Responsabilidad Civil (RCE)',
      'Terremoto y Eventos Catastróficos',
    ]);
  });

  it('marks missing coverage values as excluded', () => {
    const quotes = [
      makeParsedQuote({
        insurerName: 'BBVA',
        coverages: [
          {
            name: 'Incendio (Edificio y Contenidos)',
            canonicalName: 'Incendio (Edificio y Contenidos)',
            value: 'NO ESPECIFICADO',
            deductible: 'No aplica',
            confidence: 0,
          },
        ],
      }),
    ];
    const matrix = quotesToMatrixRows(quotes);

    const row = matrix.find((r) => r.label === 'Incendio (Edificio y Contenidos)')!;
    expect(row.cells[0].isExcluded).toBe(true);
    expect(row.cells[0].value).toBe('NO ESPECIFICADO');
  });

  it('maps priceAnnual to premium_total row', () => {
    const quotes = [makeParsedQuote({ priceAnnual: 9_200_000 })];
    const matrix = quotesToMatrixRows(quotes);

    const premium = matrix.find((r) => r.id === 'premium_total')!;
    expect(premium.cells[0].value).toBe('$9.200.000');
    expect(premium.cells[0].isExcluded).toBe(false);
  });

  it('renders special conditions as warning rows', () => {
    const quotes = [
      makeParsedQuote({ specialConditions: ['Condición especial A', 'Condición especial B'] }),
    ];
    const matrix = quotesToMatrixRows(quotes);

    const warnings = matrix.filter((r) => r.id.startsWith('warning_'));
    expect(warnings).toHaveLength(2);
    expect(warnings.map((r) => r.label)).toEqual(['Condición especial A', 'Condición especial B']);
  });

  it('renders FICHA TÉCNICA DE COLECTIVO / FLOTA rows when collectiveDetails are present', () => {
    const quotes = [
      makeParsedQuote({
        insurerName: 'SURA',
        priceAnnual: 18_000_000,
        collectiveDetails: {
          isCollective: true,
          modality: 'VIDA_GRUPO',
          insuredCount: 120,
          totalInsuredCumulus: 12_000_000_000,
          ratePerMil: '1.25 ‰ mensual',
          freeCoverLimit: 250_000_000,
          entryAgeLimit: '18 a 65 años',
          permanenceAgeLimit: '75 años',
          profitSharing: '20% sobre saldo positivo de siniestralidad < 45%',
        },
      }),
      makeParsedQuote({
        insurerName: 'ALLIANZ',
        priceAnnual: 19_500_000,
        collectiveDetails: {
          isCollective: true,
          modality: 'VIDA_GRUPO',
          insuredCount: 120,
          totalInsuredCumulus: 12_000_000_000,
          ratePerMil: '1.35 ‰ mensual',
          freeCoverLimit: 180_000_000,
          entryAgeLimit: '18 a 64 años',
          permanenceAgeLimit: '70 años',
          profitSharing: '15% anual',
        },
      }),
    ];

    const matrix = quotesToMatrixRows(quotes, 'vida_grupo');
    const header = matrix.find((r) => r.id === 'collective_details');
    expect(header).toBeDefined();
    expect(header?.label).toBe('FICHA TÉCNICA DE COLECTIVO / FLOTA');

    const countRow = matrix.find((r) => r.id === 'collective_insured_count')!;
    expect(countRow.label).toBe('N° de Vidas Aseguradas');
    expect(countRow.cells.map((c) => c.value)).toEqual(['120', '120']);

    const freeCoverRow = matrix.find((r) => r.id === 'collective_free_cover')!;
    expect(freeCoverRow.cells.map((c) => c.value)).toEqual(['$250.000.000', '$180.000.000']);

    const rateRow = matrix.find((r) => r.id === 'collective_rate_per_mil')!;
    expect(rateRow.cells.map((c) => c.value)).toEqual(['1.25 ‰ mensual', '1.35 ‰ mensual']);

    const ivaRow = matrix.find((r) => r.id === 'premium_iva')!;
    expect(ivaRow.label).toBe('IVA (0% Exento Art. 427 E.T.)');
    expect(ivaRow.cells.map((c) => c.value)).toEqual(['$ 0', '$ 0']);
  });

  it('applies 5% PVS IVA label and divisor for salud domain and vehicle count label for autos fleet', () => {
    const saludQuotes = [
      makeParsedQuote({
        insurerName: 'SURA SALUD',
        priceAnnual: 1_050_000,
        collectiveDetails: {
          isCollective: true,
          modality: 'SALUD_COLECTIVA',
          insuredCount: 45,
          continuityAndPreexisting:
            'Reconoce antigüedad y elimina carencias para grupos > 30 vidas',
        },
      }),
    ];
    const saludMatrix = quotesToMatrixRows(saludQuotes, 'salud');
    const saludIva = saludMatrix.find((r) => r.id === 'premium_iva')!;
    const saludNet = saludMatrix.find((r) => r.id === 'premium_net')!;
    expect(saludIva.label).toBe('IVA (5% Tarifa Especial PVS Art. 468-3 E.T.)');
    expect(saludNet.cells[0].value).toBe('$1.000.000');
    expect(saludIva.cells[0].value).toBe('$50.000');

    const autosFleetQuotes = [
      makeParsedQuote({
        insurerName: 'BOLÍVAR FLOTAS',
        priceAnnual: 45_000_000,
        collectiveDetails: {
          isCollective: true,
          modality: 'FLOTA_EMPRESARIAL',
          insuredCount: 18,
          totalInsuredCumulus: 1_450_000_000,
          categoryBreakdownSummary: '12 Livianos (tasa 2.8%), 6 Utilitarios (tasa 3.4%)',
        },
      }),
    ];
    const autosMatrix = quotesToMatrixRows(autosFleetQuotes, 'autos');
    const vehicleCountRow = autosMatrix.find((r) => r.id === 'collective_insured_count')!;
    expect(vehicleCountRow.label).toBe('N° de Vehículos Asegurados');
    expect(vehicleCountRow.cells[0].value).toBe('18');
  });

  it('renders percentageOfContract, coverageValidity, and FICHA TÉCNICA DE LICITACIÓN / CONTRATO Y SUSCRIPCIÓN for cumplimiento', () => {
    const cumplimientoQuotes = [
      makeParsedQuote({
        insurerName: 'SEGUROS DEL ESTADO',
        priceAnnual: 4_800_000,
        coverages: [
          {
            name: 'Cumplimiento de Contrato',
            canonicalName: 'Cumplimiento de Contrato',
            value: '200000000',
            deductible: 'Sin deducible (Ley 80)',
            percentageOfContract: '20%',
            coverageValidity: '2026-02-01 a 2027-08-01 (Ejecución + 6 meses liquidación)',
            confidence: 95,
          },
          {
            name: 'Salarios, Prestaciones e Indemnizaciones Laborales',
            canonicalName: 'Salarios, Prestaciones e Indemnizaciones Laborales',
            value: '50000000',
            deductible: 'Sin deducible (Ley 80)',
            percentageOfContract: '5%',
            coverageValidity: '2026-02-01 a 2030-02-01 (Ejecución + 3 años)',
            confidence: 95,
          },
        ],
        cumplimientoDetails: {
          contractStage: 'CONTRACTUAL_EJECUCION (Minuta del Contrato)',
          legalRegime: 'ESTATAL_LEY_80 (Decreto 1082/2015)',
          processOrContractNumber: 'LP-INVIAS-042-2026 / CTO-118-2026',
          afianzadoName: 'Consorcio Vial Andino (60% Ing. SAS / 40% Vías Ltda.)',
          beneficiaryName: 'INVIAS - NIT 800.215.807-2',
          contractOrBudgetValue: 1_000_000_000,
          contractDuration: '12 meses de ejecución + 6 meses liquidación',
          counterGuarantee: 'Pagaré en blanco con carta de instrucciones (Cupo aprobado)',
          appliedRateSummary: 'Cumplimiento 0.22%, Salarios 0.18%, RCE 0.35%',
          rceDerivativeSummary: '200 SMMLV · Modalidad Ocurrencia · Incluye Patronal y Cruzada',
        },
      }),
    ];

    const matrix = quotesToMatrixRows(cumplimientoQuotes, 'cumplimiento');

    const cumpRow = matrix.find((r) => r.label === 'Cumplimiento de Contrato')!;
    expect(cumpRow.cells[0].value).toBe('$200.000.000 (20%)');
    expect(cumpRow.cells[0].notes).toContain('Vigencia: 2026-02-01 a 2027-08-01');

    const header = matrix.find((r) => r.id === 'cumplimiento_details');
    expect(header).toBeDefined();
    expect(header?.label).toBe('FICHA TÉCNICA DE LICITACIÓN / CONTRATO Y SUSCRIPCIÓN');

    const stageRow = matrix.find((r) => r.id === 'cumplimiento_stage')!;
    expect(stageRow.cells[0].value).toContain('CONTRACTUAL_EJECUCION');

    const regimeRow = matrix.find((r) => r.id === 'cumplimiento_regime')!;
    expect(regimeRow.cells[0].value).toContain('ESTATAL_LEY_80');

    const valueRow = matrix.find((r) => r.id === 'cumplimiento_contract_value')!;
    expect(valueRow.cells[0].value).toBe('$1.000.000.000');

    const guaranteeRow = matrix.find((r) => r.id === 'cumplimiento_counter_guarantee')!;
    expect(guaranteeRow.cells[0].value).toContain('Pagaré en blanco');
  });
});

describe('alignInsurerIndices & parseNumericValue', () => {
  it('assigns unclaimed matrix column positionally when a quote filename is generic/unmapped', () => {
    const quoteInsurers = ['cotizacion 1', 'BOLÍVAR', 'ALLIANZ'];
    const matrixInsurers = ['HDI', 'BOLÍVAR', 'ALLIANZ'];

    expect(alignInsurerIndices(quoteInsurers, matrixInsurers)).toEqual([0, 1, 2]);
  });

  it('assigns remaining unclaimed column when column order is inverted and one filename is generic', () => {
    const quoteInsurers = ['documento generico', 'MAPFRE', 'SURA'];
    const matrixInsurers = ['SURA', 'HDI', 'MAPFRE'];

    // MAPFRE -> 2, SURA -> 0, remaining unclaimed is 1 (HDI)
    expect(alignInsurerIndices(quoteInsurers, matrixInsurers)).toEqual([1, 2, 0]);
  });

  it('parses Colombian decimal currency strings without multiplying by 100', () => {
    expect(parseNumericValue('$ 15.000.000,00')).toBe(15_000_000);
    expect(parseNumericValue('$ 3.962.567,50')).toBe(3_962_568);
    expect(parseNumericValue('$ 119.600.000')).toBe(119_600_000);
  });
});

describe('Section and financial label classification for Copropiedades and multi-domain', () => {
  it('correctly identifies FINANCIAL sections and sectionIds', () => {
    expect(isFinancialSection('FINANCIAL')).toBe(true);
    expect(isFinancialSection('financial')).toBe(true);
    expect(isFinancialSection('Primas y Costos')).toBe(true);
    expect(isFinancialSection('Liquidación')).toBe(true);
    expect(isFinancialSection('RESUMEN DE PRIMAS')).toBe(true);
    expect(getSectionId('FINANCIAL')).toBe(FINANCIAL_SECTION_ID);
    expect(getSectionId('Primas y Costos')).toBe(FINANCIAL_SECTION_ID);
    expect(getSectionId('Liquidación de la Póliza')).toBe(FINANCIAL_SECTION_ID);
    expect(getSectionId('DEDUCIBLES')).toBe(DEDUCTIBLE_SECTION_ID);
  });

  it('correctly classifies Copropiedades premium labels as financial rows', () => {
    expect(isFinancialRowLabel('Prima Bienes Comunes')).toBe(true);
    expect(isFinancialRowLabel('Prima Neta Edificio y Áreas Comunes')).toBe(true);
    expect(isFinancialRowLabel('Total a Pagar / Prima Total Anual')).toBe(true);
    expect(isFinancialRowLabel('Total Póliza Bienes Comunes')).toBe(true);
    expect(isFinancialRowLabel('Valor a Pagar')).toBe(true);
    expect(isFinancialRowLabel('Gastos de Expedición')).toBe(true);
    expect(isFinancialRowLabel('IVA (19%)')).toBe(true);

    // Non-financial coverage/asset rows should remain non-financial
    expect(isFinancialRowLabel('Edificio y Áreas Comunes')).toBe(false);
    expect(isFinancialRowLabel('Maquinaria y Equipos Comunitarios')).toBe(false);
    expect(isFinancialRowLabel('Suma Asegurada Edificio')).toBe(false);
    expect(isFinancialRowLabel('Terremoto, Temblor y Sismo')).toBe(false);
  });
});
