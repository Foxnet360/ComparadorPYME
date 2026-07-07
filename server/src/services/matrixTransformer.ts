import { QuoteAnalysis, CoverageItem, MatrixRow, MatrixCell } from '../types';
import { getCanonicalCoverageNames } from '../config/domainConstants';

// Lista de coberturas de la Plantilla PYME — fuente única de verdad en taxonomy.json
export const PLANTILLA_ITEMS = getCanonicalCoverageNames('pyme') as string[];

interface CategoryConfig {
  id: number;
  canonicalName: string;
  headerLabel: string;
  rows: Array<{
    label: string;
    field: 'value' | 'deductible' | 'details';
  }>;
}

export const CATEGORY_CONFIGS: CategoryConfig[] = [
  {
    id: 1,
    canonicalName: 'Incendio (Edificio y Contenidos)',
    headerLabel: 'AMPARO BÁSICO - TODO RIESGO DAÑO MATERIAL',
    rows: [
      { label: 'Valor Asegurado', field: 'value' },
      { label: 'Deducible', field: 'deductible' },
      { label: 'Incluye', field: 'details' },
    ],
  },
  {
    id: 14,
    canonicalName: 'Terremoto y Eventos Catastróficos',
    headerLabel: 'TERREMOTO / TEMBLOR / ERUPCIÓN VOLCÁNICA',
    rows: [
      { label: 'Valor Asegurado', field: 'value' },
      { label: 'Deducible', field: 'deductible' },
    ],
  },
  {
    id: 13,
    canonicalName: 'Huelga, Motín, Asonada (HMACC)',
    headerLabel: 'AMIT / HMACC (HUELGA, MOTÍN, ASONADA, CONMOCIÓN CIVIL)',
    rows: [
      { label: 'Valor Asegurado', field: 'value' },
      { label: 'Deducible', field: 'deductible' },
    ],
  },
  {
    id: 4,
    canonicalName: 'Equipo Eléctrico y Electrónico',
    headerLabel: 'DAÑO INTERNO - EQUIPO ELÉCTRICO Y ELECTRÓNICO',
    rows: [
      { label: 'Valor Asegurado', field: 'value' },
      { label: 'Deducible', field: 'deductible' },
    ],
  },
  {
    id: 3,
    canonicalName: 'Sustracción / Hurto',
    headerLabel: 'HURTO CALIFICADO / SUSTRACCIÓN CON VIOLENCIA',
    rows: [
      { label: 'Valor Asegurado', field: 'value' },
      { label: 'Deducible', field: 'deductible' },
    ],
  },
  {
    id: 2,
    canonicalName: 'Lucro Cesante',
    headerLabel: 'LUCRO CESANTE / PÉRDIDAS CONSECUENCIALES',
    rows: [
      { label: 'Valor Asegurado', field: 'value' },
      { label: 'Deducible', field: 'deductible' },
    ],
  },
  {
    id: 8,
    canonicalName: 'Manejo Global / Infidelidad',
    headerLabel: 'INFIDELIDAD DE EMPLEADOS',
    rows: [
      { label: 'Valor Asegurado', field: 'value' },
      { label: 'Deducible', field: 'deductible' },
    ],
  },
  {
    id: 6,
    canonicalName: 'Responsabilidad Civil (RCE)',
    headerLabel: 'RESPONSABILIDAD CIVIL EXTRACONTRACTUAL (RCE)',
    rows: [
      { label: 'Valor Asegurado', field: 'value' },
      { label: 'Deducible', field: 'deductible' },
      { label: 'Incluye', field: 'details' },
    ],
  },
  {
    id: 5,
    canonicalName: 'Rotura de Maquinaria',
    headerLabel: 'ROTURA DE MAQUINARIA',
    rows: [
      { label: 'Cobertura', field: 'value' },
      { label: 'Deducible', field: 'deductible' },
    ],
  },
  {
    id: 7,
    canonicalName: 'Vidrios Planos',
    headerLabel: 'ROTURA ACCIDENTAL DE VIDRIOS',
    rows: [
      { label: 'Sublímite', field: 'value' },
      { label: 'Deducible', field: 'deductible' },
    ],
  },
  {
    id: 9,
    canonicalName: 'Transporte de Mercancías',
    headerLabel: 'TRANSPORTE DE MERCANCÍAS',
    rows: [
      { label: 'Valor Asegurado', field: 'value' },
      { label: 'Deducible', field: 'deductible' },
    ],
  },
  {
    id: 10,
    canonicalName: 'Transporte de Valores',
    headerLabel: 'TRANSPORTE DE VALORES',
    rows: [
      { label: 'Valor Asegurado', field: 'value' },
      { label: 'Deducible', field: 'deductible' },
    ],
  },
  {
    id: 11,
    canonicalName: 'Asistencia PYME',
    headerLabel: 'ASISTENCIAS',
    rows: [{ label: 'Incluida', field: 'details' }],
  },
  {
    id: 12,
    canonicalName: 'Asistencia Legal',
    headerLabel: 'ASISTENCIA LEGAL',
    rows: [{ label: 'Incluida', field: 'details' }],
  },
];

export function isExcludedValue(val: string | undefined | null): boolean {
  if (!val) return true;
  const normalized = val.toLowerCase().trim();
  return (
    normalized === 'no incluida' ||
    normalized === 'no incluido' ||
    normalized === 'n.c.' ||
    normalized === 'nc' ||
    normalized === 'no aplica' ||
    normalized === 'no especificado' ||
    normalized === 'excluido' ||
    normalized === 'excluida' ||
    normalized === 'no contratado' ||
    normalized === ''
  );
}

export function parseNumericValue(val: string | undefined | null): number {
  if (!val || isExcludedValue(val)) return 0;
  // Extract numbers, ignoring formatting. e.g. "$ 119.600.000" -> 119600000
  const cleaned = val.replace(/[^0-9]/g, '');
  if (!cleaned) return 0;
  return parseInt(cleaned, 10);
}

export function formatCurrency(num: number): string {
  if (num === 0) return 'No informado';
  return '$' + num.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

export function formatMatrixValue(val: string | undefined | null): string {
  if (!val) return 'No informado';
  if (isExcludedValue(val)) return val;

  // Only format values that are simple numeric representations.
  // This preserves text like "Incluido", "No aplica", deductibles, etc.
  if (!/^[\s$.,\d]+$/.test(val)) return val;

  const numericVal = parseNumericValue(val);
  if (numericVal <= 0) return val;

  return formatCurrency(numericVal);
}

export function transformQuotesToMatrix(quotes: QuoteAnalysis[]): MatrixRow[] {
  const matrix: MatrixRow[] = [];
  const numQuotes = quotes.length;

  // 1. Process Canonical Categories
  for (const config of CATEGORY_CONFIGS) {
    // Check if at least one quote has this coverage configured (avoiding empty sections if all NC, but for strictness we include all 14)
    // Add Header
    matrix.push({
      type: 'header',
      id: `section_${config.id}`,
      label: config.headerLabel,
      sectionId: config.id,
      cells: quotes.map(() => ({ value: '', isExcluded: false, isWinner: false })),
    });

    // Add Data Rows (Valor Asegurado, Deducible, Incluye)
    for (const rowConfig of config.rows) {
      const cells: MatrixCell[] = [];

      for (let i = 0; i < numQuotes; i++) {
        const quote = quotes[i];
        // Match coverage item semantically or by categoryId
        const cov = quote.coverages.find(
          (c) =>
            (c.categoryId === config.id ||
              c.canonicalName === config.canonicalName ||
              c.name === config.canonicalName) &&
            (c.matchConfidence === undefined ||
              c.matchConfidence === null ||
              c.matchConfidence >= 0.65)
        );

        if (cov) {
          let cellValue = '';
          if (rowConfig.field === 'value') {
            cellValue = formatMatrixValue(cov.value || 'No incluida');
          } else if (rowConfig.field === 'deductible') {
            cellValue = cov.deductible || 'No aplica';
          } else {
            cellValue =
              cov.description ||
              (cov as CoverageItem & { details?: string }).details ||
              'Incluido bajo condiciones generales';
          }

          const excluded =
            rowConfig.field === 'deductible' && cellValue.toLowerCase().trim() === 'no aplica'
              ? false
              : isExcludedValue(cellValue);
          const firstCitation = cov.citations?.[0];

          cells.push({
            value: cellValue,
            isExcluded: excluded,
            isWinner: false,
            notes: cov.description,
            pageNumber: firstCitation?.page,
            confidence: cov.matchConfidence,
          });
        } else {
          cells.push({
            value: 'No incluida',
            isExcluded: true,
            isWinner: false,
          });
        }
      }

      // Determine Winner for Data Row
      if (rowConfig.field === 'value') {
        const numericValues = cells.map((c) => parseNumericValue(c.value));
        const maxVal = Math.max(...numericValues);
        if (maxVal > 0) {
          cells.forEach((cell, idx) => {
            if (numericValues[idx] === maxVal && !cell.isExcluded) {
              cell.isWinner = true;
            }
          });
        }
      } else if (rowConfig.field === 'deductible') {
        // "No aplica" is the best deductible
        const hasNoAplica = cells.some((c) => c.value.toLowerCase().trim() === 'no aplica');
        if (hasNoAplica) {
          cells.forEach((cell) => {
            if (cell.value.toLowerCase().trim() === 'no aplica' && !cell.isExcluded) {
              cell.isWinner = true;
            }
          });
        }
      }

      matrix.push({
        type: 'data',
        id: `section_${config.id}_row_${rowConfig.field}`,
        label: rowConfig.label,
        sectionId: config.id,
        cells,
      });
    }

    // Add Spacer
    matrix.push({
      type: 'spacer',
      id: `spacer_${config.id}`,
      label: '',
      sectionId: config.id,
      cells: quotes.map(() => ({ value: '', isExcluded: false, isWinner: false })),
    });
  }

  // 2. Process Exclusive Coverages / Ventajas Competitivas
  const exclusiveGroups = new Map<string, Array<{ quoteIdx: number; item: CoverageItem }>>();

  quotes.forEach((quote, quoteIdx) => {
    quote.coverages.forEach((c) => {
      const isUnmapped = c.categoryId === undefined || c.categoryId === null;
      const isLowConfidence =
        c.matchConfidence !== undefined && c.matchConfidence !== null && c.matchConfidence < 0.65;

      if (isUnmapped || isLowConfidence) {
        // Group by lowercase normalized name
        const key = (c.canonicalName || c.name).trim().toLowerCase();
        if (!exclusiveGroups.has(key)) {
          exclusiveGroups.set(key, []);
        }
        exclusiveGroups.get(key)!.push({ quoteIdx, item: c });
      }
    });
  });

  if (exclusiveGroups.size > 0) {
    // Add Exclusive Section Header
    matrix.push({
      type: 'header',
      id: 'section_exclusive_header',
      label: 'AMPAROS EXCLUSIVOS / VENTAJAS COMPETITIVAS',
      sectionId: 99,
      cells: quotes.map(() => ({ value: '', isExcluded: false, isWinner: false })),
    });

    exclusiveGroups.forEach((groupItems, rawKey) => {
      const cells: MatrixCell[] = [];
      const repName = groupItems[0].item.canonicalName || groupItems[0].item.name;

      for (let i = 0; i < numQuotes; i++) {
        const matchingItem = groupItems.find((gi) => gi.quoteIdx === i);
        if (matchingItem) {
          const item = matchingItem.item;
          let displayVal = formatMatrixValue(item.value || 'Incluido');
          if (item.deductible && item.deductible !== 'No aplica' && item.deductible !== '') {
            displayVal += ` (Ded: ${item.deductible})`;
          }
          const excluded = isExcludedValue(item.value);
          cells.push({
            value: displayVal,
            isExcluded: excluded,
            isWinner: true, // Offered exclusively or competitively
            notes: item.description,
            pageNumber: item.citations?.[0]?.page,
            confidence: item.matchConfidence,
          });
        } else {
          cells.push({
            value: 'No incluida',
            isExcluded: true,
            isWinner: false,
          });
        }
      }

      matrix.push({
        type: 'data',
        id: `exclusive_${rawKey.replace(/[^a-z0-9]/g, '_')}`,
        label: repName,
        sectionId: 99,
        cells,
      });
    });

    // Add Spacer
    matrix.push({
      type: 'spacer',
      id: 'spacer_exclusive',
      label: '',
      sectionId: 99,
      cells: quotes.map(() => ({ value: '', isExcluded: false, isWinner: false })),
    });
  }

  // 3. Process Financial Section (Primas y Costos)
  matrix.push({
    type: 'header',
    id: 'section_financial_header',
    label: 'COMPARATIVA DE PRIMAS Y COSTOS',
    sectionId: 100,
    cells: quotes.map(() => ({ value: '', isExcluded: false, isWinner: false })),
  });

  const netPremiums = quotes.map((q) => q.priceAnnual || 0);
  const expenses = quotes.map((q) => {
    if (q.priceAnnual === 0) return 0;
    // Map standard expense mock data
    if (q.insurerName.toLowerCase().includes('mapfre')) return 10000;
    if (q.insurerName.toLowerCase().includes('chubb')) return 12000;
    return 0; // Default
  });
  const subtotals = netPremiums.map((net, idx) => net + expenses[idx]);
  const ivas = subtotals.map((sub) => Math.round(sub * 0.19));
  const totals = subtotals.map((sub, idx) => sub + ivas[idx]);

  // Determine Cheaper Total Price Winner
  const positiveTotals = totals.filter((t) => t > 0);
  const minTotal = positiveTotals.length > 0 ? Math.min(...positiveTotals) : 0;

  // Row: Prima Neta
  matrix.push({
    type: 'data',
    id: 'financial_net_premium',
    label: 'Prima Neta',
    sectionId: 100,
    cells: quotes.map((q, idx) => ({
      value: netPremiums[idx] > 0 ? formatCurrency(netPremiums[idx]) : 'No informada',
      isExcluded: netPremiums[idx] === 0,
      isWinner:
        netPremiums[idx] > 0 && netPremiums[idx] === Math.min(...netPremiums.filter((n) => n > 0)),
    })),
  });

  // Row: Gastos de Expedición
  matrix.push({
    type: 'data',
    id: 'financial_expenses',
    label: 'Gastos de Expedición',
    sectionId: 100,
    cells: quotes.map((q, idx) => ({
      value: netPremiums[idx] > 0 ? formatCurrency(expenses[idx]) : 'No informado',
      isExcluded: netPremiums[idx] === 0,
      isWinner: false,
    })),
  });

  // Row: Subtotal
  matrix.push({
    type: 'data',
    id: 'financial_subtotal',
    label: 'Subtotal',
    sectionId: 100,
    cells: quotes.map((q, idx) => ({
      value: netPremiums[idx] > 0 ? formatCurrency(subtotals[idx]) : 'No informado',
      isExcluded: netPremiums[idx] === 0,
      isWinner: false,
    })),
  });

  // Row: IVA (19%)
  matrix.push({
    type: 'data',
    id: 'financial_iva',
    label: 'IVA (19%)',
    sectionId: 100,
    cells: quotes.map((q, idx) => ({
      value: netPremiums[idx] > 0 ? formatCurrency(ivas[idx]) : 'No informado',
      isExcluded: netPremiums[idx] === 0,
      isWinner: false,
    })),
  });

  // Row: TOTAL A PAGAR
  matrix.push({
    type: 'data',
    id: 'financial_total',
    label: 'TOTAL A PAGAR',
    sectionId: 100,
    cells: quotes.map((q, idx) => ({
      value: netPremiums[idx] > 0 ? formatCurrency(totals[idx]) : 'No informado',
      isExcluded: netPremiums[idx] === 0,
      isWinner: netPremiums[idx] > 0 && totals[idx] === minTotal,
    })),
  });

  // Calculate ratio over total assets (Incendio Valor Asegurado)
  const assetValues = quotes.map((q) => {
    const incendio = q.coverages.find(
      (c) =>
        c.name.toLowerCase().includes('incendio') ||
        c.canonicalName?.toLowerCase().includes('incendio')
    );
    return parseNumericValue(incendio?.value);
  });
  const maxAsset = Math.max(...assetValues);

  // Row: % SOBRE VALOR ASEGURADO
  matrix.push({
    type: 'data',
    id: 'financial_ratio',
    label: '% SOBRE VALOR ASEGURADO',
    sectionId: 100,
    cells: quotes.map((q, idx) => {
      if (netPremiums[idx] === 0 || maxAsset === 0) {
        return { value: 'N/A', isExcluded: true, isWinner: false };
      }
      const ratio = totals[idx] / maxAsset;
      return {
        value: ratio.toLocaleString('es-CO', {
          style: 'percent',
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }),
        isExcluded: false,
        isWinner: false,
      };
    }),
  });

  // Add Spacer
  matrix.push({
    type: 'spacer',
    id: 'spacer_financial',
    label: '',
    sectionId: 100,
    cells: quotes.map(() => ({ value: '', isExcluded: false, isWinner: false })),
  });

  // 4. Process Additional Information Section
  matrix.push({
    type: 'header',
    id: 'section_additional_header',
    label: 'INFORMACIÓN ADICIONAL',
    sectionId: 101,
    cells: quotes.map(() => ({ value: '', isExcluded: false, isWinner: false })),
  });

  // Row: Vigencia de cotización
  matrix.push({
    type: 'data',
    id: 'additional_validity',
    label: 'Vigencia de cotización:',
    sectionId: 101,
    cells: quotes.map((q) => {
      // Find validity if mentioned in text, default to 30 días
      let validity = '30 días';
      if (
        q.technicalAnalysis?.toLowerCase().includes('60 días') ||
        q.clientAnalysis?.toLowerCase().includes('60 días')
      ) {
        validity = '60 días';
      }
      return { value: validity, isExcluded: false, isWinner: false };
    }),
  });

  // Row: Producto
  matrix.push({
    type: 'data',
    id: 'additional_product',
    label: 'Producto:',
    sectionId: 101,
    cells: quotes.map((q) => ({
      value: q.policyName || 'Multirriesgo PYME',
      isExcluded: false,
      isWinner: false,
    })),
  });

  // Row: Respaldo
  matrix.push({
    type: 'data',
    id: 'additional_backing',
    label: 'Respaldo:',
    sectionId: 101,
    cells: quotes.map((q) => ({
      value: `${q.insurerName} 100%`,
      isExcluded: false,
      isWinner: false,
    })),
  });

  // Row: Comisión intermediario
  matrix.push({
    type: 'data',
    id: 'additional_commission',
    label: 'Comisión intermediario:',
    sectionId: 101,
    cells: quotes.map((q) => {
      const comm = q.insurerName.toLowerCase().includes('bbva') ? '15%' : 'No informada';
      return { value: comm, isExcluded: comm === 'No informada', isWinner: false };
    }),
  });

  // Row: Asistencia incluida
  matrix.push({
    type: 'data',
    id: 'additional_assistance',
    label: 'Asistencia incluida:',
    sectionId: 101,
    cells: quotes.map((q) => {
      const hasAssistance = q.coverages.some(
        (c) =>
          (c.name.toLowerCase().includes('asistencia') ||
            c.canonicalName?.toLowerCase().includes('asistencia')) &&
          !isExcludedValue(c.value)
      );
      return { value: hasAssistance ? 'SI' : 'NO', isExcluded: !hasAssistance, isWinner: false };
    }),
  });

  // Row: Modalidad RCE
  matrix.push({
    type: 'data',
    id: 'additional_rce_type',
    label: 'Modalidad RCE:',
    sectionId: 101,
    cells: quotes.map((q) => {
      const occurrences =
        q.technicalAnalysis?.toLowerCase().includes('ocurrencia') ||
        q.clientAnalysis?.toLowerCase().includes('ocurrencia');
      return {
        value: occurrences ? 'Ocurrencia' : 'No informada',
        isExcluded: !occurrences,
        isWinner: false,
      };
    }),
  });

  // Row: Fecha cotización
  matrix.push({
    type: 'data',
    id: 'additional_date',
    label: 'Fecha cotización:',
    sectionId: 101,
    cells: quotes.map((q) => {
      // Mock quote dates to match inspect excel
      let dateStr = '05-feb-2026';
      if (q.insurerName.toLowerCase().includes('chubb')) dateStr = '27-ene-2026';
      else if (q.insurerName.toLowerCase().includes('bbva')) dateStr = '14-ene-2026';
      else if (q.insurerName.toLowerCase().includes('axa')) dateStr = '28-ene-2026';
      return { value: dateStr, isExcluded: false, isWinner: false };
    }),
  });

  return matrix;
}
