import { ExcelContext } from '../types';
import { FONT_NAME, EXCEL_COLORS, applySheetHeaderFooter } from '../excelStyles';
import { findColombianInsurerProfile } from '../../../shared/colombianInsurersCatalog';
import {
  isDeductibleMatrixRow,
  pruneOrphanedSectionRows,
  calculateDynamicRowHeight,
} from '../excelHelpers';
import {
  enrichSmmlvDeductible,
  HEADER_SECTION_ID,
} from '../../unifiedComparison/matrixTransformer';
import { MatrixRow, MatrixCell } from '../../../types';

export function buildDeductiblesSheet(ctx: ExcelContext): void {
  const {
    workbook,
    quotes,
    matrix,
    insurerImageIds,
    brokerDetails,
    todayStr,
  } = ctx;

  const deductiblesSheet = workbook.addWorksheet('Matriz Deducibles');
  deductiblesSheet.views = [{ showGridLines: false }];
  applySheetHeaderFooter(deductiblesSheet, 'Matriz Deducibles', brokerDetails, todayStr);

  deductiblesSheet.getColumn(1).width = 45;
  for (let i = 0; i < quotes.length; i++) {
    deductiblesSheet.getColumn(i + 2).width = 38;
  }

  deductiblesSheet.mergeCells(1, 1, 2, quotes.length + 1);
  const dedTitle = deductiblesSheet.getCell(1, 1);
  dedTitle.value = 'MATRIZ CONSOLIDADA DE DEDUCIBLES Y RETENCIÓN DE RIESGO';
  dedTitle.font = { name: FONT_NAME, size: 14, bold: true, color: { argb: EXCEL_COLORS.NAVY_HEADER } };

  deductiblesSheet.getRow(4).height = 54;
  const dedLabelHeader = deductiblesSheet.getCell(4, 1);
  dedLabelHeader.value = 'AMPARO / COBERTURA';
  dedLabelHeader.font = { name: FONT_NAME, size: 10, bold: true, color: { argb: EXCEL_COLORS.WHITE } };
  dedLabelHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: EXCEL_COLORS.NAVY_HEADER } };
  dedLabelHeader.alignment = { vertical: 'middle', horizontal: 'left' };

  quotes.forEach((q, i) => {
    const insHeader = deductiblesSheet.getCell(4, i + 2);
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
      deductiblesSheet.addImage(insurerImageIds[i]!, {
        tl: { col: i + 1 + 0.38, row: 3.1 },
        ext: { width: 28, height: 28 },
      });
    }
  });

  // Filter matrix for deductible rows, qualifying generic "Deducible" sub-rows with their parent section header
  // and pruning orphaned headers.
  let activeParentHeader = '';
  const rawDeductibleRows: MatrixRow[] = [];
  for (const row of matrix) {
    if (row.type === 'header' && row.sectionId !== HEADER_SECTION_ID) {
      activeParentHeader = row.label || '';
    }
    if (isDeductibleMatrixRow(row)) {
      if (
        row.type === 'data' &&
        row.label.trim().toLowerCase() === 'deducible' &&
        activeParentHeader &&
        !activeParentHeader.toLowerCase().includes('deducible')
      ) {
        rawDeductibleRows.push({
          ...row,
          label: `${activeParentHeader} - Deducible`,
        });
      } else {
        rawDeductibleRows.push(row);
      }
    }
  }
  const deductibleMatrixRows = pruneOrphanedSectionRows(rawDeductibleRows);

  let currentDedRow = 5;

  if (deductibleMatrixRows.length > 0) {
    for (const row of deductibleMatrixRows) {
      if (row.type === 'header') {
        deductiblesSheet.mergeCells(currentDedRow, 1, currentDedRow, quotes.length + 1);
        const cell = deductiblesSheet.getCell(currentDedRow, 1);
        cell.value = row.label;
        cell.font = { name: FONT_NAME, size: 11, bold: true, color: { argb: EXCEL_COLORS.NAVY_HEADER } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: EXCEL_COLORS.BG_SECTION_HEADER } };
        cell.alignment = { vertical: 'middle', horizontal: 'left' };
        deductiblesSheet.getRow(currentDedRow).height = 24;
        currentDedRow++;
      } else if (row.type === 'spacer') {
        deductiblesSheet.getRow(currentDedRow).height = 8;
        currentDedRow++;
      } else {
        const labelCell = deductiblesSheet.getCell(currentDedRow, 1);
        labelCell.value = row.label;
        labelCell.font = { name: FONT_NAME, size: 10, bold: true, color: { argb: EXCEL_COLORS.SLATE_MUTED } };
        labelCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: EXCEL_COLORS.BG_LIGHT_GRAY } };
        labelCell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };

        const dedTextsForHeight: string[] = [row.label || ''];

        row.cells.forEach((cell: MatrixCell, idx: number) => {
          const xlCell = deductiblesSheet.getCell(currentDedRow, idx + 2);
          const rawDed = cell.value || 'Sin deducible';
          const enrichedDed = enrichSmmlvDeductible(rawDed);
          dedTextsForHeight.push(enrichedDed);
          const isNoAplica =
            enrichedDed.toLowerCase().includes('no aplica') ||
            enrichedDed.toLowerCase().includes('sin deducible');

          xlCell.value = enrichedDed;
          xlCell.font = { name: FONT_NAME, size: 10, color: { argb: EXCEL_COLORS.SLATE_BODY } };

          if (isNoAplica) {
            xlCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: EXCEL_COLORS.EMERALD_BG } };
            xlCell.font = { name: FONT_NAME, size: 10, bold: true, color: { argb: EXCEL_COLORS.EMERALD_TEXT } };
          }

          xlCell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
          xlCell.border = { bottom: { style: 'thin', color: { argb: EXCEL_COLORS.BORDER_LIGHT } } };
        });

        deductiblesSheet.getRow(currentDedRow).height = calculateDynamicRowHeight(
          dedTextsForHeight,
          24
        );
        currentDedRow++;
      }
    }
  } else {
    // Fallback: iterate quotes coverages for deductibles
    const coverageNames = Array.from(
      new Set(quotes.flatMap((q) => (q.coverages || []).map((c) => c.name)))
    );

    coverageNames.forEach((covName) => {
      const labelCell = deductiblesSheet.getCell(currentDedRow, 1);
      labelCell.value = covName;
      labelCell.font = { name: FONT_NAME, size: 10, bold: true, color: { argb: EXCEL_COLORS.SLATE_MUTED } };
      labelCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: EXCEL_COLORS.BG_LIGHT_GRAY } };
      labelCell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };

      const dedTextsForHeight: string[] = [covName || ''];

      quotes.forEach((q, qIdx) => {
        const xlCell = deductiblesSheet.getCell(currentDedRow, qIdx + 2);
        const cov = (q.coverages || []).find((c) => c.name === covName);
        const rawDed = cov?.deductible || 'Sin deducible';
        const enrichedDed = enrichSmmlvDeductible(rawDed);
        dedTextsForHeight.push(enrichedDed);
        const isNoAplica =
          enrichedDed.toLowerCase().includes('no aplica') ||
          enrichedDed.toLowerCase().includes('sin deducible');

        xlCell.value = enrichedDed;
        xlCell.font = { name: FONT_NAME, size: 10, color: { argb: EXCEL_COLORS.SLATE_BODY } };

        if (isNoAplica) {
          xlCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: EXCEL_COLORS.EMERALD_BG } };
          xlCell.font = { name: FONT_NAME, size: 10, bold: true, color: { argb: EXCEL_COLORS.EMERALD_TEXT } };
        }

        xlCell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
        xlCell.border = { bottom: { style: 'thin', color: { argb: EXCEL_COLORS.BORDER_LIGHT } } };
      });
      deductiblesSheet.getRow(currentDedRow).height = calculateDynamicRowHeight(
        dedTextsForHeight,
        24
      );
      currentDedRow++;
    });
  }
}
