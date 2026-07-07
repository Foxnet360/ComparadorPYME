import { describe, it, expect } from 'vitest';
import { matrixRowsToComparisonReport } from '../analysisController';
import { MatrixRow } from '../../../types';

describe('analysisController - matrixRowsToComparisonReport', () => {
  it('preserves confidence and section from v2 MatrixRow cells', () => {
    const matrixRows: MatrixRow[] = [
      {
        type: 'header',
        id: 'section_0',
        label: 'INFORMACIÓN GENERAL',
        sectionId: 1,
        cells: [
          { value: '', isExcluded: false, isWinner: false },
          { value: '', isExcluded: false, isWinner: false },
        ],
      },
      {
        type: 'data',
        id: 'section_0_row_0',
        label: 'Prima con IVA',
        sectionId: 1,
        cells: [
          { value: '$ 5.000.000', isExcluded: false, isWinner: false, confidence: 0.95 },
          { value: '$ 6.000.000', isExcluded: false, isWinner: false, confidence: 0.75 },
        ],
      },
    ];

    const quoteFiles = [
      { originalname: 'COTIZACION-MAPFRE.pdf' },
      { originalname: 'COTIZACION-CHUBB.pdf' },
    ] as Express.Multer.File[];

    const report = matrixRowsToComparisonReport(matrixRows, quoteFiles);

    const primaCoverage = report.quotes[0].coverages.find((c) => c.name === 'Prima con IVA');
    expect(primaCoverage).toBeDefined();
    expect(primaCoverage!.confidence).toBe(0.95);
    expect(primaCoverage!.section).toBe('INFORMACIÓN GENERAL');
  });

  it('falls back to default section when no preceding header exists', () => {
    const matrixRows: MatrixRow[] = [
      {
        type: 'data',
        id: 'orphan_row',
        label: 'Valor Asegurado',
        sectionId: 1,
        cells: [{ value: '$ 100.000.000', isExcluded: false, isWinner: false, confidence: 0.88 }],
      },
    ];

    const quoteFiles = [{ originalname: 'COTIZACION-MAPFRE.pdf' }] as Express.Multer.File[];

    const report = matrixRowsToComparisonReport(matrixRows, quoteFiles);

    const coverage = report.quotes[0].coverages.find((c) => c.name === 'Valor Asegurado');
    expect(coverage).toBeDefined();
    expect(coverage!.section).toBeUndefined();
  });

  it('aligns matrix cells to quote files by insurer name when column order differs', () => {
    const matrixRows: MatrixRow[] = [
      {
        type: 'header',
        id: 'client_info',
        label: 'Cotizaciones PYME - CHUBB, MAPFRE',
        sectionId: 0,
        cells: [],
      },
      {
        type: 'header',
        id: 'section_0',
        label: 'INFORMACIÓN GENERAL',
        sectionId: 1,
        cells: [],
      },
      {
        type: 'data',
        id: 'premium_total',
        label: 'TOTAL A PAGAR',
        sectionId: 1,
        cells: [
          { value: '$ 6.000.000', isExcluded: false, isWinner: false, confidence: 0.75 },
          { value: '$ 5.000.000', isExcluded: false, isWinner: false, confidence: 0.95 },
        ],
      },
    ];

    const quoteFiles = [
      { originalname: 'COTIZACION-MAPFRE.pdf' },
      { originalname: 'COTIZACION-CHUBB.pdf' },
    ] as Express.Multer.File[];

    const report = matrixRowsToComparisonReport(matrixRows, quoteFiles);

    const mapfre = report.quotes.find(q => q.insurerName === 'MAPFRE');
    const chubb = report.quotes.find(q => q.insurerName === 'CHUBB');

    expect(mapfre).toBeDefined();
    expect(chubb).toBeDefined();
    expect(mapfre!.priceAnnual).toBe(5_000_000);
    expect(chubb!.priceAnnual).toBe(6_000_000);
  });
});
