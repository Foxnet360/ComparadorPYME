import * as ExcelJS from 'exceljs';
import sharp from 'sharp';
import { QuoteAnalysis, MatrixRow, MatrixCell, ScoringBreakdown } from '../types';
import { InsuranceDomain } from '../types/domain';
import {
  transformQuotesToMatrix,
  parseNumericValue,
  formatMatrixValue,
  enrichSmmlvDeductible,
  isExcludedValue,
  HEADER_SECTION_ID,
  COVERAGE_SECTION_ID,
  DEDUCTIBLE_SECTION_ID,
  FINANCIAL_SECTION_ID,
  alignMatrixRowsToQuotes,
} from './unifiedComparison/matrixTransformer';
import {
  getDomainRegulatoryProfile,
  findPedagogicalExplanation,
} from '../shared/domainRegulatoryKnowledge';
import {
  findColombianInsurerProfile,
  buildInsurerSvgDataUri,
} from '../shared/colombianInsurersCatalog';
import {
  CommercialPolicies,
  getEffectiveCommercialPolicies,
  getStructuredCommercialPolicyEntries,
} from '../shared/commercialPolicies';

async function getInsurerLogoPngBuffer(insurerName: string): Promise<Buffer | null> {
  try {
    const uri = buildInsurerSvgDataUri(insurerName);
    const svgStr = decodeURIComponent(uri.replace('data:image/svg+xml;utf8,', ''));
    return await sharp(Buffer.from(svgStr)).resize(64, 64).png().toBuffer();
  } catch {
    return null;
  }
}

function isDeductibleMatrixRow(row: MatrixRow): boolean {
  if (row.sectionId === DEDUCTIBLE_SECTION_ID) return true;
  const idLower = (row.id || '').toLowerCase();
  if (idLower.includes('deductible') || idLower.includes('deducible')) return true;
  const labelLower = (row.label || '').toLowerCase();
  return labelLower.includes('deducible') && !labelLower.includes('cobertura');
}

function isFinancialMatrixRow(row: MatrixRow): boolean {
  return row.sectionId === FINANCIAL_SECTION_ID;
}

/**
 * Remove section header rows that have no data rows before the next header (or end of list),
 * as well as redundant leading/trailing/consecutive spacer rows.
 */
function pruneOrphanedSectionRows(rows: MatrixRow[]): MatrixRow[] {
  const result: MatrixRow[] = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    if (row.type === 'header') {
      let hasDataRow = false;
      for (let j = i + 1; j < rows.length; j++) {
        if (rows[j]!.type === 'header') break;
        if (rows[j]!.type === 'data') {
          hasDataRow = true;
          break;
        }
      }
      if (hasDataRow) {
        result.push(row);
      }
    } else if (row.type === 'spacer') {
      if (result.some((r) => r.type === 'data') && result[result.length - 1]?.type !== 'spacer') {
        result.push(row);
      }
    } else {
      result.push(row);
    }
  }
  while (result.length > 0 && result[result.length - 1]?.type === 'spacer') {
    result.pop();
  }
  return result;
}

/**
 * Compute row height dynamically based on wrapped text lines and explicit line breaks.
 */
function calculateDynamicRowHeight(texts: string[], minHeight: number = 24): number {
  let maxLines = 1;
  for (const text of texts) {
    if (!text) continue;
    const explicitLines = String(text).split('\n');
    let lineCount = 0;
    for (const line of explicitLines) {
      lineCount += Math.max(1, Math.ceil(line.length / 35));
    }
    if (lineCount > maxLines) {
      maxLines = lineCount;
    }
  }
  return Math.max(minHeight, Math.min(96, maxLines * 16 + 8));
}

export interface ClientInfo {
  name?: string;
  activity?: string;
  location?: string;
  nit?: string;
}

export interface ExcelReportData {
  matrix?: MatrixRow[];
  [key: string]: unknown;
}

export interface BrokerInfo {
  name?: string;
  intermediaryName?: string;
  registrationNumber?: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  logoUrl?: string;
  commercialPolicies?: CommercialPolicies;
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
  reportData?: ExcelReportData,
  mode: 'technical' | 'client' = 'technical'
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = brokerInfo?.intermediaryName || 'Agente Comparador CSA';
  workbook.lastModifiedBy = brokerInfo?.name || 'Agente Comparador CSA';
  workbook.created = new Date();
  workbook.modified = new Date();

  const hasNotes = cellNotes && Object.keys(cellNotes).length > 0;
  const FONT_NAME = 'Segoe UI';
  const regulatoryProfile = getDomainRegulatoryProfile(domain);

  // Pre-generate offline brand logo buffers for each insurer
  const insurerLogoBuffers = await Promise.all(
    quotes.map((q) => getInsurerLogoPngBuffer(q.insurerName))
  );
  const insurerImageIds: (number | null)[] = insurerLogoBuffers.map((buf) =>
    buf ? workbook.addImage({ buffer: buf as unknown as ExcelJS.Buffer, extension: 'png' }) : null
  );

  // Obtain ground-truth matrix rows from reportData or build using matrixTransformer
  const matrix: MatrixRow[] =
    reportData?.matrix && Array.isArray(reportData.matrix) && reportData.matrix.length > 0
      ? alignMatrixRowsToQuotes(reportData.matrix, quotes, domain as InsuranceDomain)
      : transformQuotesToMatrix(quotes, domain);

  // Client Info
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
    (q.coverages || []).forEach((c) => {
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

  // Find Best Quote
  const bestQuote = quotes.reduce(
    (prev, current) => ((prev.score || 0) > (current.score || 0) ? prev : current),
    quotes[0]!
  );

  // Intermediary / Ally Commercial Details
  const brokerName = brokerInfo?.intermediaryName || brokerInfo?.name || 'Correduría de Seguros Aliada';
  const brokerAdvisor = brokerInfo?.name || 'Asesor Técnico de Seguros';
  const brokerPhone = brokerInfo?.phone || 'Línea de Asesoría';
  const brokerEmail = brokerInfo?.email || 'contacto@corredor.com';
  const brokerReg = brokerInfo?.registrationNumber || 'Inscripción Vigente SFC';
  const brokerAddress = brokerInfo?.address || '';
  const brokerCity = brokerInfo?.city || 'Colombia';
  const todayStr = new Date().toLocaleDateString('es-ES');

  const applySheetHeaderFooter = (ws: ExcelJS.Worksheet, sheetTitle: string) => {
    ws.headerFooter = {
      oddHeader: `&L&B${brokerName}&C&"Segoe UI,Bold"${sheetTitle.toUpperCase()}&R${todayStr}`,
      oddFooter: `&L${brokerName} · Tel: ${brokerPhone} · ${brokerEmail}&R&P de &N`,
    };
  };

  // -------------------------------------------------------------
  // Pestaña 1: Portada y Resumen General (Look & Feel Ejecutivo)
  // -------------------------------------------------------------
  const portada = workbook.addWorksheet('Portada y Resumen General');
  portada.views = [{ showGridLines: false }];
  applySheetHeaderFooter(portada, 'Portada y Resumen General');

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
  titleCell.font = { name: FONT_NAME, size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } };
  titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
  portada.getRow(2).height = 38;

  portada.mergeCells('B3:F3');
  const subtitleCell = portada.getCell('B3');
  subtitleCell.value = `INFORME EJECUTIVO PARA LA TOMA DE DECISIONES | ${clientName.toUpperCase()} | ${clientLocation}`;
  subtitleCell.font = { name: FONT_NAME, size: 10, italic: true, color: { argb: 'FF475569' } };
  subtitleCell.alignment = { vertical: 'middle', horizontal: 'center' };

  // BLOQUE SOMBREADO: RESUMEN EJECUTIVO
  portada.mergeCells('B5:F5');
  const execHeaderCell = portada.getCell('B5');
  execHeaderCell.value = '📌 RESUMEN EJECUTIVO Y DICTAMEN DE RECOMENDACIÓN';
  execHeaderCell.font = { name: FONT_NAME, size: 11, bold: true, color: { argb: 'FF1E3A8A' } };

  portada.mergeCells('B6:F8');
  const execBoxCell = portada.getCell('B6');
  const execText = `Tras auditar técnicamente las cotizaciones recibidas, la opción recomendada para ${clientName} es ${bestQuote?.insurerName.toUpperCase()} (Puntaje: ${bestQuote?.score || 'N/A'}/100). Esta propuesta presenta la mejor combinación de amplitud de coberturas canónicas, equilibrio financiero en primas y condiciones de deducibles alineadas al perfil de riesgo.`;
  execBoxCell.value = execText;
  execBoxCell.font = { name: FONT_NAME, size: 10, italic: true, color: { argb: 'FF1E293B' } };
  execBoxCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
  execBoxCell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
  execBoxCell.border = {
    left: { style: 'medium', color: { argb: 'FF1E3A8A' } },
    top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
    right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
    bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
  };

  // Ficha de Datos
  const addInfoRow = (label: string, value: string, rowIdx: number) => {
    const cellA = portada.getCell(`B${rowIdx}`);
    cellA.value = label;
    cellA.font = { name: FONT_NAME, size: 10, bold: true, color: { argb: 'FF334155' } };
    cellA.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };

    const cellB = portada.getCell(`D${rowIdx}`);
    cellB.value = value;
    cellB.font = { name: FONT_NAME, size: 10, color: { argb: 'FF1E293B' } };
  };

  portada.getCell('B10').value = 'DATOS DEL ASEGURADO (CLIENTE)';
  portada.getCell('B10').font = {
    name: FONT_NAME,
    size: 11,
    bold: true,
    color: { argb: 'FF1E3A8A' },
  };
  addInfoRow('Asegurado (Razón Social):', clientName, 11);
  addInfoRow('NIT / Identificación:', clientInfo?.nit || 'No especificado', 12);
  addInfoRow('Actividad / Ocupación:', clientActivity, 13);
  addInfoRow('Ubicación del Riesgo:', clientLocation, 14);
  addInfoRow('Valor Total Bienes:', totalAssetValueStr, 15);

  portada.getCell('B17').value = 'DATOS DEL INTERMEDIARIO / ALIADO TÉCNICO';
  portada.getCell('B17').font = {
    name: FONT_NAME,
    size: 11,
    bold: true,
    color: { argb: 'FF1E3A8A' },
  };
  addInfoRow('Correduría / Agencia:', brokerName, 18);
  addInfoRow('Asesor Responsable:', brokerAdvisor, 19);
  addInfoRow('Nº Matrícula / Registro SFC:', brokerReg, 20);
  addInfoRow('Contacto / Teléfono:', `${brokerPhone} | ${brokerEmail}`, 21);
  addInfoRow('Ubicación y Sede:', `${brokerAddress ? brokerAddress + ' · ' : ''}${brokerCity}`, 22);

  // Scorecard Multidimensional (0 - 100)
  portada.getCell('B23').value = 'SCORECARD COMPARATIVO DE AUDITORÍA (0 - 100)';
  portada.getCell('B23').font = {
    name: FONT_NAME,
    size: 11,
    bold: true,
    color: { argb: 'FF1E3A8A' },
  };

  portada.getRow(24).height = 42;
  const colAHeader = portada.getCell('B24');
  colAHeader.value = 'DIMENSIÓN DE EVALUACIÓN';
  colAHeader.font = { name: FONT_NAME, size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
  colAHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } };
  colAHeader.alignment = { vertical: 'middle', horizontal: 'left' };

  quotes.forEach((q, idx) => {
    const colLetter = String.fromCharCode(68 + idx);
    const hCell = portada.getCell(`${colLetter}24`);
    const profile = findColombianInsurerProfile(q.insurerName);
    const argbColor = profile?.primaryColor
      ? 'FF' + profile.primaryColor.replace('#', '')
      : 'FF1E3A8A';
    hCell.value = `${profile?.monogram ? `[${profile.monogram}] ` : ''}${q.insurerName.toUpperCase()}`;
    hCell.font = { name: FONT_NAME, size: 9.5, bold: true, color: { argb: 'FF0F172A' } };
    hCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
    hCell.border = {
      top: { style: 'medium', color: { argb: argbColor } },
      bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
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
      color: { argb: isTotal ? 'FF1E3A8A' : 'FF334155' },
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
      cellVal.font = { name: FONT_NAME, size: 10, bold: isTotal, color: { argb: 'FF1E293B' } };
      cellVal.alignment = { horizontal: 'center' };

      // Pastel RAG Status Highlight
      if (scoreVal >= 80) {
        cellVal.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDEF7EC' } }; // Emerald 100
        cellVal.font = { name: FONT_NAME, size: 10, bold: true, color: { argb: 'FF03543F' } }; // Emerald 800
      } else if (scoreVal >= 60) {
        cellVal.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF08A' } }; // Yellow 200
        cellVal.font = { name: FONT_NAME, size: 10, bold: true, color: { argb: 'FF713F12' } }; // Yellow 900
      } else {
        cellVal.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFDE8E8' } }; // Red 100
        cellVal.font = { name: FONT_NAME, size: 10, bold: true, color: { argb: 'FF9B1C1C' } }; // Red 800
      }
    });
  });

  // Guía de Navegación
  portada.getCell('B33').value = 'CONTENIDO Y NAVEGACIÓN DEL INFORME';
  portada.getCell('B33').font = {
    name: FONT_NAME,
    size: 11,
    bold: true,
    color: { argb: 'FF1E3A8A' },
  };

  const navRows = [
    {
      name: 'Portada y Resumen General',
      desc: 'Resumen ejecutivo, ficha del cliente, aliado y scorecard de puntaje 0-100.',
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
    cellA.font = { name: FONT_NAME, size: 10, bold: true, color: { argb: 'FF1E3A8A' } };

    const cellB = portada.getCell(`D${rIdx}`);
    cellB.value = item.desc;
    cellB.font = { name: FONT_NAME, size: 10, color: { argb: 'FF475569' } };
  });

  const effectivePolicies = getEffectiveCommercialPolicies(brokerInfo?.commercialPolicies);

  // Resumen de Políticas Comerciales en Portada
  portada.getCell('B42').value = 'CONDICIONES COMERCIALES CLAVE DE LA OFERTA';
  portada.getCell('B42').font = {
    name: FONT_NAME,
    size: 11,
    bold: true,
    color: { argb: 'FF1E3A8A' },
  };

  addInfoRow('Vigencia de la Oferta:', `${effectivePolicies.offerValidityDays} días calendario desde la expedición`, 43);
  addInfoRow('Forma y Plazo de Pago:', effectivePolicies.paymentConditions, 44);
  addInfoRow('Requisitos de Emisión:', effectivePolicies.issuanceRequirements, 45);
  addInfoRow('Atención de Siniestros:', effectivePolicies.claimsPolicy, 46);

  // -------------------------------------------------------------
  // Pestaña 2: Cuadro Comparativo Resumido ("Cuadro Chico")
  // -------------------------------------------------------------
  const summarySheet = workbook.addWorksheet('Cuadro Comparativo Resumido');
  summarySheet.views = [{ showGridLines: false }];
  applySheetHeaderFooter(summarySheet, 'Cuadro Comparativo Resumido');

  summarySheet.getColumn(1).width = 42;
  for (let i = 0; i < quotes.length; i++) {
    summarySheet.getColumn(i + 2).width = 34;
  }

  summarySheet.mergeCells(1, 1, 2, quotes.length + 1);
  const sumTitle = summarySheet.getCell(1, 1);
  sumTitle.value = 'CUADRO COMPARATIVO RESUMIDO · VISIÓN EJECUTIVA CONDENSADA';
  sumTitle.font = { name: FONT_NAME, size: 13, bold: true, color: { argb: 'FF1E3A8A' } };
  sumTitle.alignment = { vertical: 'middle', horizontal: 'left' };

  summarySheet.mergeCells(3, 1, 3, quotes.length + 1);
  const sumSubtitle = summarySheet.getCell(3, 1);
  sumSubtitle.value = `Cliente: ${clientName}  |  Ramo: ${regulatoryProfile.displayName}  |  Fecha: ${todayStr}`;
  sumSubtitle.font = { name: FONT_NAME, size: 9.5, italic: true, color: { argb: 'FF64748B' } };
  sumSubtitle.alignment = { vertical: 'middle', horizontal: 'left' };

  summarySheet.getRow(5).height = 54;
  const sumHeaderLabel = summarySheet.getCell(5, 1);
  sumHeaderLabel.value = 'VARIABLE O CONCEPTO CLAVE';
  sumHeaderLabel.font = { name: FONT_NAME, size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
  sumHeaderLabel.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } };
  sumHeaderLabel.alignment = { vertical: 'middle', horizontal: 'left' };

  quotes.forEach((q, i) => {
    const headerCell = summarySheet.getCell(5, i + 2);
    headerCell.value = q.insurerName.toUpperCase();
    const profile = findColombianInsurerProfile(q.insurerName);
    const argbColor = profile?.primaryColor
      ? 'FF' + profile.primaryColor.replace('#', '')
      : 'FF1E3A8A';
    headerCell.font = { name: FONT_NAME, size: 10, bold: true, color: { argb: 'FF0F172A' } };
    headerCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
    headerCell.border = {
      top: { style: 'medium', color: { argb: argbColor } },
      bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    };
    headerCell.alignment = { horizontal: 'center', vertical: 'bottom', wrapText: true };

    if (insurerImageIds[i] !== null) {
      summarySheet.addImage(insurerImageIds[i]!, {
        tl: { col: i + 1 + 0.38, row: 4.1 },
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

  const getDeductibleSummary = (q: QuoteAnalysis, keywords: string[], quoteIdx?: number): string => {
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

  interface CondensedRow {
    type: 'header' | 'data';
    label: string;
    isCurrency?: boolean;
    getValue?: (q: QuoteAnalysis, idx?: number) => string | number;
  }

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
          : q.financialBreakdown?.iva ??
            Math.max(0, (q.priceAnnual || 0) - Math.round((q.priceAnnual || 0) / 1.19)),
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
      getValue: (q) => (q as any).paymentTerms || (q.priceMonthly ? 'Financiado / Mensual' : 'Anual Contado'),
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
            getValue: (q: QuoteAnalysis, idx?: number) =>
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

  let currentSumRow = 6;
  for (const cr of condensedRows) {
    if (cr.type === 'header') {
      summarySheet.mergeCells(currentSumRow, 1, currentSumRow, quotes.length + 1);
      const hCell = summarySheet.getCell(currentSumRow, 1);
      hCell.value = cr.label;
      hCell.font = { name: FONT_NAME, size: 10.5, bold: true, color: { argb: 'FF1E3A8A' } };
      hCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
      hCell.alignment = { vertical: 'middle', horizontal: 'left' };
      summarySheet.getRow(currentSumRow).height = 24;
      currentSumRow++;
    } else {
      const lCell = summarySheet.getCell(currentSumRow, 1);
      lCell.value = cr.label;
      lCell.font = { name: FONT_NAME, size: 9.5, bold: true, color: { argb: 'FF475569' } };
      lCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
      lCell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
      summarySheet.getRow(currentSumRow).height = 24;

      quotes.forEach((q, idx) => {
        const cCell = summarySheet.getCell(currentSumRow, idx + 2);
        const val = cr.getValue ? cr.getValue(q, idx) : '';
        if (cr.isCurrency && typeof val === 'number') {
          cCell.value = val > 0 ? val : 'No informado';
          if (val > 0) {
            cCell.numFmt = '$#,##0';
            cCell.font = { name: FONT_NAME, size: 9.5, bold: true, color: { argb: 'FF03543F' } };
            cCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDEF7EC' } };
          } else {
            cCell.font = { name: FONT_NAME, size: 9.5, color: { argb: 'FF64748B' } };
          }
        } else {
          cCell.value = val;
          cCell.font = { name: FONT_NAME, size: 9.5, color: { argb: 'FF1E293B' } };
        }
        cCell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
        cCell.border = { bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } } };
      });
      currentSumRow++;
    }
  }

  // -------------------------------------------------------------
  // Pestaña 3: Matriz Coberturas (Direct Matrix Data Rendering)
  // -------------------------------------------------------------
  const coveragesSheet = workbook.addWorksheet('Matriz Coberturas');
  coveragesSheet.views = [{ showGridLines: false }];
  applySheetHeaderFooter(coveragesSheet, 'Matriz Coberturas');

  coveragesSheet.getColumn(1).width = 45;
  for (let i = 0; i < quotes.length; i++) {
    coveragesSheet.getColumn(i + 2).width = 35;
  }

  coveragesSheet.mergeCells(1, 1, 2, quotes.length + 1 + (hasNotes ? 1 : 0));
  const covTitle = coveragesSheet.getCell(1, 1);
  covTitle.value = 'MATRIZ COMPARATIVA AMPLIADA DE COBERTURAS Y AMPAROS';
  covTitle.font = { name: FONT_NAME, size: 14, bold: true, color: { argb: 'FF1E3A8A' } };
  covTitle.alignment = { vertical: 'middle', horizontal: 'left' };

  coveragesSheet.getRow(4).height = 54;
  const mainLabelHeader = coveragesSheet.getCell(4, 1);
  mainLabelHeader.value = 'COBERTURA / CONCEPTO CANÓNICO';
  mainLabelHeader.font = { name: FONT_NAME, size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
  mainLabelHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } };
  mainLabelHeader.alignment = { vertical: 'middle', horizontal: 'left' };

  quotes.forEach((q, i) => {
    const insHeader = coveragesSheet.getCell(4, i + 2);
    insHeader.value = q.insurerName.toUpperCase();
    const profile = findColombianInsurerProfile(q.insurerName);
    const argbColor = profile?.primaryColor
      ? 'FF' + profile.primaryColor.replace('#', '')
      : 'FF1E3A8A';
    insHeader.font = { name: FONT_NAME, size: 10, bold: true, color: { argb: 'FF0F172A' } };
    insHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
    insHeader.border = {
      top: { style: 'medium', color: { argb: argbColor } },
      bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
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
    notesHeader.font = { name: FONT_NAME, size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    notesHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF6D28D9' } };
    notesHeader.alignment = { horizontal: 'center' };
  }

  const guideColIdx = quotes.length + (hasNotes ? 2 : 1) + 1;
  if (mode === 'client') {
    coveragesSheet.getColumn(guideColIdx).width = 48;
    const guideHeader = coveragesSheet.getCell(4, guideColIdx);
    guideHeader.value = 'GUÍA CONSULTIVA PARA EL ASEGURADO';
    guideHeader.font = { name: FONT_NAME, size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    guideHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0D9488' } };
    guideHeader.alignment = { horizontal: 'center' };
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
      secCell.font = { name: FONT_NAME, size: 11, bold: true, color: { argb: 'FF1E3A8A' } };
      secCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
      secCell.alignment = { vertical: 'middle', horizontal: 'left' };
      coveragesSheet.getRow(currentCovRow).height = 24;
      currentCovRow++;
    } else if (row.type === 'spacer') {
      coveragesSheet.getRow(currentCovRow).height = 8;
      currentCovRow++;
    } else {
      const labelCell = coveragesSheet.getCell(currentCovRow, 1);
      labelCell.value = row.label;
      labelCell.font = { name: FONT_NAME, size: 10, bold: true, color: { argb: 'FF475569' } };
      labelCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
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
          xlCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFDE8E8' } }; // Soft red pastel
          xlCell.font = { name: FONT_NAME, size: 10, italic: true, color: { argb: 'FF9B1C1C' } };
        } else if (numericVal > 0 && !hasConditions) {
          xlCell.value = numericVal;
          xlCell.numFmt = '$#,##0';
          rowTextsForHeight.push(valStr);
          xlCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDEF7EC' } }; // Soft green pastel
          xlCell.font = { name: FONT_NAME, size: 10, bold: true, color: { argb: 'FF03543F' } };
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
          xlCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDEF7EC' } }; // Soft green pastel
          xlCell.font = { name: FONT_NAME, size: 10, color: { argb: 'FF03543F' } };
        }

        if (isWinner && !excluded) {
          xlCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } }; // Soft Amber pastel
          xlCell.font = { name: FONT_NAME, size: 10, bold: true, color: { argb: 'FF92400E' } };
        }

        xlCell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
        xlCell.border = { bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } } };

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
        notesCell.font = { name: FONT_NAME, size: 9, color: { argb: 'FF7C3AED' }, italic: true };
        notesCell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
        if (note) {
          notesCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3E8FF' } };
          rowTextsForHeight.push(note);
        }
      }

      if (mode === 'client') {
        const ped = findPedagogicalExplanation(row.label, '', 'coverage');
        const guideText = `💡 ¿Qué protege? ${ped.whatItCovers}\n⚡ En caso de siniestro: ${ped.claimImpact}\n🔍 Clave al comparar: ${ped.comparisonTip}${ped.legalReference ? `\n⚖️ Respaldo legal: ${ped.legalReference}` : ''}`;
        const guideCell = coveragesSheet.getCell(currentCovRow, guideColIdx);
        guideCell.value = guideText;
        guideCell.font = { name: FONT_NAME, size: 9, color: { argb: 'FF134E4A' } };
        guideCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0FDFA' } };
        guideCell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
        guideCell.border = { bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } } };
        rowTextsForHeight.push(guideText);
      }

      coveragesSheet.getRow(currentCovRow).height = calculateDynamicRowHeight(rowTextsForHeight, 24);
      currentCovRow++;
    }
  }

  // -------------------------------------------------------------
  // Pestaña 3: Matriz Deducibles (Consolidated Deductible Matrix)
  // -------------------------------------------------------------
  const deductiblesSheet = workbook.addWorksheet('Matriz Deducibles');
  deductiblesSheet.views = [{ showGridLines: false }];
  applySheetHeaderFooter(deductiblesSheet, 'Matriz Deducibles');

  deductiblesSheet.getColumn(1).width = 45;
  for (let i = 0; i < quotes.length; i++) {
    deductiblesSheet.getColumn(i + 2).width = 38;
  }
  const dedGuideColIdx = quotes.length + 2;
  if (mode === 'client') {
    deductiblesSheet.getColumn(dedGuideColIdx).width = 48;
  }

  deductiblesSheet.mergeCells(1, 1, 2, quotes.length + 1 + (mode === 'client' ? 1 : 0));
  const dedTitle = deductiblesSheet.getCell(1, 1);
  dedTitle.value = 'MATRIZ CONSOLIDADA DE DEDUCIBLES Y RETENCIÓN DE RIESGO';
  dedTitle.font = { name: FONT_NAME, size: 14, bold: true, color: { argb: 'FF1E3A8A' } };

  deductiblesSheet.getRow(4).height = 54;
  const dedLabelHeader = deductiblesSheet.getCell(4, 1);
  dedLabelHeader.value = 'AMPARO / COBERTURA';
  dedLabelHeader.font = { name: FONT_NAME, size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
  dedLabelHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } };
  dedLabelHeader.alignment = { vertical: 'middle', horizontal: 'left' };

  quotes.forEach((q, i) => {
    const insHeader = deductiblesSheet.getCell(4, i + 2);
    insHeader.value = q.insurerName.toUpperCase();
    const profile = findColombianInsurerProfile(q.insurerName);
    const argbColor = profile?.primaryColor
      ? 'FF' + profile.primaryColor.replace('#', '')
      : 'FF1E3A8A';
    insHeader.font = { name: FONT_NAME, size: 10, bold: true, color: { argb: 'FF0F172A' } };
    insHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
    insHeader.border = {
      top: { style: 'medium', color: { argb: argbColor } },
      bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    };
    insHeader.alignment = { horizontal: 'center', vertical: 'bottom', wrapText: true };

    if (insurerImageIds[i] !== null) {
      deductiblesSheet.addImage(insurerImageIds[i]!, {
        tl: { col: i + 1 + 0.38, row: 3.1 },
        ext: { width: 28, height: 28 },
      });
    }
  });

  if (mode === 'client') {
    const dedGuideHeader = deductiblesSheet.getCell(4, dedGuideColIdx);
    dedGuideHeader.value = 'GUÍA PRÁCTICA DEL COPAGO';
    dedGuideHeader.font = { name: FONT_NAME, size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    dedGuideHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0D9488' } };
    dedGuideHeader.alignment = { horizontal: 'center' };
  }

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
        cell.font = { name: FONT_NAME, size: 11, bold: true, color: { argb: 'FF1E3A8A' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
        cell.alignment = { vertical: 'middle', horizontal: 'left' };
        deductiblesSheet.getRow(currentDedRow).height = 24;
        currentDedRow++;
      } else if (row.type === 'spacer') {
        deductiblesSheet.getRow(currentDedRow).height = 8;
        currentDedRow++;
      } else {
        const labelCell = deductiblesSheet.getCell(currentDedRow, 1);
        labelCell.value = row.label;
        labelCell.font = { name: FONT_NAME, size: 10, bold: true, color: { argb: 'FF475569' } };
        labelCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
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
          xlCell.font = { name: FONT_NAME, size: 10, color: { argb: 'FF1E293B' } };

          if (isNoAplica) {
            xlCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDEF7EC' } };
            xlCell.font = { name: FONT_NAME, size: 10, bold: true, color: { argb: 'FF03543F' } };
          }

          xlCell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
          xlCell.border = { bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } } };
        });
        if (mode === 'client') {
          const ped = findPedagogicalExplanation(row.label, '', 'deductible');
          const dedGuideText = `📌 ¿Cómo opera? ${ped.whatItCovers}\n⚠️ En siniestro: ${ped.claimImpact}\n🎯 Ojo al comparar: ${ped.comparisonTip}${ped.legalReference ? `\n⚖️ Base: ${ped.legalReference}` : ''}`;
          const gCell = deductiblesSheet.getCell(currentDedRow, dedGuideColIdx);
          gCell.value = dedGuideText;
          gCell.font = { name: FONT_NAME, size: 9, color: { argb: 'FF134E4A' } };
          gCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0FDFA' } };
          gCell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
          gCell.border = { bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } } };
          dedTextsForHeight.push(dedGuideText);
        }

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
      labelCell.font = { name: FONT_NAME, size: 10, bold: true, color: { argb: 'FF475569' } };
      labelCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
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
        xlCell.font = { name: FONT_NAME, size: 10, color: { argb: 'FF1E293B' } };

        if (isNoAplica) {
          xlCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDEF7EC' } };
          xlCell.font = { name: FONT_NAME, size: 10, bold: true, color: { argb: 'FF03543F' } };
        }

        xlCell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
        xlCell.border = { bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } } };
      });
      deductiblesSheet.getRow(currentDedRow).height = calculateDynamicRowHeight(
        dedTextsForHeight,
        24
      );
      currentDedRow++;
    });
  }

  // -------------------------------------------------------------
  // Pestaña 4: Primas y Costos (CON FÓRMULAS NATIVAS E INDICADOR GRÁFICO VISUAL)
  // -------------------------------------------------------------
  const financialsSheet = workbook.addWorksheet('Primas y Costos');
  financialsSheet.views = [{ showGridLines: false }];
  applySheetHeaderFooter(financialsSheet, 'Primas y Costos');

  financialsSheet.getColumn(1).width = 44;
  for (let i = 0; i < quotes.length; i++) {
    financialsSheet.getColumn(i + 2).width = 30;
  }

  financialsSheet.mergeCells(1, 1, 2, quotes.length + 1);
  const finTitle = financialsSheet.getCell(1, 1);
  finTitle.value = 'EVALUACIÓN FINANCIERA DE PRIMAS Y COSTOS COMPARATIVOS';
  finTitle.font = { name: FONT_NAME, size: 14, bold: true, color: { argb: 'FF1E3A8A' } };

  financialsSheet.getRow(4).height = 54;
  const finLabelHeader = financialsSheet.getCell(4, 1);
  finLabelHeader.value = 'CONCEPTO FINANCIERO';
  finLabelHeader.font = { name: FONT_NAME, size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
  finLabelHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } };
  finLabelHeader.alignment = { vertical: 'middle', horizontal: 'left' };

  quotes.forEach((q, i) => {
    const insHeader = financialsSheet.getCell(4, i + 2);
    insHeader.value = q.insurerName.toUpperCase();
    const profile = findColombianInsurerProfile(q.insurerName);
    const argbColor = profile?.primaryColor
      ? 'FF' + profile.primaryColor.replace('#', '')
      : 'FF1E3A8A';
    insHeader.font = { name: FONT_NAME, size: 10, bold: true, color: { argb: 'FF0F172A' } };
    insHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
    insHeader.border = {
      top: { style: 'medium', color: { argb: argbColor } },
      bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
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
      const ivaVal =
        rawIva > 0 && rawIva < totVal ? rawIva : totVal - Math.round(totVal / 1.19);
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
    ) => { value?: number; formula?: string; result?: number; isTotal?: boolean; isWinner?: boolean }
  ) => {
    financialsSheet.getRow(rowNum).height = 22;
    const lCell = financialsSheet.getCell(rowNum, 1);
    lCell.value = label;
    lCell.font = { name: FONT_NAME, size: 10, bold: true, color: { argb: 'FF334155' } };
    lCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };

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
      xlCell.font = { name: FONT_NAME, size: 10, bold: !!res.isTotal, color: { argb: 'FF1E293B' } };
      xlCell.alignment = { horizontal: 'center' };

      if (res.isWinner) {
        xlCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } };
        xlCell.font = { name: FONT_NAME, size: 10, bold: true, color: { argb: 'FF92400E' } };
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
  ratioLabel.font = { name: FONT_NAME, size: 10, bold: true, color: { argb: 'FF1E3A8A' } };

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
  chartHeader.font = { name: FONT_NAME, size: 10, bold: true, color: { argb: 'FF1E3A8A' } };

  financialsSheet.getRow(14).height = 24;
  const chartLabel = financialsSheet.getCell(14, 1);
  chartLabel.value = 'Indicador Visual (Más Económica vs Más Costosa)';
  chartLabel.font = { name: FONT_NAME, size: 10, bold: true, color: { argb: 'FF475569' } };
  chartLabel.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };

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
        xlCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDEF7EC' } };
        xlCell.font = { name: FONT_NAME, size: 9, bold: true, color: { argb: 'FF03543F' } };
      } else if (p === maxTotal) {
        xlCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFDE8E8' } };
        xlCell.font = { name: FONT_NAME, size: 9, bold: true, color: { argb: 'FF9B1C1C' } };
      } else {
        xlCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF08A' } };
        xlCell.font = { name: FONT_NAME, size: 9, bold: true, color: { argb: 'FF713F12' } };
      }
    } else {
      xlCell.value = 'N/A';
    }
    xlCell.alignment = { horizontal: 'center' };
  });

  // -------------------------------------------------------------
  // Pestaña 5: Análisis de Riesgos (Exclusiva para Modo Técnico / Auditoría)
  // -------------------------------------------------------------
  if (mode === 'technical') {
    const riskSheet = workbook.addWorksheet('Análisis de Riesgos');
  riskSheet.views = [{ showGridLines: false }];
  applySheetHeaderFooter(riskSheet, 'Análisis de Riesgos');

  riskSheet.getColumn(1).width = 24;
  riskSheet.getColumn(2).width = 25;
  riskSheet.getColumn(3).width = 18; // Columna de Calificación 1 - 10
  riskSheet.getColumn(4).width = 40;
  riskSheet.getColumn(5).width = 45;

  riskSheet.mergeCells('A1:E2');
  const riskTitle = riskSheet.getCell('A1');
  riskTitle.value = 'AUDITORÍA DE RIESGOS, CALIFICACIÓN TÉCNICA Y CONDICIONADOS';
  riskTitle.font = { name: FONT_NAME, size: 14, bold: true, color: { argb: 'FF1E3A8A' } };

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
    cell.font = { name: FONT_NAME, size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } };
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
      gradeCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDEF7EC' } };
      gradeCell.font = { name: FONT_NAME, size: 10, bold: true, color: { argb: 'FF03543F' } };
    } else if (ratingScore >= 6) {
      gradeCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF08A' } };
      gradeCell.font = { name: FONT_NAME, size: 10, bold: true, color: { argb: 'FF713F12' } };
    } else {
      gradeCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFDE8E8' } };
      gradeCell.font = { name: FONT_NAME, size: 10, bold: true, color: { argb: 'FF9B1C1C' } };
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
    cell.font = { name: FONT_NAME, size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } };
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
        levelCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFDE8E8' } };
        levelCell.font = { name: FONT_NAME, size: 10, bold: true, color: { argb: 'FF9B1C1C' } };
      } else if (alert.level === 'WARNING') {
        levelCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF08A' } };
        levelCell.font = { name: FONT_NAME, size: 10, bold: true, color: { argb: 'FF713F12' } };
      } else {
        levelCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDEF7EC' } };
        levelCell.font = { name: FONT_NAME, size: 10, bold: true, color: { argb: 'FF03543F' } };
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
    noAlertCell.font = { name: FONT_NAME, size: 10, italic: true, color: { argb: 'FF64748B' } };
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
    auditTitleCell.value = 'AUDITORÍA DETALLADA: COBERTURAS FALTANTES, CONDICIONES Y PUNTOS DE NEGOCIACIÓN';
    auditTitleCell.font = { name: FONT_NAME, size: 12, bold: true, color: { argb: 'FF1E3A8A' } };
    auditTitleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
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
          c1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: mc.impact === 'HIGH' ? 'FFFDE8E8' : 'FFFEF08A' } };
          c1.font = { name: FONT_NAME, size: 10, bold: true, color: { argb: mc.impact === 'HIGH' ? 'FF9B1C1C' : 'FF713F12' } };
          c1.alignment = { horizontal: 'center' };

          riskSheet.getCell(rRowIdx, 2).value = q.insurerName;
          riskSheet.getCell(rRowIdx, 3).value = mc.categoryName;
          riskSheet.getCell(rRowIdx, 4).value = mc.reason;
          riskSheet.getCell(rRowIdx, 5).value = `Obligatorio según estándar ${regulatoryProfile.displayName}`;
          rRowIdx++;
        });
      }

      // Deductible risks
      if (qa.deductibleRisks && qa.deductibleRisks.length > 0) {
        qa.deductibleRisks.forEach((dr) => {
          riskSheet.getRow(rRowIdx).height = 22;
          const c1 = riskSheet.getCell(rRowIdx, 1);
          c1.value = `RIESGO DEDUCIBLE (${dr.riskLevel})`;
          c1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: dr.riskLevel === 'HIGH' || dr.riskLevel === 'CRITICAL' ? 'FFFDE8E8' : 'FFFEF08A' } };
          c1.font = { name: FONT_NAME, size: 10, bold: true, color: { argb: dr.riskLevel === 'HIGH' || dr.riskLevel === 'CRITICAL' ? 'FF9B1C1C' : 'FF713F12' } };
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
          c1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFF6FF' } };
          c1.font = { name: FONT_NAME, size: 10, bold: true, color: { argb: 'FF1E40AF' } };
          c1.alignment = { horizontal: 'center' };

          riskSheet.getCell(rRowIdx, 2).value = q.insurerName;
          riskSheet.getCell(rRowIdx, 3).value = np.title;
          riskSheet.getCell(rRowIdx, 4).value = np.description;
          riskSheet.getCell(rRowIdx, 5).value = np.potentialSavings ? `Ahorro est.: ${np.potentialSavings}` : 'Mejora en suscripción';
          rRowIdx++;
        });
      }
    });
  }
}

  // -------------------------------------------------------------
  // Pestaña 6: Respaldo Normativo y Auditoría Legal en Colombia
  // -------------------------------------------------------------
  const legalSheet = workbook.addWorksheet('Respaldo Normativo y Legal');
  legalSheet.views = [{ showGridLines: false }];
  applySheetHeaderFooter(legalSheet, 'Respaldo Normativo y Legal');

  legalSheet.getColumn(1).width = 28;
  legalSheet.getColumn(2).width = 32;
  legalSheet.getColumn(3).width = 24;
  legalSheet.getColumn(4).width = 45;
  legalSheet.getColumn(5).width = 45;

  legalSheet.mergeCells('A1:E2');
  const legalTitle = legalSheet.getCell('A1');
  legalTitle.value = `MARCO NORMATIVO Y AUDITORÍA DE CONFORMIDAD REGULATORIA · ${regulatoryProfile.displayName.toUpperCase()}`;
  legalTitle.font = { name: FONT_NAME, size: 13, bold: true, color: { argb: 'FF1E3A8A' } };

  legalSheet.mergeCells('A3:E3');
  const taglineCell = legalSheet.getCell('A3');
  taglineCell.value = regulatoryProfile.tagline;
  taglineCell.font = { name: FONT_NAME, size: 10, italic: true, color: { argb: 'FF475569' } };

  // Sección 1: Normas Principales Vigentes
  legalSheet.getRow(5).height = 24;
  const lawHeader = legalSheet.getCell('A5');
  lawHeader.value = 'LEGISLACIÓN Y NORMAS COLOMBIANAS INYECTADAS EN ESTE RAMO';
  lawHeader.font = { name: FONT_NAME, size: 11, bold: true, color: { argb: 'FF0F172A' } };

  let lRowIdx = 6;
  regulatoryProfile.primaryLaws.forEach((law) => {
    legalSheet.getRow(lRowIdx).height = 22;
    const codeCell = legalSheet.getCell(lRowIdx, 1);
    codeCell.value = law.code;
    codeCell.font = { name: FONT_NAME, size: 10, bold: true, color: { argb: 'FF1E40AF' } };

    const titleCell = legalSheet.getCell(lRowIdx, 2);
    titleCell.value = law.title;
    titleCell.font = { name: FONT_NAME, size: 10, bold: true };

    legalSheet.mergeCells(lRowIdx, 3, lRowIdx, 5);
    const summaryCell = legalSheet.getCell(lRowIdx, 3);
    summaryCell.value = law.summary;
    summaryCell.font = { name: FONT_NAME, size: 9.5, color: { argb: 'FF334155' } };

    lRowIdx++;
  });

  // Sección 2: Matriz de Verificación Automática por Aseguradora
  lRowIdx += 2;
  legalSheet.getRow(lRowIdx).height = 26;
  const matrixAuditHeader = legalSheet.getCell(lRowIdx, 1);
  matrixAuditHeader.value = 'DICTAMEN DE CONFORMIDAD DE AMPAROS OBLIGATORIOS POR ASEGURADORA';
  matrixAuditHeader.font = { name: FONT_NAME, size: 11, bold: true, color: { argb: 'FF0F172A' } };

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
    cell.font = { name: FONT_NAME, size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } };
    cell.alignment = { horizontal: idx === 2 ? 'center' : 'left' };
  });

  lRowIdx++;
  const { auditReportCompliance } = await import('./regulatoryAuditService');
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
        statusCell.font = { name: FONT_NAME, size: 9.5, bold: true, color: { argb: 'FF065F46' } };
        statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1FAE5' } };
      } else if (chk.status === 'NON_COMPLIANT') {
        statusCell.value = 'NO CONFORME (CRÍTICO)';
        statusCell.font = { name: FONT_NAME, size: 9.5, bold: true, color: { argb: 'FF991B1B' } };
        statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
      } else {
        statusCell.value = 'ADVERTENCIA (REVISAR)';
        statusCell.font = { name: FONT_NAME, size: 9.5, bold: true, color: { argb: 'FF854D0E' } };
        statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF9C3' } };
      }
      statusCell.alignment = { horizontal: 'center' };

      legalSheet.getCell(lRowIdx, 4).value = chk.legalBasis;
      legalSheet.getCell(lRowIdx, 5).value = chk.details;

      lRowIdx++;
    });
  });

  // -------------------------------------------------------------
  // Pestaña 7: Políticas Comerciales y Términos de la Oferta
  // -------------------------------------------------------------
  const commercialPoliciesSheet = workbook.addWorksheet('Políticas Comerciales');
  commercialPoliciesSheet.views = [{ showGridLines: false }];
  applySheetHeaderFooter(commercialPoliciesSheet, 'Políticas Comerciales');

  commercialPoliciesSheet.getColumn(1).width = 32;
  commercialPoliciesSheet.getColumn(2).width = 35;
  commercialPoliciesSheet.getColumn(3).width = 75;

  commercialPoliciesSheet.mergeCells('A1:C2');
  const policyTitle = commercialPoliciesSheet.getCell('A1');
  policyTitle.value = `POLÍTICAS COMERCIALES Y CONDICIONES DE LA OFERTA · ${regulatoryProfile.displayName.toUpperCase()}`;
  policyTitle.font = { name: FONT_NAME, size: 13, bold: true, color: { argb: 'FF1E3A8A' } };

  commercialPoliciesSheet.mergeCells('A3:C3');
  const policySubtitle = commercialPoliciesSheet.getCell('A3');
  policySubtitle.value =
    'Condiciones operativas y términos comerciales parametrizados por la correduría de seguros para la presentación de propuestas.';
  policySubtitle.font = { name: FONT_NAME, size: 10, italic: true, color: { argb: 'FF475569' } };

  const structuredPolicies = getStructuredCommercialPolicyEntries(effectivePolicies);

  commercialPoliciesSheet.getRow(5).height = 26;
  const pHeaders = ['Categoría', 'Término / Condición', 'Detalle y Alcance Operativo'];
  pHeaders.forEach((h, idx) => {
    const cell = commercialPoliciesSheet.getCell(5, idx + 1);
    cell.value = h;
    cell.font = { name: FONT_NAME, size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } };
    cell.alignment = { vertical: 'middle', horizontal: 'left' };
  });

  let pRowIdx = 6;
  structuredPolicies.forEach((item) => {
    commercialPoliciesSheet.getRow(pRowIdx).height = 24;
    const catCell = commercialPoliciesSheet.getCell(pRowIdx, 1);
    catCell.value = item.category;
    catCell.font = { name: FONT_NAME, size: 10, bold: true, color: { argb: 'FF1E40AF' } };

    const titleCell = commercialPoliciesSheet.getCell(pRowIdx, 2);
    titleCell.value = item.title;
    titleCell.font = { name: FONT_NAME, size: 9.5, bold: true, color: { argb: 'FF334155' } };

    const detailCell = commercialPoliciesSheet.getCell(pRowIdx, 3);
    detailCell.value = item.detail;
    detailCell.font = { name: FONT_NAME, size: 9.5, color: { argb: 'FF1E293B' } };
    detailCell.alignment = { wrapText: true, vertical: 'middle' };

    pRowIdx++;
  });

  pRowIdx += 1;
  commercialPoliciesSheet.getRow(pRowIdx).height = 24;
  const brokerCardCell = commercialPoliciesSheet.getCell(pRowIdx, 1);
  commercialPoliciesSheet.mergeCells(pRowIdx, 1, pRowIdx, 3);
  brokerCardCell.value = `INTERMEDIARIO: ${brokerName} | ASESOR: ${brokerAdvisor} | REG. SFC: ${brokerReg} | TEL: ${brokerPhone} | EMAIL: ${brokerEmail}`;
  brokerCardCell.font = { name: FONT_NAME, size: 9.5, bold: true, color: { argb: 'FF1E40AF' } };
  brokerCardCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
  brokerCardCell.alignment = { vertical: 'middle', horizontal: 'left' };

  pRowIdx += 2;
  commercialPoliciesSheet.getRow(pRowIdx).height = 24;
  const legalNoticeCell = commercialPoliciesSheet.getCell(pRowIdx, 1);
  commercialPoliciesSheet.mergeCells(pRowIdx, 1, pRowIdx + 2, 3);
  legalNoticeCell.value =
    'MARCO LEGAL COLOMBIANO: La intermediación de seguros se ejerce bajo el Estatuto Orgánico del Sistema Financiero (Decreto 663 de 1993) y las instrucciones de la Superintendencia Financiera de Colombia. El contrato de seguro se rige por el Código de Comercio de Colombia (Arts. 1036 y ss). El tomador cuenta con un plazo legal de aviso de siniestro de 3 días hábiles conforme al Art. 1075 C.Co.';
  legalNoticeCell.font = { name: FONT_NAME, size: 8.5, italic: true, color: { argb: 'FF64748B' } };
  legalNoticeCell.alignment = { wrapText: true, vertical: 'middle' };

  // Generate Buffer
  const buffer = await workbook.xlsx.writeBuffer();
  return buffer as unknown as Buffer;
}
