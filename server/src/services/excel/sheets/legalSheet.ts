import { ExcelContext } from '../types';
import { FONT_NAME, EXCEL_COLORS, applySheetHeaderFooter } from '../excelStyles';

export async function buildLegalSheet(ctx: ExcelContext): Promise<void> {
  const {
    workbook,
    quotes,
    domain,
    regulatoryProfile,
    brokerDetails,
    todayStr,
  } = ctx;

  const legalSheet = workbook.addWorksheet('Respaldo Normativo y Legal');
  legalSheet.views = [{ showGridLines: false }];
  applySheetHeaderFooter(legalSheet, 'Respaldo Normativo y Legal', brokerDetails, todayStr);

  legalSheet.getColumn(1).width = 28;
  legalSheet.getColumn(2).width = 32;
  legalSheet.getColumn(3).width = 24;
  legalSheet.getColumn(4).width = 45;
  legalSheet.getColumn(5).width = 45;

  legalSheet.mergeCells('A1:E2');
  const legalTitle = legalSheet.getCell('A1');
  legalTitle.value = `MARCO NORMATIVO Y AUDITORÍA DE CONFORMIDAD REGULATORIA · ${regulatoryProfile.displayName.toUpperCase()}`;
  legalTitle.font = { name: FONT_NAME, size: 13, bold: true, color: { argb: EXCEL_COLORS.NAVY_HEADER } };

  legalSheet.mergeCells('A3:E3');
  const taglineCell = legalSheet.getCell('A3');
  taglineCell.value = regulatoryProfile.tagline;
  taglineCell.font = { name: FONT_NAME, size: 10, italic: true, color: { argb: EXCEL_COLORS.SLATE_MUTED } };

  // Sección 1: Normas Principales Vigentes
  legalSheet.getRow(5).height = 24;
  const lawHeader = legalSheet.getCell('A5');
  lawHeader.value = 'LEGISLACIÓN Y NORMAS COLOMBIANAS INYECTADAS EN ESTE RAMO';
  lawHeader.font = { name: FONT_NAME, size: 11, bold: true, color: { argb: EXCEL_COLORS.SLATE_DARK } };

  let lRowIdx = 6;
  regulatoryProfile.primaryLaws.forEach((law) => {
    legalSheet.getRow(lRowIdx).height = 22;
    const codeCell = legalSheet.getCell(lRowIdx, 1);
    codeCell.value = law.code;
    codeCell.font = { name: FONT_NAME, size: 10, bold: true, color: { argb: EXCEL_COLORS.NAVY_ACCENT } };

    const titleCell = legalSheet.getCell(lRowIdx, 2);
    titleCell.value = law.title;
    titleCell.font = { name: FONT_NAME, size: 10, bold: true };

    legalSheet.mergeCells(lRowIdx, 3, lRowIdx, 5);
    const summaryCell = legalSheet.getCell(lRowIdx, 3);
    summaryCell.value = law.summary;
    summaryCell.font = { name: FONT_NAME, size: 9.5, color: { argb: EXCEL_COLORS.SLATE_LABEL } };

    lRowIdx++;
  });

  // Sección 2: Matriz de Verificación Automática por Aseguradora
  lRowIdx += 2;
  legalSheet.getRow(lRowIdx).height = 26;
  const matrixAuditHeader = legalSheet.getCell(lRowIdx, 1);
  matrixAuditHeader.value = 'DICTAMEN DE CONFORMIDAD DE AMPAROS OBLIGATORIOS POR ASEGURADORA';
  matrixAuditHeader.font = { name: FONT_NAME, size: 11, bold: true, color: { argb: EXCEL_COLORS.SLATE_DARK } };

  lRowIdx++;
  legalSheet.getRow(lRowIdx).height = 26;
  const auditHeaders = [
    'Aseguradora',
    'Amparo Mandatorio',
    'Estado de Conformidad',
    'Base Legal / Normativa',
    'Detalle de Auditoría',
  ];
  auditHeaders.forEach((h, idx) => {
    const cell = legalSheet.getCell(lRowIdx, idx + 1);
    cell.value = h;
    cell.font = { name: FONT_NAME, size: 10, bold: true, color: { argb: EXCEL_COLORS.WHITE } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: EXCEL_COLORS.NAVY_HEADER } };
    cell.alignment = { horizontal: idx === 2 ? 'center' : 'left' };
  });

  lRowIdx++;
  const { auditReportCompliance } = await import('../../regulatoryAuditService');
  const reportCompliance = auditReportCompliance(quotes, domain);

  quotes.forEach((q) => {
    const checks = reportCompliance[q.insurerName] || [];
    checks.forEach((chk) => {
      legalSheet.getRow(lRowIdx).height = 22;

      legalSheet.getCell(lRowIdx, 1).value = q.insurerName;
      legalSheet.getCell(lRowIdx, 2).value = chk.title;

      const statusCell = legalSheet.getCell(lRowIdx, 3);
      if (chk.status === 'COMPLIANT') {
        statusCell.value = 'CONFORME';
        statusCell.font = { name: FONT_NAME, size: 9.5, bold: true, color: { argb: EXCEL_COLORS.EMERALD_DARK_TEXT } };
        statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: EXCEL_COLORS.EMERALD_LIGHT_BG } };
      } else if (chk.status === 'NON_COMPLIANT') {
        statusCell.value = 'NO CONFORME (CRÍTICO)';
        statusCell.font = { name: FONT_NAME, size: 9.5, bold: true, color: { argb: EXCEL_COLORS.RED_DARK_TEXT } };
        statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: EXCEL_COLORS.RED_LIGHT_BG } };
      } else {
        statusCell.value = 'ADVERTENCIA (REVISAR)';
        statusCell.font = { name: FONT_NAME, size: 9.5, bold: true, color: { argb: EXCEL_COLORS.YELLOW_DARK_TEXT } };
        statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: EXCEL_COLORS.YELLOW_LIGHT_BG } };
      }
      statusCell.alignment = { horizontal: 'center' };

      legalSheet.getCell(lRowIdx, 4).value = chk.legalBasis;
      legalSheet.getCell(lRowIdx, 5).value = chk.details;

      lRowIdx++;
    });
  });
}
