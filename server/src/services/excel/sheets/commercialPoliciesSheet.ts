import { ExcelContext } from '../types';
import { FONT_NAME, EXCEL_COLORS, applySheetHeaderFooter } from '../excelStyles';
import {
  extractCommercialConditionsFromReport,
  COMMERCIAL_CONDITION_FIELDS,
  getStructuredCommercialPolicyEntries,
  getEffectiveCommercialPolicies,
} from '../../../shared/commercialPolicies';

export function buildCommercialPoliciesSheet(ctx: ExcelContext): void {
  const {
    workbook,
    quotes,
    brokerInfo,
    reportData,
    matrix,
    regulatoryProfile,
    brokerDetails,
    todayStr,
  } = ctx;

  const commercialPoliciesSheet = workbook.addWorksheet('Políticas Comerciales');
  commercialPoliciesSheet.views = [{ showGridLines: false }];
  applySheetHeaderFooter(commercialPoliciesSheet, 'Políticas Comerciales', brokerDetails, todayStr);

  commercialPoliciesSheet.getColumn(1).width = 32;
  commercialPoliciesSheet.getColumn(2).width = 35;
  commercialPoliciesSheet.getColumn(3).width = 75;

  commercialPoliciesSheet.mergeCells('A1:C2');
  const policyTitle = commercialPoliciesSheet.getCell('A1');
  policyTitle.value = `POLÍTICAS COMERCIALES Y CONDICIONES DE LA OFERTA · ${regulatoryProfile.displayName.toUpperCase()}`;
  policyTitle.font = {
    name: FONT_NAME,
    size: 13,
    bold: true,
    color: { argb: EXCEL_COLORS.NAVY_HEADER },
  };

  commercialPoliciesSheet.mergeCells('A3:C3');
  const policySubtitle = commercialPoliciesSheet.getCell('A3');
  policySubtitle.value =
    'Condiciones operativas y términos comerciales parametrizados por la correduría de seguros para la presentación de propuestas.';
  policySubtitle.font = {
    name: FONT_NAME,
    size: 10,
    italic: true,
    color: { argb: EXCEL_COLORS.SLATE_MUTED },
  };

  // 1. Tabla Comparativa de Condiciones Comerciales Propuestas por cada Aseguradora
  const extractedConditions = extractCommercialConditionsFromReport({
    quotes,
    matrix,
    commercialConditions: (reportData as any)?.commercialConditions,
  });

  const totalColCount = Math.max(3, quotes.length + 1);
  commercialPoliciesSheet.mergeCells(5, 1, 5, totalColCount);
  const compCondHeader = commercialPoliciesSheet.getCell(5, 1);
  compCondHeader.value = 'CONDICIONES COMERCIALES PROPUESTAS POR CADA ASEGURADORA EN COTIZACIÓN';
  compCondHeader.font = {
    name: FONT_NAME,
    size: 10.5,
    bold: true,
    color: { argb: EXCEL_COLORS.NAVY_HEADER },
  };
  compCondHeader.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: EXCEL_COLORS.BG_SLATE_HEADER },
  };

  commercialPoliciesSheet.getRow(6).height = 26;
  const condHeaderCell = commercialPoliciesSheet.getCell(6, 1);
  condHeaderCell.value = 'Condición Comercial';
  condHeaderCell.font = {
    name: FONT_NAME,
    size: 10,
    bold: true,
    color: { argb: EXCEL_COLORS.WHITE },
  };
  condHeaderCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: EXCEL_COLORS.NAVY_HEADER },
  };

  quotes.forEach((q, idx) => {
    commercialPoliciesSheet.getColumn(idx + 2).width = 34;
    const colCell = commercialPoliciesSheet.getCell(6, idx + 2);
    colCell.value = (q.insurerName || `Aseguradora ${idx + 1}`).toUpperCase();
    colCell.font = { name: FONT_NAME, size: 10, bold: true, color: { argb: EXCEL_COLORS.WHITE } };
    colCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: EXCEL_COLORS.NAVY_HEADER },
    };
    colCell.alignment = { horizontal: 'center', vertical: 'middle' };
  });

  let pRowIdx = 7;
  COMMERCIAL_CONDITION_FIELDS.forEach(({ key, label }) => {
    commercialPoliciesSheet.getRow(pRowIdx).height = 24;
    const labelCell = commercialPoliciesSheet.getCell(pRowIdx, 1);
    labelCell.value = label;
    labelCell.font = {
      name: FONT_NAME,
      size: 9.5,
      bold: true,
      color: { argb: EXCEL_COLORS.NAVY_ACCENT },
    };

    quotes.forEach((q, idx) => {
      const insName = q.insurerName || `Aseguradora ${idx + 1}`;
      const cellVal = extractedConditions[insName]?.[key] || 'No especificado en cotización';
      const cCell = commercialPoliciesSheet.getCell(pRowIdx, idx + 2);
      cCell.value = cellVal;
      cCell.font = { name: FONT_NAME, size: 9.5, color: { argb: EXCEL_COLORS.SLATE_BODY } };
      cCell.alignment = { wrapText: true, vertical: 'middle' };
    });
    pRowIdx++;
  });

  pRowIdx += 1;

  // 2. Políticas Generales del Corredor
  commercialPoliciesSheet.mergeCells(pRowIdx, 1, pRowIdx, totalColCount);
  const brokerTitleCell = commercialPoliciesSheet.getCell(pRowIdx, 1);
  brokerTitleCell.value = 'POLÍTICAS GENERALES DE INTERMEDIACIÓN Y PROCEDIMIENTOS DEL CORREDOR';
  brokerTitleCell.font = {
    name: FONT_NAME,
    size: 10.5,
    bold: true,
    color: { argb: EXCEL_COLORS.NAVY_HEADER },
  };
  brokerTitleCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: EXCEL_COLORS.BG_SLATE_HEADER },
  };
  pRowIdx++;

  const effectivePolicies = getEffectiveCommercialPolicies(brokerInfo?.commercialPolicies);
  const structuredPolicies = getStructuredCommercialPolicyEntries(effectivePolicies);

  commercialPoliciesSheet.getRow(pRowIdx).height = 26;
  const pHeaders = ['Categoría', 'Término / Condición', 'Detalle y Alcance Operativo'];
  pHeaders.forEach((h, idx) => {
    const cell = commercialPoliciesSheet.getCell(pRowIdx, idx + 1);
    cell.value = h;
    cell.font = { name: FONT_NAME, size: 10, bold: true, color: { argb: EXCEL_COLORS.WHITE } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: EXCEL_COLORS.NAVY_HEADER } };
    cell.alignment = { vertical: 'middle', horizontal: 'left' };
  });
  pRowIdx++;
  structuredPolicies.forEach((item) => {
    commercialPoliciesSheet.getRow(pRowIdx).height = 24;
    const catCell = commercialPoliciesSheet.getCell(pRowIdx, 1);
    catCell.value = item.category;
    catCell.font = {
      name: FONT_NAME,
      size: 10,
      bold: true,
      color: { argb: EXCEL_COLORS.NAVY_ACCENT },
    };

    const titleCell = commercialPoliciesSheet.getCell(pRowIdx, 2);
    titleCell.value = item.title;
    titleCell.font = {
      name: FONT_NAME,
      size: 9.5,
      bold: true,
      color: { argb: EXCEL_COLORS.SLATE_LABEL },
    };

    const detailCell = commercialPoliciesSheet.getCell(pRowIdx, 3);
    detailCell.value = item.detail;
    detailCell.font = { name: FONT_NAME, size: 9.5, color: { argb: EXCEL_COLORS.SLATE_BODY } };
    detailCell.alignment = { wrapText: true, vertical: 'middle' };

    pRowIdx++;
  });

  pRowIdx += 1;
  commercialPoliciesSheet.getRow(pRowIdx).height = 24;
  const brokerCardCell = commercialPoliciesSheet.getCell(pRowIdx, 1);
  commercialPoliciesSheet.mergeCells(pRowIdx, 1, pRowIdx, totalColCount);
  brokerCardCell.value = `INTERMEDIARIO: ${brokerDetails.name} | ASESOR: ${brokerDetails.advisor} | REG. SFC: ${brokerDetails.reg} | TEL: ${brokerDetails.phone} | EMAIL: ${brokerDetails.email} | WEB: ${brokerDetails.website}`;
  brokerCardCell.font = {
    name: FONT_NAME,
    size: 9.5,
    bold: true,
    color: { argb: EXCEL_COLORS.NAVY_ACCENT },
  };
  brokerCardCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: EXCEL_COLORS.BG_SLATE_HEADER },
  };
  brokerCardCell.alignment = { vertical: 'middle', horizontal: 'left' };

  pRowIdx += 2;
  commercialPoliciesSheet.getRow(pRowIdx).height = 24;
  const legalNoticeCell = commercialPoliciesSheet.getCell(pRowIdx, 1);
  commercialPoliciesSheet.mergeCells(pRowIdx, 1, pRowIdx + 2, totalColCount);
  legalNoticeCell.value =
    'MARCO LEGAL COLOMBIANO: La intermediación de seguros se ejerce bajo el Estatuto Orgánico del Sistema Financiero (Decreto 663 de 1993) y las instrucciones de la Superintendencia Financiera de Colombia. El contrato de seguro se rige por el Código de Comercio de Colombia (Arts. 1036 y ss). El tomador cuenta con un plazo legal de aviso de siniestro de 3 días hábiles conforme al Art. 1075 C.Co.';
  legalNoticeCell.font = {
    name: FONT_NAME,
    size: 8.5,
    italic: true,
    color: { argb: EXCEL_COLORS.SLATE_LIGHT },
  };
  legalNoticeCell.alignment = { wrapText: true, vertical: 'middle' };
}
