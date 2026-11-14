import { ExcelContext } from '../types';
import { FONT_NAME, EXCEL_COLORS, applySheetHeaderFooter } from '../excelStyles';

export function buildRiskSheet(ctx: ExcelContext): void {
  const { workbook, quotes, regulatoryProfile, brokerDetails, todayStr } = ctx;

  const riskSheet = workbook.addWorksheet('Análisis de Riesgos');
  riskSheet.views = [{ showGridLines: false }];
  applySheetHeaderFooter(riskSheet, 'Análisis de Riesgos', brokerDetails, todayStr);

  riskSheet.getColumn(1).width = 24;
  riskSheet.getColumn(2).width = 25;
  riskSheet.getColumn(3).width = 18; // Columna de Calificación 1 - 10
  riskSheet.getColumn(4).width = 40;
  riskSheet.getColumn(5).width = 45;

  riskSheet.mergeCells('A1:E2');
  const riskTitle = riskSheet.getCell('A1');
  riskTitle.value = 'AUDITORÍA DE RIESGOS, CALIFICACIÓN TÉCNICA Y CONDICIONADOS';
  riskTitle.font = {
    name: FONT_NAME,
    size: 14,
    bold: true,
    color: { argb: EXCEL_COLORS.NAVY_HEADER },
  };

  // Scorecard de Calificación Técnica (1 a 10)
  riskSheet.getRow(4).height = 28;
  const scoreHeaders = [
    'Aseguradora',
    'Perfil de Riesgo',
    'Calificación (1 - 10)',
    'Fortaleza Principal',
    'Riesgo / Debilidad Principal',
  ];
  scoreHeaders.forEach((h, idx) => {
    const cell = riskSheet.getCell(4, idx + 1);
    cell.value = h;
    cell.font = { name: FONT_NAME, size: 10, bold: true, color: { argb: EXCEL_COLORS.WHITE } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: EXCEL_COLORS.NAVY_HEADER } };
  });

  quotes.forEach((q, idx) => {
    const rowNum = 5 + idx;
    riskSheet.getRow(rowNum).height = 22;

    const ratingScore = Math.min(10, Math.max(1, Math.round((q.score || 50) / 10)));

    riskSheet.getCell(rowNum, 1).value = q.insurerName;
    riskSheet.getCell(rowNum, 2).value =
      ratingScore >= 8
        ? 'Riesgo Bajo / Óptimo'
        : ratingScore >= 6
          ? 'Riesgo Moderado'
          : 'Riesgo Alto';

    // Columna Calificación con Gradient Scale RAG
    const gradeCell = riskSheet.getCell(rowNum, 3);
    gradeCell.value = `${ratingScore} / 10`;
    gradeCell.font = { name: FONT_NAME, size: 10, bold: true };
    gradeCell.alignment = { horizontal: 'center' };

    if (ratingScore >= 8) {
      gradeCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: EXCEL_COLORS.EMERALD_BG },
      };
      gradeCell.font = {
        name: FONT_NAME,
        size: 10,
        bold: true,
        color: { argb: EXCEL_COLORS.EMERALD_TEXT },
      };
    } else if (ratingScore >= 6) {
      gradeCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: EXCEL_COLORS.YELLOW_BG },
      };
      gradeCell.font = {
        name: FONT_NAME,
        size: 10,
        bold: true,
        color: { argb: EXCEL_COLORS.YELLOW_TEXT },
      };
    } else {
      gradeCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: EXCEL_COLORS.RED_BG },
      };
      gradeCell.font = {
        name: FONT_NAME,
        size: 10,
        bold: true,
        color: { argb: EXCEL_COLORS.RED_TEXT },
      };
    }

    riskSheet.getCell(rowNum, 4).value =
      q.technicalAnalysis || 'Alta cobertura canónica y estabilidad financiera';
    riskSheet.getCell(rowNum, 5).value =
      q.clientAnalysis || 'Revisar sublímites específicos e insumos de deducibles';
  });

  // Tabla de Alertas Auditadas
  let rRowIdx = 7 + quotes.length;
  riskSheet.getRow(rRowIdx).height = 28;
  const alertHeaders = [
    'Nivel Severidad',
    'Aseguradora',
    'Hallazgo / Cobertura',
    'Detalle de Alerta',
    'Referencia Clausulado',
  ];
  alertHeaders.forEach((h, idx) => {
    const cell = riskSheet.getCell(rRowIdx, idx + 1);
    cell.value = h;
    cell.font = { name: FONT_NAME, size: 10, bold: true, color: { argb: EXCEL_COLORS.WHITE } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: EXCEL_COLORS.NAVY_HEADER } };
  });

  rRowIdx++;
  let alertCount = 0;
  quotes.forEach((q) => {
    const alerts = q.alerts || [];
    alerts.forEach((alert) => {
      alertCount++;
      riskSheet.getRow(rRowIdx).height = 22;

      const levelCell = riskSheet.getCell(rRowIdx, 1);
      levelCell.value = alert.level || 'INFO';
      levelCell.font = { name: FONT_NAME, size: 10, bold: true };
      levelCell.alignment = { horizontal: 'center' };

      if (alert.level === 'CRITICAL') {
        levelCell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: EXCEL_COLORS.RED_BG },
        };
        levelCell.font = {
          name: FONT_NAME,
          size: 10,
          bold: true,
          color: { argb: EXCEL_COLORS.RED_TEXT },
        };
      } else if (alert.level === 'WARNING') {
        levelCell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: EXCEL_COLORS.YELLOW_BG },
        };
        levelCell.font = {
          name: FONT_NAME,
          size: 10,
          bold: true,
          color: { argb: EXCEL_COLORS.YELLOW_TEXT },
        };
      } else {
        levelCell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: EXCEL_COLORS.EMERALD_BG },
        };
        levelCell.font = {
          name: FONT_NAME,
          size: 10,
          bold: true,
          color: { argb: EXCEL_COLORS.EMERALD_TEXT },
        };
      }

      riskSheet.getCell(rRowIdx, 2).value = q.insurerName;
      riskSheet.getCell(rRowIdx, 3).value = alert.title || 'Alerta Técnica';
      riskSheet.getCell(rRowIdx, 4).value = alert.description || '';
      riskSheet.getCell(rRowIdx, 5).value =
        alert.clauseReference || alert.sourceDocument || 'Condicionado General';

      rRowIdx++;
    });
  });

  if (alertCount === 0) {
    riskSheet.mergeCells(`A${rRowIdx}:E${rRowIdx}`);
    const noAlertCell = riskSheet.getCell(`A${rRowIdx}`);
    noAlertCell.value = 'No se detectaron alertas críticas en los documentos analizados.';
    noAlertCell.font = {
      name: FONT_NAME,
      size: 10,
      italic: true,
      color: { argb: EXCEL_COLORS.SLATE_LIGHT },
    };
    rRowIdx++;
  }

  // 1:1 Parity: Auditoría de Coberturas Faltantes, Riesgos en Deducibles y Condiciones Especiales
  const hasAuditData = quotes.some(
    (q) =>
      q.quoteAudit &&
      ((q.quoteAudit.missingCoverages && q.quoteAudit.missingCoverages.length > 0) ||
        (q.quoteAudit.deductibleRisks && q.quoteAudit.deductibleRisks.length > 0) ||
        (q.quoteAudit.specialConditions && q.quoteAudit.specialConditions.length > 0) ||
        (q.quoteAudit.negotiationPoints && q.quoteAudit.negotiationPoints.length > 0))
  );

  if (hasAuditData) {
    rRowIdx += 2;
    riskSheet.mergeCells(`A${rRowIdx}:E${rRowIdx}`);
    const auditTitleCell = riskSheet.getCell(`A${rRowIdx}`);
    auditTitleCell.value =
      'AUDITORÍA DETALLADA: COBERTURAS FALTANTES, CONDICIONES Y PUNTOS DE NEGOCIACIÓN';
    auditTitleCell.font = {
      name: FONT_NAME,
      size: 12,
      bold: true,
      color: { argb: EXCEL_COLORS.NAVY_HEADER },
    };
    auditTitleCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: EXCEL_COLORS.BG_SECTION_HEADER },
    };
    riskSheet.getRow(rRowIdx).height = 26;
    rRowIdx++;

    quotes.forEach((q) => {
      const qa = q.quoteAudit;
      if (!qa) return;

      // Missing coverages
      if (qa.missingCoverages && qa.missingCoverages.length > 0) {
        qa.missingCoverages.forEach((mc) => {
          riskSheet.getRow(rRowIdx).height = 22;
          const c1 = riskSheet.getCell(rRowIdx, 1);
          c1.value = mc.impact === 'HIGH' ? 'FALTANTE CRÍTICO' : 'FALTANTE MEDIO';
          c1.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: mc.impact === 'HIGH' ? EXCEL_COLORS.RED_BG : EXCEL_COLORS.YELLOW_BG },
          };
          c1.font = {
            name: FONT_NAME,
            size: 10,
            bold: true,
            color: {
              argb: mc.impact === 'HIGH' ? EXCEL_COLORS.RED_TEXT : EXCEL_COLORS.YELLOW_TEXT,
            },
          };
          c1.alignment = { horizontal: 'center' };

          riskSheet.getCell(rRowIdx, 2).value = q.insurerName;
          riskSheet.getCell(rRowIdx, 3).value = mc.categoryName;
          riskSheet.getCell(rRowIdx, 4).value = mc.reason;
          riskSheet.getCell(rRowIdx, 5).value =
            `Obligatorio según estándar ${regulatoryProfile.displayName}`;
          rRowIdx++;
        });
      }

      // Deductible risks
      if (qa.deductibleRisks && qa.deductibleRisks.length > 0) {
        qa.deductibleRisks.forEach((dr) => {
          riskSheet.getRow(rRowIdx).height = 22;
          const c1 = riskSheet.getCell(rRowIdx, 1);
          c1.value = `RETENCIÓN / DEDUCIBLE (${dr.riskLevel})`;
          c1.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: {
              argb:
                dr.riskLevel === 'HIGH' || dr.riskLevel === 'CRITICAL'
                  ? EXCEL_COLORS.RED_BG
                  : EXCEL_COLORS.YELLOW_BG,
            },
          };
          c1.font = {
            name: FONT_NAME,
            size: 10,
            bold: true,
            color: {
              argb:
                dr.riskLevel === 'HIGH' || dr.riskLevel === 'CRITICAL'
                  ? EXCEL_COLORS.RED_TEXT
                  : EXCEL_COLORS.YELLOW_TEXT,
            },
          };
          c1.alignment = { horizontal: 'center' };

          riskSheet.getCell(rRowIdx, 2).value = q.insurerName;
          riskSheet.getCell(rRowIdx, 3).value = dr.coverageName;
          riskSheet.getCell(rRowIdx, 4).value = `${dr.deductible} — ${dr.recommendation}`;
          riskSheet.getCell(rRowIdx, 5).value = 'Art. 1103 Co.Co. (Retención)';
          rRowIdx++;
        });
      }

      // Negotiation points
      if (qa.negotiationPoints && qa.negotiationPoints.length > 0) {
        qa.negotiationPoints.forEach((np) => {
          riskSheet.getRow(rRowIdx).height = 22;
          const c1 = riskSheet.getCell(rRowIdx, 1);
          c1.value = `NEGOCIACIÓN (${np.priority})`;
          c1.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: EXCEL_COLORS.BLUE_LIGHT_BG },
          };
          c1.font = {
            name: FONT_NAME,
            size: 10,
            bold: true,
            color: { argb: EXCEL_COLORS.NAVY_ACCENT },
          };
          c1.alignment = { horizontal: 'center' };

          riskSheet.getCell(rRowIdx, 2).value = q.insurerName;
          riskSheet.getCell(rRowIdx, 3).value = np.title;
          riskSheet.getCell(rRowIdx, 4).value = np.description;
          riskSheet.getCell(rRowIdx, 5).value = np.potentialSavings
            ? `Ahorro est.: ${np.potentialSavings}`
            : 'Mejora en suscripción';
          rRowIdx++;
        });
      }
    });
  }
}
