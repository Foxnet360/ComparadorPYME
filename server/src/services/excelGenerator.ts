import * as ExcelJS from 'exceljs';
import { QuoteAnalysis, } from '../types';
import { transformQuotesToMatrix, parseNumericValue} from './matrixTransformer';

export function formatRatioCell(val: any): { value: any; numFmt?: string } {
  if (typeof val === 'string') {
    const pct = parseFloat(val.replace(/[^0-9,.]/g, '').replace(',', '.')) / 100;
    if (!isNaN(pct)) {
      return { value: pct, numFmt: '0.00%' };
    } else {
      return { value: val };
    }
  } else {
    return { value: val };
  }
}

export async function generateExcelBuffer(quotes: QuoteAnalysis[], clientInfo?: any, cellNotes?: Record<string, string>): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Agente Comparador CSA';
  workbook.lastModifiedBy = 'Agente Comparador CSA';
  workbook.created = new Date();
  workbook.modified = new Date();

  // Generate Matrix
  const matrix = transformQuotesToMatrix(quotes);
  const hasNotes = cellNotes && Object.keys(cellNotes).length > 0;

  // Parse Client Info
  const clientName = clientInfo?.name || 'LEIDY MIREYA GARCIA GUEPENDO (LASERHOME)';
  const clientActivity = clientInfo?.activity || 'Centro de Belleza y/o Estetica (CIIU 9602)';
  const clientLocation = clientInfo?.location || 'Diagonal 76A Bis 55A-19, Bogota D.C.';

  // Find max asset value from Incendio coverages
  const assetValues = quotes.map(q => {
    const incendio = q.coverages.find(c => c.name.toLowerCase().includes('incendio') || c.canonicalName?.toLowerCase().includes('incendio'));
    return parseNumericValue(incendio?.value);
  });
  const maxAsset = Math.max(...assetValues);
  const totalAssetValueStr = maxAsset > 0 
    ? '$' + maxAsset.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
    : '$119.600.000';

  // -------------------------------------------------------------
  // Sheet 1: Portada
  // -------------------------------------------------------------
  const portada = workbook.addWorksheet('Portada');
  portada.views = [{ showGridLines: false }];

  // Column Widths
  portada.getColumn(1).width = 5;
  portada.getColumn(2).width = 25;
  portada.getColumn(3).width = 5;
  portada.getColumn(4).width = 50;

  // Title Block
  portada.mergeCells('B2:D2');
  const titleCell = portada.getCell('B2');
  titleCell.value = 'COMPARATIVA DE COTIZACIONES DE SEGUROS PYME';
  titleCell.font = { name: 'Calibri', size: 16, bold: true, color: { argb: 'FF0066CC' } };
  titleCell.alignment = { vertical: 'middle', horizontal: 'left' };

  portada.mergeCells('B3:D3');
  const subtitleCell = portada.getCell('B3');
  subtitleCell.value = `${clientName.toUpperCase()} | Bogotá D.C.`;
  subtitleCell.font = { name: 'Calibri', size: 11, italic: true, color: { argb: 'FF555555' } };
  subtitleCell.alignment = { vertical: 'middle', horizontal: 'left' };

  // Resumen Ejecutivo Section
  portada.getCell('B6').value = 'RESUMEN EJECUTIVO';
  portada.getCell('B6').font = { name: 'Calibri', size: 12, bold: true, color: { argb: 'FF333333' } };
  
  const addInfoRow = (label: string, value: string, rowIdx: number) => {
    const cellA = portada.getCell(`B${rowIdx}`);
    cellA.value = label;
    cellA.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF555555' } };
    cellA.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };

    const cellB = portada.getCell(`D${rowIdx}`);
    cellB.value = value;
    cellB.font = { name: 'Calibri', size: 11, color: { argb: 'FF333333' } };
  };

  addInfoRow('Asegurado:', clientName, 8);
  addInfoRow('Actividad:', clientActivity, 9);
  addInfoRow('Ubicación:', clientLocation, 10);
  addInfoRow('Valor Total Bienes:', totalAssetValueStr, 11);
  addInfoRow('Total Aseguradoras:', `${quotes.length} (${quotes.map(q => q.insurerName).join(', ')})`, 12);

  // File Content / Navigability Guide Section
  portada.getCell('B15').value = 'CONTENIDO DEL ARCHIVO';
  portada.getCell('B15').font = { name: 'Calibri', size: 12, bold: true, color: { argb: 'FF333333' } };

  portada.getCell('B17').value = 'Hoja';
  portada.getCell('B17').font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
  portada.getCell('B17').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF333333' } };
  portada.getCell('B17').alignment = { horizontal: 'center' };

  portada.getCell('D17').value = 'Descripción';
  portada.getCell('D17').font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
  portada.getCell('D17').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF333333' } };

  const addNavRow = (sheetName: string, desc: string, rowIdx: number) => {
    const cellA = portada.getCell(`B${rowIdx}`);
    cellA.value = sheetName;
    cellA.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF0066CC' } };
    cellA.alignment = { horizontal: 'center' };
    cellA.border = {
      bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
    };

    const cellB = portada.getCell(`D${rowIdx}`);
    cellB.value = desc;
    cellB.font = { name: 'Calibri', size: 11, color: { argb: 'FF555555' } };
    cellB.border = {
      bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
    };
  };

  addNavRow('Portada', 'Resumen ejecutivo y guía de navegación rápida', 18);
  addNavRow('Coberturas y Deducibles', 'Tabla comparativa principal de amparos canónicos y amparos exclusivos', 19);
  addNavRow('Primas y Costos', 'Resumen matemático de primas netas, gastos, IVA y totales a pagar', 20);


  // -------------------------------------------------------------
  // Sheet 2: Coberturas y Deducibles
  // -------------------------------------------------------------
  const coveragesSheet = workbook.addWorksheet('Coberturas y Deducibles');
  coveragesSheet.views = [{ showGridLines: false }];

  // Base configurations
  coveragesSheet.getColumn(1).width = 40; // Cobertura/Variable
  for (let i = 0; i < quotes.length; i++) {
    coveragesSheet.getColumn(i + 2).width = 30; // Insurers
  }

  // Title block in Coberturas
  const notesColumnOffset = hasNotes ? 1 : 0;
  coveragesSheet.mergeCells(1, 1, 2, quotes.length + 1 + notesColumnOffset);
  const covTitle = coveragesSheet.getCell(1, 1);
  covTitle.value = 'COMPARATIVA DE COBERTURAS Y DEDUCIBLES';
  covTitle.font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FF0066CC' } };
  covTitle.alignment = { vertical: 'middle', horizontal: 'left' };

  // Main Headers
  coveragesSheet.getRow(4).height = 26;
  const mainLabelHeader = coveragesSheet.getCell(4, 1);
  mainLabelHeader.value = 'COBERTURA / CONCEPTO';
  mainLabelHeader.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
  mainLabelHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF333333' } };
  mainLabelHeader.alignment = { vertical: 'middle', horizontal: 'left' };

  quotes.forEach((q, i) => {
    const insHeader = coveragesSheet.getCell(4, i + 2);
    insHeader.value = q.insurerName.toUpperCase();
    insHeader.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    insHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF333333' } };
    insHeader.alignment = { vertical: 'middle', horizontal: 'center' };
  });

  // Add Notes column header if notes exist
  if (hasNotes) {
    const notesHeader = coveragesSheet.getCell(4, quotes.length + 2);
    notesHeader.value = 'INSIGHTS DEL CONSULTOR';
    notesHeader.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    notesHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF7C3AED' } }; // Purple header
    notesHeader.alignment = { vertical: 'middle', horizontal: 'center' };
    coveragesSheet.getColumn(quotes.length + 2).width = 40;
  }

  // Populate Matrix Rows (sectionId < 100)
  let currentExcelRow = 5;
  const coverageRows = matrix.filter(row => row.sectionId < 100);

  for (const row of coverageRows) {
    if (row.type === 'header') {
      coveragesSheet.mergeCells(currentExcelRow, 1, currentExcelRow, quotes.length + 1 + notesColumnOffset);
      const cell = coveragesSheet.getCell(currentExcelRow, 1);
      cell.value = row.label;
      cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF0066CC' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE6F0FA' } };
      cell.alignment = { vertical: 'middle', horizontal: 'left' };
      coveragesSheet.getRow(currentExcelRow).height = 22;
      currentExcelRow++;
    } else if (row.type === 'spacer') {
      coveragesSheet.getRow(currentExcelRow).height = 10;
      currentExcelRow++;
    } else {
      // Data Row
      coveragesSheet.getRow(currentExcelRow).height = 20;

      // Label (Column A)
      const labelCell = coveragesSheet.getCell(currentExcelRow, 1);
      labelCell.value = row.label;
      labelCell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF555555' } };
      labelCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
      labelCell.alignment = { vertical: 'middle', horizontal: 'left' };
      labelCell.border = {
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
      };

      // Insurers Value Cells
      row.cells.forEach((cell, idx) => {
        const xlCell = coveragesSheet.getCell(currentExcelRow, idx + 2);
        const val = cell.value;
        const isWinner = cell.isWinner;
        const excluded = cell.isExcluded;

        // Check if value is a numeric amount (e.g. for "Valor Asegurado" row)
        const isNumericRow = row.label.toLowerCase().includes('valor') || row.label.toLowerCase().includes('sublímite');
        const numericVal = isNumericRow ? parseNumericValue(val) : 0;

        if (excluded) {
          xlCell.value = 'No incluida';
          xlCell.font = { name: 'Calibri', size: 10, italic: true, color: { argb: 'FF94A3B8' } };
        } else if (numericVal > 0) {
          xlCell.value = numericVal;
          xlCell.numFmt = '$#,##0';
          xlCell.font = { name: 'Calibri', size: 10, color: { argb: 'FF333333' } };
        } else {
          xlCell.value = val;
          xlCell.font = { name: 'Calibri', size: 10, color: { argb: 'FF333333' } };
        }

        // Apply Winner Highlight Style
        if (isWinner && !excluded) {
          xlCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFDF2E9' } };
          xlCell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF92400E' } };
        }

        xlCell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
        xlCell.border = {
          bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
        };

        // Inject page tracking as Cell comments
        if (cell.pageNumber !== undefined && cell.pageNumber !== null) {
          xlCell.note = `Fuente original: PDF cotización, Página ${cell.pageNumber}`;
        }
      });

      // Add Notes column if exists
      if (hasNotes) {
        const cellId = `coverage-${row.id}`;
        const note = cellNotes?.[cellId];
        const notesCell = coveragesSheet.getCell(currentExcelRow, quotes.length + 2);
        notesCell.value = note || '';
        notesCell.font = { name: 'Calibri', size: 9, color: { argb: 'FF7C3AED' }, italic: true };
        notesCell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
        notesCell.border = {
          bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
        };
        if (note) {
          notesCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3E8FF' } }; // Light purple background
        }
      }

      currentExcelRow++;
    }
  }


  // -------------------------------------------------------------
  // Sheet 3: Primas y Costos
  // -------------------------------------------------------------
  const financialsSheet = workbook.addWorksheet('Primas y Costos');
  financialsSheet.views = [{ showGridLines: false }];

  // Column Widths
  financialsSheet.getColumn(1).width = 40;
  for (let i = 0; i < quotes.length; i++) {
    financialsSheet.getColumn(i + 2).width = 25;
  }

  // Title block in Financials
  financialsSheet.mergeCells(1, 1, 2, quotes.length + 1);
  const finTitle = financialsSheet.getCell(1, 1);
  finTitle.value = 'COMPARATIVA DE PRIMAS Y COSTOS';
  finTitle.font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FF0066CC' } };
  finTitle.alignment = { vertical: 'middle', horizontal: 'left' };

  // Headers
  financialsSheet.getRow(4).height = 26;
  const finLabelHeader = financialsSheet.getCell(4, 1);
  finLabelHeader.value = 'CONCEPTO FINANCIERO';
  finLabelHeader.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
  finLabelHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF333333' } };
  finLabelHeader.alignment = { vertical: 'middle', horizontal: 'left' };

  quotes.forEach((q, i) => {
    const insHeader = financialsSheet.getCell(4, i + 2);
    insHeader.value = q.insurerName.toUpperCase();
    insHeader.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    insHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF333333' } };
    insHeader.alignment = { vertical: 'middle', horizontal: 'center' };
  });

  // Populate Matrix Rows (sectionId >= 100)
  let currentFinExcelRow = 5;
  const financialRows = matrix.filter(row => row.sectionId >= 100);

  for (const row of financialRows) {
    if (row.type === 'header') {
      financialsSheet.mergeCells(currentFinExcelRow, 1, currentFinExcelRow, quotes.length + 1);
      const cell = financialsSheet.getCell(currentFinExcelRow, 1);
      cell.value = row.label;
      cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF0066CC' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE6F0FA' } };
      cell.alignment = { vertical: 'middle', horizontal: 'left' };
      financialsSheet.getRow(currentFinExcelRow).height = 22;
      currentFinExcelRow++;
    } else if (row.type === 'spacer') {
      financialsSheet.getRow(currentFinExcelRow).height = 10;
      currentFinExcelRow++;
    } else {
      financialsSheet.getRow(currentFinExcelRow).height = 20;

      // Label (Column A)
      const labelCell = financialsSheet.getCell(currentFinExcelRow, 1);
      labelCell.value = row.label;
      labelCell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF555555' } };
      labelCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
      labelCell.alignment = { vertical: 'middle', horizontal: 'left' };
      labelCell.border = {
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
      };

      // Insurer Value Cells
      row.cells.forEach((cell, idx) => {
        const xlCell = financialsSheet.getCell(currentFinExcelRow, idx + 2);
        const val = cell.value;
        const isWinner = cell.isWinner;
        const excluded = cell.isExcluded;

        // Check if value is a numeric amount (Primas, Costos, Subtotal)
        const isNumericRow = row.id.startsWith('financial_') && !row.id.endsWith('_ratio');
        const numericVal = isNumericRow ? parseNumericValue(val) : 0;

        if (excluded) {
          xlCell.value = val === 'N/A' ? 'N/A' : 'No informada';
          xlCell.font = { name: 'Calibri', size: 10, italic: true, color: { argb: 'FF94A3B8' } };
        } else if (numericVal > 0) {
          xlCell.value = numericVal;
          xlCell.numFmt = '$#,##0';
          xlCell.font = { name: 'Calibri', size: 10, color: { argb: 'FF333333' } };
        } else if (row.id.endsWith('_ratio')) {
          // Format percentage
          const { value: ratioValue, numFmt } = formatRatioCell(val);
          xlCell.value = ratioValue;
          if (numFmt) xlCell.numFmt = numFmt;
          xlCell.font = { name: 'Calibri', size: 10, color: { argb: 'FF333333' } };
        } else {
          xlCell.value = val;
          xlCell.font = { name: 'Calibri', size: 10, color: { argb: 'FF333333' } };
        }

        // Apply Winner Highlight Style for Cheapest total premium
        if (isWinner && !excluded) {
          xlCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFDF2E9' } };
          xlCell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF92400E' } };
        }

        xlCell.alignment = { vertical: 'middle', horizontal: 'center' };
        xlCell.border = {
          bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
        };
      });

      currentFinExcelRow++;
    }
  }

  // Generate buffer and return
  const buffer = await workbook.xlsx.writeBuffer();
  return buffer as unknown as Buffer;
}
