/**
 * Matrix Transformer
 * Pure functions that convert engine-specific results into the shared
 * MatrixRow[] shape consumed by the analysis controller and UI.
 */

import { MatrixRow } from '../../types';
import { FlatComparisonResult } from './comparisonSchema';
import { ParsedQuote } from '../quoteParser';

const HEADER_SECTION_ID = 0;
const COVERAGE_SECTION_ID = 1;
const FINANCIAL_SECTION_ID = 999;

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

  const primaRow = result.rows.find((r) =>
    r.label.toLowerCase().includes('prima')
  );
  if (primaRow) {
    matrix.push({
      type: 'data',
      id: 'premium_total',
      label: 'TOTAL A PAGAR',
      sectionId: FINANCIAL_SECTION_ID,
      cells: primaRow.cells.map((cell) => cellFromFlatValue(cell.value, cell.notFound)),
    });
  }

  const paymentRow = result.rows.find((r) =>
    r.label.toLowerCase().includes('pago')
  );
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

function formatCOP(value: number): string {
  return `$${value.toLocaleString('es-CO')}`;
}

function cellFromQuoteCoverage(coverage: ParsedQuote['coverages'][number] | undefined) {
  if (!coverage) {
    return { value: 'No informado', isExcluded: true, isWinner: false };
  }
  const value = coverage.value ?? 'No informado';
  const isExcluded =
    value === 'No informado' ||
    value === 'NO ESPECIFICADO' ||
    value === '';
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
  quotes.forEach((q) =>
    q.coverages.forEach((c) => coverageNames.add(c.canonicalName || c.name))
  );

  Array.from(coverageNames).forEach((name, index) => {
    matrix.push({
      type: 'data',
      id: `section_0_row_${index}`,
      label: name,
      sectionId: COVERAGE_SECTION_ID,
      cells: quotes.map((q) => {
        const coverage = q.coverages.find(
          (c) => (c.canonicalName || c.name) === name
        );
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
