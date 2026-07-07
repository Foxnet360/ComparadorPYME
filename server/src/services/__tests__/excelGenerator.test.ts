import { describe, it, expect } from 'vitest';
import * as ExcelJS from 'exceljs';
import { generateExcelBuffer, formatRatioCell } from '../excelGenerator';
import { QuoteAnalysis } from '../../types';

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

    it('should generate a workbook with three worksheets', async () => {
      const buffer = await generateExcelBuffer(mockQuotes);
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer);

      expect(workbook.worksheets.length).toBe(3);
      expect(workbook.worksheets.map((w) => w.name)).toEqual([
        'Portada',
        'Coberturas y Deducibles',
        'Primas y Costos',
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
      expect(ratioCell!.value).toBeGreaterThan(0);
      expect(ratioCell!.numFmt).toBe('0.00%');
    });

    it('should include notes column when cellNotes are provided', async () => {
      const notes: Record<string, string> = {
        'coverage-section_1_row_value': 'Nota de prueba para Incendio',
      };
      const buffer = await generateExcelBuffer(mockQuotes, undefined, notes);
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer);

      const coveragesSheet = workbook.getWorksheet('Coberturas y Deducibles');
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

      const coveragesSheet = workbook.getWorksheet('Coberturas y Deducibles');
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

      const coveragesSheet = workbook.getWorksheet('Coberturas y Deducibles');
      expect(coveragesSheet).toBeDefined();

      let exclusiveCell: ExcelJS.Cell | undefined;
      coveragesSheet!.eachRow((row) => {
        const cellA = row.getCell(1);
        if (cellA.value === 'Cobertura Adicional MAPFRE') {
          exclusiveCell = row.getCell(2); // First insurer column
        }
      });

      expect(exclusiveCell).toBeDefined();
      expect(exclusiveCell!.value).toBe('$50.000.000');
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
              name: 'Asistencia VIP',
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

      const coveragesSheet = workbook.getWorksheet('Coberturas y Deducibles');
      expect(coveragesSheet).toBeDefined();

      let exclusiveCell: ExcelJS.Cell | undefined;
      coveragesSheet!.eachRow((row) => {
        const cellA = row.getCell(1);
        if (cellA.value === 'Asistencia VIP') {
          exclusiveCell = row.getCell(2);
        }
      });

      expect(exclusiveCell).toBeDefined();
      expect(exclusiveCell!.value).toBe('Incluido');
    });
  });
});
