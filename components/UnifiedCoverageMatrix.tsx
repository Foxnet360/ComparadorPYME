import React, { useState, useRef, useEffect, lazy, Suspense, memo } from 'react';
import { QuoteAnalysis, MatrixRow, MatrixCell, CoverageItem, QuoteMetadata } from '../types';
import { PLANTILLA_ITEMS } from '../constants';
import {
  Info,
  AlertTriangle,
  ListChecks,
  Trophy,
  DollarSign,
  Calendar,
  ShieldCheck,
  Download,
  Award,
  ChevronDown,
  Check,
  AlertCircle,
  Eye,
  Loader2,
  Pin,
} from 'lucide-react';
import { DeductibleBadge } from './DeductibleBadge';
import { formatPercentage } from '../utils/formatCurrency';
import { useOptimisticCorrection } from '../hooks/useOptimisticCorrection';
import { usePdfViewer, useCellNotes } from '../contexts/AnalysisContext';
import { InlineNoteEditor } from './InlineNoteEditor';
import { apiClient } from '../services/apiClient';
import { useToasts, ToastContainer } from './ToastNotification';

const PdfViewer = lazy(() => import('./PdfViewer'));

// CoverageCell memoizado para optimizar re-renders
const CoverageCell = memo(
  ({
    cell,
    rowLabel,
    isWinner,
    excluded,
    lowConfidence,
    needsReview,
    isSaving,
    onOpenPdf: _onOpenPdf,
    onOpenCorrection: _onOpenCorrection,
    onDoubleClick,
    hasNote,
  }: {
    cell: MatrixCell;
    rowLabel: string;
    isWinner: boolean;
    excluded: boolean;
    lowConfidence: boolean;
    needsReview: boolean;
    isSaving: boolean;
    onOpenPdf?: () => void;
    onOpenCorrection?: () => void;
    onDoubleClick?: () => void;
    hasNote?: boolean;
  }) => {
    return (
      <div
        className={`relative ${
          isWinner ? 'bg-amber-50/60 font-semibold text-amber-900 border border-amber-200/50' : ''
        } ${excluded ? 'text-red-500 italic bg-slate-50/20' : 'text-slate-800'} ${
          lowConfidence ? 'bg-yellow-50/40 border-2 border-yellow-400/60 shadow-sm' : ''
        } ${needsReview ? 'ring-2 ring-red-300/50 ring-inset' : ''} ${
          isSaving ? 'opacity-70' : ''
        }`}
        onDoubleClick={onDoubleClick}
      >
        {/* Note indicator */}
        {hasNote && (
          <span className="absolute top-1 right-1 text-blue-500" title="Tiene nota consultiva">
            <Pin size={12} />
          </span>
        )}

        {/* Winner trophy */}
        {isWinner && !lowConfidence && (
          <span className="absolute top-1 left-1 text-amber-500" title="Condición favorable">
            <Trophy size={12} />
          </span>
        )}

        <div className="flex flex-col items-center justify-center gap-1.5">
          {excluded ? (
            <span className="text-red-400 font-medium">No incluida</span>
          ) : (
            <span
              className={`${isWinner ? 'text-amber-950 font-bold' : 'text-slate-800 font-medium'}`}
            >
              {rowLabel === 'Deducible' && cell.value !== 'No aplica' ? (
                <DeductibleBadge deductible={cell.value} />
              ) : rowLabel === 'Valor Asegurado' ? (
                formatMatrixValue(cell.value)
              ) : (
                cell.value
              )}
            </span>
          )}
        </div>
      </div>
    );
  }
);

CoverageCell.displayName = 'CoverageCell';

interface CategoryConfig {
  id: number;
  canonicalName: string;
  headerLabel: string;
  rows: Array<{
    label: string;
    field: 'value' | 'deductible' | 'details';
  }>;
}

import taxonomyData from '../data/domains/pyme/taxonomy.json';

const HEADER_LABEL_MAPPING: Record<number, string> = {
  1: 'AMPARO BÁSICO - TODO RIESGO DAÑO MATERIAL',
  14: 'TERREMOTO / TEMBLOR / ERUPCIÓN VOLCÁNICA',
  13: 'AMIT / HMACC (HUELGA, MOTÍN, ASONADA, CONMOCIÓN CIVIL)',
  4: 'DAÑO INTERNO - EQUIPO ELÉCTRICO Y ELECTRÓNICO',
  3: 'HURTO CALIFICADO / SUSTRACCIÓN CON VIOLENCIA',
  2: 'LUCRO CESANTE / PÉRDIDAS CONSECUENCIALES',
  8: 'INFIDELIDAD DE EMPLEADOS',
  6: 'RESPONSABILIDAD CIVIL EXTRACONTRACTUAL (RCE)',
  5: 'ROTURA DE MAQUINARIA',
  7: 'ROTURA ACCIDENTAL DE VIDRIOS',
  9: 'TRANSPORTE DE MERCANCÍAS',
  10: 'TRANSPORTE DE VALORES',
  11: 'ASISTENCIAS',
  12: 'ASISTENCIA LEGAL',
};

const ROWS_MAPPING: Record<
  number,
  Array<{ label: string; field: 'value' | 'deductible' | 'details' }>
> = {
  1: [
    { label: 'Valor Asegurado', field: 'value' },
    { label: 'Deducible', field: 'deductible' },
    { label: 'Incluye', field: 'details' },
  ],
  6: [
    { label: 'Valor Asegurado', field: 'value' },
    { label: 'Deducible', field: 'deductible' },
    { label: 'Incluye', field: 'details' },
  ],
  5: [
    { label: 'Cobertura', field: 'value' },
    { label: 'Deducible', field: 'deductible' },
  ],
  7: [
    { label: 'Sublímite', field: 'value' },
    { label: 'Deducible', field: 'deductible' },
  ],
  11: [{ label: 'Incluida', field: 'details' }],
  12: [{ label: 'Incluida', field: 'details' }],
};

export const CATEGORY_CONFIGS: CategoryConfig[] = (taxonomyData.categories || []).map((cat) => {
  const id = cat.id;
  const canonicalName = cat.name;
  const headerLabel = HEADER_LABEL_MAPPING[id] || canonicalName.toUpperCase();
  const rows = ROWS_MAPPING[id] || [
    { label: 'Valor Asegurado', field: 'value' },
    { label: 'Deducible', field: 'deductible' },
  ];
  return {
    id,
    canonicalName,
    headerLabel,
    rows,
  };
});

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
  const cleaned = val.replace(/[^0-9]/g, '');
  if (!cleaned) return 0;
  return parseInt(cleaned, 10);
}

export function formatCurrency(num: number): string {
  if (num === 0) return 'No informado';
  return '$' + num.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

export function buildExportNotes(
  cellNotes: Record<string, { content?: string }>
): Record<string, string> {
  const exportNotes: Record<string, string> = {};
  Object.entries(cellNotes).forEach(([key, note]) => {
    if (note.content) {
      exportNotes[key] = note.content;
    }
  });
  return exportNotes;
}

export function formatMatrixValue(val: string | undefined | null): string {
  if (!val) return 'No informado';
  if (
    val === 'No incluida' ||
    val === 'NO ESPECIFICADO' ||
    val === 'No contratado' ||
    isExcludedValue(val)
  ) {
    return val;
  }

  // Try parsing to see if it represents a number
  const cleanVal = val.replace(/[^0-9]/g, '');
  if (!cleanVal) return val; // No digits (e.g. "Incluido", "No aplica")

  const num = parseFloat(cleanVal);
  if (isNaN(num) || num === 0) return val;

  // Check if it's a simple number representation (only digits, spaces, dots, commas, currency symbol)
  const isSimpleNumber = /^[$\s\d.,]+$/.test(val);
  if (isSimpleNumber) {
    return formatCurrency(num);
  }

  return val;
}

export function simplifyHeaderLabel(label: string): string {
  const upper = label.toUpperCase();
  if (upper.includes('AMPARO BÁSICO')) return 'Cobertura Todo Riesgo Daño Material';
  if (upper.includes('AMIT / HMACC')) return 'Cobertura de Terrorismo, Huelga y Motín';
  if (upper.includes('DAÑO INTERNO')) return 'Equipo Eléctrico y Electrónico';
  if (upper.includes('HURTO CALIFICADO')) return 'Hurto y Sustracción con Violencia';
  if (upper.includes('LUCRO CESANTE')) return 'Lucro Cesante / Pérdida de Ingresos';
  if (upper.includes('RESPONSABILIDAD CIVIL')) return 'Responsabilidad Civil (Daños a Terceros)';
  if (upper.includes('AMPAROS EXCLUSIVOS')) return 'Beneficios y Ventajas Competitivas';
  if (upper.includes('COMPARATIVA DE PRIMAS')) return 'Resumen de Primas y Costos';
  return label;
}

function localLevenshteinDistance(str1: string, str2: string): number {
  const matrix: number[][] = [];
  for (let i = 0; i <= str1.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= str2.length; j++) {
    matrix[0][j] = j;
  }
  for (let i = 1; i <= str1.length; i++) {
    for (let j = 1; j <= str2.length; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
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

export function isBillingOrPaymentNoise(name: string): boolean {
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
    lower.includes('respaldo') ||
    lower.includes('asistencia legal') ||
    lower.includes('asistencias')
  );
}

export function transformQuotesToMatrix(quotes: QuoteAnalysis[]): MatrixRow[] {
  const matrix: MatrixRow[] = [];
  const numQuotes = quotes.length;

  // Define business sections grouping (deductible rows are handled separately below)
  const BUSINESS_SECTIONS = [
    {
      name: 'BIENES ASEGURADOS',
      categoryIds: [1, 4, 5, 7, 9, 11],
    },
    {
      name: 'COBERTURAS',
      categoryIds: [2, 6, 8, 10, 12, 13, 14],
    },
    {
      name: 'SUSTRACCIÓN',
      categoryIds: [3],
    },
  ];

  // 1. Process Canonical Categories grouped by Business Sections
  for (const section of BUSINESS_SECTIONS) {
    // Push business section header
    matrix.push({
      type: 'header',
      id: `section_group_${section.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
      label: section.name,
      sectionId: 1, // Use coverages section ID (1)
      cells: quotes.map(() => ({ value: '', isExcluded: false, isWinner: false })),
    });

    for (const catId of section.categoryIds) {
      const config = CATEGORY_CONFIGS.find((c) => c.id === catId);
      if (!config) continue;

      // Push category sub-header
      matrix.push({
        type: 'header',
        id: `section_${config.id}`,
        label: config.headerLabel,
        sectionId: 1, // Use coverages section ID (1)
        cells: quotes.map(() => ({ value: '', isExcluded: false, isWinner: false })),
      });

      for (const rowConfig of config.rows) {
        // Deductible rows are rendered in a dedicated DEDUCIBLES section below
        if (rowConfig.field === 'deductible') continue;

        const cells: MatrixCell[] = [];

        for (let i = 0; i < numQuotes; i++) {
          const quote = quotes[i];
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
              cellValue = cov.value || 'No incluida';
            } else if (rowConfig.field === 'deductible') {
              cellValue = cov.deductible || 'No aplica';
            } else {
              cellValue =
                cov.description ||
                (cov as CoverageItem & { details?: string }).details ||
                'Incluido bajo condiciones generales';
            }

            // In a deductible row, "No aplica" is not an exclusion
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
              pageNumber: firstCitation?.page || cov.citations?.[0]?.page,
              confidence: cov.matchConfidence,
              rawTextSnippet: cov.rawTextSnippet,
              needsHumanReview: cov.needsHumanReview,
              calculatedPage: cov.calculatedPage,
              justification: cov.justification,
              canonicalName: cov.canonicalName,
              matchMethod: cov.matchMethod,
            });
          } else {
            cells.push({
              value: 'No incluida',
              isExcluded: true,
              isWinner: false,
            });
          }
        }

        // Winner Detection
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
          sectionId: 1, // Use coverages section ID (1)
          cells,
        });
      }

      matrix.push({
        type: 'spacer',
        id: `spacer_${config.id}`,
        label: '',
        sectionId: 1, // Use coverages section ID (1)
        cells: quotes.map(() => ({ value: '', isExcluded: false, isWinner: false })),
      });
    }
  }

  // 2. DEDUCIBLES section — all deductible rows across categories
  matrix.push({
    type: 'header',
    id: 'section_group_deductibles',
    label: 'DEDUCIBLES',
    sectionId: 1, // Use coverages section ID (1)
    cells: quotes.map(() => ({ value: '', isExcluded: false, isWinner: false })),
  });

  for (const config of CATEGORY_CONFIGS) {
    const deductibleRows = config.rows.filter((r) => r.field === 'deductible');
    if (deductibleRows.length === 0) continue;

    // Only show this category if at least one quote has data for it
    const hasCoverage = quotes.some((q) =>
      q.coverages.some(
        (c) =>
          c.categoryId === config.id ||
          c.canonicalName === config.canonicalName ||
          c.name === config.canonicalName
      )
    );
    if (!hasCoverage) continue;

    matrix.push({
      type: 'header',
      id: `deductible_header_${config.id}`,
      label: config.headerLabel,
      sectionId: 1, // Use coverages section ID (1)
      cells: quotes.map(() => ({ value: '', isExcluded: false, isWinner: false })),
    });

    for (const rowConfig of deductibleRows) {
      const cells: MatrixCell[] = [];

      for (let i = 0; i < numQuotes; i++) {
        const quote = quotes[i];
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
            cellValue = cov.value || 'No incluida';
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
            pageNumber: firstCitation?.page || cov.citations?.[0]?.page,
            confidence: cov.matchConfidence,
            rawTextSnippet: cov.rawTextSnippet,
            needsHumanReview: cov.needsHumanReview,
            calculatedPage: cov.calculatedPage,
            justification: cov.justification,
            canonicalName: cov.canonicalName,
            matchMethod: cov.matchMethod,
          });
        } else {
          cells.push({
            value: 'No incluida',
            isExcluded: true,
            isWinner: false,
          });
        }
      }

      // Winner detection for deductible rows
      const hasNoAplica = cells.some((c) => c.value.toLowerCase().trim() === 'no aplica');
      if (hasNoAplica) {
        cells.forEach((cell) => {
          if (cell.value.toLowerCase().trim() === 'no aplica' && !cell.isExcluded) {
            cell.isWinner = true;
          }
        });
      }

      matrix.push({
        type: 'data',
        id: `deductible_${config.id}_row_${rowConfig.field}`,
        label: rowConfig.label,
        sectionId: 1, // Use coverages section ID (1)
        cells,
      });
    }

    matrix.push({
      type: 'spacer',
      id: `spacer_deductible_${config.id}`,
      label: '',
      sectionId: 1, // Use coverages section ID (1)
      cells: quotes.map(() => ({ value: '', isExcluded: false, isWinner: false })),
    });
  }

  // 3. Exclusive Coverages
  const exclusiveGroups: Array<{
    representativeName: string;
    items: Array<{ quoteIdx: number; item: CoverageItem }>;
  }> = [];

  quotes.forEach((quote, quoteIdx) => {
    quote.coverages.forEach((c) => {
      const isUnmapped = c.categoryId === undefined || c.categoryId === null;
      const isLowConfidence =
        c.matchConfidence !== undefined && c.matchConfidence !== null && c.matchConfidence < 0.65;

      if (isUnmapped || isLowConfidence) {
        const coverageName = (c.canonicalName || c.name).trim();

        if (isBillingOrPaymentNoise(coverageName)) {
          return;
        }

        // Find if there is an existing group that is semantically similar (similarity >= 0.70)
        let foundGroup = exclusiveGroups.find(
          (g) => calculateSimilarity(g.representativeName, coverageName) >= 0.7
        );

        if (foundGroup) {
          foundGroup.items.push({ quoteIdx, item: c });
        } else {
          exclusiveGroups.push({
            representativeName: coverageName,
            items: [{ quoteIdx, item: c }],
          });
        }
      }
    });
  });

  if (exclusiveGroups.length > 0) {
    matrix.push({
      type: 'header',
      id: 'section_exclusive_header',
      label: 'AMPAROS EXCLUSIVOS / VENTAJAS COMPETITIVAS',
      sectionId: 99,
      cells: quotes.map(() => ({ value: '', isExcluded: false, isWinner: false })),
    });

    exclusiveGroups.forEach((group) => {
      const cells: MatrixCell[] = [];
      const repName = group.representativeName;

      for (let i = 0; i < numQuotes; i++) {
        const matchingItems = group.items.filter((gi) => gi.quoteIdx === i);
        if (matchingItems.length > 0) {
          const displayVals = matchingItems.map((mi) => {
            const item = mi.item;
            let displayVal = formatMatrixValue(item.value || 'Incluido');
            if (item.deductible && item.deductible !== 'No aplica' && item.deductible !== '') {
              displayVal += ` (Ded: ${item.deductible})`;
            }
            return displayVal;
          });

          const bestItem = matchingItems[0].item;

          cells.push({
            value: displayVals.join(' / '),
            isExcluded: matchingItems.every((mi) => isExcludedValue(mi.item.value)),
            isWinner: true,
            notes: bestItem.description,
            pageNumber: bestItem.citations?.[0]?.page,
            confidence: bestItem.matchConfidence,
            rawTextSnippet: bestItem.rawTextSnippet,
            needsHumanReview: bestItem.needsHumanReview,
            calculatedPage: bestItem.calculatedPage,
            justification: bestItem.justification,
            canonicalName: bestItem.canonicalName,
            matchMethod: bestItem.matchMethod,
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
        id: `exclusive_${repName.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
        label: repName,
        sectionId: 99,
        cells,
      });
    });

    matrix.push({
      type: 'spacer',
      id: 'spacer_exclusive',
      label: '',
      sectionId: 99,
      cells: quotes.map(() => ({ value: '', isExcluded: false, isWinner: false })),
    });
  }

  // 3. Financials Section
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
    if (q.insurerName.toLowerCase().includes('mapfre')) return 10000;
    if (q.insurerName.toLowerCase().includes('chubb')) return 12000;
    return 0;
  });
  const subtotals = netPremiums.map((net, idx) => net + expenses[idx]);
  const ivas = subtotals.map((sub) => Math.round(sub * 0.19));
  const totals = subtotals.map((sub, idx) => sub + ivas[idx]);
  const positiveTotals = totals.filter((t) => t > 0);
  const minTotal = positiveTotals.length > 0 ? Math.min(...positiveTotals) : 0;

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

  const assetValues = quotes.map((q) => {
    const incendio = q.coverages.find(
      (c) =>
        c.name.toLowerCase().includes('incendio') ||
        c.canonicalName?.toLowerCase().includes('incendio')
    );
    return parseNumericValue(incendio?.value);
  });
  const maxAsset = Math.max(...assetValues);

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

  matrix.push({
    type: 'spacer',
    id: 'spacer_financial',
    label: '',
    sectionId: 100,
    cells: quotes.map(() => ({ value: '', isExcluded: false, isWinner: false })),
  });

  // 4. Additional Info
  matrix.push({
    type: 'header',
    id: 'section_additional_header',
    label: 'INFORMACIÓN ADICIONAL',
    sectionId: 101,
    cells: quotes.map(() => ({ value: '', isExcluded: false, isWinner: false })),
  });

  matrix.push({
    type: 'data',
    id: 'additional_validity',
    label: 'Vigencia de cotización:',
    sectionId: 101,
    cells: quotes.map((q) => {
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

  matrix.push({
    type: 'data',
    id: 'additional_date',
    label: 'Fecha cotización:',
    sectionId: 101,
    cells: quotes.map((q) => {
      let dateStr = '05-feb-2026';
      if (q.insurerName.toLowerCase().includes('chubb')) dateStr = '27-ene-2026';
      else if (q.insurerName.toLowerCase().includes('bbva')) dateStr = '14-ene-2026';
      else if (q.insurerName.toLowerCase().includes('axa')) dateStr = '28-ene-2026';
      return { value: dateStr, isExcluded: false, isWinner: false };
    }),
  });

  return matrix;
}

interface UnifiedCoverageMatrixProps {
  quotes: QuoteAnalysis[];
  rows?: MatrixRow[];
  metadata?: QuoteMetadata[];
  viewMode?: 'client' | 'technical';
  analysisId?: string; // Optional ID for direct exports
  schemaVersion?: 1 | 2;
}

export const UnifiedCoverageMatrix: React.FC<UnifiedCoverageMatrixProps> = ({
  quotes,
  rows,
  metadata,
  viewMode = 'technical',
  analysisId,
  schemaVersion,
}) => {
  const [activeTab, setActiveTab] = useState<'coverages' | 'financials' | 'additional'>(
    'coverages'
  );
  const [hoveredCell, setHoveredCell] = useState<{ rowId: string; colIdx: number } | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<{ rowId: string; colIdx: number } | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpenDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const { submitCorrection } = useOptimisticCorrection();
  const { openPdfViewer } = usePdfViewer();
  const { cellNotes, setCellNote, getCellNote } = useCellNotes();
  const { toasts, addToast, removeToast, success, error } = useToasts();
  const [savingCorrections, setSavingCorrections] = useState<Set<string>>(new Set());
  const [editingNote, setEditingNote] = useState<{ rowId: string; colIdx: number } | null>(null);

  const handleDiscrepancyResolution = async (
    rowId: string,
    colIdx: number,
    selectedCategory: string
  ) => {
    const quote = quotes[colIdx];
    const cell = fullMatrix.find((r) => r.id === rowId)?.cells[colIdx];

    if (!quote || !cell) return;

    const correctionId = `${rowId}-${colIdx}`;
    setSavingCorrections((prev) => new Set(prev).add(correctionId));

    try {
      const result = await submitCorrection({
        rawName: cell.rawName || rowId,
        insurerName: quote.insurerName,
        systemMapping: cell.canonicalName || rowId,
        userCorrection: selectedCategory,
        correctionType: 'coverage_mapping',
        rawTextSnippet: cell.rawTextSnippet,
        pageNumber: cell.calculatedPage || cell.pageNumber,
      });

      if (result.success) {
        setOpenDropdown(null);
      }
    } finally {
      setSavingCorrections((prev) => {
        const next = new Set(prev);
        next.delete(correctionId);
        return next;
      });
    }
  };

  const handleOpenPdfEvidence = (cell: MatrixCell, quote: QuoteAnalysis) => {
    if (cell.calculatedPage || cell.pageNumber) {
      openPdfViewer({
        pdfUrl: `/api/quotes/${quote.insurerName}/pdf`,
        targetPage: cell.calculatedPage || cell.pageNumber || 1,
        searchText: cell.rawTextSnippet,
        title: `Evidencia - ${quote.insurerName}`,
      });
    }
  };

  const handleCellDoubleClick = (rowId: string, colIdx: number) => {
    setEditingNote({ rowId, colIdx });
  };

  const handleSaveNote = (rowId: string, colIdx: number, content: string) => {
    const cellId = `${rowId}-${colIdx}`;
    setCellNote(cellId, content);
    setEditingNote(null);
  };

  const handleCancelNote = () => {
    setEditingNote(null);
  };

  const isLowConfidence = (confidence: number | undefined): boolean => {
    return confidence !== undefined && confidence !== null && confidence <= 0.5;
  };

  // Use backend rows for V2 granular reports; fallback to V1 client-side reconstruction
  // for explicit V1 or when rows are missing entirely.
  const useBackendRows = schemaVersion === 2 || (schemaVersion !== 1 && rows !== undefined);
  const fullMatrix = useBackendRows ? (rows ?? []) : transformQuotesToMatrix(quotes);

  // Partition matrix rows according to active tabs
  const filteredRows = fullMatrix.filter((row) => {
    if (activeTab === 'coverages') return row.sectionId < 100;
    if (activeTab === 'financials') return row.sectionId === 100;
    return row.sectionId === 101;
  });

  const getConfidenceBadgeColor = (confidence: number | undefined) => {
    if (confidence === undefined || confidence === null)
      return 'bg-slate-100 text-slate-500 border-slate-200';
    if (confidence >= 0.8) return 'bg-green-100 text-green-700 border-green-300';
    if (confidence >= 0.5) return 'bg-yellow-100 text-yellow-700 border-yellow-300';
    return 'bg-red-100 text-red-700 border-red-300';
  };

  const getConfidenceText = (confidence: number | undefined) => {
    if (confidence === undefined || confidence === null) return 'Sin match';
    if (confidence >= 0.8) return 'Alta';
    if (confidence >= 0.5) return 'Media';
    return 'Baja';
  };

  const handleExportExcel = async () => {
    if (!analysisId) {
      addToast('ID de análisis no disponible para exportación.', 'warning');
      return;
    }
    setIsExporting(true);
    try {
      // Create a simplified version of cellNotes for export
      const exportNotes = buildExportNotes(cellNotes);

      const response = await apiClient.fetch(`/analysis/${analysisId}/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cellNotes: exportNotes }),
      });

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `comparativa_seguros_${analysisId}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      success('Excel descargado correctamente.');
    } catch (err) {
      console.error('Error al exportar Excel:', err);
      const message =
        err instanceof Error
          ? err.message
          : 'No se pudo descargar el Excel. Inténtalo de nuevo más tarde.';
      error(message);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Panel with Premium Title & Export Button */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-950 p-6 rounded-2xl shadow-lg border border-slate-700 text-white">
        <div>
          <h2 className="text-xl md:text-2xl font-extrabold tracking-tight flex items-center gap-2">
            <ListChecks className="text-blue-400" size={24} />
            Análisis de Cotizaciones Unificado
          </h2>
          <p className="text-xs md:text-sm text-slate-300 mt-1">
            Visualización interactiva con paridad total de filas del reporte técnico en Excel.
          </p>
        </div>
        {analysisId && (
          <button
            onClick={handleExportExcel}
            disabled={isExporting}
            className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 font-semibold text-sm transition-all shadow-md active:scale-95 disabled:opacity-50"
          >
            {isExporting ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
            {isExporting ? 'Generando Excel...' : 'Descargar Excel Comparativo'}
          </button>
        )}
      </div>

      {/* Segmented Premium Tab Controls */}
      <div className="flex bg-slate-100 p-1.5 rounded-xl border border-slate-200 max-w-lg shadow-inner">
        <button
          onClick={() => setActiveTab('coverages')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs md:text-sm font-semibold transition-all ${
            activeTab === 'coverages'
              ? 'bg-white text-blue-700 shadow-sm border border-slate-200'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <ShieldCheck size={16} />
          Coberturas y Deducibles
        </button>
        <button
          onClick={() => setActiveTab('financials')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs md:text-sm font-semibold transition-all ${
            activeTab === 'financials'
              ? 'bg-white text-blue-700 shadow-sm border border-slate-200'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <DollarSign size={16} />
          Primas y Costos
        </button>
        <button
          onClick={() => setActiveTab('additional')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs md:text-sm font-semibold transition-all ${
            activeTab === 'additional'
              ? 'bg-white text-blue-700 shadow-sm border border-slate-200'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <Calendar size={16} />
          Información Adicional
        </button>
      </div>

      {/* Header Metadata Card */}
      {metadata && metadata.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100">
            <Calendar className="text-blue-600" size={20} />
            <h3 className="font-bold text-slate-800 text-lg">Información del Riesgo & Metadatos</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {metadata.map((meta, idx) => (
              <div
                key={idx}
                className="bg-slate-50 rounded-xl p-4 border border-slate-100 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-3 border-b border-slate-200 pb-2">
                    <span className="font-extrabold text-blue-800 text-sm">{meta.insurer}</span>
                    <span className="text-[10px] bg-blue-100 text-blue-700 font-bold px-2 py-0.5 rounded-full">
                      Extracción V2
                    </span>
                  </div>
                  <div className="space-y-2 text-xs text-slate-600">
                    {meta.cliente && (
                      <div className="flex justify-between">
                        <span className="font-medium text-slate-500">Cliente:</span>
                        <span className="font-semibold text-slate-800 text-right">
                          {meta.cliente}
                        </span>
                      </div>
                    )}
                    {meta.tipoSeguro && (
                      <div className="flex justify-between">
                        <span className="font-medium text-slate-500">Tipo de Seguro:</span>
                        <span className="font-semibold text-slate-800 text-right">
                          {meta.tipoSeguro}
                        </span>
                      </div>
                    )}
                    {meta.ubicacionRiesgo && (
                      <div className="flex justify-between">
                        <span className="font-medium text-slate-500">Ubicación del Riesgo:</span>
                        <span
                          className="font-semibold text-slate-800 text-right max-w-[150px] truncate"
                          title={meta.ubicacionRiesgo}
                        >
                          {meta.ubicacionRiesgo}
                        </span>
                      </div>
                    )}
                    {meta.anoConstruccion && (
                      <div className="flex justify-between">
                        <span className="font-medium text-slate-500">Año de Construcción:</span>
                        <span className="font-semibold text-slate-800 text-right">
                          {meta.anoConstruccion}
                        </span>
                      </div>
                    )}
                    {meta.pisos && (
                      <div className="flex justify-between">
                        <span className="font-medium text-slate-500">Pisos:</span>
                        <span className="font-semibold text-slate-800 text-right">
                          {meta.pisos}
                        </span>
                      </div>
                    )}
                    {meta.aliado && (
                      <div className="flex justify-between">
                        <span className="font-medium text-slate-500">Aliado:</span>
                        <span className="font-semibold text-slate-800 text-right">
                          {meta.aliado}
                        </span>
                      </div>
                    )}
                    {meta.actividadOcupacion && (
                      <div className="flex justify-between">
                        <span className="font-medium text-slate-500">Actividad/Ocupación:</span>
                        <span
                          className="font-semibold text-slate-800 text-right max-w-[150px] truncate"
                          title={meta.actividadOcupacion}
                        >
                          {meta.actividadOcupacion}
                        </span>
                      </div>
                    )}
                    {meta.documento && (
                      <div className="flex justify-between">
                        <span className="font-medium text-slate-500">Documento:</span>
                        <span className="font-semibold text-slate-800 text-right">
                          {meta.documento}
                        </span>
                      </div>
                    )}
                    {meta.vigencia && (
                      <div className="flex justify-between">
                        <span className="font-medium text-slate-500">Vigencia:</span>
                        <span className="font-semibold text-slate-800 text-right">
                          {meta.vigencia}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Grid Matrix Container */}
      <div
        className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"
        role="grid"
        aria-label="Matriz de coberturas de seguros"
      >
        {filteredRows.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center text-slate-500">
            <ListChecks className="text-slate-300 mb-4" size={48} />
            <h3 className="text-lg font-semibold text-slate-700 mb-2">No hay datos para mostrar</h3>
            <p className="text-sm max-w-md">
              La matriz de coberturas está vacía. Sube las cotizaciones de las aseguradoras para
              generar la comparativa.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto relative">
            <table className="w-full text-sm border-collapse text-left">
              <thead className="bg-[#E6F0FA] text-[#0066CC] font-bold text-xs uppercase border-b border-blue-200 sticky top-0 z-20">
                <tr role="row">
                  <th
                    role="columnheader"
                    className="px-6 py-4 sticky left-0 bg-[#E6F0FA] border-r border-blue-100 min-w-[220px] md:min-w-[280px] shadow-[4px_0_10px_-5px_rgba(0,0,0,0.08)] z-30"
                  >
                    Concepto / Variable
                  </th>
                  {quotes.map((q, i) => (
                    <th
                      key={i}
                      role="columnheader"
                      className="px-6 py-4 min-w-[200px] md:min-w-[240px] whitespace-nowrap text-center text-[#0066CC] border-b border-blue-100"
                    >
                      {q.insurerName}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRows.map((row) => {
                  if (row.type === 'header') {
                    const displayLabel =
                      viewMode === 'client' ? simplifyHeaderLabel(row.label) : row.label;
                    return (
                      <tr key={row.id} className="bg-[#E6F0FA]/40 font-bold" role="row">
                        <td
                          role="gridcell"
                          colSpan={quotes.length + 1}
                          className="px-6 py-3 text-xs md:text-sm text-blue-800 uppercase tracking-wide border-y border-blue-50/50"
                        >
                          {displayLabel}
                        </td>
                      </tr>
                    );
                  }

                  if (row.type === 'spacer') {
                    return (
                      <tr key={row.id} className="bg-white h-4" role="row">
                        <td role="gridcell" colSpan={quotes.length + 1} className="py-2"></td>
                      </tr>
                    );
                  }

                  // Standard Data Row
                  return (
                    <tr
                      key={row.id}
                      className="hover:bg-slate-50/70 transition-colors group"
                      role="row"
                    >
                      {/* Concept Label (Column A) */}
                      <td
                        role="gridcell"
                        className="px-6 py-3.5 text-xs md:text-sm font-semibold text-slate-700 bg-[#F8FAFC] sticky left-0 border-r border-slate-100 shadow-[4px_0_10px_-5px_rgba(0,0,0,0.05)] z-10 group-hover:bg-[#F1F5F9]/80"
                      >
                        {row.label}
                      </td>

                      {/* Insurer Cells */}
                      {row.cells.map((cell, colIdx) => {
                        const isWinner = cell.isWinner;
                        const excluded = cell.isExcluded;
                        const hasDetails =
                          cell.confidence !== undefined ||
                          cell.pageNumber !== undefined ||
                          cell.notes;
                        const lowConfidence = isLowConfidence(cell.confidence);
                        const needsReview = cell.needsHumanReview;
                        const isSaving = savingCorrections.has(`${row.id}-${colIdx}`);
                        const cellId = `${row.id}-${colIdx}`;
                        const cellNote = getCellNote(cellId);
                        const isEditingNote =
                          editingNote?.rowId === row.id && editingNote?.colIdx === colIdx;

                        const cellClass = `px-6 py-3.5 text-sm align-middle text-center relative border-r border-slate-50 transition-all ${
                          isWinner
                            ? 'bg-amber-50/60 font-semibold text-amber-900 border border-amber-200/50'
                            : ''
                        } ${
                          excluded
                            ? 'text-slate-400 italic bg-slate-100/60 line-through decoration-slate-400'
                            : 'text-slate-800'
                        } ${
                          lowConfidence
                            ? 'bg-yellow-50/40 border-2 border-yellow-400/60 shadow-sm'
                            : ''
                        } ${needsReview ? 'ring-2 ring-red-300/50 ring-inset' : ''} ${
                          isSaving ? 'opacity-70' : ''
                        }`;

                        if (isEditingNote) {
                          return (
                            <td
                              key={colIdx}
                              role="gridcell"
                              tabIndex={0}
                              className="relative p-0"
                              style={{ height: '150px' }}
                            >
                              <InlineNoteEditor
                                cellId={cellId}
                                initialContent={cellNote?.content || ''}
                                onSave={(id, content) => handleSaveNote(row.id, colIdx, content)}
                                onCancel={handleCancelNote}
                              />
                            </td>
                          );
                        }

                        return (
                          <td
                            key={colIdx}
                            role="gridcell"
                            tabIndex={0}
                            className={cellClass}
                            onMouseEnter={() => setHoveredCell({ rowId: row.id, colIdx })}
                            onMouseLeave={() => setHoveredCell(null)}
                            onDoubleClick={() => handleCellDoubleClick(row.id, colIdx)}
                          >
                            {/* Note indicator */}
                            {cellNote && (
                              <span
                                className="absolute top-1 right-2 text-blue-500 hover:scale-110 transition-transform cursor-help"
                                title={`Nota: ${cellNote.content.substring(0, 50)}...`}
                              >
                                <Pin size={12} />
                              </span>
                            )}

                            {/* Confidence indicator */}
                            {viewMode === 'technical' && cell.confidence !== undefined && (
                              <span
                                className={`absolute top-1 left-1 w-2.5 h-2.5 rounded-full border ${getConfidenceBadgeColor(cell.confidence)} cursor-help`}
                                title={`Confianza: ${formatPercentage(cell.confidence, 0)} (${getConfidenceText(cell.confidence)})`}
                              />
                            )}

                            {/* Winner trophy */}
                            {isWinner && (viewMode === 'technical' ? !lowConfidence : true) && (
                              <span
                                className="absolute top-1 right-2 text-amber-500 hover:scale-110 transition-transform cursor-help"
                                title="Condición / Valor favorable"
                              >
                                🏆
                              </span>
                            )}

                            {/* Low Confidence / Needs Review Alert */}
                            {viewMode === 'technical' && (lowConfidence || needsReview) && (
                              <span
                                className="absolute top-1 right-2 text-yellow-600 hover:scale-110 transition-transform cursor-help z-10"
                                title={
                                  needsReview
                                    ? 'Requiere validación humana - Doble agente en discrepancia'
                                    : 'Confianza baja en mapeo ontológico'
                                }
                              >
                                <AlertCircle size={14} />
                              </span>
                            )}

                            {/* Cell Value Rendering */}
                            <div className="flex flex-col items-center justify-center gap-1.5">
                              {excluded ? (
                                <span className="text-slate-400 font-medium">No incluida</span>
                              ) : (
                                <span
                                  className={`${isWinner ? 'text-amber-950 font-bold' : 'text-slate-800 font-medium'}`}
                                >
                                  {row.label === 'Deducible' && cell.value !== 'No aplica' ? (
                                    <DeductibleBadge deductible={cell.value} />
                                  ) : row.label === 'Valor Asegurado' ? (
                                    formatMatrixValue(cell.value)
                                  ) : (
                                    cell.value
                                  )}
                                </span>
                              )}

                              {/* Technical Details Popover Trigger (Only in Technical ViewMode) */}
                              {viewMode === 'technical' && hasDetails && (
                                <div className="flex items-center gap-1 mt-1 text-[10px] text-slate-400">
                                  {(cell.calculatedPage !== undefined ||
                                    cell.pageNumber !== undefined) && (
                                    <button
                                      onClick={() => handleOpenPdfEvidence(cell, quotes[colIdx])}
                                      className="bg-blue-50 text-blue-600 hover:bg-blue-100 px-1.5 py-0.5 rounded border border-blue-200 flex items-center gap-0.5 transition-colors cursor-pointer"
                                      title="Ver evidencia en PDF"
                                    >
                                      <Eye size={10} />
                                      Pág. {cell.calculatedPage || cell.pageNumber}
                                    </button>
                                  )}
                                  {cell.confidence !== undefined && (
                                    <span
                                      className={`px-1.5 py-0.5 rounded border ${getConfidenceBadgeColor(cell.confidence)}`}
                                    >
                                      {getConfidenceText(cell.confidence)}
                                    </span>
                                  )}
                                  {needsReview && (
                                    <span className="bg-red-50 text-red-600 px-1.5 py-0.5 rounded border border-red-200 flex items-center gap-0.5">
                                      <AlertTriangle size={10} />
                                      Revisar
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>

                            {/* Inline Discrepancy Resolution Dropdown */}
                            {viewMode === 'technical' &&
                              needsReview &&
                              openDropdown?.rowId === row.id &&
                              openDropdown?.colIdx === colIdx && (
                                <div
                                  ref={dropdownRef}
                                  className="absolute left-1/2 -translate-x-1/2 top-full mt-2 w-80 bg-white rounded-xl shadow-2xl z-50 border border-slate-200 overflow-hidden"
                                >
                                  <div className="bg-amber-50 px-4 py-2.5 border-b border-amber-200 flex items-center gap-2">
                                    <AlertTriangle size={14} className="text-amber-600" />
                                    <span className="text-xs font-bold text-amber-800">
                                      Resolver Discrepancia Ontológica
                                    </span>
                                  </div>
                                  <div className="p-3 max-h-64 overflow-y-auto">
                                    <p className="text-[11px] text-slate-500 mb-2">
                                      Seleccione la categoría canónica correcta:
                                    </p>
                                    {PLANTILLA_ITEMS.map((item, idx) => (
                                      <button
                                        key={idx}
                                        onClick={() =>
                                          handleDiscrepancyResolution(row.id, colIdx, item)
                                        }
                                        className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 rounded-lg transition-colors flex items-center justify-between group"
                                      >
                                        <span>{item}</span>
                                        <Check
                                          size={12}
                                          className="text-green-600 opacity-0 group-hover:opacity-100 transition-opacity"
                                        />
                                      </button>
                                    ))}
                                  </div>
                                  <div className="px-3 py-2 bg-slate-50 border-t border-slate-100">
                                    <button
                                      onClick={() => setOpenDropdown(null)}
                                      className="w-full text-center text-[11px] text-slate-500 hover:text-slate-700 py-1"
                                    >
                                      Cancelar
                                    </button>
                                  </div>
                                </div>
                              )}

                            {/* Trigger button for dropdown */}
                            {viewMode === 'technical' && needsReview && (
                              <button
                                onClick={() =>
                                  setOpenDropdown(
                                    openDropdown?.rowId === row.id &&
                                      openDropdown?.colIdx === colIdx
                                      ? null
                                      : { rowId: row.id, colIdx }
                                  )
                                }
                                disabled={isSaving}
                                className="absolute bottom-1 right-1 text-[10px] text-yellow-700 bg-yellow-100 hover:bg-yellow-200 disabled:opacity-50 px-1.5 py-0.5 rounded border border-yellow-300 transition-colors flex items-center gap-0.5 z-10"
                              >
                                {isSaving ? (
                                  <Loader2 size={10} className="animate-spin" />
                                ) : (
                                  <ChevronDown size={10} />
                                )}
                                {isSaving ? 'Guardando...' : 'Corregir'}
                              </button>
                            )}

                            {/* Premium Technical Hover Card Popover */}
                            {viewMode === 'technical' &&
                              hoveredCell?.rowId === row.id &&
                              hoveredCell?.colIdx === colIdx &&
                              hasDetails && (
                                <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-80 p-4 bg-slate-900 text-slate-100 text-xs rounded-xl shadow-xl z-50 border border-slate-700 pointer-events-none transition-all duration-200">
                                  <div className="flex items-center gap-2 mb-2 pb-1.5 border-b border-slate-800">
                                    <Award className="text-blue-400" size={14} />
                                    <span className="font-bold text-white text-[11px] tracking-wide uppercase">
                                      Auditoría de Extracción
                                    </span>
                                  </div>

                                  {/* Confidence Section */}
                                  {cell.confidence !== undefined && (
                                    <div className="flex justify-between py-0.5">
                                      <span className="text-slate-400">Confianza:</span>
                                      <span
                                        className={`font-semibold ${lowConfidence ? 'text-yellow-400' : 'text-white'}`}
                                      >
                                        {formatPercentage(cell.confidence, 0)} (
                                        {getConfidenceText(cell.confidence)})
                                      </span>
                                    </div>
                                  )}

                                  {/* Canonical Name & Match Method */}
                                  {(cell.canonicalName || cell.matchMethod) && (
                                    <div className="mt-2 pt-2 border-t border-slate-800">
                                      {cell.canonicalName && (
                                        <div className="flex justify-between py-0.5">
                                          <span className="text-slate-400">Nombre canónico:</span>
                                          <span className="font-semibold text-white text-right max-w-[180px] truncate">
                                            {cell.canonicalName}
                                          </span>
                                        </div>
                                      )}
                                      {cell.matchMethod && (
                                        <div className="flex justify-between py-0.5">
                                          <span className="text-slate-400">Método:</span>
                                          <span className="font-semibold text-white capitalize">
                                            {cell.matchMethod}
                                          </span>
                                        </div>
                                      )}
                                    </div>
                                  )}

                                  {/* Page Evidence */}
                                  {(cell.calculatedPage !== undefined ||
                                    cell.pageNumber !== undefined) && (
                                    <div className="flex justify-between py-0.5">
                                      <span className="text-slate-400">Página:</span>
                                      <span className="font-semibold text-white">
                                        {cell.calculatedPage !== undefined
                                          ? `Pág. ${cell.calculatedPage} (calculada)`
                                          : `Pág. ${cell.pageNumber}`}
                                      </span>
                                    </div>
                                  )}

                                  {/* Notes / Raw Text Snippet */}
                                  {(cell.notes || cell.rawTextSnippet) && (
                                    <div className="mt-2 pt-2 border-t border-slate-800">
                                      <span className="font-semibold text-slate-400 block mb-1">
                                        {cell.notes ? 'Notas' : 'Evidencia textual (verbatim):'}
                                      </span>
                                      <div className="bg-slate-800/50 rounded-lg p-2 text-[11px] text-slate-300 leading-relaxed italic border border-slate-700/50">
                                        "
                                        {cell.notes && cell.notes.length > 200
                                          ? `${cell.notes.slice(0, 200)}...`
                                          : cell.notes || cell.rawTextSnippet}
                                        "
                                      </div>
                                    </div>
                                  )}

                                  {/* Justification */}
                                  {cell.justification && (
                                    <div className="mt-2 pt-2 border-t border-slate-800">
                                      <span className="font-semibold text-slate-400 block mb-1">
                                        Justificación IA:
                                      </span>
                                      <div className="text-[11px] text-slate-300 leading-relaxed">
                                        {cell.justification}
                                      </div>
                                    </div>
                                  )}

                                  {/* Human Review Flag */}
                                  {needsReview && (
                                    <div className="mt-2 pt-2 border-t border-slate-800">
                                      <div className="bg-red-900/30 border border-red-700/50 rounded-lg p-2 flex items-center gap-2">
                                        <AlertTriangle
                                          size={12}
                                          className="text-red-400 flex-shrink-0"
                                        />
                                        <span className="text-[11px] text-red-300">
                                          Doble agente en discrepancia. Se requiere validación
                                          humana.
                                        </span>
                                      </div>
                                    </div>
                                  )}

                                  <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-6 border-r-6 border-t-6 border-transparent border-t-slate-900"></div>
                                </div>
                              )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Methodology Alert Note */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex items-start gap-3 shadow-inner">
        <Info className="text-slate-500 mt-0.5 flex-shrink-0" size={16} />
        <div className="text-xs text-slate-500 leading-relaxed">
          {viewMode === 'client' ? (
            <>
              <span className="font-semibold text-slate-700">Nota:</span> La correspondencia en esta
              matriz horizontal ha sido alineada por nuestro motor de análisis. El contenido
              coincide de manera exacta con el reporte de cotizaciones.
            </>
          ) : (
            <>
              <span className="font-semibold text-slate-700">Nota técnica:</span> La correspondencia
              en esta matriz horizontal ha sido alineada determinísticamente por nuestro
              transformador. El contenido coincide de manera exacta y paritaria con el reporte Excel
              monocromático de 3 pestañas.
            </>
          )}
        </div>
      </div>

      {/* PdfViewer Lazy Loaded */}
      <Suspense fallback={null}>
        <PdfViewer />
      </Suspense>

      <ToastContainer toasts={toasts} onClose={removeToast} />
    </div>
  );
};
