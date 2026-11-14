import { ExcelContext } from '../types';
import { FONT_NAME, EXCEL_COLORS, applySheetHeaderFooter } from '../excelStyles';
import { findColombianInsurerProfile } from '../../../shared/colombianInsurersCatalog';
import { getEffectiveCommercialPolicies } from '../../../shared/commercialPolicies';
import { ScoringBreakdown } from '../../../types';

export function buildPortadaSheet(ctx: ExcelContext): void {
  const {
    workbook,
    quotes,
    clientInfo,
    brokerInfo,
    insurerImageIds,
    clientName,
    clientActivity,
    clientLocation,
    totalAssetValueStr,
    bestQuote,
    brokerDetails,
    todayStr,
  } = ctx;

  const portada = workbook.addWorksheet('Portada y Resumen General');
  portada.views = [{ showGridLines: false }];
  applySheetHeaderFooter(portada, 'Portada y Resumen General', brokerDetails, todayStr);

  // Embed broker logo if provided as base64
  if (brokerInfo?.logoUrl && brokerInfo.logoUrl.includes('base64,')) {
    try {
      const base64Data = brokerInfo.logoUrl.split('base64,')[1];
      if (base64Data) {
        const imageId = workbook.addImage({
          base64: base64Data,
          extension: brokerInfo.logoUrl.includes('image/jpeg') ? 'jpeg' : 'png',
        });
        portada.addImage(imageId, {
          tl: { col: 4, row: 1 },
          ext: { width: 130, height: 42 },
        });
      }
    } catch (e) {
      console.warn('Failed to add broker logo to Excel', e);
    }
  }

  portada.getColumn(1).width = 4;
  portada.getColumn(2).width = 28;
  portada.getColumn(3).width = 4;
  portada.getColumn(4).width = 45;
  portada.getColumn(5).width = 18;
  portada.getColumn(6).width = 18;

  // Banner Principal
  portada.mergeCells('B2:F2');
  const titleCell = portada.getCell('B2');
  titleCell.value = 'COMPARATIVA Y AUDITORÍA TÉCNICA DE SEGUROS';
  titleCell.font = { name: FONT_NAME, size: 16, bold: true, color: { argb: EXCEL_COLORS.WHITE } };
  titleCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: EXCEL_COLORS.NAVY_HEADER },
  };
  titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
  portada.getRow(2).height = 38;

  portada.mergeCells('B3:F3');
  const subtitleCell = portada.getCell('B3');
  subtitleCell.value = `INFORME EJECUTIVO PARA LA TOMA DE DECISIONES | ${clientName.toUpperCase()} | ${clientLocation}`;
  subtitleCell.font = {
    name: FONT_NAME,
    size: 10,
    italic: true,
    color: { argb: EXCEL_COLORS.SLATE_MUTED },
  };
  subtitleCell.alignment = { vertical: 'middle', horizontal: 'center' };

  // BLOQUE SOMBREADO: RESUMEN EJECUTIVO
  portada.mergeCells('B5:F5');
  const execHeaderCell = portada.getCell('B5');
  execHeaderCell.value = '📌 RESUMEN EJECUTIVO Y DICTAMEN DE RECOMENDACIÓN';
  execHeaderCell.font = {
    name: FONT_NAME,
    size: 11,
    bold: true,
    color: { argb: EXCEL_COLORS.NAVY_HEADER },
  };

  portada.mergeCells('B6:F8');
  const execBoxCell = portada.getCell('B6');
  const execText = `Tras auditar técnicamente las cotizaciones recibidas, la opción recomendada para ${clientName} es ${bestQuote?.insurerName.toUpperCase()} (Puntaje: ${bestQuote?.score || 'N/A'}/100). Esta propuesta presenta la mejor combinación de amplitud de coberturas canónicas, equilibrio financiero en primas y condiciones de deducibles alineadas al perfil de riesgo.`;
  execBoxCell.value = execText;
  execBoxCell.font = {
    name: FONT_NAME,
    size: 10,
    italic: true,
    color: { argb: EXCEL_COLORS.SLATE_BODY },
  };
  execBoxCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: EXCEL_COLORS.BG_LIGHT_GRAY },
  };
  execBoxCell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
  execBoxCell.border = {
    left: { style: 'medium', color: { argb: EXCEL_COLORS.NAVY_HEADER } },
    top: { style: 'thin', color: { argb: EXCEL_COLORS.BORDER_LIGHT } },
    right: { style: 'thin', color: { argb: EXCEL_COLORS.BORDER_LIGHT } },
    bottom: { style: 'thin', color: { argb: EXCEL_COLORS.BORDER_LIGHT } },
  };

  // Ficha de Datos
  const addInfoRow = (label: string, value: string, rowIdx: number) => {
    const cellA = portada.getCell(`B${rowIdx}`);
    cellA.value = label;
    cellA.font = {
      name: FONT_NAME,
      size: 10,
      bold: true,
      color: { argb: EXCEL_COLORS.SLATE_LABEL },
    };
    cellA.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: EXCEL_COLORS.BG_SLATE_HEADER },
    };

    const cellB = portada.getCell(`D${rowIdx}`);
    cellB.value = value;
    cellB.font = { name: FONT_NAME, size: 10, color: { argb: EXCEL_COLORS.SLATE_BODY } };
  };

  portada.getCell('B10').value = 'DATOS DEL ASEGURADO (CLIENTE)';
  portada.getCell('B10').font = {
    name: FONT_NAME,
    size: 11,
    bold: true,
    color: { argb: EXCEL_COLORS.NAVY_HEADER },
  };
  addInfoRow('Asegurado (Razón Social):', clientName, 11);
  addInfoRow('NIT / Identificación:', clientInfo?.nit || 'No especificado', 12);
  addInfoRow('Actividad / Ocupación:', clientActivity, 13);
  addInfoRow('Ubicación del Riesgo:', clientLocation, 14);
  addInfoRow('Valor Total Bienes:', totalAssetValueStr, 15);

  portada.getCell('B17').value = 'DATOS DEL INTERMEDIARIO / CORREDOR TÉCNICO';
  portada.getCell('B17').font = {
    name: FONT_NAME,
    size: 11,
    bold: true,
    color: { argb: EXCEL_COLORS.NAVY_HEADER },
  };
  addInfoRow('Correduría / Agencia:', brokerDetails.name, 18);
  addInfoRow('Asesor Responsable:', brokerDetails.advisor, 19);
  addInfoRow('Nº Matrícula / Registro SFC:', brokerDetails.reg, 20);
  addInfoRow('Contacto / Teléfono:', `${brokerDetails.phone} | ${brokerDetails.email}`, 21);
  addInfoRow(
    'Ubicación y Sede:',
    `${brokerDetails.address ? brokerDetails.address + ' · ' : ''}${brokerDetails.city}`,
    22
  );

  // Scorecard Multidimensional (0 - 100)
  portada.getCell('B23').value = 'SCORECARD COMPARATIVO DE AUDITORÍA (0 - 100)';
  portada.getCell('B23').font = {
    name: FONT_NAME,
    size: 11,
    bold: true,
    color: { argb: EXCEL_COLORS.NAVY_HEADER },
  };

  portada.getRow(24).height = 42;
  const colAHeader = portada.getCell('B24');
  colAHeader.value = 'DIMENSIÓN DE EVALUACIÓN';
  colAHeader.font = { name: FONT_NAME, size: 10, bold: true, color: { argb: EXCEL_COLORS.WHITE } };
  colAHeader.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: EXCEL_COLORS.NAVY_HEADER },
  };
  colAHeader.alignment = { vertical: 'middle', horizontal: 'left' };

  quotes.forEach((q, idx) => {
    const colLetter = String.fromCharCode(68 + idx);
    const hCell = portada.getCell(`${colLetter}24`);
    const profile = findColombianInsurerProfile(q.insurerName);
    const argbColor = profile?.primaryColor
      ? 'FF' + profile.primaryColor.replace('#', '')
      : EXCEL_COLORS.NAVY_HEADER;
    hCell.value = `${profile?.monogram ? `[${profile.monogram}] ` : ''}${q.insurerName.toUpperCase()}`;
    hCell.font = {
      name: FONT_NAME,
      size: 9.5,
      bold: true,
      color: { argb: EXCEL_COLORS.SLATE_DARK },
    };
    hCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: EXCEL_COLORS.BG_SLATE_HEADER },
    };
    hCell.border = {
      top: { style: 'medium', color: { argb: argbColor } },
      bottom: { style: 'thin', color: { argb: EXCEL_COLORS.BORDER_MEDIUM } },
      left: { style: 'thin', color: { argb: EXCEL_COLORS.BORDER_MEDIUM } },
      right: { style: 'thin', color: { argb: EXCEL_COLORS.BORDER_MEDIUM } },
    };
    hCell.alignment = { horizontal: 'center', vertical: 'bottom', wrapText: true };

    if (insurerImageIds[idx] !== null) {
      portada.addImage(insurerImageIds[idx]!, {
        tl: { col: 3 + idx + 0.38, row: 23.08 },
        ext: { width: 22, height: 22 },
      });
    }
  });

  const dimensions = [
    { label: 'Nota Global de Auditoría', key: 'total' },
    { label: 'Amplitud de Coberturas (25%)', key: 'coverage' },
    { label: 'Estructura de Deducibles (20%)', key: 'deductibles' },
    { label: 'Claridad en Exclusiones (20%)', key: 'exclusions' },
    { label: 'Competitividad en Precio (15%)', key: 'priceRatio' },
    { label: 'Flexibilidad de Sublímites (10%)', key: 'sublimits' },
    { label: 'Cumplimiento de Garantías (10%)', key: 'warranties' },
  ];

  dimensions.forEach((dim, rIdx) => {
    const rowNum = 25 + rIdx;
    portada.getRow(rowNum).height = 22;

    const isTotal = dim.key === 'total';
    const labelCell = portada.getCell(`B${rowNum}`);
    labelCell.value = dim.label;
    labelCell.font = {
      name: FONT_NAME,
      size: 10,
      bold: isTotal,
      color: { argb: isTotal ? EXCEL_COLORS.NAVY_HEADER : EXCEL_COLORS.SLATE_LABEL },
    };

    quotes.forEach((q, qIdx) => {
      const colLetter = String.fromCharCode(68 + qIdx);
      const cellVal = portada.getCell(`${colLetter}${rowNum}`);
      let scoreVal = 50;

      if (isTotal) {
        scoreVal = q.score || 50;
      } else if (q.scoringBreakdown) {
        const breakdownVal = q.scoringBreakdown[dim.key as keyof ScoringBreakdown];
        scoreVal = Math.round((breakdownVal || 5) * 10);
      }

      cellVal.value = scoreVal;
      cellVal.font = {
        name: FONT_NAME,
        size: 10,
        bold: isTotal,
        color: { argb: EXCEL_COLORS.SLATE_BODY },
      };
      cellVal.alignment = { horizontal: 'center' };

      // Pastel RAG Status Highlight
      if (scoreVal >= 80) {
        cellVal.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: EXCEL_COLORS.EMERALD_BG },
        };
        cellVal.font = {
          name: FONT_NAME,
          size: 10,
          bold: true,
          color: { argb: EXCEL_COLORS.EMERALD_TEXT },
        };
      } else if (scoreVal >= 60) {
        cellVal.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: EXCEL_COLORS.YELLOW_BG },
        };
        cellVal.font = {
          name: FONT_NAME,
          size: 10,
          bold: true,
          color: { argb: EXCEL_COLORS.YELLOW_TEXT },
        };
      } else {
        cellVal.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: EXCEL_COLORS.RED_BG },
        };
        cellVal.font = {
          name: FONT_NAME,
          size: 10,
          bold: true,
          color: { argb: EXCEL_COLORS.RED_TEXT },
        };
      }
    });
  });

  // Guía de Navegación
  portada.getCell('B33').value = 'CONTENIDO Y NAVEGACIÓN DEL INFORME';
  portada.getCell('B33').font = {
    name: FONT_NAME,
    size: 11,
    bold: true,
    color: { argb: EXCEL_COLORS.NAVY_HEADER },
  };

  const navRows = [
    {
      name: 'Portada y Resumen General',
      desc: 'Resumen ejecutivo, ficha del cliente, corredor y scorecard de puntaje 0-100.',
    },
    {
      name: 'Matriz Coberturas',
      desc: 'Matriz comparativa ampliada de amparos canónicos y ventajas exclusivas.',
    },
    {
      name: 'Matriz Deducibles',
      desc: 'Matriz consolidada dedicada a deducibles y valores equivalentes en COP.',
    },
    {
      name: 'Primas y Costos',
      desc: 'Desglose financiero con fórmulas automáticas nativas e indicador gráfico visual.',
    },
    {
      name: 'Análisis de Riesgos',
      desc: 'Auditoría técnica de alertas clasificadas y escala de calificación 1 a 10.',
    },
    {
      name: 'Respaldo Normativo y Legal',
      desc: 'Auditoría de cumplimiento regulatorio y jurisprudencia colombiana aplicable.',
    },
    {
      name: 'Políticas Comerciales',
      desc: 'Condiciones de validez de la oferta, financiación, garantías y procedimiento de siniestros.',
    },
  ];

  navRows.forEach((item, idx) => {
    const rIdx = 34 + idx;
    const cellA = portada.getCell(`B${rIdx}`);
    cellA.value = item.name;
    cellA.font = {
      name: FONT_NAME,
      size: 10,
      bold: true,
      color: { argb: EXCEL_COLORS.NAVY_HEADER },
    };

    const cellB = portada.getCell(`D${rIdx}`);
    cellB.value = item.desc;
    cellB.font = { name: FONT_NAME, size: 10, color: { argb: EXCEL_COLORS.SLATE_MUTED } };
  });

  const effectivePolicies = getEffectiveCommercialPolicies(brokerInfo?.commercialPolicies);

  // Resumen de Políticas Comerciales en Portada
  portada.getCell('B42').value = 'CONDICIONES COMERCIALES CLAVE DE LA OFERTA';
  portada.getCell('B42').font = {
    name: FONT_NAME,
    size: 11,
    bold: true,
    color: { argb: EXCEL_COLORS.NAVY_HEADER },
  };

  addInfoRow(
    'Vigencia de la Oferta:',
    `${effectivePolicies.offerValidityDays} días calendario desde la expedición`,
    43
  );
  addInfoRow('Forma y Plazo de Pago:', effectivePolicies.paymentConditions, 44);
  addInfoRow('Requisitos de Emisión:', effectivePolicies.issuanceRequirements, 45);
  addInfoRow('Atención de Siniestros:', effectivePolicies.claimsPolicy, 46);
}
