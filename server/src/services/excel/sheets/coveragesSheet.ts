import { ExcelContext } from '../types';
import { FONT_NAME, EXCEL_COLORS, applySheetHeaderFooter } from '../excelStyles';
import { findColombianInsurerProfile } from '../../../shared/colombianInsurersCatalog';
import {
  pruneOrphanedSectionRows,
  isFinancialMatrixRow,
  isDeductibleMatrixRow,
  calculateDynamicRowHeight,
} from '../excelHelpers';
import {
  isExcludedValue,
  parseNumericValue,
  formatMatrixValue,
  HEADER_SECTION_ID,
} from '../../unifiedComparison/matrixTransformer';
import { MatrixCell } from '../../../types';

export function buildCoveragesSheet(ctx: ExcelContext): void {
  const {
    workbook,
    quotes,
    cellNotes,
    mode,
    hasNotes,
    matrix,
    insurerImageIds,
    brokerDetails,
    todayStr,
  } = ctx;

  const coveragesSheet = workbook.addWorksheet('Matriz Coberturas');
  coveragesSheet.views = [{ showGridLines: false }];
  applySheetHeaderFooter(coveragesSheet, 'Matriz Coberturas', brokerDetails, todayStr);

  coveragesSheet.getColumn(1).width = 45;
  for (let i = 0; i < quotes.length; i++) {
    coveragesSheet.getColumn(i + 2).width = 35;
  }

  coveragesSheet.mergeCells(1, 1, 2, quotes.length + 1 + (hasNotes ? 1 : 0));
  const covTitle = coveragesSheet.getCell(1, 1);
  covTitle.value = 'MATRIZ COMPARATIVA AMPLIADA DE COBERTURAS Y AMPAROS';
  covTitle.font = { name: FONT_NAME, size: 14, bold: true, color: { argb: EXCEL_COLORS.NAVY_HEADER } };
  covTitle.alignment = { vertical: 'middle', horizontal: 'left' };

  coveragesSheet.getRow(4).height = 54;
  const mainLabelHeader = coveragesSheet.getCell(4, 1);
  mainLabelHeader.value = 'COBERTURA / CONCEPTO CANÓNICO';
  mainLabelHeader.font = { name: FONT_NAME, size: 10, bold: true, color: { argb: EXCEL_COLORS.WHITE } };
  mainLabelHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: EXCEL_COLORS.NAVY_HEADER } };
  mainLabelHeader.alignment = { vertical: 'middle', horizontal: 'left' };

  quotes.forEach((q, i) => {
    const insHeader = coveragesSheet.getCell(4, i + 2);
    insHeader.value = q.insurerName.toUpperCase();
    const profile = findColombianInsurerProfile(q.insurerName);
    const argbColor = profile?.primaryColor
      ? 'FF' + profile.primaryColor.replace('#', '')
      : EXCEL_COLORS.NAVY_HEADER;
    insHeader.font = { name: FONT_NAME, size: 10, bold: true, color: { argb: EXCEL_COLORS.SLATE_DARK } };
    insHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: EXCEL_COLORS.BG_SLATE_HEADER } };
    insHeader.border = {
      top: { style: 'medium', color: { argb: argbColor } },
      bottom: { style: 'thin', color: { argb: EXCEL_COLORS.BORDER_MEDIUM } },
      left: { style: 'thin', color: { argb: EXCEL_COLORS.BORDER_MEDIUM } },
      right: { style: 'thin', color: { argb: EXCEL_COLORS.BORDER_MEDIUM } },
    };
    insHeader.alignment = { horizontal: 'center', vertical: 'bottom', wrapText: true };

    if (insurerImageIds[i] !== null) {
      coveragesSheet.addImage(insurerImageIds[i]!, {
        tl: { col: i + 1 + 0.38, row: 3.1 },
        ext: { width: 28, height: 28 },
      });
    }
  });

  if (hasNotes) {
    const notesColIdx = quotes.length + 2;
    coveragesSheet.getColumn(notesColIdx).width = 40;
    const notesHeader = coveragesSheet.getCell(4, notesColIdx);
    notesHeader.value = 'INSIGHTS DEL CONSULTOR';
    notesHeader.font = { name: FONT_NAME, size: 10, bold: true, color: { argb: EXCEL_COLORS.WHITE } };
    notesHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: EXCEL_COLORS.PURPLE_HEADER } };
    notesHeader.alignment = { horizontal: 'center' };
  }

  // Filter matrix rows for coverages tab (exclude standalone deductible section rows & financial rows)
  // and prune any section headers whose data rows were all filtered out.
  const coverageMatrixRows = pruneOrphanedSectionRows(
    matrix.filter(
      (row) =>
        row.sectionId !== HEADER_SECTION_ID &&
        !isFinancialMatrixRow(row) &&
        !isDeductibleMatrixRow(row)
    )
  );

  let currentCovRow = 5;
  for (const row of coverageMatrixRows) {
    if (row.type === 'header') {
      coveragesSheet.mergeCells(
        currentCovRow,
        1,
        currentCovRow,
        quotes.length + 1 + (hasNotes ? 1 : 0)
      );
      const secCell = coveragesSheet.getCell(currentCovRow, 1);
      secCell.value = row.label;
      secCell.font = { name: FONT_NAME, size: 11, bold: true, color: { argb: EXCEL_COLORS.NAVY_HEADER } };
      secCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: EXCEL_COLORS.BG_SECTION_HEADER } };
      secCell.alignment = { vertical: 'middle', horizontal: 'left' };
      coveragesSheet.getRow(currentCovRow).height = 24;
      currentCovRow++;
    } else if (row.type === 'spacer') {
      coveragesSheet.getRow(currentCovRow).height = 8;
      currentCovRow++;
    } else {
      const labelCell = coveragesSheet.getCell(currentCovRow, 1);
      labelCell.value = row.label;
      labelCell.font = { name: FONT_NAME, size: 10, bold: true, color: { argb: EXCEL_COLORS.SLATE_MUTED } };
      labelCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: EXCEL_COLORS.BG_LIGHT_GRAY } };
      labelCell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };

      const rowTextsForHeight: string[] = [row.label || ''];

      row.cells.forEach((cell: MatrixCell, idx: number) => {
        const xlCell = coveragesSheet.getCell(currentCovRow, idx + 2);
        const valStr = cell.value || '';
        const excluded = cell.isExcluded || isExcludedValue(valStr);
        const numericVal = parseNumericValue(valStr);
        const isWinner = cell.isWinner;

        // Preserve qualitative text, sublimits and conditions instead of stripping to raw number
        const hasConditions =
          valStr.includes('(') ||
          valStr.includes(')') ||
          valStr.toLowerCase().includes('sublímite') ||
          valStr.toLowerCase().includes('mín') ||
          valStr.toLowerCase().includes('días') ||
          valStr.toLowerCase().includes('evento') ||
          valStr.includes('%') ||
          valStr.includes('-');

        const trimmedNotes = (cell.notes || '').trim();
        const hasMeaningfulNotes =
          !excluded &&
          trimmedNotes.length > 0 &&
          trimmedNotes.toLowerCase() !== valStr.trim().toLowerCase() &&
          ![
            'no cotizado',
            'no especificado',
            'no informado',
            'no incluido',
            'no incluida',
            'no aplica',
            'sin deducible',
            'n/a',
            'n.c.',
          ].includes(trimmedNotes.toLowerCase());

        if (excluded) {
          xlCell.value = 'No incluida';
          rowTextsForHeight.push('No incluida');
          xlCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: EXCEL_COLORS.RED_BG } };
          xlCell.font = { name: FONT_NAME, size: 10, italic: true, color: { argb: EXCEL_COLORS.RED_TEXT } };
        } else if (numericVal > 0 && !hasConditions) {
          xlCell.value = numericVal;
          xlCell.numFmt = '$#,##0';
          rowTextsForHeight.push(valStr);
          xlCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: EXCEL_COLORS.EMERALD_BG } };
          xlCell.font = { name: FONT_NAME, size: 10, bold: true, color: { argb: EXCEL_COLORS.EMERALD_TEXT } };
        } else {
          const baseDisplay =
            numericVal > 0 && !hasConditions
              ? '$' +
                numericVal.toLocaleString('es-CO', {
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0,
                })
              : formatMatrixValue(valStr);
          xlCell.value = baseDisplay;
          rowTextsForHeight.push(baseDisplay);
          xlCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: EXCEL_COLORS.EMERALD_BG } };
          xlCell.font = { name: FONT_NAME, size: 10, color: { argb: EXCEL_COLORS.EMERALD_TEXT } };
        }

        if (isWinner && !excluded) {
          xlCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: EXCEL_COLORS.AMBER_BG } };
          xlCell.font = { name: FONT_NAME, size: 10, bold: true, color: { argb: EXCEL_COLORS.AMBER_TEXT } };
        }

        xlCell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
        xlCell.border = { bottom: { style: 'thin', color: { argb: EXCEL_COLORS.BORDER_LIGHT } } };

        if (mode === 'technical') {
          if (cell.pageNumber) {
            xlCell.note = `Fuente original: PDF cotización, Página ${cell.pageNumber}`;
          }
          if (cell.confidence !== undefined && cell.confidence !== null) {
            const confText = `Confianza: ${(cell.confidence * 100).toFixed(0)}%`;
            xlCell.note = xlCell.note ? `${xlCell.note}\n${confText}` : confText;
          }
          if (hasMeaningfulNotes) {
            const deducNote = `Nota de extracción: ${trimmedNotes}`;
            xlCell.note = xlCell.note ? `${xlCell.note}\n${deducNote}` : deducNote;
          }
        }
      });

      if (hasNotes) {
        const cellId = `coverage-${row.id}`;
        const note = cellNotes?.[cellId];
        const notesCell = coveragesSheet.getCell(currentCovRow, quotes.length + 2);
        notesCell.value = note || '';
        notesCell.font = { name: FONT_NAME, size: 9, color: { argb: EXCEL_COLORS.PURPLE_NOTE }, italic: true };
        notesCell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
        if (note) {
          notesCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: EXCEL_COLORS.PURPLE_BG } };
          rowTextsForHeight.push(note);
        }
      }

      coveragesSheet.getRow(currentCovRow).height = calculateDynamicRowHeight(rowTextsForHeight, 24);
      currentCovRow++;
    }
  }
}
