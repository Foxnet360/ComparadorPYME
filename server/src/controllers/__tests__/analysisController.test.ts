import { describe, it, expect, vi } from 'vitest';
import { matrixRowsToComparisonReport, resolveAnalysisUserId } from '../analysisController';
import { FINANCIAL_SECTION_ID, isFinancialRowLabel } from '../../services/unifiedComparison/matrixTransformer';
import { semanticMatcher } from '../../services/semanticMatcher';
import { MatrixRow } from '../../types';
import { AuthenticatedRequest } from '../../middleware/auth';

vi.mock('../../services/semanticMatcher', () => ({
  semanticMatcher: {
    matchCoverage: vi.fn(async (coverageName) => {
      if (coverageName === 'Incendio Edificio') {
        return {
          categoryId: 1,
          canonicalName: 'Incendio (Edificio y Contenidos)',
          confidence: 0.92,
          method: 'thesaurus',
        };
      }
      if (coverageName === 'Prima con IVA') {
        return {
          categoryId: 99,
          canonicalName: 'Prima con IVA',
          confidence: 0.95,
          method: 'fuzzy',
        };
      }
      if (coverageName === 'Valor Asegurado') {
        return {
          categoryId: 1,
          canonicalName: 'Valor Asegurado',
          confidence: 0.88,
          method: 'fuzzy',
        };
      }
      if (coverageName === 'Bienes bajo tierra') {
        return {
          categoryId: 6,
          canonicalName: 'Bienes bajo tierra',
          confidence: 0.9,
          method: 'thesaurus',
        };
      }
      return {
        categoryId: null,
        canonicalName: coverageName,
        confidence: 0,
        method: null,
      };
    }),
  },
}));

describe('analysisController - matrixRowsToComparisonReport', () => {
  it('preserves confidence and section from v2 MatrixRow cells', async () => {
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

    const report = await matrixRowsToComparisonReport(matrixRows, quoteFiles);

    const primaCoverage = report.quotes[0].coverages.find((c) => c.name === 'Prima con IVA');
    expect(primaCoverage).toBeDefined();
    expect(primaCoverage!.confidence).toBe(0.95);
    expect(primaCoverage!.section).toBe('INFORMACIÓN GENERAL');
  });

  it('falls back to default section when no preceding header exists', async () => {
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

    const report = await matrixRowsToComparisonReport(matrixRows, quoteFiles);

    const coverage = report.quotes[0].coverages.find((c) => c.name === 'Valor Asegurado');
    expect(coverage).toBeDefined();
    expect(coverage!.section).toBeUndefined();
  });

  it('aligns matrix cells to quote files by insurer name when column order differs', async () => {
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
        sectionId: FINANCIAL_SECTION_ID,
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

    const report = await matrixRowsToComparisonReport(matrixRows, quoteFiles);

    const mapfre = report.quotes.find((q) => q.insurerName === 'MAPFRE');
    const chubb = report.quotes.find((q) => q.insurerName === 'CHUBB');

    expect(mapfre).toBeDefined();
    expect(chubb).toBeDefined();
    expect(mapfre!.priceAnnual).toBe(5_000_000);
    expect(chubb!.priceAnnual).toBe(6_000_000);
  });

  it('maps cell notes to coverage deductible', async () => {
    const matrixRows: MatrixRow[] = [
      {
        type: 'header',
        id: 'section_0',
        label: 'DEDUCIBLES',
        sectionId: 1,
        cells: [{ value: '', isExcluded: false, isWinner: false }],
      },
      {
        type: 'data',
        id: 'section_0_row_0',
        label: 'Incendio Edificio',
        sectionId: 1,
        cells: [
          {
            value: '10%',
            isExcluded: false,
            isWinner: false,
            notes: '10% PERD - Min 1 SMMLV',
            confidence: 0.92,
          },
        ],
      },
    ];

    const quoteFiles = [{ originalname: 'COTIZACION-MAPFRE.pdf' }] as Express.Multer.File[];

    const report = await matrixRowsToComparisonReport(matrixRows, quoteFiles);

    const coverage = report.quotes[0].coverages.find((c) => c.name === 'Incendio Edificio');
    expect(coverage).toBeDefined();
    expect(coverage!.deductible).toBe('10% PERD - Min 1 SMMLV');
  });

  it('correctly parses complex Colombian premium decimal and thousand formats', async () => {
    const matrixRows: MatrixRow[] = [
      {
        type: 'header',
        id: 'client_info',
        label: 'Cotizaciones PYME - MAPFRE',
        sectionId: 0,
        cells: [],
      },
      {
        type: 'data',
        id: 'premium_total',
        label: 'TOTAL A PAGAR',
        sectionId: FINANCIAL_SECTION_ID,
        cells: [{ value: '$1.134.400,50', isExcluded: false, isWinner: false, confidence: 0.95 }],
      },
    ];

    const quoteFiles = [{ originalname: 'COTIZACION-MAPFRE.pdf' }] as Express.Multer.File[];

    const report = await matrixRowsToComparisonReport(matrixRows, quoteFiles);
    expect(report.quotes[0].priceAnnual).toBe(1134400.5);
  });

  it('gracefully handles unparseable premiums and does not corrupt default value', async () => {
    const matrixRows: MatrixRow[] = [
      {
        type: 'header',
        id: 'client_info',
        label: 'Cotizaciones PYME - MAPFRE',
        sectionId: 0,
        cells: [],
      },
      {
        type: 'data',
        id: 'premium_total',
        label: 'TOTAL A PAGAR',
        sectionId: 1,
        cells: [{ value: 'No informado', isExcluded: false, isWinner: false, confidence: 0.95 }],
      },
    ];

    const quoteFiles = [{ originalname: 'COTIZACION-MAPFRE.pdf' }] as Express.Multer.File[];

    const report = await matrixRowsToComparisonReport(matrixRows, quoteFiles);
    expect(report.quotes[0].priceAnnual).toBe(0); // maintains original/default value
  });

  it('disambiguates insured sum (Valor Total Asegurado) from policy premium (Valor a pagar)', async () => {
    const matrixRows: MatrixRow[] = [
      {
        type: 'header',
        id: 'financial_header',
        label: 'PRIMAS Y COSTOS',
        sectionId: FINANCIAL_SECTION_ID,
        cells: [],
      },
      {
        type: 'data',
        id: 'asset_total_row',
        label: 'VALOR TOTAL ASEGURADO',
        sectionId: FINANCIAL_SECTION_ID,
        cells: [{ value: '$ 2.629.400.000', isExcluded: false, isWinner: false }],
      },
      {
        type: 'data',
        id: 'premium_row',
        label: 'VALOR A PAGAR',
        sectionId: FINANCIAL_SECTION_ID,
        cells: [{ value: '$ 4.333.254', isExcluded: false, isWinner: false }],
      },
    ];

    const quoteFiles = [{ originalname: 'COTIZACION-MAPFRE.pdf' }] as Express.Multer.File[];
    const report = await matrixRowsToComparisonReport(matrixRows, quoteFiles, { domain: 'hogar' });

    expect(report.quotes[0].priceAnnual).toBe(4333254);
  });

  it('rejects sum insured values exceeding Hogar sanity threshold (> 100M COP)', async () => {
    const matrixRows: MatrixRow[] = [
      {
        type: 'header',
        id: 'financial_header',
        label: 'PRIMAS Y COSTOS',
        sectionId: FINANCIAL_SECTION_ID,
        cells: [],
      },
      {
        type: 'data',
        id: 'fallback_row',
        label: 'Prima Total',
        sectionId: FINANCIAL_SECTION_ID,
        cells: [{ value: '$ 2.509.400.000', isExcluded: false, isWinner: false }],
      },
    ];

    const quoteFiles = [{ originalname: 'COTIZACION-ALLIANZ.pdf' }] as Express.Multer.File[];
    const report = await matrixRowsToComparisonReport(matrixRows, quoteFiles, { domain: 'hogar' });

    // Exceeds 100M COP in residential Hogar; must not be assigned as annual premium
    expect(report.quotes[0].priceAnnual).toBe(0);
  });

  it('isFinancialRowLabel excludes property and coverage labels containing total', () => {
    expect(isFinancialRowLabel('VALOR TOTAL ASEGURADO')).toBe(false);
    expect(isFinancialRowLabel('SUMA ASEGURADA TOTAL')).toBe(false);
    expect(isFinancialRowLabel('Edificio')).toBe(false);
    expect(isFinancialRowLabel('Contenidos')).toBe(false);
    expect(isFinancialRowLabel('Pérdida Total')).toBe(false);

    expect(isFinancialRowLabel('Total')).toBe(true);
    expect(isFinancialRowLabel('TOTAL A PAGAR')).toBe(true);
    expect(isFinancialRowLabel('Valor a pagar')).toBe(true);
    expect(isFinancialRowLabel('Prima total')).toBe(true);
    expect(isFinancialRowLabel('Prima con IVA')).toBe(true);
    expect(isFinancialRowLabel('Gastos de expedición')).toBe(true);
  });

  it('correctly maps raw rows using ontology mapping and excludes unmapped billing rows', async () => {
    const matrixRows: MatrixRow[] = [
      {
        type: 'header',
        id: 'section_0',
        label: 'INFORMACIÓN GENERAL',
        sectionId: 1,
        cells: [],
      },
      {
        type: 'data',
        id: 'row_bienes',
        label: 'Bienes bajo tierra',
        sectionId: 1,
        cells: [{ value: 'Amparado', isExcluded: false, isWinner: false, confidence: 0.9 }],
      },
      {
        type: 'data',
        id: 'row_prima',
        label: 'PRIMA ANUAL NETO',
        sectionId: 1,
        cells: [{ value: '$ 1.200.000', isExcluded: false, isWinner: false, confidence: 0.9 }],
      },
    ];

    const quoteFiles = [{ originalname: 'COTIZACION-MAPFRE.pdf' }] as Express.Multer.File[];

    const report = await matrixRowsToComparisonReport(matrixRows, quoteFiles);

    // Bienes bajo tierra should be mapped
    const bienesCoverage = report.quotes[0].coverages.find((c) => c.name === 'Bienes bajo tierra');
    expect(bienesCoverage).toBeDefined();
    expect(bienesCoverage!.categoryId).toBeDefined();
    expect(bienesCoverage!.canonicalName).toBeDefined();

    // PRIMA ANUAL NETO should be ignored (not dumped as a coverage advantages row)
    const primaRow = report.quotes[0].coverages.find((c) => c.name === 'PRIMA ANUAL NETO');
    expect(primaRow).toBeUndefined();
  });

  it('surfaces graph canonical names while preserving raw labels when graphEnabled is true', async () => {
    const matrixRows = [
      {
        type: 'header',
        id: 'section_0',
        label: 'COBERTURAS',
        sectionId: 1,
        cells: [],
      },
      {
        type: 'data',
        id: 'row_incendio',
        label: 'Incendio Edificio',
        sectionId: 1,
        canonicalName: 'Incendio (Edificio y Contenidos)',
        matchConfidence: 0.93,
        matchMethod: 'graph',
        cells: [
          {
            value: 'Amparado',
            isExcluded: false,
            isWinner: false,
            notes: '10% min 1 SMMLV',
            confidence: 0.92,
          },
        ],
      },
    ] as unknown as MatrixRow[];

    const report = await matrixRowsToComparisonReport(
      matrixRows,
      [{ originalname: 'COTIZACION-MAPFRE.pdf' }] as Express.Multer.File[],
      { graphEnabled: true }
    );

    const coverage = report.quotes[0].coverages[0];
    expect(coverage).toBeDefined();
    expect(coverage.name).toBe('Incendio Edificio');
    expect(coverage.canonicalName).toBe('Incendio (Edificio y Contenidos)');
    expect(coverage.matchConfidence).toBe(0.93);
    expect(coverage.matchMethod).toBe('graph');
  });

  it('propagates the resolved domain to semanticMatcher.matchCoverage', async () => {
    const matrixRows: MatrixRow[] = [
      {
        type: 'data',
        id: 'domain_row',
        label: 'Domain Test Coverage',
        sectionId: 1,
        cells: [{ value: 'Incluido', isExcluded: false, isWinner: false, confidence: 0.8 }],
      },
    ];
    const quoteFiles = [{ originalname: 'COTIZACION-MAPFRE.pdf' }] as Express.Multer.File[];

    await matrixRowsToComparisonReport(matrixRows, quoteFiles);
    expect(semanticMatcher.matchCoverage).toHaveBeenCalledWith('Domain Test Coverage', 'pyme');

    vi.mocked(semanticMatcher.matchCoverage).mockClear();
    await matrixRowsToComparisonReport(matrixRows, quoteFiles, { domain: 'autos' });
    expect(semanticMatcher.matchCoverage).toHaveBeenCalledWith('Domain Test Coverage', 'autos');
  });
});

describe('analysisController - resolveAnalysisUserId', () => {
  it('returns anonymous for unauthenticated requests', () => {
    const req = { user: undefined, body: {} } as AuthenticatedRequest;

    expect(resolveAnalysisUserId(req)).toBe('anonymous');
  });

  it('returns the authenticated user id when present', () => {
    const req = { user: { id: 'auth-user-123' }, body: {} } as AuthenticatedRequest;

    expect(resolveAnalysisUserId(req)).toBe('auth-user-123');
  });

  it('ignores body userId on the optional-auth /api/analyze endpoint', () => {
    const req = { user: undefined, body: { userId: 'body-user-123' } } as AuthenticatedRequest;

    expect(resolveAnalysisUserId(req)).toBe('anonymous');
  });
});
