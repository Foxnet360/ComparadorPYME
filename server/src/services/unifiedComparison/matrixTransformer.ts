/**
 * Matrix Transformer
 * Pure functions that convert engine-specific results into the shared
 * MatrixRow[] shape consumed by the analysis controller and UI.
 */

import { MatrixCell, MatrixRow, QuoteAnalysis, CoverageItem } from '../../types';
import {
  FlatComparisonResult,
  FlatComparisonResultV2,
  StructuredDeductible,
  SchemaSection,
} from './comparisonSchema';
import { UnifiedComparisonResult } from '../../types/unifiedComparison';
import { ParsedQuote } from '../quoteParser';
import { getCanonicalCoverageOrder } from './flatTableParser';
import { InsuranceDomain } from '../../types/domain';
import { domainTaxonomyRegistry } from '../domainTaxonomyRegistry';
import { getCanonicalCoverageNames } from '../../config/domainConstants';
import { hasDomainSpecificFile, loadDomainJson } from '../domainBundleLoader';
import { parseColombianCurrency } from '../../utils/currencyParser';
import { extractCanonicalInsurerName, isKnownCanonicalInsurer } from './insurerSanitizer';

export const HEADER_SECTION_ID = 0;
export const COVERAGE_SECTION_ID = 1;
export const DEDUCTIBLE_SECTION_ID = 50;
export const FINANCIAL_SECTION_ID = 100;
export const ADDITIONAL_SECTION_ID = 101;

export const FINANCIAL_SECTION_LABEL = 'PRIMAS Y COSTOS';

export function getSectionId(sectionName: string): number {
  const norm = sectionName
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  if (norm.includes('PRIMA') || norm.includes('COSTO') || norm === FINANCIAL_SECTION_LABEL) {
    return FINANCIAL_SECTION_ID;
  }
  if (norm.includes('DEDUCIBLE')) {
    return DEDUCTIBLE_SECTION_ID;
  }
  if (
    norm.includes('CONDICION') ||
    norm.includes('OBSERVACION') ||
    norm.includes('ALERTA') ||
    norm.includes('ADICIONAL')
  ) {
    return ADDITIONAL_SECTION_ID;
  }
  return COVERAGE_SECTION_ID;
}

export function getDomainHeaderLabel(domain: InsuranceDomain = 'pyme'): string {
  return domain === 'pyme' ? 'PYME' : domain.toUpperCase();
}

function mapTaxonomySectionToSchemaSection(section?: string): string {
  if (!section) return SchemaSection.COBERTURAS;
  const normalized = section
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  if (normalized.includes('deducible')) return SchemaSection.DEDUCIBLES;
  if (
    normalized.includes('sustraccion') ||
    normalized.includes('robo') ||
    normalized.includes('hurto')
  )
    return SchemaSection.SUSTRACCION;
  if (
    normalized.includes('condicion') ||
    normalized.includes('observacion') ||
    normalized.includes('exclusion')
  )
    return SchemaSection.CONDICIONES;
  if (
    normalized.includes('prima') ||
    normalized.includes('pago') ||
    normalized.includes('gasto') ||
    normalized.includes('expedicion') ||
    normalized.includes('iva') ||
    normalized.includes('total')
  )
    return SchemaSection.FINANCIAL;
  if (
    normalized.includes('bien') ||
    normalized.includes('edificio') ||
    normalized.includes('contenido') ||
    normalized.includes('mercancia') ||
    normalized.includes('mueble') ||
    normalized.includes('maquinaria') ||
    normalized.includes('equipo')
  )
    return SchemaSection.BIENES_ASEGURADOS;
  return SchemaSection.COBERTURAS;
}

function getSectionOrder(domain: InsuranceDomain = 'pyme'): string[] {
  if (domain === 'pyme') {
    return [
      'INFORMACIÓN GENERAL',
      'BIENES ASEGURADOS',
      'COBERTURAS',
      'SUSTRACCIÓN',
      'DEDUCIBLES',
      'CONDICIONES',
      FINANCIAL_SECTION_LABEL,
    ];
  }

  const taxonomy = domainTaxonomyRegistry.getTaxonomy(domain);
  const sections: string[] = [];
  for (const category of taxonomy.categories) {
    const mapped = mapTaxonomySectionToSchemaSection(category.section);
    if (!sections.includes(mapped)) {
      sections.push(mapped);
    }
  }
  if (!sections.includes(FINANCIAL_SECTION_LABEL)) {
    sections.push(FINANCIAL_SECTION_LABEL);
  }
  return sections;
}

export function isFinancialRowLabel(label: string): boolean {
  const normalized = label
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  // Common coverage and asset terms that happen to contain financial substrings
  // (e.g. "Pérdida Total" contains "total", "Valor Total Asegurado" contains "total")
  // must not be misclassified as financial rows.
  const coverageTerms = [
    'perdida total',
    'perdida parcial',
    'hurto',
    'robo',
    'sustraccion',
    'responsabilidad civil',
    'rce',
    'rc ',
    'daño',
    'incendio',
    'terremoto',
    'asistencia',
    'carro taller',
    'vehiculo de reemplazo',
    'eventos de la naturaleza',
    'granizo',
    'inundacion',
    'conductor adicional',
    'menores de 25',
    'hurto de partes',
    'asegurad',
    'asegurable',
    'suma asegurada',
    'valor asegurable',
    'edificio',
    'contenido',
    'bienes',
    'maquinaria',
    'mercancia',
    'predio',
  ];
  if (coverageTerms.some((term) => normalized.includes(term))) return false;

  // Single-word exact total match
  if (normalized === 'total' || normalized === 'total:' || normalized === 'gran total') {
    return true;
  }

  return [
    'prima',
    'prima con iva',
    'prima neta',
    'total a pagar',
    'total prima',
    'valor a pagar',
    'total liquidacion',
    'total poliza',
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
export function flatResultToMatrixRows(
  result: FlatComparisonResult,
  domain: InsuranceDomain = 'pyme'
): MatrixRow[] {
  const numInsurers = result.insurers.length;
  const matrix: MatrixRow[] = [];

  // Header
  matrix.push({
    type: 'header',
    id: 'client_info',
    label: `Cotizaciones ${getDomainHeaderLabel(domain)} - ${result.insurers.join(', ')}`,
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

function sectionSortIndex(section: string | undefined, domain: InsuranceDomain = 'pyme'): number {
  if (!section) return Number.MAX_SAFE_INTEGER;
  const index = getSectionOrder(domain).indexOf(section);
  return index === -1 ? Number.MAX_SAFE_INTEGER : index;
}

function getCanonicalOrderIndexMap(domain: InsuranceDomain = 'pyme'): Map<string, number> {
  return new Map<string, number>(getCanonicalCoverageOrder(domain).map((id, index) => [id, index]));
}

function canonicalSortIndex(
  canonicalId: string | undefined,
  domain: InsuranceDomain = 'pyme'
): number {
  if (!canonicalId) return Number.MAX_SAFE_INTEGER;
  return getCanonicalOrderIndexMap(domain).get(canonicalId) ?? Number.MAX_SAFE_INTEGER;
}

function sortByCanonicalId<T extends { canonicalId?: string }>(
  rows: T[],
  domain: InsuranceDomain = 'pyme'
): T[] {
  return [...rows].sort(
    (a, b) => canonicalSortIndex(a.canonicalId, domain) - canonicalSortIndex(b.canonicalId, domain)
  );
}

function cellFromFlatValueV2(
  value: string | null,
  notFound?: boolean,
  confidence?: number,
  notes?: string,
  rawTextSnippet?: string,
  pageNumber?: number
) {
  const isMissing = value === null || value === undefined || notFound === true;
  const cell: Record<string, unknown> = {
    value: isMissing ? 'No informado' : value,
    isExcluded: isMissing,
    isWinner: false,
    confidence: isMissing ? 0 : typeof confidence === 'number' ? confidence : 0,
  };
  if (notes !== undefined) cell.notes = notes;
  if (rawTextSnippet !== undefined) cell.rawTextSnippet = rawTextSnippet;
  if (typeof pageNumber === 'number' && Number.isFinite(pageNumber)) cell.pageNumber = pageNumber;
  return cell as any;
}

/**
 * Convert a FlatComparisonResultV2 from the unified engine into section-aware MatrixRow[].
 */
export function flatResultToMatrixRowsV2(
  result: FlatComparisonResultV2,
  domain: InsuranceDomain = 'pyme'
): MatrixRow[] {
  const numInsurers = result.insurers.length;
  const matrix: MatrixRow[] = [];

  // Top header
  matrix.push({
    type: 'header',
    id: 'client_info',
    label: `Cotizaciones ${getDomainHeaderLabel(domain)} - ${result.insurers.join(', ')}`,
    sectionId: HEADER_SECTION_ID,
    cells: emptyCells(numInsurers),
  });

  // Group rows by section, pulling recognized financial rows into their own section
  const sectionGroups = new Map<
    string,
    {
      label: string;
      canonicalName?: string;
      canonicalId?: string;
      matchConfidence?: number;
      matchMethod?: string | null;
      cells: {
        value: string | null;
        notFound?: boolean;
        confidence?: number;
        notes?: string;
        rawTextSnippet?: string;
        pageNumber?: number;
      }[];
    }[]
  >();

  for (const row of sortByCanonicalId(result.rows, domain)) {
    const section =
      isFinancialRowLabel(row.label) || row.section === 'FINANCIAL'
        ? FINANCIAL_SECTION_LABEL
        : row.section || 'OTROS';
    if (!sectionGroups.has(section)) {
      sectionGroups.set(section, []);
    }
    sectionGroups.get(section)!.push({
      label: row.label,
      canonicalName: row.canonicalName,
      canonicalId: row.canonicalId,
      matchConfidence: row.matchConfidence,
      matchMethod: row.canonicalSource ?? null,
      cells: row.cells.map((cell) => ({
        value: cell.value,
        notFound: cell.notFound,
        confidence: cell.confidence,
        notes: cell.rawText ?? formatDeductible(cell.deductible),
        rawTextSnippet: cell.rawText,
        pageNumber: (cell as any).pageNumber,
      })),
    });
  }

  for (const row of sortByCanonicalId(result.extraRows, domain)) {
    const section =
      isFinancialRowLabel(row.label) || row.section === 'FINANCIAL'
        ? FINANCIAL_SECTION_LABEL
        : row.section || 'OTROS';
    if (!sectionGroups.has(section)) {
      sectionGroups.set(section, []);
    }
    sectionGroups.get(section)!.push({
      label: row.label,
      canonicalName: row.canonicalName,
      canonicalId: row.canonicalId,
      matchConfidence: row.matchConfidence,
      matchMethod: row.canonicalSource ?? null,
      cells: row.cells.map((cell) => ({
        value: cell.value,
        notFound: cell.notFound,
        confidence: cell.confidence,
        notes: cell.rawText ?? formatDeductible(cell.deductible),
        rawTextSnippet: cell.rawText,
        pageNumber: (cell as any).pageNumber,
      })),
    });
  }

  // Sort sections canonically
  const sortedSections = Array.from(sectionGroups.entries()).sort(
    (a, b) => sectionSortIndex(a[0], domain) - sectionSortIndex(b[0], domain)
  );

  let sectionIndex = 0;
  for (const [section, rows] of sortedSections) {
    const currentSectionId = getSectionId(section);
    matrix.push({
      type: 'header',
      id: `section_${sectionIndex}`,
      label: section,
      sectionId: currentSectionId,
      cells: emptyCells(numInsurers),
    });

    rows.forEach((row, rowIndex) => {
      const dataRow: MatrixRow = {
        type: 'data',
        id: `section_${sectionIndex}_row_${rowIndex}`,
        label: row.label,
        sectionId: currentSectionId,
        ...(row.canonicalName !== undefined ? { canonicalName: row.canonicalName } : {}),
        ...(row.canonicalId !== undefined ? { canonicalId: row.canonicalId } : {}),
        ...(row.matchConfidence !== undefined ? { matchConfidence: row.matchConfidence } : {}),
        matchMethod: row.matchMethod,
        cells: row.cells.map((cell) =>
          cellFromFlatValueV2(
            cell.value,
            cell.notFound,
            cell.confidence,
            cell.notes,
            cell.rawTextSnippet,
            cell.pageNumber
          )
        ),
      };
      matrix.push(dataRow);
    });

    sectionIndex++;
  }

  // Warnings
  if (result.warnings.length > 0) {
    matrix.push({
      type: 'spacer',
      id: 'spacer_warnings',
      label: '',
      sectionId: ADDITIONAL_SECTION_ID,
      cells: emptyCells(numInsurers),
    });
    matrix.push({
      type: 'header',
      id: 'warnings',
      label: '⚠️ ALERTAS',
      sectionId: ADDITIONAL_SECTION_ID,
      cells: emptyCells(numInsurers),
    });
    result.warnings.forEach((warning, index) => {
      matrix.push({
        type: 'data',
        id: `warning_${index}`,
        label: warning,
        sectionId: ADDITIONAL_SECTION_ID,
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
export function quotesToMatrixRows(
  quotes: ParsedQuote[],
  domain: InsuranceDomain = 'pyme'
): MatrixRow[] {
  const numInsurers = quotes.length;
  const matrix: MatrixRow[] = [];

  matrix.push({
    type: 'header',
    id: 'client_info',
    label: `Cotizaciones ${getDomainHeaderLabel(domain)} - ${quotes.map((q) => q.insurerName).join(', ')}`,
    sectionId: HEADER_SECTION_ID,
    cells: emptyCells(numInsurers),
  });

  matrix.push({
    type: 'header',
    id: 'section_0',
    label: domain === 'pyme' ? 'COBERTURAS' : 'COBERTURAS',
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

// ---------------------------------------------------------------------------
// v3 transformer (renewal mode): v2 matrix + "Póliza Actual" baseline column
// ---------------------------------------------------------------------------

function normalizeForBaselineMatch(value: string): string {
  return value.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
}

function findBaselineCoverage(
  referenceQuote: ParsedQuote,
  rowLabel: string
): ParsedQuote['coverages'][number] | undefined {
  const normalizedLabel = normalizeForBaselineMatch(rowLabel);
  return referenceQuote.coverages.find((coverage) => {
    const candidate = normalizeForBaselineMatch(coverage.canonicalName || coverage.name);
    return (
      candidate === normalizedLabel ||
      candidate.includes(normalizedLabel) ||
      normalizedLabel.includes(candidate)
    );
  });
}

const PREMIUM_ROW_PATTERN = /prima|total|pagar/i;

function baselineCellForRow(row: MatrixRow, referenceQuote: ParsedQuote): MatrixCell {
  if (row.type !== 'data' || row.id.startsWith('warning_')) {
    return { value: '', isExcluded: false, isWinner: false, isBaseline: true };
  }

  if (row.sectionId === FINANCIAL_SECTION_ID && PREMIUM_ROW_PATTERN.test(row.label)) {
    return referenceQuote.priceAnnual > 0
      ? {
          value: formatCOP(referenceQuote.priceAnnual),
          isExcluded: false,
          isWinner: false,
          isBaseline: true,
        }
      : { value: 'No informado', isExcluded: true, isWinner: false, isBaseline: true };
  }

  const coverage = findBaselineCoverage(referenceQuote, row.label);
  if (!coverage || !coverage.value || coverage.value === 'NO ESPECIFICADO') {
    return { value: 'No informado', isExcluded: true, isWinner: false, isBaseline: true };
  }
  return {
    value: coverage.value,
    isExcluded: false,
    isWinner: false,
    isBaseline: true,
    notes: coverage.deductible ?? undefined,
    confidence: coverage.confidence !== undefined ? coverage.confidence / 100 : undefined,
  };
}

/**
 * Build the renewal-mode (schemaVersion 3) matrix: the v2 matrix plus a
 * leading "Póliza Actual" baseline column sourced from the incumbent
 * reference quote. Every row is flagged `isBaseline` and gains a leading
 * baseline cell; a marker header row (`baseline_column`) lets consumers
 * render the baseline badge. Without a reference quote the output is the
 * plain v2 matrix (v1/v2 consumers stay untouched — R5.1/R5.2).
 */
export function flatResultToMatrixRowsV3(
  result: FlatComparisonResultV2,
  domain: InsuranceDomain = 'pyme',
  referenceQuote?: ParsedQuote | null
): MatrixRow[] {
  const matrix = flatResultToMatrixRowsV2(result, domain);
  if (!referenceQuote) return matrix;

  const withBaseline: MatrixRow[] = matrix.map((row) => ({
    ...row,
    isBaseline: true,
    cells: [baselineCellForRow(row, referenceQuote), ...row.cells],
  }));

  const numColumns = result.insurers.length + 1;
  const markerIndex = withBaseline.findIndex((row) => row.id === 'client_info');
  const markerRow: MatrixRow = {
    type: 'header',
    id: 'baseline_column',
    label: `Póliza Actual - ${referenceQuote.insurerName}`,
    sectionId: HEADER_SECTION_ID,
    isBaseline: true,
    cells: [
      { value: referenceQuote.insurerName, isExcluded: false, isWinner: false, isBaseline: true },
      ...emptyCells(numColumns - 1),
    ],
  };

  const clientHeader = withBaseline[markerIndex];
  if (clientHeader) {
    clientHeader.label = `${clientHeader.label.split(' - ')[0]} - ${referenceQuote.insurerName} (Póliza Actual), ${result.insurers.join(', ')}`;
  }

  withBaseline.splice(markerIndex >= 0 ? markerIndex + 1 : 0, 0, markerRow);
  return withBaseline;
}

// ---------------------------------------------------------------------------
// Canonical PYME template & QuoteAnalysis matrix transformation (Excel / legacy)
// ---------------------------------------------------------------------------
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
    canonicalName: 'Responsabilidad Civil Extracontractual (RCE)',
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
  const parsedCurrency = parseColombianCurrency(val);
  if (parsedCurrency !== null && parsedCurrency > 0) {
    return Math.round(parsedCurrency);
  }
  // Extract numbers, ignoring formatting and stripping trailing decimal cents (.00 / ,00)
  const withoutTrailingCents = val.replace(/[,.]\d{1,2}(?!\d)/g, '');
  const cleaned = withoutTrailingCents.replace(/[^0-9]/g, '');
  if (!cleaned) return 0;
  return parseInt(cleaned, 10);
}

export function formatCurrency(num: number): string {
  if (num === 0) return 'No informado';
  return '$' + num.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

const SMMLV_2026 = Number(process.env.SMMLV_VALUE) || 1750905;

export function enrichSmmlvDeductible(text: string | undefined | null): string {
  if (!text) return 'Según amparo principal';
  if (text.includes('($')) return text; // Already enriched

  return text.replace(
    /(\d+(?:\.\d+)?)\s*(?:S\.?M\.?M\.?L\.?V\.?|salarios?\s+mínimos?|smmlv)/gi,
    (match, numStr) => {
      const num = parseFloat(numStr);
      if (!isNaN(num) && num > 0) {
        const copVal = Math.round(num * SMMLV_2026);
        const formattedCop = '$' + copVal.toLocaleString('es-CO');
        return `${match} (${formattedCop} COP)`;
      }
      return match;
    }
  );
}

export function formatMatrixValue(val: string | undefined | null): string {
  if (!val) return 'No informado';
  if (isExcludedValue(val)) return val;

  // Preserves text like "Incluido", "No aplica", deductibles, etc.
  if (!/^[\s$.,\d]+$/.test(val)) return val;

  const numericVal = parseNumericValue(val);
  if (numericVal <= 0) return val;

  return formatCurrency(numericVal);
}

export function getCategoryConfigsForDomain(domain: string = 'pyme'): CategoryConfig[] {
  const d = (domain || 'pyme').toLowerCase();
  if (d === 'pyme') {
    return CATEGORY_CONFIGS;
  }

  try {
    if (hasDomainSpecificFile(d, 'taxonomy.json')) {
      const taxonomy: any = loadDomainJson(d, 'taxonomy.json');

      if (taxonomy && Array.isArray(taxonomy.categories) && taxonomy.categories.length > 0) {
        return taxonomy.categories.map((cat: any, idx: number) => ({
          id: cat.id,
          canonicalName: cat.name,
          headerLabel: String(cat.section || cat.name).toUpperCase(),
          rows: [
            { label: 'Valor Asegurado', field: 'value' as const },
            { label: 'Deducible', field: 'deductible' as const },
            { label: 'Incluye / Sublímites', field: 'details' as const },
          ],
        }));
      }
    }
  } catch (err) {
    console.warn(
      `[MatrixTransformer] Dynamic taxonomy load failed for ${domain}, using PYME fallback`,
      err
    );
  }

  return CATEGORY_CONFIGS;
}

export function transformQuotesToMatrix(
  quotes: QuoteAnalysis[],
  domain: string = 'pyme'
): MatrixRow[] {
  const matrix: MatrixRow[] = [];
  const numQuotes = quotes.length;
  const activeCategoryConfigs = getCategoryConfigsForDomain(domain);

  let catIdx = 1;
  for (const config of activeCategoryConfigs) {
    const secId = typeof config.id === 'number' ? config.id : catIdx++;
    matrix.push({
      type: 'header',
      id: `section_${secId}`,
      label: config.headerLabel,
      sectionId: secId,
      cells: quotes.map(() => ({ value: '', isExcluded: false, isWinner: false })),
    });

    // Add Data Rows (Valor Asegurado, Deducible, Incluye)
    for (const rowConfig of config.rows) {
      const cells: MatrixCell[] = [];

      for (let i = 0; i < numQuotes; i++) {
        const quote = quotes[i]!;
        // Match coverage item semantically or by categoryId
        const cov = quote.coverages.find(
          (c) =>
            (String(c.categoryId) === String(config.id) ||
              (c.canonicalName &&
                c.canonicalName.toLowerCase() === config.canonicalName.toLowerCase()) ||
              (c.name && c.name.toLowerCase() === config.canonicalName.toLowerCase())) &&
            (c.matchConfidence === undefined ||
              c.matchConfidence === null ||
              c.matchConfidence >= 0.5)
        );

        if (cov) {
          let cellValue = '';
          if (rowConfig.field === 'value') {
            cellValue = formatMatrixValue(cov.value || 'No incluida');
          } else if (rowConfig.field === 'deductible') {
            const rawDed = cov.deductible;
            cellValue =
              rawDed && rawDed !== cov.value
                ? enrichSmmlvDeductible(rawDed)
                : 'Según amparo principal';
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
      const repName = groupItems[0]!.item.canonicalName || groupItems[0]!.item.name;

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
    if ((q as any).expenses !== undefined) return (q as any).expenses;
    if ((q as any).fees !== undefined) return (q as any).fees;
    if (q.insurerName.toLowerCase().includes('mapfre')) return 10000;
    if (q.insurerName.toLowerCase().includes('chubb')) return 12000;
    return 0;
  });
  const subtotals = netPremiums.map((net, idx) => net + expenses[idx]!);
  const ivas = subtotals.map((sub) => Math.round(sub * 0.19));
  const totals = subtotals.map((sub, idx) => sub + ivas[idx]!);

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
      value: netPremiums[idx]! > 0 ? formatCurrency(netPremiums[idx]!) : 'No informada',
      isExcluded: netPremiums[idx]! === 0,
      isWinner:
        netPremiums[idx]! > 0 &&
        netPremiums[idx]! === Math.min(...netPremiums.filter((n) => n > 0)),
    })),
  });

  // Row: Gastos de Expedición
  matrix.push({
    type: 'data',
    id: 'financial_expenses',
    label: 'Gastos de Expedición',
    sectionId: 100,
    cells: quotes.map((q, idx) => ({
      value: netPremiums[idx]! > 0 ? formatCurrency(expenses[idx]!) : 'No informado',
      isExcluded: netPremiums[idx]! === 0,
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
      value: netPremiums[idx]! > 0 ? formatCurrency(subtotals[idx]!) : 'No informado',
      isExcluded: netPremiums[idx]! === 0,
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
      value: netPremiums[idx]! > 0 ? formatCurrency(ivas[idx]!) : 'No informado',
      isExcluded: netPremiums[idx]! === 0,
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
      value: netPremiums[idx]! > 0 ? formatCurrency(totals[idx]!) : 'No informado',
      isExcluded: netPremiums[idx]! === 0,
      isWinner: netPremiums[idx]! > 0 && totals[idx]! === minTotal,
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
      const ratio = totals[idx]! / maxAsset;
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
      const dateStr =
        (q as any).quoteDate ||
        (q as any).metadata?.quoteDate ||
        (q as any).date ||
        'No informada';
      return { value: dateStr, isExcluded: dateStr === 'No informada', isWinner: false };
    }),
  });

  return matrix;
}

/**
 * Convert a UnifiedComparisonResult (e.g. from Deep Mode validation) into MatrixRow[].
 */
export function unifiedResultToMatrixRows(
  result: UnifiedComparisonResult,
  domain: InsuranceDomain = 'pyme'
): MatrixRow[] {
  const numInsurers = result.insurers?.length || 0;
  const matrix: MatrixRow[] = [];

  // Header row
  const insurerNames = result.insurers?.map((i) => i.name).join(', ') || 'Aseguradoras';
  matrix.push({
    type: 'header',
    id: 'client_info',
    label: `Cotizaciones ${getDomainHeaderLabel(domain)} - ${insurerNames}`,
    sectionId: HEADER_SECTION_ID,
    cells: emptyCells(numInsurers),
  });

  // Coverage categories and rows
  result.coverageMatrix?.forEach((category, catIdx) => {
    matrix.push({
      type: 'header',
      id: `section_cat_${catIdx}`,
      label: category.category,
      sectionId: COVERAGE_SECTION_ID,
      cells: emptyCells(numInsurers),
    });

    category.rows?.forEach((row, rowIdx) => {
      matrix.push({
        type: 'data',
        id: `cov_${catIdx}_${rowIdx}`,
        label: row.label,
        sectionId: row.type === 'deductible' ? DEDUCTIBLE_SECTION_ID : COVERAGE_SECTION_ID,
        cells: row.cells.map((cell) => {
          const val = cell.value;
          const isMissing = !val || val === 'No incluido' || val === 'N/A' || val === 'No informado';
          return {
            value: isMissing ? 'No informado' : val,
            rawText: cell.rawText,
            notes: cell.notes,
            confidence: cell.confidence ?? (cell.isAmbiguous ? 0.5 : 0.85),
            isExcluded: isMissing,
            isWinner: false,
          };
        }),
      });
    });
  });

  // Financial section (if present)
  if (result.financials?.premiums?.length) {
    matrix.push({
      type: 'header',
      id: 'section_financials',
      label: FINANCIAL_SECTION_LABEL,
      sectionId: FINANCIAL_SECTION_ID,
      cells: emptyCells(numInsurers),
    });

    const netPremiums = result.financials.premiums.map((p) =>
      p.netPremium !== null && p.netPremium !== undefined ? formatCurrency(p.netPremium) : 'No disponible'
    );
    matrix.push({
      type: 'data',
      id: 'fin_net_premium',
      label: 'Prima Neta',
      sectionId: FINANCIAL_SECTION_ID,
      cells: netPremiums.map((val) => ({
        ...cellFromFlatValue(val, val === 'No disponible'),
        confidence: 0.95,
      })),
    });

    const totalPremiums = result.financials.premiums.map((p) =>
      p.total !== null && p.total !== undefined ? formatCurrency(p.total) : 'No disponible'
    );
    matrix.push({
      type: 'data',
      id: 'fin_total_premium',
      label: 'Prima Total (Inc. IVA)',
      sectionId: FINANCIAL_SECTION_ID,
      cells: totalPremiums.map((val) => ({
        ...cellFromFlatValue(val, val === 'No disponible'),
        confidence: 0.95,
      })),
    });
  }

  return matrix;
}

// ---------------------------------------------------------------------------
// Insurer and Matrix Column Alignment Utilities
// ---------------------------------------------------------------------------

/**
 * Extract the ordered insurer names encoded in the matrix header row.
 * The unified engine emits a top header of the form:
 *   "Cotizaciones PYME - Insurer A, Insurer B"
 */
export function extractMatrixInsurers(matrixRows: MatrixRow[]): string[] {
  const header = matrixRows.find((row) => row.type === 'header' && row.id === 'client_info');
  if (!header?.label) return [];
  const separator = ' - ';
  const idx = header.label.indexOf(separator);
  if (idx < 0) return [];
  return header.label
    .slice(idx + separator.length)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export function normalizeInsurerName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

export function longestCommonSubstringLength(a: string, b: string): number {
  if (a.length === 0 || b.length === 0) return 0;
  const matrix: number[][] = Array.from({ length: a.length + 1 }, () =>
    Array(b.length + 1).fill(0)
  );
  let max = 0;

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      if (a[i - 1] === b[j - 1]) {
        matrix[i]![j] = matrix[i - 1]![j - 1]! + 1;
        max = Math.max(max, matrix[i]![j]!);
      }
    }
  }

  return max;
}

/**
 * Map each quote-file insurer to the index of the matching matrix column.
 * Falls back to positional assignment for unclaimed columns when a filename is generic.
 */
export function alignInsurerIndices(quoteInsurers: string[], matrixInsurers: string[]): number[] {
  if (matrixInsurers.length === 0) {
    return quoteInsurers.map(() => -1);
  }

  const normalizedMatrix = matrixInsurers.map((name) => normalizeInsurerName(name));
  const canonicalMatrix = matrixInsurers.map((name) => extractCanonicalInsurerName(name));
  const normalizedQuotes = quoteInsurers.map((name) => normalizeInsurerName(name));
  const canonicalQuotes = quoteInsurers.map((name) => extractCanonicalInsurerName(name));

  const result = new Array<number>(quoteInsurers.length).fill(-1);
  const usedMatrixIndices = new Set<number>();

  // Pass 1: Exact normalized match or canonical insurer brand match
  for (let qIdx = 0; qIdx < quoteInsurers.length; qIdx++) {
    const normQuote = normalizedQuotes[qIdx]!;
    const canonQuote = canonicalQuotes[qIdx]!;
    const isKnownQuote = isKnownCanonicalInsurer(canonQuote);

    for (let mIdx = 0; mIdx < matrixInsurers.length; mIdx++) {
      if (usedMatrixIndices.has(mIdx)) continue;
      if (
        (normQuote.length > 0 && normalizedMatrix[mIdx] === normQuote) ||
        (isKnownQuote && canonicalMatrix[mIdx] === canonQuote)
      ) {
        result[qIdx] = mIdx;
        usedMatrixIndices.add(mIdx);
        break;
      }
    }
  }

  // Pass 2: Longest common substring match (>= 3 chars) on remaining unclaimed columns
  for (let qIdx = 0; qIdx < quoteInsurers.length; qIdx++) {
    if (result[qIdx] !== -1) continue;
    const normQuote = normalizedQuotes[qIdx]!;
    let bestIndex = -1;
    let bestScore = 0;

    for (let mIdx = 0; mIdx < normalizedMatrix.length; mIdx++) {
      if (usedMatrixIndices.has(mIdx)) continue;
      const matrixName = normalizedMatrix[mIdx]!;
      const score = longestCommonSubstringLength(normQuote, matrixName);
      if (score > bestScore && score >= 3) {
        bestScore = score;
        bestIndex = mIdx;
      }
    }

    if (bestIndex !== -1) {
      result[qIdx] = bestIndex;
      usedMatrixIndices.add(bestIndex);
    }
  }

  // Pass 3: Positional fallback for generic filenames or unmapped aliases
  for (let qIdx = 0; qIdx < quoteInsurers.length; qIdx++) {
    if (result[qIdx] !== -1) continue;

    if (qIdx < matrixInsurers.length && !usedMatrixIndices.has(qIdx)) {
      result[qIdx] = qIdx;
      usedMatrixIndices.add(qIdx);
      continue;
    }

    for (let mIdx = 0; mIdx < matrixInsurers.length; mIdx++) {
      if (!usedMatrixIndices.has(mIdx)) {
        result[qIdx] = mIdx;
        usedMatrixIndices.add(mIdx);
        break;
      }
    }
  }

  return result;
}

/**
 * Align matrix cells to match the exact sequence of quotes.
 * Ensures 1:1 parity between quote columns (scorecard/summary) and matrix columns across Web and Excel.
 */
export function alignMatrixRowsToQuotes(
  matrixRows: MatrixRow[],
  quotes: Array<{ insurerName: string }>,
  domain: InsuranceDomain = 'pyme'
): MatrixRow[] {
  if (!matrixRows || matrixRows.length === 0 || !quotes || quotes.length === 0) {
    return matrixRows;
  }

  const matrixInsurers = extractMatrixInsurers(matrixRows);
  if (matrixInsurers.length === 0) {
    return matrixRows;
  }

  const quoteInsurers = quotes.map((q) => q.insurerName);
  const indices = alignInsurerIndices(quoteInsurers, matrixInsurers);

  // If already identically aligned and names match, return unchanged
  const isMisaligned = indices.some((srcIdx, targetIdx) => srcIdx !== targetIdx);
  const isRenamed = quotes.some(
    (q, idx) =>
      normalizeInsurerName(q.insurerName) !== normalizeInsurerName(matrixInsurers[idx] || '')
  );
  if (!isMisaligned && !isRenamed) {
    return matrixRows;
  }

  const headerPrefix = `Cotizaciones ${getDomainHeaderLabel(domain)} - `;

  return matrixRows.map((row) => {
    if (!row.cells || row.cells.length === 0) return row;

    const reorderedCells = indices.map((srcIdx) =>
      srcIdx >= 0 && row.cells[srcIdx]
        ? row.cells[srcIdx]!
        : { value: '', isExcluded: false, isWinner: false }
    );

    if (row.type === 'header' && row.id === 'client_info') {
      return {
        ...row,
        label: `${headerPrefix}${quotes.map((q) => q.insurerName).join(', ')}`,
        cells: reorderedCells,
      };
    }

    return {
      ...row,
      cells: reorderedCells,
    };
  });
}

