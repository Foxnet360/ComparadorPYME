import { ExcelContext } from '../types';
import { FONT_NAME, EXCEL_COLORS, applySheetHeaderFooter } from '../excelStyles';
import { findColombianInsurerProfile } from '../../../shared/colombianInsurersCatalog';
import { isFinancialMatrixRow } from '../excelHelpers';
import { parseNumericValue } from '../../unifiedComparison/matrixTransformer';

export function buildFinancialsSheet(ctx: ExcelContext): void {
  const {
    workbook,
    quotes,
    reportData,
    matrix,
    insurerImageIds,
    maxAsset,
    brokerDetails,
    todayStr,
  } = ctx;

  const financialsSheet = workbook.addWorksheet('Primas y Costos');
  financialsSheet.views = [{ showGridLines: false }];
  applySheetHeaderFooter(financialsSheet, 'Primas y Costos', brokerDetails, todayStr);

  financialsSheet.getColumn(1).width = 44;
  for (let i = 0; i < quotes.length; i++) {
    financialsSheet.getColumn(i + 2).width = 30;
  }

  financialsSheet.mergeCells(1, 1, 2, quotes.length + 1);
  const finTitle = financialsSheet.getCell(1, 1);
  finTitle.value = 'EVALUACIÓN FINANCIERA DE PRIMAS Y COSTOS COMPARATIVOS';
  finTitle.font = {
    name: FONT_NAME,
    size: 14,
    bold: true,
    color: { argb: EXCEL_COLORS.NAVY_HEADER },
  };

  financialsSheet.getRow(4).height = 54;
  const finLabelHeader = financialsSheet.getCell(4, 1);
  finLabelHeader.value = 'CONCEPTO FINANCIERO';
  finLabelHeader.font = {
    name: FONT_NAME,
    size: 10,
    bold: true,
    color: { argb: EXCEL_COLORS.WHITE },
  };
  finLabelHeader.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: EXCEL_COLORS.NAVY_HEADER },
  };
  finLabelHeader.alignment = { vertical: 'middle', horizontal: 'left' };

  quotes.forEach((q, i) => {
    const insHeader = financialsSheet.getCell(4, i + 2);
    insHeader.value = q.insurerName.toUpperCase();
    const profile = findColombianInsurerProfile(q.insurerName);
    const argbColor = profile?.primaryColor
      ? 'FF' + profile.primaryColor.replace('#', '')
      : EXCEL_COLORS.NAVY_HEADER;
    insHeader.font = {
      name: FONT_NAME,
      size: 10,
      bold: true,
      color: { argb: EXCEL_COLORS.SLATE_DARK },
    };
    insHeader.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: EXCEL_COLORS.BG_SLATE_HEADER },
    };
    insHeader.border = {
      top: { style: 'medium', color: { argb: argbColor } },
      bottom: { style: 'thin', color: { argb: EXCEL_COLORS.BORDER_MEDIUM } },
      left: { style: 'thin', color: { argb: EXCEL_COLORS.BORDER_MEDIUM } },
      right: { style: 'thin', color: { argb: EXCEL_COLORS.BORDER_MEDIUM } },
    };
    insHeader.alignment = { horizontal: 'center', vertical: 'bottom', wrapText: true };

    if (insurerImageIds[i] !== null) {
      financialsSheet.addImage(insurerImageIds[i]!, {
        tl: { col: i + 1 + 0.38, row: 3.1 },
        ext: { width: 28, height: 28 },
      });
    }
  });

  const financialMatrixRows = matrix.filter(
    (row) => isFinancialMatrixRow(row) && row.type === 'data'
  );

  const normalizeFinLabel = (lbl: string) =>
    lbl
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();

  const netRow = financialMatrixRows.find((r) => {
    const l = normalizeFinLabel(r.label);
    return (
      l.includes('prima neta') ||
      l.includes('prima comercial') ||
      l.includes('prima sin iva') ||
      l.includes('prima antes de iva') ||
      l === 'neto'
    );
  });
  const expRow = financialMatrixRows.find((r) => {
    const l = normalizeFinLabel(r.label);
    return l.includes('gasto') || l.includes('expedici');
  });
  const ivaRow = financialMatrixRows.find((r) => {
    const l = normalizeFinLabel(r.label);
    return (
      l.includes('iva') &&
      !l.includes('con iva') &&
      !l.includes('iva incluido') &&
      !l.includes('inc. iva') &&
      !l.includes('inc iva')
    );
  });
  const totalRow = financialMatrixRows.find((r) => {
    const l = normalizeFinLabel(r.label);
    return (
      l.includes('total a pagar') ||
      l.includes('valor a pagar') ||
      l.includes('total prima') ||
      l.includes('prima total') ||
      l.includes('prima con iva') ||
      l.includes('total liquidacion') ||
      l.includes('total poliza') ||
      l === 'total'
    );
  });

  const hasExplicitInputMatrix = Boolean(
    reportData?.matrix && Array.isArray(reportData.matrix) && reportData.matrix.length > 0
  );

  const netPremiums: number[] = [];
  const expenses: number[] = [];
  const subtotals: number[] = [];
  const ivas: number[] = [];
  const totals: number[] = [];

  quotes.forEach((q, idx) => {
    if (q.financialBreakdown) {
      netPremiums.push(q.financialBreakdown.netPremium);
      expenses.push(q.financialBreakdown.expenses);
      subtotals.push(q.financialBreakdown.subtotal);
      ivas.push(q.financialBreakdown.iva);
      totals.push(q.financialBreakdown.totalPayable);
      return;
    }

    const rawNet = netRow ? parseNumericValue(netRow.cells[idx]?.value) : 0;
    const rawExp = expRow
      ? parseNumericValue(expRow.cells[idx]?.value)
      : q.priceAnnual === 0
        ? 0
        : q.expenses || q.fees || 0;
    const rawIva = ivaRow ? parseNumericValue(ivaRow.cells[idx]?.value) : 0;
    const rawTotal = totalRow ? parseNumericValue(totalRow.cells[idx]?.value) : 0;
    const quotePrice = q.priceAnnual || 0;

    if (hasExplicitInputMatrix && rawNet === 0 && (rawTotal > 0 || quotePrice > 0)) {
      // V2 unified matrix where priceAnnual / Total already includes IVA (and no separate Prima Neta row exists):
      // derive Subtotal, IVA, and Prima Neta from Total so we never double-charge 19% IVA over priceAnnual.
      const totVal = rawTotal > 0 ? rawTotal : quotePrice;
      const ivaVal = rawIva > 0 && rawIva < totVal ? rawIva : totVal - Math.round(totVal / 1.19);
      const subVal = Math.max(0, totVal - ivaVal);
      const expVal = Math.min(rawExp, subVal);
      const netVal = Math.max(0, subVal - expVal);

      netPremiums.push(netVal);
      expenses.push(expVal);
      subtotals.push(subVal);
      ivas.push(ivaVal);
      totals.push(totVal);
    } else if (rawNet > 0 && rawTotal > rawNet) {
      const netVal = rawNet;
      const expVal = rawExp;
      const subVal = netVal + expVal;
      const ivaVal = rawIva > 0 ? rawIva : Math.max(0, rawTotal - subVal);
      const totVal = subVal + ivaVal;

      netPremiums.push(netVal);
      expenses.push(expVal);
      subtotals.push(subVal);
      ivas.push(ivaVal);
      totals.push(totVal);
    } else {
      const netVal = rawNet > 0 ? rawNet : quotePrice;
      const expVal = rawExp;
      const subVal = netVal + expVal;
      const ivaVal = rawIva > 0 ? rawIva : Math.round(subVal * 0.19);
      const totVal = subVal + ivaVal;

      netPremiums.push(netVal);
      expenses.push(expVal);
      subtotals.push(subVal);
      ivas.push(ivaVal);
      totals.push(totVal);
    }
  });

  const addFinRow = (
    label: string,
    rowNum: number,
    getValueOrFormula: (
      colLetter: string,
      idx: number
    ) => {
      value?: number;
      formula?: string;
      result?: number;
      isTotal?: boolean;
      isWinner?: boolean;
    }
  ) => {
    financialsSheet.getRow(rowNum).height = 22;
    const lCell = financialsSheet.getCell(rowNum, 1);
    lCell.value = label;
    lCell.font = {
      name: FONT_NAME,
      size: 10,
      bold: true,
      color: { argb: EXCEL_COLORS.SLATE_LABEL },
    };
    lCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: EXCEL_COLORS.BG_SLATE_HEADER },
    };

    quotes.forEach((q, idx) => {
      const colLetter = String.fromCharCode(66 + idx);
      const xlCell = financialsSheet.getCell(`${colLetter}${rowNum}`);
      const res = getValueOrFormula(colLetter, idx);

      if (res.formula) {
        xlCell.value =
          res.result !== undefined
            ? { formula: res.formula, result: res.result }
            : { formula: res.formula };
      } else if (res.value !== undefined) {
        xlCell.value = res.value;
      }

      xlCell.numFmt = '$#,##0';
      xlCell.font = {
        name: FONT_NAME,
        size: 10,
        bold: !!res.isTotal,
        color: { argb: EXCEL_COLORS.SLATE_BODY },
      };
      xlCell.alignment = { horizontal: 'center' };

      if (res.isWinner) {
        xlCell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: EXCEL_COLORS.AMBER_BG },
        };
        xlCell.font = {
          name: FONT_NAME,
          size: 10,
          bold: true,
          color: { argb: EXCEL_COLORS.AMBER_TEXT },
        };
      }
    });
  };

  const positiveNets = netPremiums.filter((n) => n > 0);
  const minNet = positiveNets.length > 0 ? Math.min(...positiveNets) : 0;
  const positiveTotals = totals.filter((t) => t > 0);
  const minTotal = positiveTotals.length > 0 ? Math.min(...positiveTotals) : 0;
  const maxTotal = positiveTotals.length > 0 ? Math.max(...positiveTotals) : 0;

  addFinRow('Prima Neta (Anual)', 5, (_, idx) => ({
    value: netPremiums[idx]!,
    isWinner: netPremiums[idx]! > 0 && netPremiums[idx]! === minNet,
  }));

  addFinRow('Gastos de Expedición', 6, (_, idx) => ({
    value: expenses[idx]!,
  }));

  // Fórmulas automáticas nativas
  addFinRow('Subtotal', 7, (colLetter, idx) => ({
    formula: `SUM(${colLetter}5:${colLetter}6)`,
    result: subtotals[idx]!,
    isTotal: true,
  }));

  addFinRow('IVA (19%)', 8, (colLetter, idx) => {
    const subVal = subtotals[idx]!;
    const ivaVal = ivas[idx]!;
    if (Math.round(subVal * 0.19) === ivaVal) {
      return {
        formula: `ROUND(${colLetter}7*0.19, 0)`,
        result: ivaVal,
      };
    }
    return {
      value: ivaVal,
    };
  });

  addFinRow('TOTAL A PAGAR', 9, (colLetter, idx) => ({
    formula: `${colLetter}7+${colLetter}8`,
    result: totals[idx]!,
    isTotal: true,
    isWinner: totals[idx]! > 0 && totals[idx]! === minTotal,
  }));

  // Ratio % sobre Valor Asegurado
  financialsSheet.getRow(11).height = 22;
  const ratioLabel = financialsSheet.getCell(11, 1);
  ratioLabel.value = '% SOBRE VALOR ASEGURADO';
  ratioLabel.font = {
    name: FONT_NAME,
    size: 10,
    bold: true,
    color: { argb: EXCEL_COLORS.NAVY_HEADER },
  };

  quotes.forEach((q, idx) => {
    const colLetter = String.fromCharCode(66 + idx);
    const xlCell = financialsSheet.getCell(`${colLetter}11`);
    if (totals[idx]! > 0 && maxAsset > 0) {
      xlCell.value = { formula: `${colLetter}9/${maxAsset}`, result: totals[idx]! / maxAsset };
      xlCell.numFmt = '0.00%';
    } else {
      xlCell.value = 'N/A';
    }
    xlCell.alignment = { horizontal: 'center' };
  });

  // GRÁFICO INTEGRADO / INDICADOR DE COMPARACIÓN VISUAL DE PRECIOS
  financialsSheet.getRow(13).height = 24;
  const chartHeader = financialsSheet.getCell(13, 1);
  chartHeader.value = '📊 COMPARACIÓN GRÁFICA DE COSTO RELATIVO';
  chartHeader.font = {
    name: FONT_NAME,
    size: 10,
    bold: true,
    color: { argb: EXCEL_COLORS.NAVY_HEADER },
  };

  financialsSheet.getRow(14).height = 24;
  const chartLabel = financialsSheet.getCell(14, 1);
  chartLabel.value = 'Indicador Visual (Más Económica vs Más Costosa)';
  chartLabel.font = {
    name: FONT_NAME,
    size: 10,
    bold: true,
    color: { argb: EXCEL_COLORS.SLATE_MUTED },
  };
  chartLabel.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: EXCEL_COLORS.BG_LIGHT_GRAY },
  };

  quotes.forEach((q, idx) => {
    const colLetter = String.fromCharCode(66 + idx);
    const xlCell = financialsSheet.getCell(`${colLetter}14`);
    const p = totals[idx]!;

    if (p > 0 && minTotal > 0) {
      const diffPct = ((p - minTotal) / minTotal) * 100;
      let barChars = '██████████';
      if (diffPct === 0) barChars = '████ (MÁS ECONÓMICA)';
      else if (p === maxTotal) barChars = '████████████ (MÁS COSTOSA)';

      xlCell.value = `${barChars} (+${diffPct.toFixed(1)}%)`;

      if (p === minTotal) {
        xlCell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: EXCEL_COLORS.EMERALD_BG },
        };
        xlCell.font = {
          name: FONT_NAME,
          size: 9,
          bold: true,
          color: { argb: EXCEL_COLORS.EMERALD_TEXT },
        };
      } else if (p === maxTotal) {
        xlCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: EXCEL_COLORS.RED_BG } };
        xlCell.font = {
          name: FONT_NAME,
          size: 9,
          bold: true,
          color: { argb: EXCEL_COLORS.RED_TEXT },
        };
      } else {
        xlCell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: EXCEL_COLORS.YELLOW_BG },
        };
        xlCell.font = {
          name: FONT_NAME,
          size: 9,
          bold: true,
          color: { argb: EXCEL_COLORS.YELLOW_TEXT },
        };
      }
    } else {
      xlCell.value = 'N/A';
    }
    xlCell.alignment = { horizontal: 'center' };
  });
}
