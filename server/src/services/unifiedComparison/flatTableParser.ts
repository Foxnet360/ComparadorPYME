/**
 * Flat Table Parser
 * Normalizes Markdown, CSV, JSON, and key-value LLM outputs into the
 * FlatComparisonSchema shape (4 rows × N insurers).
 */

import { FlatComparisonSchema, type FlatComparisonResult } from './comparisonSchema';
import { parseJsonWithRepair } from '../jsonRepair';

export const FLAT_ROW_LABELS = [
  'Bienes Asegurados',
  'Deducibles',
  'Prima con IVA',
  'Forma de Pago',
] as const;

type RowValues = string[];

interface RawTable {
  insurers: string[];
  rows: Map<string, RowValues>;
  extraRows: Map<string, RowValues>;
}

export interface ParseOptions {
  generatedAt?: string;
  model?: string;
  pdfCount?: number;
  processingTimeMs?: number;
  confidence?: number;
  needsHumanReview?: boolean;
}

export class FlatTableParseError extends Error {
  constructor(
    message: string,
    public readonly issues: Array<{ message: string }> = []
  ) {
    super(message);
    this.name = 'FlatTableParseError';
  }
}

// ---------------------------------------------------------------------------
// Row-label normalization (accent-tolerant, case-insensitive)
// ---------------------------------------------------------------------------

const ROW_LABEL_ALIASES = new Map<string, string>([
  ['bienes asegurados', 'Bienes Asegurados'],
  ['bienes', 'Bienes Asegurados'],
  ['deducibles', 'Deducibles'],
  ['deducible', 'Deducibles'],
  ['prima con iva', 'Prima con IVA'],
  ['prima total con iva', 'Prima con IVA'],
  ['prima', 'Prima con IVA'],
  ['forma de pago', 'Forma de Pago'],
  ['formadepago', 'Forma de Pago'],
  ['pago', 'Forma de Pago'],
]);

function normalizeLabel(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function mapRowLabel(label: string): string | undefined {
  const normalized = normalizeLabel(label);
  return ROW_LABEL_ALIASES.get(normalized);
}

// ---------------------------------------------------------------------------
// Format detection
// ---------------------------------------------------------------------------

function detectFormat(raw: string): 'markdown' | 'csv' | 'json' | 'kv' {
  const trimmed = raw.trim();

  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    return 'json';
  }

  const lines = trimmed
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.some((line) => line.startsWith('|') && line.endsWith('|'))) {
    return 'markdown';
  }

  if (lines.length >= 2 && inferCsvDelimiter(lines[0])) {
    return 'csv';
  }

  return 'kv';
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function padValues(values: string[], length: number): string[] {
  const result = values.slice(0, length);
  while (result.length < length) {
    result.push('');
  }
  return result;
}

function isEmptyValue(value: string | null): boolean {
  if (value === null || value === undefined) return true;
  return value.trim() === '' || value.trim().toLowerCase() === 'no informado';
}

function buildCell(insurer: string, rawValue: string | null | undefined) {
  const raw = rawValue ?? '';
  const notFound = isEmptyValue(raw);
  return {
    insurer,
    value: notFound ? 'No informado' : raw.trim(),
    rawText: rawValue ?? undefined,
    notFound: notFound || undefined,
  };
}

// ---------------------------------------------------------------------------
// Markdown parser
// ---------------------------------------------------------------------------

function splitMarkdownLine(line: string): string[] {
  return line
    .split('|')
    .slice(1, -1)
    .map((cell) => cell.trim());
}

function isMarkdownSeparator(line: string): boolean {
  const content = line.replace(/\|/g, '').trim();
  return /^[-\s:]+$/.test(content);
}

function parseMarkdown(raw: string): RawTable {
  const lines = raw
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('|') && line.endsWith('|'));

  if (lines.length < 2) {
    throw new Error('Markdown table must have at least a header and one data row');
  }

  const headerCells = splitMarkdownLine(lines[0]);
  // First header cell is the row-label column; remaining cells are insurers.
  const insurers = headerCells
    .slice(1)
    .map((cell) => cell.trim())
    .filter(Boolean);

  const rows = new Map<string, RowValues>();
  const extraRows = new Map<string, RowValues>();

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (isMarkdownSeparator(line)) continue;

    const cells = splitMarkdownLine(line);
    const label = cells[0]?.trim();
    if (!label) continue;

    const values = padValues(
      cells.slice(1).map((cell) => cell.trim()),
      insurers.length
    );
    const canonical = mapRowLabel(label);
    const target = canonical ? rows : extraRows;
    target.set(canonical || label, values);
  }

  return { insurers, rows, extraRows };
}

// ---------------------------------------------------------------------------
// CSV parser
// ---------------------------------------------------------------------------

function inferCsvDelimiter(line: string): ',' | ';' | null {
  const commas = (line.match(/,/g) || []).length;
  const semicolons = (line.match(/;/g) || []).length;

  if (commas === 0 && semicolons === 0) return null;
  return commas >= semicolons ? ',' : ';';
}

function parseCsvLine(line: string, delimiter: string): string[] {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === delimiter && !inQuotes) {
      cells.push(current.trim());
      current = '';
      continue;
    }

    current += char;
  }

  cells.push(current.trim());
  return cells;
}

function parseCsv(raw: string): RawTable {
  const lines = raw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length < 2) {
    throw new Error('CSV input must have at least a header and one data row');
  }

  const delimiter = inferCsvDelimiter(lines[0]);
  if (!delimiter) {
    throw new Error('Could not detect CSV delimiter');
  }

  const headerCells = parseCsvLine(lines[0], delimiter);
  const firstHeader = headerCells[0]?.trim() ?? '';
  const hasRowLabelColumn =
    firstHeader === '' || /^(fila|concepto|cobertura|row|label|rowlabel)$/i.test(firstHeader);

  const insurers = hasRowLabelColumn
    ? headerCells
        .slice(1)
        .map((cell) => cell.trim())
        .filter(Boolean)
    : headerCells.map((cell) => cell.trim()).filter(Boolean);

  const rows = new Map<string, RowValues>();
  const extraRows = new Map<string, RowValues>();

  for (let i = 1; i < lines.length; i++) {
    const cells = parseCsvLine(lines[i], delimiter);
    const label = hasRowLabelColumn ? cells[0]?.trim() : undefined;
    if (hasRowLabelColumn && !label) continue;

    const values = padValues(
      hasRowLabelColumn
        ? cells.slice(1).map((cell) => cell.trim())
        : cells.map((cell) => cell.trim()),
      insurers.length
    );

    if (hasRowLabelColumn) {
      const canonical = mapRowLabel(label!);
      const target = canonical ? rows : extraRows;
      target.set(canonical || label!, values);
    } else {
      // Without a row-label column we cannot map values; keep them as extra rows keyed by position.
      extraRows.set(`Fila ${i}`, values);
    }
  }

  return { insurers, rows, extraRows };
}

// ---------------------------------------------------------------------------
// JSON parser
// ---------------------------------------------------------------------------

function parseJson(raw: string): RawTable {
  const parseResult = parseJsonWithRepair(raw);
  if (!parseResult.success) {
    throw new Error(parseResult.error || 'JSON parsing failed');
  }

  const data = parseResult.data;

  if (Array.isArray(data)) {
    throw new Error('JSON array root is not supported');
  }

  if (typeof data !== 'object' || data === null) {
    throw new Error('JSON root must be an object');
  }

  if ('insurers' in data && Array.isArray(data.insurers)) {
    return parseJsonWithInsurersArray(data as Record<string, unknown>);
  }

  return parseJsonAsInsurerMap(data as Record<string, unknown>);
}

function extractCellValue(cell: unknown): string {
  if (cell === null || cell === undefined) return '';
  if (typeof cell === 'object') {
    if ('value' in cell) {
      const val = (cell as { value: unknown }).value;
      return val === null || val === undefined ? '' : String(val);
    }
    return '';
  }
  return String(cell);
}

function parseJsonWithInsurersArray(data: Record<string, unknown>): RawTable {
  const insurers = (data.insurers as unknown[]).map((item) => String(item).trim()).filter(Boolean);
  const inputRows = Array.isArray(data.rows) ? (data.rows as unknown[]) : [];

  const rows = new Map<string, RowValues>();
  const extraRows = new Map<string, RowValues>();

  for (const row of inputRows) {
    if (typeof row !== 'object' || row === null || !('label' in row)) continue;

    const label = String((row as { label: unknown }).label).trim();
    const canonical = mapRowLabel(label);
    const target = canonical ? rows : extraRows;
    const key = canonical || label;

    let values: string[] = [];
    if ('cells' in row && Array.isArray((row as { cells: unknown }).cells)) {
      const cells = (row as { cells: unknown[] }).cells;
      values = insurers.map((insurer) => {
        // Prefer object cells matched by insurer name.
        const matched = cells.find(
          (cell) =>
            typeof cell === 'object' &&
            cell !== null &&
            String((cell as { insurer?: unknown }).insurer).trim() === insurer
        );
        if (matched != null) {
          return extractCellValue(matched);
        }
        // Fall back to positional values.
        const idx = insurers.indexOf(insurer);
        return extractCellValue(cells[idx]);
      });
    }

    target.set(key, padValues(values, insurers.length));
  }

  return { insurers, rows, extraRows };
}

function parseJsonAsInsurerMap(data: Record<string, unknown>): RawTable {
  const entries = Object.entries(data).filter(([key]) => !key.startsWith('_'));
  const insurers = entries.map(([name]) => name);

  const rows = new Map<string, RowValues>();
  const extraRows = new Map<string, RowValues>();

  for (const canonicalLabel of FLAT_ROW_LABELS) {
    const values = insurers.map((insurer) => {
      const insurerObj = data[insurer];
      if (typeof insurerObj !== 'object' || insurerObj === null) return '';

      const matchedKey = Object.keys(insurerObj).find((key) => mapRowLabel(key) === canonicalLabel);
      if (!matchedKey) return '';

      const val = (insurerObj as Record<string, unknown>)[matchedKey];
      return val === null || val === undefined ? '' : String(val);
    });
    rows.set(canonicalLabel, values);
  }

  // Any key that does not map to a canonical row is treated as an extra row.
  for (const [insurer, insurerObj] of entries) {
    if (typeof insurerObj !== 'object' || insurerObj === null) continue;
    for (const [key, val] of Object.entries(insurerObj as Record<string, unknown>)) {
      if (mapRowLabel(key)) continue;
      const value = val === null || val === undefined ? '' : String(val);
      if (!extraRows.has(key)) {
        extraRows.set(
          key,
          insurers.map(() => '')
        );
      }
      const idx = insurers.indexOf(insurer);
      extraRows.get(key)![idx] = value;
    }
  }

  return { insurers, rows, extraRows };
}

// ---------------------------------------------------------------------------
// Key-value parser
// ---------------------------------------------------------------------------

function parseKeyValue(raw: string): RawTable {
  const lines = raw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const rows = new Map<string, Array<{ insurer: string; value: string }>>();
  const insurersSet = new Set<string>();
  let currentLabel: string | null = null;

  for (const line of lines) {
    const labelCandidate = line.replace(/[:：].*$/, '').trim();
    const canonical = mapRowLabel(labelCandidate);

    if (canonical) {
      currentLabel = canonical;
      continue;
    }

    if (!currentLabel) continue;

    const separatorMatch = line.match(/^([^:]+):\s*(.*)$/);
    if (!separatorMatch) continue;

    const insurer = separatorMatch[1].trim();
    const value = separatorMatch[2].trim();
    if (!insurer) continue;

    insurersSet.add(insurer);
    const entries = rows.get(currentLabel) || [];
    entries.push({ insurer, value });
    rows.set(currentLabel, entries);
  }

  const insurers = Array.from(insurersSet);
  if (insurers.length === 0) {
    throw new Error('Key-value input did not contain any insurer rows');
  }

  const alignedRows = new Map<string, RowValues>();
  for (const [label, entries] of rows.entries()) {
    alignedRows.set(
      label,
      insurers.map((insurer) => {
        const found = entries.find((entry) => entry.insurer === insurer);
        return found ? found.value : '';
      })
    );
  }

  return { insurers, rows: alignedRows, extraRows: new Map() };
}

// ---------------------------------------------------------------------------
// Result builder
// ---------------------------------------------------------------------------

function buildResult(
  rawTable: RawTable,
  options: ParseOptions = {},
  warnings: string[] = []
): FlatComparisonResult {
  const insurers = rawTable.insurers.filter(Boolean);
  if (insurers.length === 0) {
    throw new FlatTableParseError('No insurers detected in the table', []);
  }

  const rows = FLAT_ROW_LABELS.map((canonicalLabel) => {
    const values = rawTable.rows.get(canonicalLabel) || [];
    const padded = padValues(values, insurers.length);

    if (!rawTable.rows.has(canonicalLabel)) {
      warnings.push(`Fila no encontrada: ${canonicalLabel}; se completó con "No informado"`);
    }

    return {
      label: canonicalLabel,
      cells: insurers.map((insurer, index) => buildCell(insurer, padded[index])),
    };
  });

  const extraRows = Array.from(rawTable.extraRows.entries()).map(([label, values]) => ({
    label,
    cells: insurers.map((insurer, index) => ({
      insurer,
      value: paddedOrNull(values, index),
      rawText: paddedOrNull(values, index) ?? undefined,
    })),
  }));

  function paddedOrNull(values: RowValues, index: number): string | null {
    const value = values[index];
    return value === undefined || value === null || value.trim() === '' ? null : value;
  }

  const now = new Date().toISOString();
  const result: FlatComparisonResult = {
    metadata: {
      generatedAt: options.generatedAt ?? now,
      model: options.model ?? 'unknown',
      pdfCount: options.pdfCount ?? insurers.length,
      processingTimeMs: options.processingTimeMs ?? 0,
      confidence: options.confidence ?? 0,
      needsHumanReview: options.needsHumanReview ?? true,
    },
    insurers,
    schemaVersion: 1,
    rows,
    extraRows,
    warnings,
  };

  const validation = FlatComparisonSchema.safeParse(result);
  if (!validation.success) {
    throw new FlatTableParseError(
      'Parsed table failed schema validation',
      validation.error.issues.map((issue) => ({ message: issue.message }))
    );
  }

  return result;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export class FlatTableParser {
  parse(raw: string, options?: ParseOptions): FlatComparisonResult {
    const format = detectFormat(raw);
    let rawTable: RawTable;
    const warnings: string[] = [];

    try {
      switch (format) {
        case 'json':
          rawTable = parseJson(raw);
          break;
        case 'markdown':
          rawTable = parseMarkdown(raw);
          break;
        case 'csv':
          rawTable = parseCsv(raw);
          break;
        case 'kv':
          rawTable = parseKeyValue(raw);
          break;
      }
    } catch (error) {
      throw new FlatTableParseError(`Failed to parse flat ${format} table`, [
        { message: error instanceof Error ? error.message : String(error) },
      ]);
    }

    return buildResult(rawTable, options, warnings);
  }
}

export const flatTableParser = new FlatTableParser();
export default flatTableParser;
