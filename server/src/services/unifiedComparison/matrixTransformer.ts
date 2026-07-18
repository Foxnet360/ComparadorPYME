/**
 * Matrix Transformer
 * Pure functions that convert engine-specific results into the shared
 * MatrixRow[] shape consumed by the analysis controller and UI.
 */

import { MatrixRow } from '../../types';
import {
  FlatComparisonResult,
  FlatComparisonResultV2,
  StructuredDeductible,
} from './comparisonSchema';
import { ParsedQuote } from '../quoteParser';
import { CANONICAL_COVERAGE_ORDER } from './flatTableParser';

const HEADER_SECTION_ID = 0;
const COVERAGE_SECTION_ID = 1;
export const FINANCIAL_SECTION_ID = 100;

const FINANCIAL_SECTION_LABEL = 'PRIMAS Y COSTOS';

function isFinancialRowLabel(label: string): boolean {
  const normalized = label
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  return [
    'prima',
    'prima con iva',
    'prima neta',
    'total a pagar',
    'total',
    'pago',
    'forma de pago',
    'gastos',
    'gastos de expedicion',
    'subtotal',
    'iva',
    'costo',
    'neto',
    'sobre valor asegurado',
    '% sobre valor asegurado',
  ].some((keyword) => normalized.includes(keyword));
}

function formatDeductible(deductible: StructuredDeductible | undefined): string | undefined {
  if (!deductible) return undefined;
  if (deductible.type === 'not_applicable') return 'No aplica';
  if (deductible.type === 'see_conditions') return 'Ver condiciones';
  const parts: string[] = [];
  if (deductible.percentage !== undefined) parts.push(`${deductible.percentage}%`);
  if (deductible.minimum !== undefined) {
    const minText = deductible.currency
      ? `${deductible.currency}${deductible.minimum}`
      : `${deductible.minimum}`;
    parts.push(`Mínimo ${minText}`);
  }
  return parts.length > 0 ? parts.join(' - ') : undefined;
}

function emptyCells(count: number) {
  return Array.from({ length: count }, () => ({
    value: '',
    isExcluded: false,
    isWinner: false,
  }));
}

function cellFromFlatValue(value: string | null, notFound?: boolean) {
  const isMissing = value === null || value === undefined || notFound === true;
  return {
    value: isMissing ? 'No informado' : value,
    isExcluded: isMissing,
    isWinner: false,
  };
}

/**
 * Convert a FlatComparisonResult from the unified engine into MatrixRow[].
 */
export function flatResultToMatrixRows(result: FlatComparisonResult): MatrixRow[] {
  const numInsurers = result.insurers.length;
  const matrix: MatrixRow[] = [];

  // Header
  matrix.push({
    type: 'header',
    id: 'client_info',
    label: `Cotizaciones PYME - ${result.insurers.join(', ')}`,
    sectionId: HEADER_SECTION_ID,
    cells: emptyCells(numInsurers),
  });

  // Coverage section
  matrix.push({
    type: 'header',
    id: 'section_0',
    label: 'INFORMACIÓN GENERAL',
    sectionId: COVERAGE_SECTION_ID,
    cells: emptyCells(numInsurers),
  });

  result.rows.forEach((row, index) => {
    matrix.push({
      type: 'data',
      id: `section_0_row_${index}`,
      label: row.label,
      sectionId: COVERAGE_SECTION_ID,
      cells: row.cells.map((cell) => ({
        ...cellFromFlatValue(cell.value, cell.notFound),
        notes: cell.rawText,
        confidence: cell.notFound ? 0 : 0.85,
      })),
    });
  });

  result.extraRows.forEach((row, index) => {
    matrix.push({
      type: 'data',
      id: `section_0_extra_${index}`,
      label: row.label,
      sectionId: COVERAGE_SECTION_ID,
      cells: row.cells.map((cell) => ({
        ...cellFromFlatValue(cell.value, cell.notFound),
        notes: cell.rawText,
        confidence: cell.notFound ? 0 : 0.85,
      })),
    });
  });

  // Financials section
  matrix.push({
    type: 'header',
    id: 'financials',
    label: 'PRIMAS Y COSTOS',
    sectionId: FINANCIAL_SECTION_ID,
    cells: emptyCells(numInsurers),
  });

  const primaRow = result.rows.find((r) => r.label.toLowerCase().includes('prima'));
  if (primaRow) {
    matrix.push({
      type: 'data',
      id: 'premium_total',
      label: 'TOTAL A PAGAR',
      sectionId: FINANCIAL_SECTION_ID,
      cells: primaRow.cells.map((cell) => cellFromFlatValue(cell.value, cell.notFound)),
    });
  }

  const paymentRow = result.rows.find((r) => r.label.toLowerCase().includes('pago'));
  if (paymentRow) {
    matrix.push({
      type: 'data',
      id: 'meta_payment',
      label: 'Forma de Pago',
      sectionId: FINANCIAL_SECTION_ID,
      cells: paymentRow.cells.map((cell) => cellFromFlatValue(cell.value, cell.notFound)),
    });
  }

  // Warnings
  if (result.warnings.length > 0) {
    matrix.push({
      type: 'spacer',
      id: 'spacer_warnings',
      label: '',
      sectionId: FINANCIAL_SECTION_ID,
      cells: emptyCells(numInsurers),
    });
    matrix.push({
      type: 'header',
      id: 'warnings',
      label: '⚠️ ALERTAS',
      sectionId: FINANCIAL_SECTION_ID,
      cells: emptyCells(numInsurers),
    });
    result.warnings.forEach((warning, index) => {
      matrix.push({
        type: 'data',
        id: `warning_${index}`,
        label: warning,
        sectionId: FINANCIAL_SECTION_ID,
        cells: emptyCells(numInsurers),
      });
    });
  }

  return matrix;
}

// ---------------------------------------------------------------------------
// v2 transformer: section-aware granular rows
// ---------------------------------------------------------------------------

const SECTION_ORDER = [
  'INFORMACIÓN GENERAL',
  'BIENES ASEGURADOS',
  'COBERTURAS',
  'SUSTRACCIÓN',
  'DEDUCIBLES',
  'CONDICIONES',
  FINANCIAL_SECTION_LABEL,
];

function sectionSortIndex(section: string | undefined): number {
  if (!section) return Number.MAX_SAFE_INTEGER;
  const index = SECTION_ORDER.indexOf(section);
  return index === -1 ? Number.MAX_SAFE_INTEGER : index;
}

const CANONICAL_ORDER_INDEX = new Map<string, number>(
  CANONICAL_COVERAGE_ORDER.map((id, index) => [id, index])
);

function canonicalSortIndex(canonicalId: string | undefined): number {
  if (!canonicalId) return Number.MAX_SAFE_INTEGER;
  return CANONICAL_ORDER_INDEX.get(canonicalId) ?? Number.MAX_SAFE_INTEGER;
}

function sortByCanonicalId<T extends { canonicalId?: string }>(rows: T[]): T[] {
  return [...rows].sort(
    (a, b) => canonicalSortIndex(a.canonicalId) - canonicalSortIndex(b.canonicalId)
  );
}

function cellFromFlatValueV2(
  value: string | null,
  notFound?: boolean,
  confidence?: number,
  notes?: string
) {
  const isMissing = value === null || value === undefined || notFound === true;
  return {
    value: isMissing ? 'No informado' : value,
    isExcluded: isMissing,
    isWinner: false,
    confidence: isMissing ? 0 : (confidence ?? 0),
    notes,
  };
}

/**
 * Convert a FlatComparisonResultV2 from the unified engine into section-aware MatrixRow[].
 */
export function flatResultToMatrixRowsV2(result: FlatComparisonResultV2): MatrixRow[] {
  const numInsurers = result.insurers.length;
  const matrix: MatrixRow[] = [];

  // Top header
  matrix.push({
    type: 'header',
    id: 'client_info',
    label: `Cotizaciones PYME - ${result.insurers.join(', ')}`,
    sectionId: HEADER_SECTION_ID,
    cells: emptyCells(numInsurers),
  });

  // Group rows by section, pulling recognized financial rows into their own section
  const sectionGroups = new Map<
    string,
    {
      label: string;
      canonicalId?: string;
      cells: { value: string | null; notFound?: boolean; confidence?: number; notes?: string }[];
    }[]
  >();

  for (const row of sortByCanonicalId(result.rows)) {
    const section =
      isFinancialRowLabel(row.label) || row.section === 'FINANCIAL'
        ? FINANCIAL_SECTION_LABEL
        : row.section || 'OTROS';
    if (!sectionGroups.has(section)) {
      sectionGroups.set(section, []);
    }
    sectionGroups.get(section)!.push({
      label: row.label,
      canonicalId: row.canonicalId,
      cells: row.cells.map((cell) => ({
        value: cell.value,
        notFound: cell.notFound,
        confidence: cell.confidence,
        notes: cell.rawText ?? formatDeductible(cell.deductible),
      })),
    });
  }

  for (const row of sortByCanonicalId(result.extraRows)) {
    const section =
      isFinancialRowLabel(row.label) || row.section === 'FINANCIAL'
        ? FINANCIAL_SECTION_LABEL
        : row.section || 'OTROS';
    if (!sectionGroups.has(section)) {
      sectionGroups.set(section, []);
    }
    sectionGroups.get(section)!.push({
      label: row.label,
      canonicalId: row.canonicalId,
      cells: row.cells.map((cell) => ({
        value: cell.value,
        notFound: cell.notFound,
        confidence: cell.confidence,
        notes: cell.rawText ?? formatDeductible(cell.deductible),
      })),
    });
  }

  // Sort sections canonically
  const sortedSections = Array.from(sectionGroups.entries()).sort(
    (a, b) => sectionSortIndex(a[0]) - sectionSortIndex(b[0])
  );

  let sectionIndex = 0;
  for (const [section, rows] of sortedSections) {
    const isFinancialSection = section === FINANCIAL_SECTION_LABEL;
    matrix.push({
      type: 'header',
      id: `section_${sectionIndex}`,
      label: section,
      sectionId: isFinancialSection ? FINANCIAL_SECTION_ID : COVERAGE_SECTION_ID,
      cells: emptyCells(numInsurers),
    });

    rows.forEach((row, rowIndex) => {
      matrix.push({
        type: 'data',
        id: `section_${sectionIndex}_row_${rowIndex}`,
        label: row.label,
        sectionId: section === FINANCIAL_SECTION_LABEL ? FINANCIAL_SECTION_ID : COVERAGE_SECTION_ID,
        cells: row.cells.map((cell) =>
          cellFromFlatValueV2(cell.value, cell.notFound, cell.confidence, cell.notes)
        ),
      });
    });

    sectionIndex++;
  }

  // Warnings
  if (result.warnings.length > 0) {
    matrix.push({
      type: 'spacer',
      id: 'spacer_warnings',
      label: '',
      sectionId: FINANCIAL_SECTION_ID,
      cells: emptyCells(numInsurers),
    });
    matrix.push({
      type: 'header',
      id: 'warnings',
      label: '⚠️ ALERTAS',
      sectionId: FINANCIAL_SECTION_ID,
      cells: emptyCells(numInsurers),
    });
    result.warnings.forEach((warning, index) => {
      matrix.push({
        type: 'data',
        id: `warning_${index}`,
        label: warning,
        sectionId: FINANCIAL_SECTION_ID,
        cells: emptyCells(numInsurers),
      });
    });
  }

  return matrix;
}

function formatCOP(value: number): string {
  return `$${value.toLocaleString('es-CO')}`;
}

function cellFromQuoteCoverage(coverage: ParsedQuote['coverages'][number] | undefined) {
  if (!coverage) {
    return { value: 'No informado', isExcluded: true, isWinner: false };
  }
  const value = coverage.value ?? 'No informado';
  const isExcluded = value === 'No informado' || value === 'NO ESPECIFICADO' || value === '';
  return {
    value,
    isExcluded,
    isWinner: false,
    notes: coverage.deductible,
    confidence: coverage.confidence,
  };
}

/**
 * Convert an array of ParsedQuote (legacy per-quote pipeline) into MatrixRow[].
 */
export function quotesToMatrixRows(quotes: ParsedQuote[]): MatrixRow[] {
  const numInsurers = quotes.length;
  const matrix: MatrixRow[] = [];

  matrix.push({
    type: 'header',
    id: 'client_info',
    label: `Cotizaciones PYME - ${quotes.map((q) => q.insurerName).join(', ')}`,
    sectionId: HEADER_SECTION_ID,
    cells: emptyCells(numInsurers),
  });

  matrix.push({
    type: 'header',
    id: 'section_0',
    label: 'COBERTURAS',
    sectionId: COVERAGE_SECTION_ID,
    cells: emptyCells(numInsurers),
  });

  const coverageNames = new Set<string>();
  quotes.forEach((q) => q.coverages.forEach((c) => coverageNames.add(c.canonicalName || c.name)));

  Array.from(coverageNames).forEach((name, index) => {
    matrix.push({
      type: 'data',
      id: `section_0_row_${index}`,
      label: name,
      sectionId: COVERAGE_SECTION_ID,
      cells: quotes.map((q) => {
        const coverage = q.coverages.find((c) => (c.canonicalName || c.name) === name);
        return cellFromQuoteCoverage(coverage);
      }),
    });
  });

  matrix.push({
    type: 'header',
    id: 'financials',
    label: 'PRIMAS Y COSTOS',
    sectionId: FINANCIAL_SECTION_ID,
    cells: emptyCells(numInsurers),
  });

  matrix.push({
    type: 'data',
    id: 'premium_total',
    label: 'TOTAL A PAGAR',
    sectionId: FINANCIAL_SECTION_ID,
    cells: quotes.map((q) => ({
      value: q.priceAnnual > 0 ? formatCOP(q.priceAnnual) : 'No informado',
      isExcluded: q.priceAnnual <= 0,
      isWinner: false,
    })),
  });

  const allWarnings = quotes.flatMap((q) => q.specialConditions || []);
  if (allWarnings.length > 0) {
    matrix.push({
      type: 'spacer',
      id: 'spacer_warnings',
      label: '',
      sectionId: FINANCIAL_SECTION_ID,
      cells: emptyCells(numInsurers),
    });
    matrix.push({
      type: 'header',
      id: 'warnings',
      label: '⚠️ ALERTAS',
      sectionId: FINANCIAL_SECTION_ID,
      cells: emptyCells(numInsurers),
    });
    allWarnings.forEach((warning, index) => {
      matrix.push({
        type: 'data',
        id: `warning_${index}`,
        label: warning,
        sectionId: FINANCIAL_SECTION_ID,
        cells: emptyCells(numInsurers),
      });
    });
  }

  return matrix;
}
