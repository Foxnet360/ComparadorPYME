import * as ExcelJS from 'exceljs';
import { QuoteAnalysis } from '../types';
import { parseNumericValue, formatMatrixValue, enrichSmmlvDeductible, isExcludedValue } from './matrixTransformer';

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

// Levenshtein similarity helper for robust coverage matching
function localLevenshteinDistance(str1: string, str2: string): number {
  const matrix: number[][] = [];
  for (let i = 0; i <= str1.length; i++) matrix[i] = [i];
  for (let j = 0; j <= str2.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= str1.length; i++) {
    for (let j = 1; j <= str2.length; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(matrix[i - 1][j] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j - 1] + cost);
    }
  }
  return matrix[str1.length][str2.length];
}

function calculateSimilarity(str1: string, str2: string): number {
  const n1 = str1.toLowerCase().trim();
  const n2 = str2.toLowerCase().trim();
  if (n1 === n2) return 1.0;
  if (n1.includes(n2) || n2.includes(n1)) {
    const ratio = Math.min(n1.length, n2.length) / Math.max(n1.length, n2.length);
    return 0.7 + ratio * 0.2;
  }
  const maxLen = Math.max(n1.length, n2.length);
  if (maxLen === 0) return 1.0;
  return 1 - localLevenshteinDistance(n1, n2) / maxLen;
}

function isBillingOrPaymentNoise(name: string): boolean {
  const lower = name.toLowerCase();
  return (
    lower.includes('forma de pago') ||
    lower.includes('prima ') ||
    lower.includes('prima_') ||
    lower.includes('iva') ||
    lower.includes('gastos de expedición') ||
    lower.includes('gastos de expedicion') ||
    lower.includes('comisión') ||
    lower.includes('comision') ||
    lower.includes('cuota') ||
    lower.includes('financiación') ||
    lower.includes('financiacion') ||
    lower.includes('pago fraccionado') ||
    lower.includes('intermediario') ||
    lower.includes('costo') ||
    lower.includes('valor aseg') ||
    lower.includes('vigencia') ||
    lower.includes('producto') ||
    lower.includes('respaldo')
  );
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

  const hasNotes = cellNotes && Object.keys(cellNotes).length > 0;
  const FONT_NAME = 'Segoe UI';

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
      ? '$' + maxAsset.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
      : 'No especificado';

  // Find Best Quote
  const bestQuote = quotes.reduce(
    (prev, current) => ((prev.score || 0) > (current.score || 0) ? prev : current),
    quotes[0]
  );

  // -------------------------------------------------------------
  // Pestaña 1: Portada y Resumen General
  // -------------------------------------------------------------
  const portada = workbook.addWorksheet('Portada y Resumen General');
  portada.views = [{ showGridLines: false }];

  portada.getColumn(1).width = 4;
  portada.getColumn(2).width = 28;
  portada.getColumn(3).width = 4;
  portada.getColumn(4).width = 45;
  portada.getColumn(5).width = 18;
  portada.getColumn(6).width = 18;

  // Title Banner
  portada.mergeCells('B2:F2');
  const titleCell = portada.getCell('B2');
  titleCell.value = 'COMPARATIVA Y AUDITORÍA TÉCNICA DE SEGUROS';
  titleCell.font = { name: FONT_NAME, size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } };
  titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
  portada.getRow(2).height = 36;

  portada.mergeCells('B3:F3');
  const subtitleCell = portada.getCell('B3');
  subtitleCell.value = `INFORME EJECUTIVO PARA LA TOMA DE DECISIONES | ${clientName.toUpperCase()} | ${clientLocation}`;
  subtitleCell.font = { name: FONT_NAME, size: 10, italic: true, color: { argb: 'FF475569' } };
  subtitleCell.alignment = { vertical: 'middle', horizontal: 'center' };

  // BLOQUE SOMBREADO: RESUMEN EJECUTIVO (PÁRRAFO DE RECOMENDACIÓN)
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

  // Helper Row Adder
  const addInfoRow = (label: string, value: string, rowIdx: number) => {
    const cellA = portada.getCell(`B${rowIdx}`);
    cellA.value = label;
    cellA.font = { name: FONT_NAME, size: 10, bold: true, color: { argb: 'FF334155' } };
    cellA.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };

    const cellB = portada.getCell(`D${rowIdx}`);
    cellB.value = value;
    cellB.font = { name: FONT_NAME, size: 10, color: { argb: 'FF1E293B' } };
  };

  // Datos del Cliente
  portada.getCell('B10').value = 'DATOS DEL ASEGURADO (CLIENTE)';
  portada.getCell('B10').font = { name: FONT_NAME, size: 11, bold: true, color: { argb: 'FF1E3A8A' } };
  addInfoRow('Asegurado:', clientName, 11);
  addInfoRow('Actividad / Ocupación:', clientActivity, 12);
  addInfoRow('Ubicación del Riesgo:', clientLocation, 13);
  addInfoRow('Valor Total Bienes:', totalAssetValueStr, 14);

  // Intermediario / Aliado
  portada.getCell('B16').value = 'DATOS DEL INTERMEDIARIO / ALIADO TÉCNICO';
  portada.getCell('B16').font = { name: FONT_NAME, size: 11, bold: true, color: { argb: 'FF1E3A8A' } };
  addInfoRow('Corredoría / Agencia:', brokerInfo?.intermediaryName || 'Agencia Aliada', 17);
  addInfoRow('Asesor Responsable:', brokerInfo?.name || 'Asesor Técnico de Seguros', 18);
  addInfoRow('Nº Matrícula / Registro:', brokerInfo?.registrationNumber || 'No especificado', 19);
  addInfoRow('Contacto / Correo:', brokerInfo?.email || 'contacto@corredor.com', 20);

  // Scorecard Multidimensional (0 - 100)
  portada.getCell('B22').value = 'SCORECARD COMPARATIVO DE AUDITORÍA (0 - 100)';
  portada.getCell('B22').font = { name: FONT_NAME, size: 11, bold: true, color: { argb: 'FF1E3A8A' } };

  portada.getRow(23).height = 24;
  const colAHeader = portada.getCell('B23');
  colAHeader.value = 'DIMENSIÓN DE EVALUACIÓN';
  colAHeader.font = { name: FONT_NAME, size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
  colAHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } };

  quotes.forEach((q, idx) => {
    const colLetter = String.fromCharCode(68 + idx);
    const hCell = portada.getCell(`${colLetter}23`);
    hCell.value = q.insurerName.toUpperCase();
    hCell.font = { name: FONT_NAME, size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    hCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } };
    hCell.alignment = { horizontal: 'center' };
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
    const rowNum = 24 + rIdx;
    portada.getRow(rowNum).height = 20;

    const isTotal = dim.key === 'total';
    const labelCell = portada.getCell(`B${rowNum}`);
    labelCell.value = dim.label;
    labelCell.font = { name: FONT_NAME, size: 10, bold: isTotal, color: { argb: isTotal ? 'FF1E3A8A' : 'FF334155' } };

    quotes.forEach((q, qIdx) => {
      const colLetter = String.fromCharCode(68 + qIdx);
      const cellVal = portada.getCell(`${colLetter}${rowNum}`);
      let scoreVal = 50;

      if (isTotal) {
        scoreVal = q.score || 50;
      } else if (q.scoringBreakdown) {
        scoreVal = Math.round(((q.scoringBreakdown as any)[dim.key] || 5) * 10);
      }

      cellVal.value = scoreVal;
      cellVal.font = { name: FONT_NAME, size: 10, bold: isTotal, color: { argb: 'FF1E293B' } };
      cellVal.alignment = { horizontal: 'center' };

      // Relleno condicional suave según el puntaje
      if (scoreVal >= 80) {
        cellVal.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1FAE5' } };
      } else if (scoreVal >= 60) {
        cellVal.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } };
      } else {
        cellVal.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
      }
    });
  });

  // Guía de Navegación
  portada.getCell('B32').value = 'CONTENIDO Y NAVEGACIÓN DEL INFORME';
  portada.getCell('B32').font = { name: FONT_NAME, size: 11, bold: true, color: { argb: 'FF1E3A8A' } };

  const navRows = [
    { name: 'Portada y Resumen General', desc: 'Resumen ejecutivo, ficha del cliente, aliado y scorecard de puntaje 0-100.' },
    { name: 'Matriz Coberturas', desc: 'Matriz comparativa ampliada de amparos canónicos y ventajas exclusivas.' },
    { name: 'Matriz Deducibles', desc: 'Matriz consolidada dedicada a deducibles y valores equivalentes en COP.' },
    { name: 'Primas y Costos', desc: 'Desglose financiero con fórmulas automáticas nativas e indicador gráfico visual.' },
    { name: 'Análisis de Riesgos', desc: 'Auditoría técnica de alertas clasificadas y escala de calificación 1 a 10.' },
  ];

  navRows.forEach((item, idx) => {
    const rIdx = 33 + idx;
    const cellA = portada.getCell(`B${rIdx}`);
    cellA.value = item.name;
    cellA.font = { name: FONT_NAME, size: 10, bold: true, color: { argb: 'FF1E3A8A' } };

    const cellB = portada.getCell(`D${rIdx}`);
    cellB.value = item.desc;
    cellB.font = { name: FONT_NAME, size: 10, color: { argb: 'FF475569' } };
  });

  // -------------------------------------------------------------
  // Pestaña 2: Matriz Coberturas
  // -------------------------------------------------------------
  const coveragesSheet = workbook.addWorksheet('Matriz Coberturas');
  coveragesSheet.views = [{ showGridLines: false }];

  coveragesSheet.getColumn(1).width = 44;
  for (let i = 0; i < quotes.length; i++) {
    coveragesSheet.getColumn(i + 2).width = 34;
  }

  coveragesSheet.mergeCells(1, 1, 2, quotes.length + 1 + (hasNotes ? 1 : 0));
  const covTitle = coveragesSheet.getCell(1, 1);
  covTitle.value = 'MATRIZ COMPARATIVA AMPLIADA DE COBERTURAS Y AMPAROS';
  covTitle.font = { name: FONT_NAME, size: 14, bold: true, color: { argb: 'FF1E3A8A' } };
  covTitle.alignment = { vertical: 'middle', horizontal: 'left' };

  coveragesSheet.getRow(4).height = 26;
  const mainLabelHeader = coveragesSheet.getCell(4, 1);
  mainLabelHeader.value = 'COBERTURA / CONCEPTO CANÓNICO';
  mainLabelHeader.font = { name: FONT_NAME, size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
  mainLabelHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } };

  quotes.forEach((q, i) => {
    const insHeader = coveragesSheet.getCell(4, i + 2);
    insHeader.value = q.insurerName.toUpperCase();
    insHeader.font = { name: FONT_NAME, size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    insHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } };
    insHeader.alignment = { horizontal: 'center' };
  });

  if (hasNotes) {
    const notesHeader = coveragesSheet.getCell(4, quotes.length + 2);
    notesHeader.value = 'INSIGHTS DEL CONSULTOR';
    notesHeader.font = { name: FONT_NAME, size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    notesHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF7C3AED' } };
    notesHeader.alignment = { horizontal: 'center' };
    coveragesSheet.getColumn(quotes.length + 2).width = 40;
  }

  // Canonical Coverage Categories
  const CANONICAL_CATEGORIES = [
    { section: 'BIENES ASEGURADOS', name: 'Incendio (Edificio y Contenidos)', keywords: ['incendio', 'edificio', 'bienes', 'amparo básico', 'daño material'] },
    { section: 'BIENES ASEGURADOS', name: 'Terremoto y Eventos Catastróficos', keywords: ['terremoto', 'temblor', 'erupcion', 'volcan'] },
    { section: 'BIENES ASEGURADOS', name: 'Equipo Eléctrico y Electrónico', keywords: ['equipo eléctrico', 'equipo electronico', 'daño interno'] },
    { section: 'BIENES ASEGURADOS', name: 'Rotura de Maquinaria', keywords: ['rotura de maquinaria', 'maquinaria'] },
    { section: 'BIENES ASEGURADOS', name: 'Transporte de Mercancías', keywords: ['transporte', 'mercancías', 'mercancias'] },
    { section: 'BIENES ASEGURADOS', name: 'Vidrios Planos', keywords: ['vidrio'] },
    { section: 'COBERTURAS', name: 'Terrorismo, AMIT y Actos Malintencionados', keywords: ['terrorismo', 'amit', 'hmacc', 'huelga', 'motin', 'asonada'] },
    { section: 'COBERTURAS', name: 'Lucro Cesante / Pérdida de Ingresos', keywords: ['lucro cesante', 'pérdida de ingresos', 'canones'] },
    { section: 'COBERTURAS', name: 'Responsabilidad Civil Extracontractual (RCE)', keywords: ['responsabilidad civil', 'rce', 'rc '] },
    { section: 'COBERTURAS', name: 'Manejo Global / Infidelidad de Empleados', keywords: ['manejo', 'infidelidad'] },
    { section: 'COBERTURAS', name: 'Daños por Agua, Anegación e Inundación', keywords: ['agua', 'anegacion', 'anegación', 'inundacion'] },
    { section: 'COBERTURAS', name: 'Asistencia PYME y Legal', keywords: ['asistencia'] },
    { section: 'SUSTRACCIÓN', name: 'Sustracción / Hurto', keywords: ['sustracción', 'sustraccion', 'hurto', 'robo'] },
  ];

  let currentCovRow = 5;
  let currentSection = '';

  CANONICAL_CATEGORIES.forEach((cat) => {
    if (cat.section !== currentSection) {
      currentSection = cat.section;
      coveragesSheet.mergeCells(currentCovRow, 1, currentCovRow, quotes.length + 1 + (hasNotes ? 1 : 0));
      const secCell = coveragesSheet.getCell(currentCovRow, 1);
      secCell.value = currentSection;
      secCell.font = { name: FONT_NAME, size: 11, bold: true, color: { argb: 'FF1E3A8A' } };
      secCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE6F0FA' } };
      currentCovRow++;
    }

    coveragesSheet.getRow(currentCovRow).height = 22;
    const labelCell = coveragesSheet.getCell(currentCovRow, 1);
    labelCell.value = cat.name;
    labelCell.font = { name: FONT_NAME, size: 10, bold: true, color: { argb: 'FF475569' } };
    labelCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };

    const rowValues: { text: string; num: number; isExcluded: boolean }[] = [];

    quotes.forEach((q, qIdx) => {
      const xlCell = coveragesSheet.getCell(currentCovRow, qIdx + 2);
      const cov = (q.coverages || []).find((c) => {
        const cName = (c.name || '').toLowerCase();
        const cCanon = (c.canonicalName || '').toLowerCase();
        return (
          cCanon === cat.name.toLowerCase() ||
          cName === cat.name.toLowerCase() ||
          calculateSimilarity(cName, cat.name) >= 0.70 ||
          cat.keywords.some((kw) => cName.includes(kw) || cCanon.includes(kw))
        );
      });

      if (cov) {
        const valStr = cov.value || 'Amparada';
        const numericVal = parseNumericValue(valStr);
        const excluded = isExcludedValue(valStr);

        rowValues.push({ text: valStr, num: numericVal, isExcluded: excluded });

        if (excluded) {
          xlCell.value = 'No incluida';
          xlCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
          xlCell.font = { name: FONT_NAME, size: 10, italic: true, color: { argb: 'FF991B1B' } };
        } else if (numericVal > 0) {
          xlCell.value = numericVal;
          xlCell.numFmt = '$#,##0';
          xlCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1FAE5' } };
          xlCell.font = { name: FONT_NAME, size: 10, bold: true, color: { argb: 'FF065F46' } };
        } else {
          xlCell.value = formatMatrixValue(valStr);
          xlCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1FAE5' } };
          xlCell.font = { name: FONT_NAME, size: 10, color: { argb: 'FF065F46' } };
        }

        const firstCitation = cov.citations?.[0];
        if (firstCitation?.page) {
          xlCell.note = `Fuente original: PDF cotización, Página ${firstCitation.page}`;
        }
        if (cov.matchConfidence !== undefined && cov.matchConfidence !== null) {
          const confidenceText = `Confianza: ${(cov.matchConfidence * 100).toFixed(0)}%`;
          xlCell.note = xlCell.note ? `${xlCell.note}\n${confidenceText}` : confidenceText;
        }
      } else {
        rowValues.push({ text: 'No incluida', num: 0, isExcluded: true });
        xlCell.value = 'No incluida';
        xlCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
        xlCell.font = { name: FONT_NAME, size: 10, italic: true, color: { argb: 'FF991B1B' } };
      }

      xlCell.alignment = { horizontal: 'center', wrapText: true };
      xlCell.border = { bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } } };
    });

    // Winner Highlight
    const maxNum = Math.max(...rowValues.map((v) => v.num));
    if (maxNum > 0) {
      quotes.forEach((_, qIdx) => {
        if (rowValues[qIdx].num === maxNum && !rowValues[qIdx].isExcluded) {
          const xlCell = coveragesSheet.getCell(currentCovRow, qIdx + 2);
          xlCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFDF2E9' } };
          xlCell.font = { name: FONT_NAME, size: 10, bold: true, color: { argb: 'FF92400E' } };
        }
      });
    }

    currentCovRow++;
  });

  // Exclusive / Additional Coverages
  const exclusiveGroups: Array<{ name: string; items: Array<{ qIdx: number; cov: any }> }> = [];
  quotes.forEach((q, qIdx) => {
    (q.coverages || []).forEach((c) => {
      const cName = (c.name || c.canonicalName || '').trim();
      if (!cName || isBillingOrPaymentNoise(cName)) return;

      const isCanonical = CANONICAL_CATEGORIES.some(
        (cat) =>
          cat.keywords.some((kw) => cName.toLowerCase().includes(kw)) ||
          calculateSimilarity(cName, cat.name) >= 0.70
      );

      if (!isCanonical) {
        let group = exclusiveGroups.find((g) => calculateSimilarity(g.name, cName) >= 0.70);
        if (group) {
          group.items.push({ qIdx, cov: c });
        } else {
          exclusiveGroups.push({ name: cName, items: [{ qIdx, cov: c }] });
        }
      }
    });
  });

  if (exclusiveGroups.length > 0) {
    coveragesSheet.mergeCells(currentCovRow, 1, currentCovRow, quotes.length + 1 + (hasNotes ? 1 : 0));
    const exHeader = coveragesSheet.getCell(currentCovRow, 1);
    exHeader.value = 'AMPAROS EXCLUSIVOS Y VENTAJAS COMPETITIVAS';
    exHeader.font = { name: FONT_NAME, size: 11, bold: true, color: { argb: 'FF1E3A8A' } };
    exHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE6F0FA' } };
    currentCovRow++;

    exclusiveGroups.forEach((group) => {
      coveragesSheet.getRow(currentCovRow).height = 22;
      const labelCell = coveragesSheet.getCell(currentCovRow, 1);
      labelCell.value = group.name;
      labelCell.font = { name: FONT_NAME, size: 10, bold: true, color: { argb: 'FF475569' } };
      labelCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };

      quotes.forEach((_, qIdx) => {
        const xlCell = coveragesSheet.getCell(currentCovRow, qIdx + 2);
        const match = group.items.find((it) => it.qIdx === qIdx);

        if (match) {
          const valStr = match.cov.value || 'Incluido';
          const numericVal = parseNumericValue(valStr);
          if (numericVal > 0) {
            xlCell.value = numericVal;
            xlCell.numFmt = '$#,##0';
          } else {
            xlCell.value = valStr;
          }
          xlCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1FAE5' } };
          xlCell.font = { name: FONT_NAME, size: 10, bold: true, color: { argb: 'FF065F46' } };
        } else {
          xlCell.value = 'No incluida';
          xlCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
          xlCell.font = { name: FONT_NAME, size: 10, italic: true, color: { argb: 'FF991B1B' } };
        }

        xlCell.alignment = { horizontal: 'center' };
        xlCell.border = { bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } } };
      });
      currentCovRow++;
    });
  }

  // -------------------------------------------------------------
  // Pestaña 3: Matriz Deducibles
  // -------------------------------------------------------------
  const deductiblesSheet = workbook.addWorksheet('Matriz Deducibles');
  deductiblesSheet.views = [{ showGridLines: false }];

  deductiblesSheet.getColumn(1).width = 44;
  for (let i = 0; i < quotes.length; i++) {
    deductiblesSheet.getColumn(i + 2).width = 38;
  }

  deductiblesSheet.mergeCells(1, 1, 2, quotes.length + 1);
  const dedTitle = deductiblesSheet.getCell(1, 1);
  dedTitle.value = 'MATRIZ CONSOLIDADA DE DEDUCIBLES Y RETENCIÓN DE RIESGO';
  dedTitle.font = { name: FONT_NAME, size: 14, bold: true, color: { argb: 'FF1E3A8A' } };

  deductiblesSheet.getRow(4).height = 26;
  const dedLabelHeader = deductiblesSheet.getCell(4, 1);
  dedLabelHeader.value = 'AMPARO / COBERTURA';
  dedLabelHeader.font = { name: FONT_NAME, size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
  dedLabelHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } };

  quotes.forEach((q, i) => {
    const insHeader = deductiblesSheet.getCell(4, i + 2);
    insHeader.value = q.insurerName.toUpperCase();
    insHeader.font = { name: FONT_NAME, size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    insHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } };
    insHeader.alignment = { horizontal: 'center' };
  });

  let currentDedRow = 5;

  CANONICAL_CATEGORIES.forEach((cat) => {
    deductiblesSheet.getRow(currentDedRow).height = 24;
    const labelCell = deductiblesSheet.getCell(currentDedRow, 1);
    labelCell.value = cat.name;
    labelCell.font = { name: FONT_NAME, size: 10, bold: true, color: { argb: 'FF475569' } };
    labelCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };

    quotes.forEach((q, qIdx) => {
      const xlCell = deductiblesSheet.getCell(currentDedRow, qIdx + 2);
      const cov = (q.coverages || []).find((c) => {
        const cName = (c.name || '').toLowerCase();
        const cCanon = (c.canonicalName || '').toLowerCase();
        return (
          cCanon === cat.name.toLowerCase() ||
          cName === cat.name.toLowerCase() ||
          calculateSimilarity(cName, cat.name) >= 0.70 ||
          cat.keywords.some((kw) => cName.includes(kw) || cCanon.includes(kw))
        );
      });

      const rawDed = cov?.deductible || q.deductibles || 'Sin deducible';
      const enrichedDed = enrichSmmlvDeductible(rawDed);
      const isNoAplica =
        enrichedDed.toLowerCase().includes('no aplica') ||
        enrichedDed.toLowerCase().includes('sin deducible');

      xlCell.value = enrichedDed;
      xlCell.font = { name: FONT_NAME, size: 10, color: { argb: 'FF1E293B' } };

      if (isNoAplica) {
        xlCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1FAE5' } };
        xlCell.font = { name: FONT_NAME, size: 10, bold: true, color: { argb: 'FF065F46' } };
      }

      xlCell.alignment = { horizontal: 'center', wrapText: true };
      xlCell.border = { bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } } };
    });
    currentDedRow++;
  });

  // -------------------------------------------------------------
  // Pestaña 4: Primas y Costos (CON FÓRMULAS NATIVAS E INDICADOR GRÁFICO VISUAL)
  // -------------------------------------------------------------
  const financialsSheet = workbook.addWorksheet('Primas y Costos');
  financialsSheet.views = [{ showGridLines: false }];

  financialsSheet.getColumn(1).width = 44;
  for (let i = 0; i < quotes.length; i++) {
    financialsSheet.getColumn(i + 2).width = 30;
  }

  financialsSheet.mergeCells(1, 1, 2, quotes.length + 1);
  const finTitle = financialsSheet.getCell(1, 1);
  finTitle.value = 'EVALUACIÓN FINANCIERA DE PRIMAS Y COSTOS COMPARATIVOS';
  finTitle.font = { name: FONT_NAME, size: 14, bold: true, color: { argb: 'FF1E3A8A' } };

  financialsSheet.getRow(4).height = 26;
  const finLabelHeader = financialsSheet.getCell(4, 1);
  finLabelHeader.value = 'CONCEPTO FINANCIERO';
  finLabelHeader.font = { name: FONT_NAME, size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
  finLabelHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } };

  quotes.forEach((q, i) => {
    const insHeader = financialsSheet.getCell(4, i + 2);
    insHeader.value = q.insurerName.toUpperCase();
    insHeader.font = { name: FONT_NAME, size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    insHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } };
    insHeader.alignment = { horizontal: 'center' };
  });

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
    lCell.font = { name: FONT_NAME, size: 10, bold: true, color: { argb: 'FF334155' } };
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
      xlCell.font = { name: FONT_NAME, size: 10, bold: !!res.isTotal, color: { argb: 'FF1E293B' } };
      xlCell.alignment = { horizontal: 'center' };

      if (res.isWinner) {
        xlCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFDF2E9' } };
        xlCell.font = { name: FONT_NAME, size: 10, bold: true, color: { argb: 'FF92400E' } };
      }
    });
  };

  const minNet = Math.min(...netPremiums.filter((n) => n > 0));
  const maxNet = Math.max(...netPremiums.filter((n) => n > 0));

  addFinRow('Prima Neta (Anual)', 5, (_, idx) => ({
    value: netPremiums[idx],
    isWinner: netPremiums[idx] > 0 && netPremiums[idx] === minNet,
  }));

  addFinRow('Gastos de Expedición', 6, (_, idx) => ({
    value: expenses[idx],
  }));

  // Fórmulas automáticas nativas
  addFinRow('Subtotal', 7, (colLetter) => ({
    formula: `SUM(${colLetter}5:${colLetter}6)`,
    isTotal: true,
  }));

  addFinRow('IVA (19%)', 8, (colLetter) => ({
    formula: `ROUND(${colLetter}7*0.19, 0)`,
  }));

  addFinRow('TOTAL A PAGAR', 9, (colLetter, idx) => ({
    formula: `${colLetter}7+${colLetter}8`,
    isTotal: true,
    isWinner: netPremiums[idx] > 0 && netPremiums[idx] === minNet,
  }));

  // Ratio % sobre Valor Asegurado
  financialsSheet.getRow(11).height = 22;
  const ratioLabel = financialsSheet.getCell(11, 1);
  ratioLabel.value = '% SOBRE VALOR ASEGURADO';
  ratioLabel.font = { name: FONT_NAME, size: 10, bold: true, color: { argb: 'FF1E3A8A' } };

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
    const p = netPremiums[idx];

    if (p > 0 && minNet > 0) {
      const diffPct = ((p - minNet) / minNet) * 100;
      let barChars = '██████████';
      if (diffPct === 0) barChars = '████ (MÁS ECONÓMICA)';
      else if (p === maxNet) barChars = '████████████ (MÁS COSTOSA)';

      xlCell.value = `${barChars} (+${diffPct.toFixed(1)}%)`;

      if (p === minNet) {
        xlCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1FAE5' } };
        xlCell.font = { name: FONT_NAME, size: 9, bold: true, color: { argb: 'FF065F46' } };
      } else if (p === maxNet) {
        xlCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
        xlCell.font = { name: FONT_NAME, size: 9, bold: true, color: { argb: 'FF991B1B' } };
      } else {
        xlCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } };
        xlCell.font = { name: FONT_NAME, size: 9, bold: true, color: { argb: 'FF92400E' } };
      }
    } else {
      xlCell.value = 'N/A';
    }
    xlCell.alignment = { horizontal: 'center' };
  });

  // -------------------------------------------------------------
  // Pestaña 5: Análisis de Riesgos (CON ESCALA CONDICIONAL GRADIENTE 1 - 10)
  // -------------------------------------------------------------
  const riskSheet = workbook.addWorksheet('Análisis de Riesgos');
  riskSheet.views = [{ showGridLines: false }];

  riskSheet.getColumn(1).width = 24;
  riskSheet.getColumn(2).width = 25;
  riskSheet.getColumn(3).width = 18; // Columna de Calificación 1 - 10
  riskSheet.getColumn(4).width = 40;
  riskSheet.getColumn(5).width = 45;

  riskSheet.mergeCells('A1:E2');
  const riskTitle = riskSheet.getCell('A1');
  riskTitle.value = 'AUDITORÍA DE RIESGOS, CALIFICACIÓN TÉCNICA Y CONDICIONADOS';
  riskTitle.font = { name: FONT_NAME, size: 14, bold: true, color: { argb: 'FF1E3A8A' } };

  // Section 1: Scorecard de Calificación Técnica (1 a 10)
  riskSheet.getRow(4).height = 24;
  const scoreHeaders = ['Aseguradora', 'Perfil de Riesgo', 'Calificación (1 - 10)', 'Fortaleza Principal', 'Riesgo / Debilidad Principal'];
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
    riskSheet.getCell(rowNum, 2).value = ratingScore >= 8 ? 'Riesgo Bajo / Óptimo' : ratingScore >= 6 ? 'Riesgo Moderado' : 'Riesgo Alto';

    // Columna Calificación con Gradient Scale
    const gradeCell = riskSheet.getCell(rowNum, 3);
    gradeCell.value = `${ratingScore} / 10`;
    gradeCell.font = { name: FONT_NAME, size: 10, bold: true };
    gradeCell.alignment = { horizontal: 'center' };

    if (ratingScore >= 8) {
      gradeCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1FAE5' } };
      gradeCell.font = { name: FONT_NAME, size: 10, bold: true, color: { argb: 'FF065F46' } };
    } else if (ratingScore >= 6) {
      gradeCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } };
      gradeCell.font = { name: FONT_NAME, size: 10, bold: true, color: { argb: 'FF92400E' } };
    } else {
      gradeCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
      gradeCell.font = { name: FONT_NAME, size: 10, bold: true, color: { argb: 'FF991B1B' } };
    }

    riskSheet.getCell(rowNum, 4).value = q.technicalAnalysis || 'Alta cobertura canónica y estabilidad financiera';
    riskSheet.getCell(rowNum, 5).value = q.clientAnalysis || 'Revisar sublímites específicos e insumos de deducibles';
  });

  // Section 2: Alertas Auditadas
  let rRowIdx = 7 + quotes.length;
  riskSheet.getRow(rRowIdx).height = 24;
  const alertHeaders = ['Nivel Severidad', 'Aseguradora', 'Hallazgo / Cobertura', 'Detalle de Alerta', 'Referencia Clausulado'];
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
        levelCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
        levelCell.font = { name: FONT_NAME, size: 10, bold: true, color: { argb: 'FF991B1B' } };
      } else if (alert.level === 'WARNING') {
        levelCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } };
        levelCell.font = { name: FONT_NAME, size: 10, bold: true, color: { argb: 'FF92400E' } };
      } else {
        levelCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1FAE5' } };
        levelCell.font = { name: FONT_NAME, size: 10, bold: true, color: { argb: 'FF065F46' } };
      }

      riskSheet.getCell(rRowIdx, 2).value = q.insurerName;
      riskSheet.getCell(rRowIdx, 3).value = alert.title || 'Alerta Técnica';
      riskSheet.getCell(rRowIdx, 4).value = alert.description || '';
      riskSheet.getCell(rRowIdx, 5).value = alert.clauseReference || alert.sourceDocument || 'Condicionado General';

      rRowIdx++;
    });
  });

  if (alertCount === 0) {
    riskSheet.mergeCells(`A${rRowIdx}:E${rRowIdx}`);
    const noAlertCell = riskSheet.getCell(`A${rRowIdx}`);
    noAlertCell.value = 'No se detectaron alertas críticas en los documentos analizados.';
    noAlertCell.font = { name: FONT_NAME, size: 10, italic: true, color: { argb: 'FF64748B' } };
  }

  // Generate Buffer
  const buffer = await workbook.xlsx.writeBuffer();
  return buffer as unknown as Buffer;
}
