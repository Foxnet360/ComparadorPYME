import * as ExcelJS from 'exceljs';
import { QuoteAnalysis } from '../types';
import { transformQuotesToMatrix, parseNumericValue, formatMatrixValue } from './matrixTransformer';

interface ClientInfo {
  name?: string;
  activity?: string;
  location?: string;
}

export interface BrokerInfo {
  name?: string;
  intermediaryName?: string;
  registrationNumber?: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
}

export function formatRatioCell(val: string | number): { value: string | number; numFmt?: string } {
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

export async function generateExcelBuffer(
  quotes: QuoteAnalysis[],
  clientInfo?: ClientInfo,
  cellNotes?: Record<string, string>,
  brokerInfo?: BrokerInfo,
  domain: string = 'pyme',
  reportData?: any
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = brokerInfo?.intermediaryName || 'Agente Comparador CSA';
  workbook.lastModifiedBy = brokerInfo?.name || 'Agente Comparador CSA';
  workbook.created = new Date();
  workbook.modified = new Date();

  // Generate Base Matrix
  const matrix = transformQuotesToMatrix(quotes, domain);
  const hasNotes = cellNotes && Object.keys(cellNotes).length > 0;

  // Parse Client Info
  const clientName = clientInfo?.name || 'Cliente';
  const defaultActivity =
    domain === 'copropiedades'
      ? 'Edificio Residencial / Comercial (Copropiedad)'
      : domain === 'autos'
      ? 'Vehículo Particular / Flotas'
      : domain === 'hogar'
      ? 'Vivienda Residencial / Hogar'
      : 'Comercial / PYME';
  const clientActivity =
    clientInfo?.activity && clientInfo.activity !== 'Centro de Belleza y/o Estetica (CIIU 9602)'
      ? clientInfo.activity
      : defaultActivity;
  const clientLocation = clientInfo?.location || 'Bogotá D.C.';

  // Max Asset Calculation
  const assetValues: number[] = [];
  quotes.forEach((q) => {
    q.coverages.forEach((c) => {
      const name = (c.name || '').toLowerCase();
      const canonical = (c.canonicalName || '').toLowerCase();
      if (
        name.includes('incendio') ||
        name.includes('edificio') ||
        name.includes('bienes') ||
        name.includes('daño material') ||
        name.includes('amparo básico') ||
        canonical.includes('incendio') ||
        canonical.includes('edificio') ||
        canonical.includes('daño material')
      ) {
        const val = parseNumericValue(c.value);
        if (val > 0) assetValues.push(val);
      }
    });
  });
  const maxAsset = assetValues.length > 0 ? Math.max(...assetValues) : 0;
  const totalAssetValueStr =
    maxAsset > 0
      ? '$' +
        maxAsset.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
      : 'No especificado';

  // -------------------------------------------------------------
  // Pestaña 1: Portada y Resumen General
  // -------------------------------------------------------------
  const portada = workbook.addWorksheet('Portada y Resumen General');
  portada.views = [{ showGridLines: false }];

  portada.getColumn(1).width = 5;
  portada.getColumn(2).width = 28;
  portada.getColumn(3).width = 4;
  portada.getColumn(4).width = 45;
  portada.getColumn(5).width = 18;
  portada.getColumn(6).width = 18;

  // Title Banner
  portada.mergeCells('B2:F2');
  const titleCell = portada.getCell('B2');
  titleCell.value = 'COMPARATIVA Y AUDITORÍA TÉCNICA DE SEGUROS';
  titleCell.font = { name: 'Calibri', size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } };
  titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
  portada.getRow(2).height = 35;

  portada.mergeCells('B3:F3');
  const subtitleCell = portada.getCell('B3');
  subtitleCell.value = `DOCUMENTO DE ANÁLISIS TÉCNICO | ${clientName.toUpperCase()} | ${clientLocation}`;
  subtitleCell.font = { name: 'Calibri', size: 10, italic: true, color: { argb: 'FF475569' } };
  subtitleCell.alignment = { vertical: 'middle', horizontal: 'center' };

  // Helper row adder
  const addInfoRow = (label: string, value: string, rowIdx: number) => {
    const cellA = portada.getCell(`B${rowIdx}`);
    cellA.value = label;
    cellA.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF334155' } };
    cellA.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };

    const cellB = portada.getCell(`D${rowIdx}`);
    cellB.value = value;
    cellB.font = { name: 'Calibri', size: 10, color: { argb: 'FF1E293B' } };
  };

  // Section: Datos del Cliente
  portada.getCell('B5').value = 'DATOS DEL ASEGURADO (CLIENTE)';
  portada.getCell('B5').font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF1E3A8A' } };
  addInfoRow('Asegurado:', clientName, 6);
  addInfoRow('Actividad / Ocupación:', clientActivity, 7);
  addInfoRow('Ubicación del Riesgo:', clientLocation, 8);
  addInfoRow('Valor Total Bienes:', totalAssetValueStr, 9);

  // Section: Intermediario / Aliado
  portada.getCell('B11').value = 'DATOS DEL INTERMEDIARIO / ALIADO TÉCNICO';
  portada.getCell('B11').font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF1E3A8A' } };
  addInfoRow('Corredoría / Agencia:', brokerInfo?.intermediaryName || 'Agencia Aliada', 12);
  addInfoRow('Asesor Responsable:', brokerInfo?.name || 'Asesor Técnico de Seguros', 13);
  addInfoRow('Nº Matrícula / Registro:', brokerInfo?.registrationNumber || 'No especificado', 14);
  addInfoRow(
    'Contacto:',
    [brokerInfo?.phone, brokerInfo?.email, brokerInfo?.city].filter(Boolean).join(' | ') || 'No especificado',
    15
  );

  // Section: Scorecard Multidimensional
  portada.getCell('B17').value = 'SCORECARD MULTIDIMENSIONAL (CALIFICACIÓN 0 - 100)';
  portada.getCell('B17').font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF1E3A8A' } };

  portada.getCell('B19').value = 'Dimensión Evaluada';
  portada.getCell('B19').font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
  portada.getCell('B19').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } };

  quotes.forEach((q, i) => {
    const colLetter = String.fromCharCode(68 + i); // D, E, F...
    const cell = portada.getCell(`${colLetter}19`);
    cell.value = q.insurerName.toUpperCase();
    cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } };
    cell.alignment = { horizontal: 'center' };
  });

  const dimensions = [
    { key: 'totalScore', label: 'SCORE TOTAL (0 - 100)' },
    { key: 'coverage', label: 'Coberturas (25%)' },
    { key: 'deductibles', label: 'Deducibles (20%)' },
    { key: 'exclusions', label: 'Ausencia Exclusiones (20%)' },
    { key: 'priceRatio', label: 'Ratio de Precio (15%)' },
    { key: 'sublimits', label: 'Sublímites (10%)' },
    { key: 'warranties', label: 'Garantías (10%)' },
  ];

  dimensions.forEach((dim, idx) => {
    const rIdx = 20 + idx;
    const isTotal = dim.key === 'totalScore';

    const cellLabel = portada.getCell(`B${rIdx}`);
    cellLabel.value = dim.label;
    cellLabel.font = { name: 'Calibri', size: 10, bold: isTotal, color: { argb: isTotal ? 'FF1E3A8A' : 'FF334155' } };
    if (isTotal) {
      cellLabel.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0F2FE' } };
    }

    quotes.forEach((q, qIdx) => {
      const colLetter = String.fromCharCode(68 + qIdx);
      const cellVal = portada.getCell(`${colLetter}${rIdx}`);
      let scoreVal = 50;

      if (dim.key === 'totalScore') {
        scoreVal = q.score || 50;
      } else if (q.scoringBreakdown) {
        scoreVal = Math.round(((q.scoringBreakdown as any)[dim.key] || 5) * 10);
      }

      cellVal.value = scoreVal;
      cellVal.font = { name: 'Calibri', size: 10, bold: isTotal, color: { argb: 'FF1E293B' } };
      cellVal.alignment = { horizontal: 'center' };

      if (isTotal) {
        cellVal.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0F2FE' } };
      }
    });
  });

  // Section: Opción Recomendada
  const bestQuote = quotes.reduce(
    (prev, current) => ((prev.score || 0) > (current.score || 0) ? prev : current),
    quotes[0]
  );
  portada.getCell('B29').value = 'OPCIÓN RECOMENDADA TÉCNICAMENTE';
  portada.getCell('B29').font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF059669' } };

  portada.mergeCells('B30:F30');
  const recCell = portada.getCell('B30');
  recCell.value = `Aseguradora Ganadora: ${bestQuote?.insurerName} (Score: ${bestQuote?.score || 'N/A'}/100) — Se destaca por la mejor amplitud de coberturas y equilibrio financiero.`;
  recCell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF065F46' } };
  recCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1FAE5' } };

  // Section: Guía del Documento
  portada.getCell('B33').value = 'CONTENIDO Y NAVEGACIÓN DEL INFORME';
  portada.getCell('B33').font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF1E3A8A' } };

  const navRows = [
    { name: 'Portada y Resumen General', desc: 'Resumen ejecutivo, ficha del cliente, aliado y scorecard de puntaje.' },
    { name: 'Matriz Coberturas', desc: 'Matriz comparativa ampliada de amparos canónicos y ventajas exclusivas.' },
    { name: 'Matriz Deducibles', desc: 'Matriz consolidada dedicada a deducibles y valores equivalentes en COP.' },
    { name: 'Primas y Costos', desc: 'Desglose financiero completo con primas netas, IVA, subtotal y fórmulas.' },
    { name: 'Análisis de Riesgos', desc: 'Auditoría técnica de alertas (Críticas/Advertencias), dictamen legal y garantías.' },
  ];

  navRows.forEach((item, idx) => {
    const rIdx = 35 + idx;
    const cellA = portada.getCell(`B${rIdx}`);
    cellA.value = item.name;
    cellA.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF1E3A8A' } };

    const cellB = portada.getCell(`D${rIdx}`);
    cellB.value = item.desc;
    cellB.font = { name: 'Calibri', size: 10, color: { argb: 'FF475569' } };
  });

  // -------------------------------------------------------------
  // Pestaña 2: Matriz Coberturas
  // -------------------------------------------------------------
  const coveragesSheet = workbook.addWorksheet('Matriz Coberturas');
  coveragesSheet.views = [{ showGridLines: false }];

  coveragesSheet.getColumn(1).width = 42;
  for (let i = 0; i < quotes.length; i++) {
    coveragesSheet.getColumn(i + 2).width = 32;
  }

  coveragesSheet.mergeCells(1, 1, 2, quotes.length + 1 + (hasNotes ? 1 : 0));
  const covTitle = coveragesSheet.getCell(1, 1);
  covTitle.value = 'MATRIZ COMPARATIVA AMPLIADA DE COBERTURAS';
  covTitle.font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FF1E3A8A' } };
  covTitle.alignment = { vertical: 'middle', horizontal: 'left' };

  // Headers
  coveragesSheet.getRow(4).height = 26;
  const mainLabelHeader = coveragesSheet.getCell(4, 1);
  mainLabelHeader.value = 'COBERTURA / CONCEPTO CANÓNICO';
  mainLabelHeader.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
  mainLabelHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } };

  quotes.forEach((q, i) => {
    const insHeader = coveragesSheet.getCell(4, i + 2);
    insHeader.value = q.insurerName.toUpperCase();
    insHeader.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    insHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } };
    insHeader.alignment = { horizontal: 'center' };
  });

  if (hasNotes) {
    const notesHeader = coveragesSheet.getCell(4, quotes.length + 2);
    notesHeader.value = 'INSIGHTS DEL CONSULTOR';
    notesHeader.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    notesHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF7C3AED' } };
    notesHeader.alignment = { horizontal: 'center' };
    coveragesSheet.getColumn(quotes.length + 2).width = 40;
  }

  // Populate coverage matrix rows (filter out standalone deductible rows for tab 3)
  let currentExcelRow = 5;
  const coverageRows = matrix.filter(
    (row) => row.sectionId < 100 && !row.id.includes('_row_deductible') && !row.id.startsWith('deductible_')
  );

  for (const row of coverageRows) {
    if (row.type === 'header') {
      coveragesSheet.mergeCells(currentExcelRow, 1, currentExcelRow, quotes.length + 1 + (hasNotes ? 1 : 0));
      const cell = coveragesSheet.getCell(currentExcelRow, 1);
      cell.value = row.label;
      cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF1E3A8A' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE6F0FA' } };
      currentExcelRow++;
    } else if (row.type === 'spacer') {
      coveragesSheet.getRow(currentExcelRow).height = 8;
      currentExcelRow++;
    } else {
      coveragesSheet.getRow(currentExcelRow).height = 20;
      const labelCell = coveragesSheet.getCell(currentExcelRow, 1);
      labelCell.value = row.label;
      labelCell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF475569' } };
      labelCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };

      row.cells.forEach((cell, idx) => {
        const xlCell = coveragesSheet.getCell(currentExcelRow, idx + 2);
        const val = cell.value;
        const isWinner = cell.isWinner;
        const excluded = cell.isExcluded;
        const numericVal = parseNumericValue(val);

        if (excluded) {
          xlCell.value = 'No incluida';
          xlCell.font = { name: 'Calibri', size: 10, italic: true, color: { argb: 'FF94A3B8' } };
        } else if (numericVal > 0) {
          xlCell.value = numericVal;
          xlCell.numFmt = '$#,##0';
          xlCell.font = { name: 'Calibri', size: 10, color: { argb: 'FF1E293B' } };
        } else {
          xlCell.value = formatMatrixValue(val);
          xlCell.font = { name: 'Calibri', size: 10, color: { argb: 'FF1E293B' } };
        }

        if (isWinner && !excluded) {
          xlCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFDF2E9' } };
          xlCell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF92400E' } };
        }

        xlCell.alignment = { horizontal: 'center', wrapText: true };
        xlCell.border = { bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } } };

        if (cell.pageNumber !== undefined && cell.pageNumber !== null) {
          xlCell.note = `Fuente original: PDF cotización, Página ${cell.pageNumber}`;
        }
        if (cell.confidence !== undefined && cell.confidence !== null) {
          const confidenceText = `Confianza: ${(cell.confidence * 100).toFixed(0)}%`;
          xlCell.note = xlCell.note ? `${xlCell.note}\n${confidenceText}` : confidenceText;
        }
      });

      if (hasNotes) {
        const cellId = `coverage-${row.id}`;
        const note = cellNotes?.[cellId];
        const notesCell = coveragesSheet.getCell(currentExcelRow, quotes.length + 2);
        notesCell.value = note || '';
        notesCell.font = { name: 'Calibri', size: 9, color: { argb: 'FF7C3AED' }, italic: true };
        if (note) notesCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3E8FF' } };
      }

      currentExcelRow++;
    }
  }

  // -------------------------------------------------------------
  // Pestaña 3: Matriz Deducibles
  // -------------------------------------------------------------
  const deductiblesSheet = workbook.addWorksheet('Matriz Deducibles');
  deductiblesSheet.views = [{ showGridLines: false }];

  deductiblesSheet.getColumn(1).width = 42;
  for (let i = 0; i < quotes.length; i++) {
    deductiblesSheet.getColumn(i + 2).width = 35;
  }

  deductiblesSheet.mergeCells(1, 1, 2, quotes.length + 1);
  const dedTitle = deductiblesSheet.getCell(1, 1);
  dedTitle.value = 'MATRIZ CONSOLIDADA DE DEDUCIBLES';
  dedTitle.font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FF1E3A8A' } };

  deductiblesSheet.getRow(4).height = 26;
  const dedLabelHeader = deductiblesSheet.getCell(4, 1);
  dedLabelHeader.value = 'AMPARO / COBERTURA';
  dedLabelHeader.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
  dedLabelHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } };

  quotes.forEach((q, i) => {
    const insHeader = deductiblesSheet.getCell(4, i + 2);
    insHeader.value = q.insurerName.toUpperCase();
    insHeader.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    insHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } };
    insHeader.alignment = { horizontal: 'center' };
  });

  let currentDedRow = 5;
  // Filter matrix for deductible rows
  const deductibleRows = matrix.filter(
    (row) => row.id.includes('_row_deductible') || row.id.startsWith('deductible_') || row.id === 'section_group_deductibles'
  );

  for (const row of deductibleRows) {
    if (row.type === 'header') {
      deductiblesSheet.mergeCells(currentDedRow, 1, currentDedRow, quotes.length + 1);
      const cell = deductiblesSheet.getCell(currentDedRow, 1);
      cell.value = row.label;
      cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF1E3A8A' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE6F0FA' } };
      currentDedRow++;
    } else if (row.type === 'spacer') {
      deductiblesSheet.getRow(currentDedRow).height = 8;
      currentDedRow++;
    } else {
      deductiblesSheet.getRow(currentDedRow).height = 22;
      const labelCell = deductiblesSheet.getCell(currentDedRow, 1);
      labelCell.value = row.label;
      labelCell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF475569' } };
      labelCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };

      row.cells.forEach((cell, idx) => {
        const xlCell = deductiblesSheet.getCell(currentDedRow, idx + 2);
        const val = cell.value;
        const isNoAplica = val.toLowerCase().includes('no aplica') || val.toLowerCase().includes('sin deducible');

        xlCell.value = val;
        xlCell.font = { name: 'Calibri', size: 10, color: { argb: 'FF1E293B' } };

        if (isNoAplica) {
          xlCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1FAE5' } }; // Soft green
          xlCell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF065F46' } };
        }

        xlCell.alignment = { horizontal: 'center', wrapText: true };
        xlCell.border = { bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } } };
      });
      currentDedRow++;
    }
  }

  // -------------------------------------------------------------
  // Pestaña 4: Primas y Costos (CON FÓRMULAS NATIVAS DE EXCEL)
  // -------------------------------------------------------------
  const financialsSheet = workbook.addWorksheet('Primas y Costos');
  financialsSheet.views = [{ showGridLines: false }];

  financialsSheet.getColumn(1).width = 42;
  for (let i = 0; i < quotes.length; i++) {
    financialsSheet.getColumn(i + 2).width = 28;
  }

  financialsSheet.mergeCells(1, 1, 2, quotes.length + 1);
  const finTitle = financialsSheet.getCell(1, 1);
  finTitle.value = 'EVALUACIÓN FINANCIERA DE PRIMAS Y COSTOS';
  finTitle.font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FF1E3A8A' } };

  financialsSheet.getRow(4).height = 26;
  const finLabelHeader = financialsSheet.getCell(4, 1);
  finLabelHeader.value = 'CONCEPTO FINANCIERO';
  finLabelHeader.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
  finLabelHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } };

  quotes.forEach((q, i) => {
    const insHeader = financialsSheet.getCell(4, i + 2);
    insHeader.value = q.insurerName.toUpperCase();
    insHeader.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    insHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } };
    insHeader.alignment = { horizontal: 'center' };
  });

  // Financial Rows with Formulas
  const netPremiums = quotes.map((q) => q.priceAnnual || 0);
  const expenses = quotes.map((q) => {
    if (q.priceAnnual === 0) return 0;
    if (q.insurerName.toLowerCase().includes('mapfre')) return 10000;
    if (q.insurerName.toLowerCase().includes('chubb')) return 12000;
    return 0;
  });

  const addFinRow = (
    label: string,
    rowNum: number,
    getValueOrFormula: (colLetter: string, idx: number) => { value?: number; formula?: string; isTotal?: boolean; isWinner?: boolean }
  ) => {
    financialsSheet.getRow(rowNum).height = 22;
    const lCell = financialsSheet.getCell(rowNum, 1);
    lCell.value = label;
    lCell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF334155' } };
    lCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };

    quotes.forEach((q, idx) => {
      const colLetter = String.fromCharCode(66 + idx);
      const xlCell = financialsSheet.getCell(`${colLetter}${rowNum}`);
      const res = getValueOrFormula(colLetter, idx);

      if (res.formula) {
        xlCell.value = { formula: res.formula };
      } else if (res.value !== undefined) {
        xlCell.value = res.value;
      }

      xlCell.numFmt = '$#,##0';
      xlCell.font = { name: 'Calibri', size: 10, bold: !!res.isTotal, color: { argb: 'FF1E293B' } };
      xlCell.alignment = { horizontal: 'center' };

      if (res.isWinner) {
        xlCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFDF2E9' } };
        xlCell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF92400E' } };
      }
    });
  };

  const minNet = Math.min(...netPremiums.filter((n) => n > 0));

  addFinRow('Prima Neta (Anual)', 5, (_, idx) => ({
    value: netPremiums[idx],
    isWinner: netPremiums[idx] > 0 && netPremiums[idx] === minNet,
  }));

  addFinRow('Gastos de Expedición', 6, (_, idx) => ({
    value: expenses[idx],
  }));

  // Subtotal Formula = Row 5 + Row 6
  addFinRow('Subtotal', 7, (colLetter) => ({
    formula: `SUM(${colLetter}5:${colLetter}6)`,
    isTotal: true,
  }));

  // IVA Formula = ROUND(Subtotal * 0.19, 0)
  addFinRow('IVA (19%)', 8, (colLetter) => ({
    formula: `ROUND(${colLetter}7*0.19, 0)`,
  }));

  // TOTAL A PAGAR Formula = Subtotal + IVA
  addFinRow('TOTAL A PAGAR', 9, (colLetter, idx) => ({
    formula: `${colLetter}7+${colLetter}8`,
    isTotal: true,
    isWinner: netPremiums[idx] > 0 && netPremiums[idx] === minNet,
  }));

  // Ratio % sobre Valor Asegurado
  financialsSheet.getRow(11).height = 22;
  const ratioLabel = financialsSheet.getCell(11, 1);
  ratioLabel.value = '% SOBRE VALOR ASEGURADO';
  ratioLabel.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF1E3A8A' } };

  quotes.forEach((q, idx) => {
    const colLetter = String.fromCharCode(66 + idx);
    const xlCell = financialsSheet.getCell(`${colLetter}11`);
    if (netPremiums[idx] > 0 && maxAsset > 0) {
      xlCell.value = { formula: `${colLetter}9/${maxAsset}` };
      xlCell.numFmt = '0.00%';
    } else {
      xlCell.value = 'N/A';
    }
    xlCell.alignment = { horizontal: 'center' };
  });

  // -------------------------------------------------------------
  // Pestaña 5: Análisis de Riesgos
  // -------------------------------------------------------------
  const riskSheet = workbook.addWorksheet('Análisis de Riesgos');
  riskSheet.views = [{ showGridLines: false }];

  riskSheet.getColumn(1).width = 20;
  riskSheet.getColumn(2).width = 25;
  riskSheet.getColumn(3).width = 35;
  riskSheet.getColumn(4).width = 45;
  riskSheet.getColumn(5).width = 25;

  riskSheet.mergeCells('A1:E2');
  const riskTitle = riskSheet.getCell('A1');
  riskTitle.value = 'AUDITORÍA DE RIESGOS, EXCLUSIONES Y CONDICIONADOS';
  riskTitle.font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FF1E3A8A' } };

  // Section Header: Alertas
  riskSheet.getRow(4).height = 24;
  const alertHeaders = ['Nivel Severidad', 'Aseguradora', 'Hallazgo / Cobertura', 'Detalle de Alerta', 'Referencia Clausulado'];
  alertHeaders.forEach((h, idx) => {
    const cell = riskSheet.getCell(4, idx + 1);
    cell.value = h;
    cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } };
  });

  let rRowIdx = 5;
  quotes.forEach((q) => {
    const alerts = q.alerts || [];
    alerts.forEach((alert) => {
      riskSheet.getRow(rRowIdx).height = 22;

      const levelCell = riskSheet.getCell(rRowIdx, 1);
      levelCell.value = alert.level || 'INFO';
      levelCell.font = { name: 'Calibri', size: 10, bold: true };
      levelCell.alignment = { horizontal: 'center' };

      if (alert.level === 'CRITICAL') {
        levelCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
        levelCell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF991B1B' } };
      } else if (alert.level === 'WARNING') {
        levelCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } };
        levelCell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF92400E' } };
      } else {
        levelCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1FAE5' } };
        levelCell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF065F46' } };
      }

      riskSheet.getCell(rRowIdx, 2).value = q.insurerName;
      riskSheet.getCell(rRowIdx, 3).value = alert.title || 'Alerta Técnica';
      riskSheet.getCell(rRowIdx, 4).value = alert.description || '';
      riskSheet.getCell(rRowIdx, 5).value = alert.clauseReference || alert.sourceDocument || 'Condicionado General';

      rRowIdx++;
    });
  });

  // Fallback if no alerts
  if (rRowIdx === 5) {
    riskSheet.mergeCells('A5:E5');
    riskSheet.getCell('A5').value = 'No se detectaron alertas críticas en los documentos analizados.';
    riskSheet.getCell('A5').font = { name: 'Calibri', size: 10, italic: true, color: { argb: 'FF64748B' } };
  }

  // Generate Buffer
  const buffer = await workbook.xlsx.writeBuffer();
  return buffer as unknown as Buffer;
}
