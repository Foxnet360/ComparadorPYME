import { ExcelContext } from '../types';
import { FONT_NAME, EXCEL_COLORS, applySheetHeaderFooter } from '../excelStyles';
import { findColombianInsurerProfile } from '../../../shared/colombianInsurersCatalog';
import {
  isExcludedValue,
  parseNumericValue,
  formatMatrixValue,
  DEDUCTIBLE_SECTION_ID,
  FINANCIAL_SECTION_ID,
} from '../../unifiedComparison/matrixTransformer';
import { QuoteAnalysis } from '../../../types';

interface CondensedRow {
  type: 'header' | 'data';
  label: string;
  isCurrency?: boolean;
  getValue?: (q: QuoteAnalysis, idx?: number) => string | number;
}

export function buildSummarySheet(ctx: ExcelContext): void {
  const {
    workbook,
    quotes,
    brokerInfo,
    domain,
    regulatoryProfile,
    matrix,
    insurerImageIds,
    clientName,
    bestQuote,
    brokerDetails,
    todayStr,
  } = ctx;

  const summarySheet = workbook.addWorksheet('Cuadro Comparativo Resumido');
  summarySheet.views = [{ showGridLines: false }];
  applySheetHeaderFooter(summarySheet, 'Cuadro Comparativo Resumido', brokerDetails, todayStr);

  summarySheet.getColumn(1).width = 42;
  for (let i = 0; i < quotes.length; i++) {
    summarySheet.getColumn(i + 2).width = 34;
  }

  summarySheet.mergeCells(1, 1, 2, quotes.length + 1);
  const sumTitle = summarySheet.getCell(1, 1);
  sumTitle.value = 'CUADRO COMPARATIVO RESUMIDO · VISIÓN EJECUTIVA CONDENSADA';
  sumTitle.font = {
    name: FONT_NAME,
    size: 13,
    bold: true,
    color: { argb: EXCEL_COLORS.NAVY_HEADER },
  };
  sumTitle.alignment = { vertical: 'middle', horizontal: 'left' };

  // Embed broker logo on Cuadro Comparativo Resumido if provided
  if (brokerInfo?.logoUrl && brokerInfo.logoUrl.includes('base64,')) {
    try {
      const base64Data = brokerInfo.logoUrl.split('base64,')[1];
      if (base64Data) {
        const brokerImageId = workbook.addImage({
          base64: base64Data,
          extension: brokerInfo.logoUrl.includes('image/jpeg') ? 'jpeg' : 'png',
        });
        summarySheet.addImage(brokerImageId, {
          tl: { col: Math.max(1, quotes.length), row: 0.2 },
          ext: { width: 125, height: 38 },
        });
      }
    } catch (e) {
      console.warn('Failed to add broker logo to summarySheet', e);
    }
  }

  summarySheet.mergeCells(3, 1, 3, quotes.length + 1);
  const sumSubtitle = summarySheet.getCell(3, 1);
  sumSubtitle.value = `Cliente: ${clientName}  |  Ramo: ${regulatoryProfile.displayName}  |  Fecha: ${todayStr}`;
  sumSubtitle.font = {
    name: FONT_NAME,
    size: 9.5,
    italic: true,
    color: { argb: EXCEL_COLORS.SLATE_LIGHT },
  };
  sumSubtitle.alignment = { vertical: 'middle', horizontal: 'left' };

  // Bloque: INFORMACIÓN DEL TÉCNICO (INTERMEDIARIO)
  summarySheet.mergeCells(5, 1, 5, quotes.length + 1);
  const techHeader = summarySheet.getCell(5, 1);
  techHeader.value = 'INFORMACIÓN DEL TÉCNICO (INTERMEDIARIO)';
  techHeader.font = { name: FONT_NAME, size: 10, bold: true, color: { argb: EXCEL_COLORS.WHITE } };
  techHeader.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: EXCEL_COLORS.NAVY_HEADER },
  };
  techHeader.alignment = { vertical: 'middle', horizontal: 'left' };
  summarySheet.getRow(5).height = 22;

  summarySheet.mergeCells(6, 1, 6, quotes.length + 1);
  const techRow1 = summarySheet.getCell(6, 1);
  techRow1.value = `Técnico / Asesor: ${brokerDetails.advisor}   |   Compañía Intermediaria: ${brokerDetails.name}   |   Registro SFC: ${brokerDetails.reg}`;
  techRow1.font = {
    name: FONT_NAME,
    size: 9.5,
    bold: true,
    color: { argb: EXCEL_COLORS.SLATE_BODY },
  };
  techRow1.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: EXCEL_COLORS.BG_LIGHT_GRAY },
  };
  techRow1.alignment = { vertical: 'middle', horizontal: 'left' };
  techRow1.border = {
    left: { style: 'thin', color: { argb: EXCEL_COLORS.BORDER_MEDIUM } },
    right: { style: 'thin', color: { argb: EXCEL_COLORS.BORDER_MEDIUM } },
    top: { style: 'thin', color: { argb: EXCEL_COLORS.BORDER_MEDIUM } },
  };
  summarySheet.getRow(6).height = 20;

  summarySheet.mergeCells(7, 1, 7, quotes.length + 1);
  const techRow2 = summarySheet.getCell(7, 1);
  const locStr =
    [brokerDetails.address, brokerDetails.city].filter(Boolean).join(', ') || 'Colombia';
  techRow2.value = `Teléfono: ${brokerDetails.phone}   |   Email: ${brokerDetails.email}   |   Ubicación: ${locStr}   |   Web: ${brokerDetails.website}`;
  techRow2.font = { name: FONT_NAME, size: 9, color: { argb: EXCEL_COLORS.SLATE_MUTED } };
  techRow2.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: EXCEL_COLORS.BG_LIGHT_GRAY },
  };
  techRow2.alignment = { vertical: 'middle', horizontal: 'left' };
  techRow2.border = {
    left: { style: 'thin', color: { argb: EXCEL_COLORS.BORDER_MEDIUM } },
    right: { style: 'thin', color: { argb: EXCEL_COLORS.BORDER_MEDIUM } },
    bottom: { style: 'thin', color: { argb: EXCEL_COLORS.BORDER_MEDIUM } },
  };
  summarySheet.getRow(7).height = 20;

  summarySheet.getRow(8).height = 10;

  const tableHeaderRow = 9;
  summarySheet.getRow(tableHeaderRow).height = 54;
  const sumHeaderLabel = summarySheet.getCell(tableHeaderRow, 1);
  sumHeaderLabel.value = 'VARIABLE O CONCEPTO CLAVE';
  sumHeaderLabel.font = {
    name: FONT_NAME,
    size: 10,
    bold: true,
    color: { argb: EXCEL_COLORS.WHITE },
  };
  sumHeaderLabel.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: EXCEL_COLORS.NAVY_HEADER },
  };
  sumHeaderLabel.alignment = { vertical: 'middle', horizontal: 'left' };

  quotes.forEach((q, i) => {
    const headerCell = summarySheet.getCell(tableHeaderRow, i + 2);
    headerCell.value = q.insurerName.toUpperCase();
    const profile = findColombianInsurerProfile(q.insurerName);
    const argbColor = profile?.primaryColor
      ? 'FF' + profile.primaryColor.replace('#', '')
      : EXCEL_COLORS.NAVY_HEADER;
    headerCell.font = {
      name: FONT_NAME,
      size: 10,
      bold: true,
      color: { argb: EXCEL_COLORS.SLATE_DARK },
    };
    headerCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: EXCEL_COLORS.BG_SLATE_HEADER },
    };
    headerCell.border = {
      top: { style: 'medium', color: { argb: argbColor } },
      bottom: { style: 'thin', color: { argb: EXCEL_COLORS.BORDER_MEDIUM } },
      left: { style: 'thin', color: { argb: EXCEL_COLORS.BORDER_MEDIUM } },
      right: { style: 'thin', color: { argb: EXCEL_COLORS.BORDER_MEDIUM } },
    };
    headerCell.alignment = { horizontal: 'center', vertical: 'bottom', wrapText: true };

    if (insurerImageIds[i] !== null) {
      summarySheet.addImage(insurerImageIds[i]!, {
        tl: { col: i + 1 + 0.38, row: tableHeaderRow - 0.9 },
        ext: { width: 28, height: 28 },
      });
    }
  });

  const getCoverageSummary = (q: QuoteAnalysis, keywords: string[], quoteIdx?: number): string => {
    for (const c of q.coverages || []) {
      const nameNorm = (c.name || c.canonicalName || '').toLowerCase();
      if (keywords.some((kw) => nameNorm.includes(kw))) {
        if (c.value && !isExcludedValue(c.value)) {
          const num = parseNumericValue(c.value);
          return num > 0 ? '$ ' + num.toLocaleString('es-CO') : formatMatrixValue(c.value);
        }
      }
    }

    if (typeof quoteIdx === 'number' && matrix && matrix.length > 0) {
      const row = matrix.find((r) => {
        if (r.type !== 'data' || !r.cells || !r.cells[quoteIdx]) return false;
        if (r.sectionId === FINANCIAL_SECTION_ID) return false;
        const labelNorm = (r.label || '').toLowerCase();
        return keywords.some((kw) => labelNorm.includes(kw));
      });
      if (row && row.cells[quoteIdx]?.value) {
        const val = row.cells[quoteIdx]!.value;
        if (val && val !== 'No informado' && val !== 'No cotizado' && !isExcludedValue(val)) {
          const num = parseNumericValue(val);
          return num > 0 ? '$ ' + num.toLocaleString('es-CO') : formatMatrixValue(val);
        }
      }
    }

    return 'No cotizado';
  };

  const getDeductibleSummary = (
    q: QuoteAnalysis,
    keywords: string[],
    quoteIdx?: number
  ): string => {
    for (const c of q.coverages || []) {
      const nameNorm = (c.name || c.canonicalName || '').toLowerCase();
      if (keywords.some((kw) => nameNorm.includes(kw))) {
        if (
          c.deductible &&
          c.deductible.trim() !== '' &&
          c.deductible.toLowerCase() !== 'no aplica' &&
          c.deductible.toLowerCase() !== 'no especificado'
        ) {
          return c.deductible;
        }
      }
    }

    if (typeof quoteIdx === 'number' && matrix && matrix.length > 0) {
      const dedRow = matrix.find((r) => {
        if (r.type !== 'data' || !r.cells || !r.cells[quoteIdx]) return false;
        if (r.sectionId !== DEDUCTIBLE_SECTION_ID && !r.label.toLowerCase().includes('deducible')) {
          return false;
        }
        const labelNorm = (r.label || '').toLowerCase();
        return keywords.some((kw) => labelNorm.includes(kw));
      });
      if (dedRow && dedRow.cells[quoteIdx]?.value) {
        const val = dedRow.cells[quoteIdx]!.value;
        if (val && val !== 'No informado' && val !== 'No cotizado') {
          return val;
        }
      }
    }

    return 'Según condiciones generales';
  };

  const domainRules = regulatoryProfile?.mandatoryVerificationRules || [];
  const isVida = domain === 'vida_grupo';

  const condensedRows: CondensedRow[] = [
    { type: 'header', label: '1. CONDICIONES ECONÓMICAS Y FORMA DE PAGO' },
    {
      type: 'data',
      label: 'Prima Neta Anual',
      isCurrency: true,
      getValue: (q) =>
        q.financialBreakdown?.netPremium ??
        (isVida ? q.priceAnnual || 0 : Math.round((q.priceAnnual || 0) / 1.19)),
    },
    {
      type: 'data',
      label: 'Gastos de Expedición',
      isCurrency: true,
      getValue: (q) => q.financialBreakdown?.expenses ?? q.expenses ?? q.fees ?? 0,
    },
    {
      type: 'data',
      label: isVida ? 'IVA (0% Exento Art. 427 E.T.)' : 'IVA (19%)',
      isCurrency: true,
      getValue: (q) =>
        isVida
          ? 0
          : (q.financialBreakdown?.iva ??
            Math.max(0, (q.priceAnnual || 0) - Math.round((q.priceAnnual || 0) / 1.19))),
    },
    {
      type: 'data',
      label: 'Total a Pagar',
      isCurrency: true,
      getValue: (q) =>
        q.financialBreakdown?.totalPayable ??
        (q.priceAnnual || (q.priceMonthly ? q.priceMonthly * 12 : 0)),
    },
    {
      type: 'data',
      label: 'Forma y Opciones de Pago',
      getValue: (q) =>
        (q as any).paymentTerms || (q.priceMonthly ? 'Financiado / Mensual' : 'Anual Contado'),
    },
    {
      type: 'header',
      label: `2. VALORES ASEGURADOS PRINCIPALES (${(regulatoryProfile?.displayName || 'COBERTURAS').toUpperCase()})`,
    },
    ...(domainRules.length > 0
      ? domainRules.map((rule) => ({
          type: 'data' as const,
          label: rule.title,
          getValue: (q: QuoteAnalysis, idx?: number) => getCoverageSummary(q, rule.keywords, idx),
        }))
      : [
          {
            type: 'data' as const,
            label: 'Amparo Principal / Cobertura Básica',
            getValue: (q: QuoteAnalysis) =>
              (q.coverages && q.coverages[0]?.value) || 'Ver condicionado',
          },
        ]),
    { type: 'header', label: '3. ESTRUCTURA DE DEDUCIBLES' },
    ...(domainRules.length > 0
      ? domainRules.map((rule) => ({
          type: 'data' as const,
          label: `Deducible: ${rule.title}`,
          getValue: (q: QuoteAnalysis, idx?: number) => getDeductibleSummary(q, rule.keywords, idx),
        }))
      : [
          {
            type: 'data' as const,
            label: 'Deducibles Generales',
            getValue: (q: QuoteAnalysis) => q.deductibles || 'Ver condicionado particular',
          },
        ]),
    { type: 'header', label: '4. EVALUACIÓN Y DICTAMEN DE ASESORÍA' },
    {
      type: 'data',
      label: 'Calificación Técnica Integral',
      getValue: (q) => `${q.score || 0} / 100`,
    },
    {
      type: 'data',
      label: 'Aspecto Clave / Recomendación',
      getValue: (q) =>
        q.insurerName === bestQuote.insurerName
          ? '⭐ Opción más recomendada en balance técnico'
          : 'Propuesta competitiva de mercado',
    },
  ];

  let currentSumRow = 10;
  for (const cr of condensedRows) {
    if (cr.type === 'header') {
      summarySheet.mergeCells(currentSumRow, 1, currentSumRow, quotes.length + 1);
      const hCell = summarySheet.getCell(currentSumRow, 1);
      hCell.value = cr.label;
      hCell.font = {
        name: FONT_NAME,
        size: 10.5,
        bold: true,
        color: { argb: EXCEL_COLORS.NAVY_HEADER },
      };
      hCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: EXCEL_COLORS.BG_SECTION_HEADER },
      };
      hCell.alignment = { vertical: 'middle', horizontal: 'left' };
      summarySheet.getRow(currentSumRow).height = 24;
      currentSumRow++;
    } else {
      const lCell = summarySheet.getCell(currentSumRow, 1);
      lCell.value = cr.label;
      lCell.font = {
        name: FONT_NAME,
        size: 9.5,
        bold: true,
        color: { argb: EXCEL_COLORS.SLATE_MUTED },
      };
      lCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: EXCEL_COLORS.BG_LIGHT_GRAY },
      };
      lCell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
      summarySheet.getRow(currentSumRow).height = 24;

      quotes.forEach((q, idx) => {
        const cCell = summarySheet.getCell(currentSumRow, idx + 2);
        const val = cr.getValue ? cr.getValue(q, idx) : '';
        if (cr.isCurrency && typeof val === 'number') {
          cCell.value = val > 0 ? val : 'No informado';
          if (val > 0) {
            cCell.numFmt = '$#,##0';
            cCell.font = {
              name: FONT_NAME,
              size: 9.5,
              bold: true,
              color: { argb: EXCEL_COLORS.EMERALD_TEXT },
            };
            cCell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: EXCEL_COLORS.EMERALD_BG },
            };
          } else {
            cCell.font = { name: FONT_NAME, size: 9.5, color: { argb: EXCEL_COLORS.SLATE_LIGHT } };
          }
        } else {
          cCell.value = val;
          cCell.font = { name: FONT_NAME, size: 9.5, color: { argb: EXCEL_COLORS.SLATE_BODY } };
        }
        cCell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
        cCell.border = { bottom: { style: 'thin', color: { argb: EXCEL_COLORS.BORDER_LIGHT } } };
      });
      currentSumRow++;
    }
  }

  // Bloque Pie de Página: Información de Contacto del Intermediario
  currentSumRow += 1;
  summarySheet.getRow(currentSumRow).height = 24;
  summarySheet.mergeCells(currentSumRow, 1, currentSumRow, quotes.length + 1);
  const sumFooterCell = summarySheet.getCell(currentSumRow, 1);
  sumFooterCell.value = `CONTACTO Y ASESORÍA TÉCNICA: ${brokerDetails.name}   |   Asesor: ${brokerDetails.advisor}   |   Tel: ${brokerDetails.phone}   |   Email: ${brokerDetails.email}   |   Web: ${brokerDetails.website}   |   Reg. SFC: ${brokerDetails.reg}`;
  sumFooterCell.font = {
    name: FONT_NAME,
    size: 9,
    bold: true,
    color: { argb: EXCEL_COLORS.NAVY_ACCENT },
  };
  sumFooterCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: EXCEL_COLORS.BG_SLATE_HEADER },
  };
  sumFooterCell.alignment = { vertical: 'middle', horizontal: 'center' };
  sumFooterCell.border = {
    top: { style: 'thin', color: { argb: EXCEL_COLORS.BORDER_MEDIUM } },
    bottom: { style: 'thin', color: { argb: EXCEL_COLORS.BORDER_MEDIUM } },
    left: { style: 'thin', color: { argb: EXCEL_COLORS.BORDER_MEDIUM } },
    right: { style: 'thin', color: { argb: EXCEL_COLORS.BORDER_MEDIUM } },
  };

  currentSumRow += 1;
  summarySheet.getRow(currentSumRow).height = 20;
  summarySheet.mergeCells(currentSumRow, 1, currentSumRow, quotes.length + 1);
  const sumLegalCell = summarySheet.getCell(currentSumRow, 1);
  sumLegalCell.value =
    'Intermediación de seguros regulada por el Estatuto Orgánico del Sistema Financiero. Vigilado por la Superintendencia Financiera de Colombia. Radicación y acompañamiento en reclamación de siniestros.';
  sumLegalCell.font = {
    name: FONT_NAME,
    size: 8,
    italic: true,
    color: { argb: EXCEL_COLORS.SLATE_LIGHT },
  };
  sumLegalCell.alignment = { vertical: 'middle', horizontal: 'center' };
}
