import { LayoutTable, LayoutCell } from '../schemas/templateRegistrySchema';
import {
  createStructuredLogger,
  globalMetrics,
  StructuredLogger,
  MetricCollector,
} from '../utils/structuredLogger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LayoutTextItem {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
}

export interface LayoutPage {
  page: number;
  items: LayoutTextItem[];
}

export interface LayoutRegion {
  page: number;
  type: 'table' | 'header' | 'footer' | 'body';
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  text?: string;
}

export interface LayoutParserResult {
  tables: LayoutTable[];
  regions: LayoutRegion[];
  rotatedPages: number[];
  failed: boolean;
  failureReason?: string;
}

export interface LayoutParserOptions {
  yToleranceFactor?: number;
  minYTolerance?: number;
  xTolerance?: number;
  headerTokens?: string[];
  minColumns?: number;
  rotationThresholdDegrees?: number;
  rotatedItemRatio?: number;
  tableGapFactor?: number;
  regionBandRatio?: number;
  logger?: StructuredLogger;
  metrics?: MetricCollector;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_HEADER_TOKENS = [
  'cobertura',
  'suma asegurada',
  'deducible',
  'prima',
  'amparo',
  'descripción',
  'descripcion',
  'monto',
  'valor asegurado',
];

const DEFAULT_OPTIONS: Required<LayoutParserOptions> = {
  yToleranceFactor: 0.6,
  minYTolerance: 2,
  xTolerance: 12,
  headerTokens: DEFAULT_HEADER_TOKENS,
  minColumns: 2,
  rotationThresholdDegrees: 5,
  rotatedItemRatio: 0.5,
  tableGapFactor: 3,
  regionBandRatio: 0.15,
  logger: undefined as unknown as StructuredLogger,
  metrics: undefined as unknown as MetricCollector,
};

function withDefaults(options?: LayoutParserOptions): Required<LayoutParserOptions> {
  return { ...DEFAULT_OPTIONS, ...options };
}

// ---------------------------------------------------------------------------
// Row clustering
// ---------------------------------------------------------------------------

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function rowCenter(row: LayoutTextItem[]): number {
  return row.reduce((sum, item) => sum + item.y + item.height / 2, 0) / row.length;
}

export function clusterRows(items: LayoutTextItem[], yTolerance: number): LayoutTextItem[][] {
  if (items.length === 0) return [];

  const sorted = [...items].sort((a, b) => a.y - b.y);
  const rows: LayoutTextItem[][] = [];

  for (const item of sorted) {
    let placed = false;
    for (const row of rows) {
      const center = rowCenter(row);
      if (Math.abs(item.y + item.height / 2 - center) <= yTolerance) {
        row.push(item);
        placed = true;
        break;
      }
    }
    if (!placed) {
      rows.push([item]);
    }
  }

  // Sort each row left-to-right and the rows top-to-bottom (PDF y ascends,
  // so larger y is higher on the page).
  for (const row of rows) {
    row.sort((a, b) => a.x - b.x);
  }
  rows.sort((a, b) => rowCenter(b) - rowCenter(a));

  return rows;
}

// ---------------------------------------------------------------------------
// Column boundary derivation
// ---------------------------------------------------------------------------

export function deriveColumnBoundaries(rows: LayoutTextItem[][], xTolerance: number): number[] {
  if (rows.length === 0) return [];

  const leftEdges: number[] = [];
  for (const row of rows) {
    for (const item of row) {
      leftEdges.push(item.x);
    }
  }
  if (leftEdges.length === 0) return [];

  leftEdges.sort((a, b) => a - b);

  const clusters: number[][] = [[leftEdges[0]]];
  for (let i = 1; i < leftEdges.length; i++) {
    const current = leftEdges[i];
    const lastCluster = clusters[clusters.length - 1];
    if (current - lastCluster[lastCluster.length - 1] <= xTolerance) {
      lastCluster.push(current);
    } else {
      clusters.push([current]);
    }
  }

  // Column boundary = average left edge of the cluster.
  return clusters.map((cluster) => cluster.reduce((a, b) => a + b, 0) / cluster.length);
}

function nearestColumnIndex(x: number, boundaries: number[]): number {
  let best = 0;
  let bestDist = Math.abs(x - boundaries[0]);
  for (let i = 1; i < boundaries.length; i++) {
    const dist = Math.abs(x - boundaries[i]);
    if (dist < bestDist) {
      bestDist = dist;
      best = i;
    }
  }
  return best;
}

function assignRowToColumns(
  row: LayoutTextItem[],
  boundaries: number[]
): (LayoutCell | undefined)[] {
  const cells: (LayoutCell | undefined)[] = new Array(boundaries.length).fill(undefined);
  for (const item of row) {
    const idx = nearestColumnIndex(item.x, boundaries);
    cells[idx] = {
      text: item.text,
      x: item.x,
      y: item.y,
      width: item.width,
      height: item.height,
    };
  }
  return cells;
}

// ---------------------------------------------------------------------------
// Header / table detection
// ---------------------------------------------------------------------------

export function detectTableHeader(rowTexts: string[], headerTokens: string[]): boolean {
  const normalized = rowTexts.join(' ').toLowerCase();
  return headerTokens.some((token) => normalized.includes(token.toLowerCase()));
}

function splitIntoTableBlocks(
  rows: LayoutTextItem[][],
  boundaries: number[],
  options: Required<LayoutParserOptions>
): LayoutTextItem[][][] {
  const blocks: LayoutTextItem[][][] = [];
  let current: LayoutTextItem[][] = [];
  let lastY: number | null = null;

  const gapThreshold = options.xTolerance * options.tableGapFactor + options.xTolerance;

  for (const row of rows) {
    const cells = assignRowToColumns(row, boundaries);
    const populated = cells.filter(Boolean).length;
    if (populated < options.minColumns) {
      if (current.length > 0) {
        blocks.push(current);
        current = [];
        lastY = null;
      }
      continue;
    }

    const center = rowCenter(row);
    if (lastY !== null && Math.abs(center - lastY) > gapThreshold) {
      blocks.push(current);
      current = [];
    }

    current.push(row);
    lastY = center;
  }

  if (current.length > 0) {
    blocks.push(current);
  }

  return blocks;
}

function buildTable(
  pageNumber: number,
  block: LayoutTextItem[][],
  boundaries: number[],
  options: Required<LayoutParserOptions>
): LayoutTable {
  let headerRow: LayoutCell[] | undefined;
  let bodyRows: LayoutTextItem[][] = block;

  if (block.length > 0) {
    const firstRowTexts = block[0].map((item) => item.text);
    if (detectTableHeader(firstRowTexts, options.headerTokens)) {
      headerRow = assignRowToColumns(block[0], boundaries).filter(
        (c): c is LayoutCell => c !== undefined
      );
      bodyRows = block.slice(1);
    }
  }

  const rows: LayoutCell[][] = [];
  const mergedCells: LayoutCell[] = [];

  for (let r = 0; r < bodyRows.length; r++) {
    const cells = assignRowToColumns(bodyRows[r], boundaries);
    const rowCells: LayoutCell[] = [];
    for (let c = 0; c < cells.length; c++) {
      const cell = cells[c];
      if (!cell) {
        continue;
      }
      rowCells.push(cell);

      // Detect merged cells: same text in the same column in consecutive rows.
      if (r > 0) {
        const prev = rows[r - 1]?.find(
          (prevCell) => boundaries.findIndex((b) => Math.abs(prevCell.x - b) < 0.5) === c
        );
        if (prev && prev.text === cell.text) {
          mergedCells.push(prev);
        }
      }
    }
    rows.push(rowCells);
  }

  const allItems = block.flat();
  const minX = Math.min(...allItems.map((i) => i.x));
  const maxX = Math.max(...allItems.map((i) => i.x + i.width));
  const minY = Math.min(...allItems.map((i) => i.y));
  const maxY = Math.max(...allItems.map((i) => i.y + i.height));

  return {
    page: pageNumber,
    bounds: {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
    },
    headers: headerRow ?? [],
    rows,
    mergedCells: mergedCells.length > 0 ? mergedCells : undefined,
  };
}

// ---------------------------------------------------------------------------
// Region detection
// ---------------------------------------------------------------------------

function detectRegions(
  page: LayoutPage,
  tables: LayoutTable[],
  options: Required<LayoutParserOptions>
): LayoutRegion[] {
  if (page.items.length === 0) return [];

  const minY = Math.min(...page.items.map((i) => i.y));
  const maxY = Math.max(...page.items.map((i) => i.y + i.height));
  const height = maxY - minY;
  const band = height * options.regionBandRatio;

  const tableRegions: LayoutRegion[] = tables.map((table) => ({
    page: page.page,
    type: 'table',
    bounds: { ...table.bounds },
    text: table.headers.map((h) => h.text).join(' '),
  }));

  const headerBand = { y: maxY - band, height: band };
  const footerBand = { y: minY, height: band };

  const headerItems = page.items.filter((i) => i.y + i.height >= headerBand.y);
  const footerItems = page.items.filter((i) => i.y < footerBand.y + footerBand.height);
  const bodyItems = page.items.filter(
    (i) => i.y + i.height < headerBand.y && i.y >= footerBand.y + footerBand.height
  );

  function regionOf(
    type: LayoutRegion['type'],
    items: LayoutTextItem[],
    text: string
  ): LayoutRegion | undefined {
    if (items.length === 0) return undefined;
    const minX = Math.min(...items.map((i) => i.x));
    const maxX = Math.max(...items.map((i) => i.x + i.width));
    const minY = Math.min(...items.map((i) => i.y));
    const maxY = Math.max(...items.map((i) => i.y + i.height));
    return {
      page: page.page,
      type,
      bounds: {
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY,
      },
      text,
    };
  }

  const headerRegion = regionOf('header', headerItems, headerItems.map((i) => i.text).join(' '));
  const footerRegion = regionOf('footer', footerItems, footerItems.map((i) => i.text).join(' '));
  const bodyRegion = regionOf('body', bodyItems, bodyItems.map((i) => i.text).join(' '));

  return [
    ...tableRegions,
    ...(headerRegion ? [headerRegion] : []),
    ...(bodyRegion ? [bodyRegion] : []),
    ...(footerRegion ? [footerRegion] : []),
  ];
}

// ---------------------------------------------------------------------------
// Rotation detection
// ---------------------------------------------------------------------------

export function detectRotatedPages(
  pages: LayoutPage[],
  thresholdDegrees?: number,
  rotatedItemRatio?: number
): number[] {
  const deg = thresholdDegrees ?? DEFAULT_OPTIONS.rotationThresholdDegrees;
  const ratio = rotatedItemRatio ?? DEFAULT_OPTIONS.rotatedItemRatio;
  const rotated: number[] = [];

  for (const page of pages) {
    if (page.items.length === 0) continue;
    const rotatedCount = page.items.filter(
      (item) => Math.abs((item.rotation ?? 0) % 360) > deg
    ).length;
    if (rotatedCount / page.items.length >= ratio) {
      rotated.push(page.page);
    }
  }

  return rotated;
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

export function extractTables(
  pages: LayoutPage[],
  options?: LayoutParserOptions
): LayoutParserResult {
  const opts = withDefaults(options);
  const logger = options?.logger ?? createStructuredLogger('layoutParser');
  const metrics = options?.metrics ?? globalMetrics;

  const result: LayoutParserResult = {
    tables: [],
    regions: [],
    rotatedPages: detectRotatedPages(pages, opts.rotationThresholdDegrees, opts.rotatedItemRatio),
    failed: false,
  };

  function fail(reason: string, reasonTag: string): LayoutParserResult {
    result.failed = true;
    result.failureReason = reason;
    logger.warn('layout_parse_failed', 'Layout parsing failed', {
      reason,
      pageCount: pages.length,
      rotatedPages: result.rotatedPages,
    });
    metrics.increment('layoutParser.failure', { reason: reasonTag });
    return result;
  }

  if (pages.length === 0 || pages.every((p) => p.items.length === 0)) {
    return fail('No text items found in any page', 'empty');
  }

  if (result.rotatedPages.length > 0) {
    return fail(`rotated pages detected: ${result.rotatedPages.join(', ')}`, 'rotation');
  }

  for (const page of pages) {
    if (page.items.length === 0) continue;

    const heights = page.items.map((i) => i.height);
    const medianHeight = median(heights);
    const yTolerance = Math.max(opts.minYTolerance, medianHeight * opts.yToleranceFactor);

    const rows = clusterRows(page.items, yTolerance);
    const boundaries = deriveColumnBoundaries(rows, opts.xTolerance);

    if (boundaries.length < opts.minColumns) {
      result.failed = true;
      result.failureReason = `Insufficient columns detected on page ${page.page}: ${boundaries.length}`;
      logger.warn('layout_parse_failed', 'Layout parsing failed', {
        reason: result.failureReason,
        page: page.page,
        columnCount: boundaries.length,
      });
      metrics.increment('layoutParser.failure', { reason: 'insufficient_columns' });
      continue;
    }

    const blocks = splitIntoTableBlocks(rows, boundaries, opts);
    const pageTables = blocks
      .filter((block) => block.length >= 1)
      .map((block) => buildTable(page.page, block, boundaries, opts));

    result.tables.push(...pageTables);
    result.regions.push(...detectRegions(page, pageTables, opts));

    if (pageTables.length > 0) {
      logger.info('layout_parse_success', 'Layout parsed successfully', {
        page: page.page,
        tableCount: pageTables.length,
        columnCount: boundaries.length,
      });
      metrics.increment('layoutParser.success', { page: page.page });
    }
  }

  if (result.tables.length === 0 && !result.failed) {
    return fail('No tables could be reconstructed', 'no_tables');
  }

  if (result.failed && !result.failureReason) {
    result.failureReason = 'Layout parsing failed';
  }

  if (result.failed) {
    console.warn(`⚠️ [layoutParser] ${result.failureReason}`);
  }

  return result;
}

export default extractTables;
