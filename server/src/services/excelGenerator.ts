import * as ExcelJS from 'exceljs';
import { QuoteAnalysis, MatrixRow, MatrixCell } from '../types';
import {
  transformQuotesToMatrix,
  parseNumericValue,
  formatMatrixValue,
  enrichSmmlvDeductible,
  isExcludedValue,
} from './matrixTransformer';

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

  // Obtain ground-truth matrix rows from reportData or build using matrixTransformer
  const matrix: MatrixRow[] =
    reportData?.matrix && Array.isArray(reportData.matrix) && reportData.matrix.length > 0
      ? reportData.matrix
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

  // -------------------------------------------------------------
  // Pestaña 1: Portada y Resumen General (Look & Feel Ejecutivo)
  // -------------------------------------------------------------
  const portada = workbook.addWorksheet('Portada y Resumen General');
  portada.views = [{ showGridLines: false }];

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
  addInfoRow('Asegurado:', clientName, 11);
  addInfoRow('Actividad / Ocupación:', clientActivity, 12);
  addInfoRow('Ubicación del Riesgo:', clientLocation, 13);
  addInfoRow('Valor Total Bienes:', totalAssetValueStr, 14);

  portada.getCell('B16').value = 'DATOS DEL INTERMEDIARIO / ALIADO TÉCNICO';
  portada.getCell('B16').font = {
    name: FONT_NAME,
    size: 11,
    bold: true,
    color: { argb: 'FF1E3A8A' },
  };
  addInfoRow('Corredoría / Agencia:', brokerInfo?.intermediaryName || 'Agencia Aliada', 17);
  addInfoRow('Asesor Responsable:', brokerInfo?.name || 'Asesor Técnico de Seguros', 18);
  addInfoRow('Nº Matrícula / Registro:', brokerInfo?.registrationNumber || 'No especificado', 19);
  addInfoRow('Contacto / Correo:', brokerInfo?.email || 'contacto@corredor.com', 20);

  // Scorecard Multidimensional (0 - 100)
  portada.getCell('B22').value = 'SCORECARD COMPARATIVO DE AUDITORÍA (0 - 100)';
  portada.getCell('B22').font = {
    name: FONT_NAME,
    size: 11,
    bold: true,
    color: { argb: 'FF1E3A8A' },
  };

  portada.getRow(23).height = 26;
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
        scoreVal = Math.round(((q.scoringBreakdown as any)[dim.key] || 5) * 10);
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
  portada.getCell('B32').value = 'CONTENIDO Y NAVEGACIÓN DEL INFORME';
  portada.getCell('B32').font = {
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
  // Pestaña 2: Matriz Coberturas (Direct Matrix Data Rendering)
  // -------------------------------------------------------------
  const coveragesSheet = workbook.addWorksheet('Matriz Coberturas');
  coveragesSheet.views = [{ showGridLines: false }];

  coveragesSheet.getColumn(1).width = 45;
  for (let i = 0; i < quotes.length; i++) {
    coveragesSheet.getColumn(i + 2).width = 35;
  }

  coveragesSheet.mergeCells(1, 1, 2, quotes.length + 1 + (hasNotes ? 1 : 0));
  const covTitle = coveragesSheet.getCell(1, 1);
  covTitle.value = 'MATRIZ COMPARATIVA AMPLIADA DE COBERTURAS Y AMPAROS';
  covTitle.font = { name: FONT_NAME, size: 14, bold: true, color: { argb: 'FF1E3A8A' } };
  covTitle.alignment = { vertical: 'middle', horizontal: 'left' };

  coveragesSheet.getRow(4).height = 28;
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

  // Filter matrix rows for coverages tab (exclude standalone deductible section rows & financial rows)
  const coverageMatrixRows = matrix.filter(
    (row) =>
      row.sectionId < 100 &&
      !row.id.includes('_row_deductible') &&
      !row.id.startsWith('deductible_') &&
      row.id !== 'section_group_deductibles'
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
      currentCovRow++;
    } else if (row.type === 'spacer') {
      coveragesSheet.getRow(currentCovRow).height = 8;
      currentCovRow++;
    } else {
      coveragesSheet.getRow(currentCovRow).height = 22;
      const labelCell = coveragesSheet.getCell(currentCovRow, 1);
      labelCell.value = row.label;
      labelCell.font = { name: FONT_NAME, size: 10, bold: true, color: { argb: 'FF475569' } };
      labelCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };

      row.cells.forEach((cell: MatrixCell, idx: number) => {
        const xlCell = coveragesSheet.getCell(currentCovRow, idx + 2);
        const valStr = cell.value || '';
        const excluded = cell.isExcluded || isExcludedValue(valStr);
        const numericVal = parseNumericValue(valStr);
        const isWinner = cell.isWinner;

        if (excluded) {
          xlCell.value = 'No incluida';
          xlCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFDE8E8' } }; // Soft red pastel
          xlCell.font = { name: FONT_NAME, size: 10, italic: true, color: { argb: 'FF9B1C1C' } };
        } else if (numericVal > 0) {
          xlCell.value = numericVal;
          xlCell.numFmt = '$#,##0';
          xlCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDEF7EC' } }; // Soft green pastel
          xlCell.font = { name: FONT_NAME, size: 10, bold: true, color: { argb: 'FF03543F' } };
        } else {
          xlCell.value = formatMatrixValue(valStr);
          xlCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDEF7EC' } }; // Soft green pastel
          xlCell.font = { name: FONT_NAME, size: 10, color: { argb: 'FF03543F' } };
        }

        if (isWinner && !excluded) {
          xlCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } }; // Soft Amber pastel
          xlCell.font = { name: FONT_NAME, size: 10, bold: true, color: { argb: 'FF92400E' } };
        }

        xlCell.alignment = { horizontal: 'center', wrapText: true };
        xlCell.border = { bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } } };

        if (cell.pageNumber) {
          xlCell.note = `Fuente original: PDF cotización, Página ${cell.pageNumber}`;
        }
        if (cell.confidence !== undefined && cell.confidence !== null) {
          const confText = `Confianza: ${(cell.confidence * 100).toFixed(0)}%`;
          xlCell.note = xlCell.note ? `${xlCell.note}\n${confText}` : confText;
        }
      });

      if (hasNotes) {
        const cellId = `coverage-${row.id}`;
        const note = cellNotes?.[cellId];
        const notesCell = coveragesSheet.getCell(currentCovRow, quotes.length + 2);
        notesCell.value = note || '';
        notesCell.font = { name: FONT_NAME, size: 9, color: { argb: 'FF7C3AED' }, italic: true };
        if (note)
          notesCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3E8FF' } };
      }

      currentCovRow++;
    }
  }

  // -------------------------------------------------------------
  // Pestaña 3: Matriz Deducibles (Consolidated Deductible Matrix)
  // -------------------------------------------------------------
  const deductiblesSheet = workbook.addWorksheet('Matriz Deducibles');
  deductiblesSheet.views = [{ showGridLines: false }];

  deductiblesSheet.getColumn(1).width = 45;
  for (let i = 0; i < quotes.length; i++) {
    deductiblesSheet.getColumn(i + 2).width = 38;
  }

  deductiblesSheet.mergeCells(1, 1, 2, quotes.length + 1);
  const dedTitle = deductiblesSheet.getCell(1, 1);
  dedTitle.value = 'MATRIZ CONSOLIDADA DE DEDUCIBLES Y RETENCIÓN DE RIESGO';
  dedTitle.font = { name: FONT_NAME, size: 14, bold: true, color: { argb: 'FF1E3A8A' } };

  deductiblesSheet.getRow(4).height = 28;
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

  // Filter matrix for deductible rows or build from matrix
  const deductibleMatrixRows = matrix.filter(
    (row) =>
      row.id.includes('_row_deductible') ||
      row.id.startsWith('deductible_') ||
      row.id === 'section_group_deductibles'
  );

  let currentDedRow = 5;

  if (deductibleMatrixRows.length > 0) {
    for (const row of deductibleMatrixRows) {
      if (row.type === 'header') {
        deductiblesSheet.mergeCells(currentDedRow, 1, currentDedRow, quotes.length + 1);
        const cell = deductiblesSheet.getCell(currentDedRow, 1);
        cell.value = row.label;
        cell.font = { name: FONT_NAME, size: 11, bold: true, color: { argb: 'FF1E3A8A' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
        currentDedRow++;
      } else if (row.type === 'spacer') {
        deductiblesSheet.getRow(currentDedRow).height = 8;
        currentDedRow++;
      } else {
        deductiblesSheet.getRow(currentDedRow).height = 24;
        const labelCell = deductiblesSheet.getCell(currentDedRow, 1);
        labelCell.value = row.label;
        labelCell.font = { name: FONT_NAME, size: 10, bold: true, color: { argb: 'FF475569' } };
        labelCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };

        row.cells.forEach((cell: MatrixCell, idx: number) => {
          const xlCell = deductiblesSheet.getCell(currentDedRow, idx + 2);
          const rawDed = cell.value || 'Sin deducible';
          const enrichedDed = enrichSmmlvDeductible(rawDed);
          const isNoAplica =
            enrichedDed.toLowerCase().includes('no aplica') ||
            enrichedDed.toLowerCase().includes('sin deducible');

          xlCell.value = enrichedDed;
          xlCell.font = { name: FONT_NAME, size: 10, color: { argb: 'FF1E293B' } };

          if (isNoAplica) {
            xlCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDEF7EC' } };
            xlCell.font = { name: FONT_NAME, size: 10, bold: true, color: { argb: 'FF03543F' } };
          }

          xlCell.alignment = { horizontal: 'center', wrapText: true };
          xlCell.border = { bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } } };
        });
        currentDedRow++;
      }
    }
  } else {
    // Fallback: iterate quotes coverages for deductibles
    const coverageNames = Array.from(
      new Set(quotes.flatMap((q) => (q.coverages || []).map((c) => c.name)))
    );

    coverageNames.forEach((covName) => {
      deductiblesSheet.getRow(currentDedRow).height = 24;
      const labelCell = deductiblesSheet.getCell(currentDedRow, 1);
      labelCell.value = covName;
      labelCell.font = { name: FONT_NAME, size: 10, bold: true, color: { argb: 'FF475569' } };
      labelCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };

      quotes.forEach((q, qIdx) => {
        const xlCell = deductiblesSheet.getCell(currentDedRow, qIdx + 2);
        const cov = (q.coverages || []).find((c) => c.name === covName);
        const rawDed = cov?.deductible || 'Sin deducible';
        const enrichedDed = enrichSmmlvDeductible(rawDed);
        const isNoAplica =
          enrichedDed.toLowerCase().includes('no aplica') ||
          enrichedDed.toLowerCase().includes('sin deducible');

        xlCell.value = enrichedDed;
        xlCell.font = { name: FONT_NAME, size: 10, color: { argb: 'FF1E293B' } };

        if (isNoAplica) {
          xlCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDEF7EC' } };
          xlCell.font = { name: FONT_NAME, size: 10, bold: true, color: { argb: 'FF03543F' } };
        }

        xlCell.alignment = { horizontal: 'center', wrapText: true };
        xlCell.border = { bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } } };
      });
      currentDedRow++;
    });
  }

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

  financialsSheet.getRow(4).height = 28;
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
    getValueOrFormula: (
      colLetter: string,
      idx: number
    ) => { value?: number; formula?: string; isTotal?: boolean; isWinner?: boolean }
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
        xlCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } };
        xlCell.font = { name: FONT_NAME, size: 10, bold: true, color: { argb: 'FF92400E' } };
      }
    });
  };

  const minNet = Math.min(...netPremiums.filter((n) => n > 0));
  const maxNet = Math.max(...netPremiums.filter((n) => n > 0));

  addFinRow('Prima Neta (Anual)', 5, (_, idx) => ({
    value: netPremiums[idx]!,
    isWinner: netPremiums[idx]! > 0 && netPremiums[idx]! === minNet,
  }));

  addFinRow('Gastos de Expedición', 6, (_, idx) => ({
    value: expenses[idx]!,
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
    isWinner: netPremiums[idx]! > 0 && netPremiums[idx]! === minNet,
  }));

  // Ratio % sobre Valor Asegurado
  financialsSheet.getRow(11).height = 22;
  const ratioLabel = financialsSheet.getCell(11, 1);
  ratioLabel.value = '% SOBRE VALOR ASEGURADO';
  ratioLabel.font = { name: FONT_NAME, size: 10, bold: true, color: { argb: 'FF1E3A8A' } };

  quotes.forEach((q, idx) => {
    const colLetter = String.fromCharCode(66 + idx);
    const xlCell = financialsSheet.getCell(`${colLetter}11`);
    if (netPremiums[idx]! > 0 && maxAsset > 0) {
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
    const p = netPremiums[idx]!;

    if (p > 0 && minNet > 0) {
      const diffPct = ((p - minNet) / minNet) * 100;
      let barChars = '██████████';
      if (diffPct === 0) barChars = '████ (MÁS ECONÓMICA)';
      else if (p === maxNet) barChars = '████████████ (MÁS COSTOSA)';

      xlCell.value = `${barChars} (+${diffPct.toFixed(1)}%)`;

      if (p === minNet) {
        xlCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDEF7EC' } };
        xlCell.font = { name: FONT_NAME, size: 9, bold: true, color: { argb: 'FF03543F' } };
      } else if (p === maxNet) {
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
  }

  // Generate Buffer
  const buffer = await workbook.xlsx.writeBuffer();
  return buffer as unknown as Buffer;
}
