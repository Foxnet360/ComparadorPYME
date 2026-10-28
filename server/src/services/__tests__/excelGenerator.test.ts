import { describe, it, expect, vi } from 'vitest';
import * as ExcelJS from 'exceljs';
import { generateExcelBuffer, formatRatioCell } from '../excelGenerator';
import * as matrixTransformer from '../matrixTransformer';
import { QuoteAnalysis, MatrixRow } from '../../types';

describe('excelGenerator', () => {
  describe('formatRatioCell', () => {
    it('should parse string percentage and return numeric value with percent format', () => {
      const result = formatRatioCell('0,68%');
      expect(result.value).toBeCloseTo(0.0068, 6);
      expect(result.numFmt).toBe('0.00%');
    });

    it('should parse string percentage with dot decimal separator', () => {
      const result = formatRatioCell('1.25%');
      expect(result.value).toBe(0.0125);
      expect(result.numFmt).toBe('0.00%');
    });

    it('should return value as-is when input is a number (non-string)', () => {
      const result = formatRatioCell(0.0068);
      expect(result.value).toBe(0.0068);
      expect(result.numFmt).toBeUndefined();
    });

    it('should return value as-is when input is null', () => {
      const result = formatRatioCell(null);
      expect(result.value).toBeNull();
      expect(result.numFmt).toBeUndefined();
    });

    it('should return value as-is when input is undefined', () => {
      const result = formatRatioCell(undefined);
      expect(result.value).toBeUndefined();
      expect(result.numFmt).toBeUndefined();
    });

    it('should return original string when it cannot be parsed as percentage', () => {
      const result = formatRatioCell('N/A');
      expect(result.value).toBe('N/A');
      expect(result.numFmt).toBeUndefined();
    });

    it('should not throw when input is an object', () => {
      const obj = { value: '0,68%' };
      expect(() => formatRatioCell(obj)).not.toThrow();
      const result = formatRatioCell(obj);
      expect(result.value).toBe(obj);
      expect(result.numFmt).toBeUndefined();
    });
  });

  describe('generateExcelBuffer', () => {
    const mockQuotes: QuoteAnalysis[] = [
      {
        insurerName: 'MAPFRE',
        policyName: 'TODO RIESGO PYME',
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
        technicalAnalysis: '',
        score: 82,
        alerts: [],
        coverages: [
          {
            name: 'Incendio (Edificio y Contenidos)',
            value: '$119.600.000',
            deductible: '10% PERD - Min 1 SMMLV',
            categoryId: 1,
            matchConfidence: 0.95,
          },
          // Exclusive coverage with raw numeric value
          {
            name: 'Cobertura Adicional MAPFRE',
            value: '50000000',
            deductible: 'No aplica',
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
        technicalAnalysis: '',
        score: 72,
        alerts: [],
        coverages: [
          {
            name: 'Incendio (Edificio y Contenidos)',
            value: '$45.000.000',
            deductible: '5% siniestro - Min 1 SMMLV',
            categoryId: 1,
            matchConfidence: 0.95,
          },
        ],
      },
    ];

    it('should generate a valid Excel buffer without throwing', async () => {
      const buffer = await generateExcelBuffer(mockQuotes);
      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);
    });

    it('should generate a workbook with eight worksheets including Cuadro Comparativo Resumido, Respaldo Normativo y Legal and Políticas Comerciales', async () => {
      const buffer = await generateExcelBuffer(mockQuotes);
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer);

      expect(workbook.worksheets.length).toBe(8);
      expect(workbook.worksheets.map((w) => w.name)).toEqual([
        'Portada y Resumen General',
        'Cuadro Comparativo Resumido',
        'Matriz Coberturas',
        'Matriz Deducibles',
        'Primas y Costos',
        'Análisis de Riesgos',
        'Respaldo Normativo y Legal',
        'Políticas Comerciales',
      ]);
    });

    it('should format ratio cells as percentages in Primas y Costos sheet', async () => {
      const buffer = await generateExcelBuffer(mockQuotes);
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer);

      const primasSheet = workbook.getWorksheet('Primas y Costos');
      expect(primasSheet).toBeDefined();

      // Find the ratio row by scanning for the label in column A
      let ratioCell: ExcelJS.Cell | undefined;
      primasSheet!.eachRow((row) => {
        const cellA = row.getCell(1);
        if (cellA.value === '% SOBRE VALOR ASEGURADO') {
          ratioCell = row.getCell(2); // First insurer column
        }
      });

      expect(ratioCell).toBeDefined();
      const val = ratioCell!.value;
      if (typeof val === 'object' && val !== null && 'formula' in val) {
        expect((val as any).formula).toContain('/119600000');
      } else {
        expect(val as number).toBeGreaterThan(0);
        expect(ratioCell!.numFmt).toBe('0.00%');
      }
    });

    it('should include notes column when cellNotes are provided', async () => {
      const notes: Record<string, string> = {
        'coverage-section_1_row_value': 'Nota de prueba para Incendio',
      };
      const buffer = await generateExcelBuffer(mockQuotes, undefined, notes);
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer);

      const coveragesSheet = workbook.getWorksheet('Matriz Coberturas');
      expect(coveragesSheet).toBeDefined();

      // With notes, there should be an extra column
      const headerRow = coveragesSheet!.getRow(4);
      const notesHeader = headerRow.getCell(mockQuotes.length + 2);
      expect(notesHeader.value).toBe('INSIGHTS DEL CONSULTOR');
    });

    it('should handle cellNotes being empty', async () => {
      const buffer = await generateExcelBuffer(mockQuotes, undefined, {});
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer);

      const coveragesSheet = workbook.getWorksheet('Matriz Coberturas');
      expect(coveragesSheet).toBeDefined();

      // Without notes, there should be no extra column
      const headerRow = coveragesSheet!.getRow(4);
      const notesHeader = headerRow.getCell(mockQuotes.length + 2);
      expect(notesHeader.value).not.toBe('INSIGHTS DEL CONSULTOR');
    });

    it('should format raw numeric exclusive coverage values as COP', async () => {
      const buffer = await generateExcelBuffer(mockQuotes);
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer);

      const coveragesSheet = workbook.getWorksheet('Matriz Coberturas');
      expect(coveragesSheet).toBeDefined();

      let exclusiveCell: ExcelJS.Cell | undefined;
      coveragesSheet!.eachRow((row) => {
        const cellA = row.getCell(1);
        if (cellA.value === 'Cobertura Adicional MAPFRE') {
          exclusiveCell = row.getCell(2); // First insurer column
        }
      });

      expect(exclusiveCell).toBeDefined();
      expect(exclusiveCell!.value).toBe(50000000);
      expect(exclusiveCell!.numFmt).toBe('$#,##0');
    });

    it('should preserve non-numeric exclusive coverage values', async () => {
      const quotesWithTextExclusive: QuoteAnalysis[] = [
        {
          insurerName: 'MAPFRE',
          policyName: 'TODO RIESGO PYME',
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
          technicalAnalysis: '',
          score: 82,
          alerts: [],
          coverages: [
            {
              name: 'Incendio (Edificio y Contenidos)',
              value: '$119.600.000',
              deductible: '10% PERD - Min 1 SMMLV',
              categoryId: 1,
              matchConfidence: 0.95,
            },
            {
              name: 'Servicio VIP Exclusivo',
              value: 'Incluido',
              deductible: 'No aplica',
              categoryId: null,
              matchConfidence: 0.3,
            },
          ],
        },
      ];

      const buffer = await generateExcelBuffer(quotesWithTextExclusive);
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer);

      const coveragesSheet = workbook.getWorksheet('Matriz Coberturas');
      expect(coveragesSheet).toBeDefined();

      let exclusiveCell: ExcelJS.Cell | undefined;
      coveragesSheet!.eachRow((row) => {
        const cellA = row.getCell(1);
        if (cellA.value === 'Servicio VIP Exclusivo') {
          exclusiveCell = row.getCell(2);
        }
      });

      expect(exclusiveCell).toBeDefined();
      expect(exclusiveCell!.value).toBe('Incluido');
    });
  });

  describe('section grouping and confidence export', () => {
    const mockQuotesWithConfidence: QuoteAnalysis[] = [
      {
        insurerName: 'MAPFRE',
        policyName: 'TODO RIESGO PYME',
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
        technicalAnalysis: '',
        score: 82,
        alerts: [],
        coverages: [
          {
            name: 'Incendio (Edificio y Contenidos)',
            value: '$119.600.000',
            deductible: '10% PERD - Min 1 SMMLV',
            categoryId: 1,
            matchConfidence: 0.95,
          },
        ],
      },
    ];

    it('should preserve section headers in the coverages sheet', async () => {
      const buffer = await generateExcelBuffer(mockQuotesWithConfidence);
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer);

      const coveragesSheet = workbook.getWorksheet('Matriz Coberturas');
      expect(coveragesSheet).toBeDefined();

      let foundHeader = false;
      coveragesSheet!.eachRow((row) => {
        const cellA = row.getCell(1);
        const val = String(cellA.value || '');
        if (
          val.includes('AMPARO BÁSICO') ||
          val.includes('BIENES ASEGURADOS') ||
          val.includes('DAÑOS MATERIALES')
        ) {
          foundHeader = true;
        }
      });

      expect(foundHeader).toBe(true);
    });

    it('should include cell confidence as a cell note when available', async () => {
      const buffer = await generateExcelBuffer(mockQuotesWithConfidence);
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer);

      const coveragesSheet = workbook.getWorksheet('Matriz Coberturas');
      expect(coveragesSheet).toBeDefined();

      let confidenceCell: ExcelJS.Cell | undefined;
      coveragesSheet!.eachRow((row) => {
        const cellA = row.getCell(1);
        const val = String(cellA.value || '');
        if ((val === 'Valor Asegurado' || val.includes('Incendio')) && !confidenceCell) {
          confidenceCell = row.getCell(2); // First insurer column
        }
      });

      expect(confidenceCell).toBeDefined();
      expect(confidenceCell!.note).toBeDefined();
      expect(typeof confidenceCell!.note).toBe('string');
      expect(confidenceCell!.note).toContain('Confianza');
      expect(confidenceCell!.note).toContain('95');
    });
  });

  describe('financial rows from granular matrix', () => {
    const mockQuotes: QuoteAnalysis[] = [
      {
        insurerName: 'MAPFRE',
        policyName: 'TODO RIESGO PYME',
        priceMonthly: 0,
        priceAnnual: 5000000,
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
        technicalAnalysis: '',
        score: 82,
        alerts: [],
        coverages: [],
      },
      {
        insurerName: 'CHUBB',
        policyName: 'Pymes',
        priceMonthly: 0,
        priceAnnual: 6000000,
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
        technicalAnalysis: '',
        score: 72,
        alerts: [],
        coverages: [],
      },
    ];

    it('should place financial rows with sectionId >= 100 into Primas y Costos sheet', async () => {
      const spy = vi.spyOn(matrixTransformer, 'transformQuotesToMatrix').mockReturnValue([
        {
          type: 'header',
          id: 'financials',
          label: 'PRIMAS Y COSTOS',
          sectionId: 999,
          cells: [
            { value: '', isExcluded: false, isWinner: false },
            { value: '', isExcluded: false, isWinner: false },
          ],
        },
        {
          type: 'data',
          id: 'premium_total',
          label: 'TOTAL A PAGAR',
          sectionId: 999,
          cells: [
            { value: '$ 5.000.000', isExcluded: false, isWinner: false },
            { value: '$ 6.000.000', isExcluded: false, isWinner: false },
          ],
        },
      ]);

      try {
        const buffer = await generateExcelBuffer(mockQuotes);
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(buffer);

        const primasSheet = workbook.getWorksheet('Primas y Costos');
        expect(primasSheet).toBeDefined();

        let foundPremiumRow = false;
        primasSheet!.eachRow((row) => {
          const cellA = row.getCell(1);
          if (cellA.value === 'TOTAL A PAGAR') {
            foundPremiumRow = true;
          }
        });

        expect(foundPremiumRow).toBe(true);
      } finally {
        spy.mockRestore();
      }
    });

    it('should preserve sublimit and conditional text in coverage cells instead of stripping to raw numbers', async () => {
      const customMatrix = [
        {
          type: 'data' as const,
          id: 'sublimit_cov_row',
          label: 'Gastos de Extinción (Sublímite)',
          sectionId: 1,
          cells: [
            { value: '$50.000.000 (Sublímite 10%)', isExcluded: false, isWinner: false },
            { value: '$40.000.000 - Ver cláusula 3', isExcluded: false, isWinner: false },
          ],
        },
      ];

      const buffer = await generateExcelBuffer(mockQuotes, undefined, undefined, undefined, 'pyme', {
        matrix: customMatrix,
      });
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer);

      const coveragesSheet = workbook.getWorksheet('Matriz Coberturas');
      expect(coveragesSheet).toBeDefined();

      let cellValueA: any;
      let cellValueB: any;
      coveragesSheet!.eachRow((row) => {
        const cellLabel = row.getCell(1).value;
        if (cellLabel === 'Gastos de Extinción (Sublímite)') {
          cellValueA = row.getCell(2).value;
          cellValueB = row.getCell(3).value;
        }
      });

      expect(cellValueA).toContain('Sublímite 10%');
      expect(cellValueB).toContain('Ver cláusula 3');
    });

    it('should route deductible rows to Matriz Deducibles sheet using sectionId and semantic detection', async () => {
      const customMatrix = [
        {
          type: 'data' as const,
          id: 'deductible_section_row',
          label: 'Deducible Terremoto',
          sectionId: 50,
          cells: [
            { value: '10% de la pérdida mín 5 SMMLV', isExcluded: false, isWinner: false },
            { value: '5% del valor aseg mín 3 SMMLV', isExcluded: false, isWinner: false },
          ],
        },
      ];

      const buffer = await generateExcelBuffer(mockQuotes, undefined, undefined, undefined, 'pyme', {
        matrix: customMatrix,
      });
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer);

      const dedSheet = workbook.getWorksheet('Matriz Deducibles');
      expect(dedSheet).toBeDefined();

      let foundDeductible = false;
      dedSheet!.eachRow((row) => {
        if (row.getCell(1).value === 'Deducible Terremoto') {
          foundDeductible = true;
          expect(String(row.getCell(2).value)).toContain('10%');
        }
      });
      expect(foundDeductible).toBe(true);
    });

    it('aligns matrix cells to match quotes order in Excel output when reportData.matrix has inverted column order', async () => {
      // mockQuotes has [MAPFRE, CHUBB]
      // Inverted matrix has [CHUBB, MAPFRE]
      const invertedMatrix: MatrixRow[] = [
        {
          type: 'header',
          id: 'client_info',
          label: 'Cotizaciones PYME - CHUBB, MAPFRE',
          sectionId: 0,
          cells: [],
        },
        {
          type: 'data',
          id: 'cov_incendio',
          label: 'Incendio y Terremoto',
          sectionId: 1,
          cells: [
            { value: '$ 200.000.000', isExcluded: false, isWinner: false }, // CHUBB is col 0 in raw matrix
            { value: '$ 100.000.000', isExcluded: false, isWinner: false }, // MAPFRE is col 1 in raw matrix
          ],
        },
      ];

      const buffer = await generateExcelBuffer(mockQuotes, undefined, undefined, undefined, 'pyme', {
        matrix: invertedMatrix,
      });

      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer);

      const covSheet = workbook.getWorksheet('Matriz Coberturas');
      expect(covSheet).toBeDefined();

      // Column B header is quotes[0] = MAPFRE
      expect(covSheet!.getCell(4, 2).value).toBe('MAPFRE');
      // Column C header is quotes[1] = CHUBB
      expect(covSheet!.getCell(4, 3).value).toBe('CHUBB');

      // Row 5 should have Incendio y Terremoto
      const row5 = covSheet!.getRow(5);
      expect(row5.getCell(1).value).toBe('Incendio y Terremoto');
      // Column B (MAPFRE) MUST have 100M (MAPFRE's value), NOT 200M (CHUBB's value)!
      expect(row5.getCell(2).value).toBe(100000000);
      // Column C (CHUBB) MUST have 200M (CHUBB's value)!
      expect(row5.getCell(3).value).toBe(200000000);
    });

    it('prunes orphaned section headers, includes cell notes, and avoids double-charging 19% IVA on V2 matrix totals', async () => {
      const v2Matrix = [
        {
          type: 'header' as const,
          id: 'client_info',
          label: 'Cotizaciones PYME - MAPFRE, CHUBB',
          sectionId: 0,
          cells: [],
        },
        {
          type: 'header' as const,
          id: 'section_cov',
          label: 'COBERTURAS PRINCIPALES',
          sectionId: 1,
          cells: [],
        },
        {
          type: 'data' as const,
          id: 'cov_1',
          label: 'Incendio y Rayo',
          sectionId: 1,
          cells: [
            {
              value: '$ 100.000.000',
              notes: '10% de la pérdida mín 1 SMMLV',
              isExcluded: false,
              isWinner: true,
            },
            {
              value: '$ 80.000.000',
              notes: '5% del valor asegurado mín 2 SMMLV con condiciones extendidas de reposición',
              isExcluded: false,
              isWinner: false,
            },
          ],
        },
        {
          type: 'header' as const,
          id: 'section_orphan',
          label: 'SECCIÓN HUÉRFANA SIN DATOS',
          sectionId: 1,
          cells: [],
        },
        {
          type: 'header' as const,
          id: 'section_fin',
          label: 'PRIMAS Y COSTOS',
          sectionId: 100,
          cells: [],
        },
        {
          type: 'data' as const,
          id: 'fin_total',
          label: 'TOTAL A PAGAR',
          sectionId: 100,
          cells: [
            { value: '$ 5.000.000', isExcluded: false, isWinner: true },
            { value: '$ 6.000.000', isExcluded: false, isWinner: false },
          ],
        },
      ];

      const buffer = await generateExcelBuffer(mockQuotes, undefined, undefined, undefined, 'pyme', {
        matrix: v2Matrix,
      });

      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer);

      const covSheet = workbook.getWorksheet('Matriz Coberturas')!;
      const labelsInCovSheet: string[] = [];
      let covDataRow: ExcelJS.Row | undefined;
      covSheet.eachRow((row) => {
        const val = String(row.getCell(1).value || '');
        labelsInCovSheet.push(val);
        if (val === 'Incendio y Rayo') {
          covDataRow = row;
        }
      });

      // Orphaned section header must be pruned
      expect(labelsInCovSheet).toContain('COBERTURAS PRINCIPALES');
      expect(labelsInCovSheet).not.toContain('SECCIÓN HUÉRFANA SIN DATOS');

      // Finding 4: Cell notes must not corrupt or concatenate into cell values (remains numeric)
      expect(covDataRow).toBeDefined();
      expect(covDataRow!.getCell(2).value).toBe(100000000);
      expect(String(covDataRow!.getCell(2).note)).toContain('10% de la pérdida mín 1 SMMLV');

      // Primas y Costos should match the V2 TOTAL A PAGAR (5,000,000 and 6,000,000) without adding another 19% IVA
      const finSheet = workbook.getWorksheet('Primas y Costos')!;
      let totalRowCellB: any;
      let totalRowCellC: any;
      finSheet.eachRow((row) => {
        if (row.getCell(1).value === 'TOTAL A PAGAR') {
          totalRowCellB = row.getCell(2).value;
          totalRowCellC = row.getCell(3).value;
        }
      });

      expect(totalRowCellB?.result).toBe(5_000_000);
      expect(totalRowCellC?.result).toBe(6_000_000);
    });
  });
});
