/**
 * Flat Table Parser
 * Normalizes Markdown, CSV, JSON, and key-value LLM outputs into the
 * FlatComparisonSchema shape (4 rows × N insurers).
 */

import {
  FlatComparisonSchema,
  SchemaSection,
  type FlatComparisonResult,
  type FlatComparisonResultV2,
  type FlatComparisonCell,
  type StructuredDeductible,
} from './comparisonSchema';
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
  quoteMetadata?: any[];
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

// ---------------------------------------------------------------------------
// v2 alias normalization and section assignment
// ---------------------------------------------------------------------------

interface AliasEntry {
  aliases: string[];
  canonical: string;
  section: SchemaSection;
}

const ALIAS_MAP: AliasEntry[] = [
  {
    aliases: ['bienes asegurados'],
    canonical: 'Bienes Asegurados',
    section: SchemaSection.BIENES_ASEGURADOS,
  },
  {
    aliases: ['edificio', 'valor edificio'],
    canonical: 'Edificio',
    section: SchemaSection.BIENES_ASEGURADOS,
  },
  {
    aliases: ['contenidos', 'contenido'],
    canonical: 'Contenidos',
    section: SchemaSection.BIENES_ASEGURADOS,
  },
  {
    aliases: ['mercancias', 'mercaderias'],
    canonical: 'Mercancías',
    section: SchemaSection.BIENES_ASEGURADOS,
  },
  {
    aliases: ['muebles y enseres', 'muebles y enseres domesticos', 'muebles'],
    canonical: 'Muebles y enseres',
    section: SchemaSection.BIENES_ASEGURADOS,
  },
  {
    aliases: ['maquinaria y equipo', 'maquinaria', 'equipos y maquinaria'],
    canonical: 'Maquinaria y equipo',
    section: SchemaSection.BIENES_ASEGURADOS,
  },
  {
    aliases: [
      'equipo electrico y electronico',
      'equipo electrico',
      'eq. electrico',
      'eee',
      'equipo electronico',
    ],
    canonical: 'Equipo eléctrico y electrónico',
    section: SchemaSection.BIENES_ASEGURADOS,
  },
  {
    aliases: ['asistencia', 'servicios de asistencia'],
    canonical: 'Asistencia',
    section: SchemaSection.BIENES_ASEGURADOS,
  },
  {
    aliases: [
      'amparo basico todo riesgo',
      'amparo basico',
      'todo riesgo',
      'todo riesgo danos materiales',
      'danos materiales',
    ],
    canonical: 'Amparo básico todo riesgo',
    section: SchemaSection.COBERTURAS,
  },
  {
    aliases: [
      'terremoto y eventos catastroficos',
      'terremoto, maremoto o tsunami, temblor o erupcion volcanica',
      'terremoto',
      'sismo',
      'temblor',
      'erupcion volcanica',
    ],
    canonical: 'Terremoto',
    section: SchemaSection.COBERTURAS,
  },
  {
    aliases: [
      'responsabilidad civil extracontractual (rce)',
      'responsabilidad civil extracontractual',
      'rce',
      'responsabilidad civil',
      'dano a terceros',
    ],
    canonical: 'Responsabilidad Civil Extracontractual (RCE)',
    section: SchemaSection.COBERTURAS,
  },
  {
    aliases: [
      'lucro cesante',
      'perdida de beneficios',
      'interrupcion de negocio',
      'lucro cesante por danos materiales',
      'perdidas consecuenciales',
    ],
    canonical: 'Lucro Cesante',
    section: SchemaSection.COBERTURAS,
  },
  {
    aliases: ['rotura de maquinaria', 'rotura de maquinas', 'rotura'],
    canonical: 'Rotura de Maquinaria',
    section: SchemaSection.COBERTURAS,
  },
  {
    aliases: [
      'equipos electricos y electronicos',
      'equipo electrico y electronico',
      'eee',
      'equipo electrico',
      'equipo electronico',
    ],
    canonical: 'Equipos eléctricos y electrónicos',
    section: SchemaSection.COBERTURAS,
  },
  {
    aliases: ['gastos medicos', 'accidentes personales', 'gastos de curacion'],
    canonical: 'Gastos médicos',
    section: SchemaSection.COBERTURAS,
  },
  {
    aliases: ['asistencia', 'asistencia pyme', 'servicios de asistencia'],
    canonical: 'Asistencia',
    section: SchemaSection.COBERTURAS,
  },
  {
    aliases: [
      'vidrios',
      'vidrios planos',
      'placas',
      'cristales',
      'rotura accidental de vidrios',
    ],
    canonical: 'Vidrios',
    section: SchemaSection.COBERTURAS,
  },
  {
    aliases: [
      'manejo global / infidelidad',
      'manejo global',
      'infidelidad de empleados',
      'infidelidad',
      'fraude de empleados',
      'manejo global comercial',
    ],
    canonical: 'Manejo global / Infidelidad',
    section: SchemaSection.COBERTURAS,
  },
  {
    aliases: ['transporte de mercancias', 'transito de mercancias', 'transporte'],
    canonical: 'Transporte de mercancías',
    section: SchemaSection.COBERTURAS,
  },
  {
    aliases: ['danos por agua / anegacion', 'danos por agua', 'anegacion', 'inundacion'],
    canonical: 'Daños por agua / Anegación',
    section: SchemaSection.COBERTURAS,
  },
  {
    aliases: [
      'hmacc amit',
      'hmacc',
      'amit',
      'huelga y motin',
      'huelga, motin, asonada',
      'actos mal intencionados de terceros',
    ],
    canonical: 'HMACC-AMIT',
    section: SchemaSection.COBERTURAS,
  },
  {
    aliases: [
      'rc en proceso civil',
      'asistencia legal',
      'asistencia juridica',
      'legal',
      'asesoria legal',
    ],
    canonical: 'RC en proceso civil',
    section: SchemaSection.COBERTURAS,
  },
  {
    aliases: ['deducible', 'deducibles'],
    canonical: 'Deducibles',
    section: SchemaSection.DEDUCIBLES,
  },
  {
    aliases: ['deducible edificio', 'ded. edificio'],
    canonical: 'Deducible Edificio',
    section: SchemaSection.DEDUCIBLES,
  },
  {
    aliases: ['deducible contenidos', 'ded. contenidos'],
    canonical: 'Deducible Contenidos',
    section: SchemaSection.DEDUCIBLES,
  },
  {
    aliases: ['deducible mercancias', 'ded. mercancias', 'deducible mercaderias'],
    canonical: 'Deducible Mercancías',
    section: SchemaSection.DEDUCIBLES,
  },
  {
    aliases: ['deducible equipo electrico', 'ded. equipo electrico', 'deducible eee'],
    canonical: 'Deducible Equipo Eléctrico',
    section: SchemaSection.DEDUCIBLES,
  },
  {
    aliases: ['todo riesgo incendio', 'incendio', 'deducible incendio'],
    canonical: 'Todo Riesgo Incendio',
    section: SchemaSection.DEDUCIBLES,
  },
  {
    aliases: ['anegacion / cobertura extendida', 'anegacion', 'cobertura extendida'],
    canonical: 'Anegación / Cobertura Extendida',
    section: SchemaSection.DEDUCIBLES,
  },
  {
    aliases: ['terremoto', 'deducible terremoto'],
    canonical: 'Terremoto',
    section: SchemaSection.DEDUCIBLES,
  },
  {
    aliases: ['hmacc amit', 'hmacc', 'amit', 'huelga y motin'],
    canonical: 'HMACC-AMIT',
    section: SchemaSection.DEDUCIBLES,
  },
  {
    aliases: ['responsabilidad civil (rce)', 'deducible rce', 'deducible responsabilidad civil', 'rce', 'deducible r.c.e.'],
    canonical: 'RCE',
    section: SchemaSection.DEDUCIBLES,
  },
  {
    aliases: ['sustraccion con violencia', 'sustraccion', 'robo'],
    canonical: 'Sustracción con Violencia',
    section: SchemaSection.SUSTRACCION,
  },
  {
    aliases: ['prima con iva incluido', 'prima con iva', 'prima total con iva'],
    canonical: 'Prima con IVA incluido',
    section: SchemaSection.FINANCIAL,
  },
  {
    aliases: ['gastos de expedicion', 'expedicion', 'gastos expedicion'],
    canonical: 'Gastos de expedición',
    section: SchemaSection.FINANCIAL,
  },
  {
    aliases: ['iva', 'impuesto al valor agregado'],
    canonical: 'IVA',
    section: SchemaSection.FINANCIAL,
  },
  {
    aliases: ['total prima', 'prima total', 'total a pagar'],
    canonical: 'Total prima',
    section: SchemaSection.FINANCIAL,
  },
  {
    aliases: ['forma de pago'],
    canonical: 'Forma de pago',
    section: SchemaSection.FINANCIAL,
  },
  { aliases: ['observaciones'], canonical: 'Observaciones', section: SchemaSection.CONDICIONES },
  { aliases: ['exclusiones'], canonical: 'Exclusiones', section: SchemaSection.CONDICIONES },
];

export interface NormalizedAlias {
  canonical: string;
  section: SchemaSection;
  quality: number;
}

function exactMatchQuality(alias: string, normalized: string): number {
  return alias === normalized ? 1 : alias.length > normalized.length ? 0.5 : 0.7;
}

export function normalizeAlias(input: string): NormalizedAlias | undefined {
  const normalized = normalizeLabel(input);
  if (!normalized) return undefined;

  const matches: { entry: AliasEntry; matchedAlias: string; quality: number }[] = [];
  for (const entry of ALIAS_MAP) {
    for (const rawAlias of entry.aliases) {
      const alias = normalizeLabel(rawAlias);
      if (normalized.includes(alias) || alias.includes(normalized)) {
        matches.push({
          entry,
          matchedAlias: alias,
          quality: exactMatchQuality(alias, normalized),
        });
      }
    }
  }

  if (matches.length === 0) return undefined;

  // Prefer the highest quality match; tie-break by longest alias length.
  matches.sort((a, b) => {
    if (b.quality !== a.quality) return b.quality - a.quality;
    return b.matchedAlias.length - a.matchedAlias.length;
  });

  const best = matches[0];
  const canonicals = new Set(
    matches
      .filter(
        (m) => m.quality === best.quality || m.matchedAlias.length === best.matchedAlias.length
      )
      .map((m) => m.entry.canonical)
  );

  // Ambiguous if multiple distinct canonicals match and the input is not an exact match of the best alias.
  if (canonicals.size > 1 && best.matchedAlias !== normalized) {
    return undefined;
  }

  return {
    canonical: best.entry.canonical,
    section: best.entry.section,
    quality: best.quality,
  };
}

export function sectionByKeyword(label: string): SchemaSection {
  const normalized = label.toLowerCase();
  if (
    normalized.includes('edificio') ||
    normalized.includes('contenido') ||
    normalized.includes('mercancia') ||
    normalized.includes('mueble') ||
    normalized.includes('maquinaria') ||
    normalized.includes('equipo') ||
    normalized.includes('asistencia') ||
    normalized.includes('bienes')
  ) {
    return SchemaSection.BIENES_ASEGURADOS;
  }
  if (
    normalized.includes('deducible') ||
    normalized.includes('incendio') ||
    normalized.includes('anegacion') ||
    normalized.includes('terremoto') ||
    normalized.includes('hmacc') ||
    normalized.includes('amit')
  ) {
    return SchemaSection.DEDUCIBLES;
  }
  if (normalized.includes('sustraccion') || normalized.includes('robo')) {
    return SchemaSection.SUSTRACCION;
  }
  if (
    normalized.includes('prima') ||
    normalized.includes('iva') ||
    normalized.includes('gasto') ||
    normalized.includes('expedicion') ||
    normalized.includes('pago') ||
    normalized.includes('financial')
  ) {
    return SchemaSection.FINANCIAL;
  }
  if (
    normalized.includes('exclusi') ||
    normalized.includes('observaci') ||
    normalized.includes('condici')
  ) {
    return SchemaSection.CONDICIONES;
  }
  return SchemaSection.COBERTURAS;
}

// ---------------------------------------------------------------------------
// v2 per-cell confidence
// ---------------------------------------------------------------------------

function isValidValuePattern(value: string | null): boolean {
  if (value === null || value === undefined) return false;
  const trimmed = value.trim().toLowerCase();
  if (trimmed === '' || trimmed === 'no informado') return false;
  // Accept currency, percentage, numeric, or deductible-like patterns.
  return /[$\d]/.test(value) || /%|smmlv|uf|umed|deducible|minimo|min/.test(trimmed);
}

export function computeCellConfidence(
  cell: Partial<FlatComparisonCell>,
  aliasQuality: number
): number {
  let score = 1.0;
  if (cell.notFound) score -= 0.5;
  if (!cell.rawText || cell.rawText.trim().length === 0) score -= 0.15;
  score *= aliasQuality;
  if (!isValidValuePattern(cell.value ?? null)) score -= 0.15;
  if (cell.isAmbiguous) score -= 0.2;
  return Math.max(0.0, Math.min(1.0, score));
}

// ---------------------------------------------------------------------------
// Structured deductible extraction
// ---------------------------------------------------------------------------

function normalizeDeductibleText(text: string): string {
  const cleanSmmlv = text.replace(/s\.m\.m\.l\.v\.?/gi, 'smmlv');
  return cleanSmmlv
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function parseDeductibleNumber(value: string): number {
  const clean = value.trim().replace(/\s/g, '');
  if (clean.includes(',')) {
    // comma is decimal separator
    return parseFloat(clean.replace(/\./g, '').replace(',', '.'));
  }
  if (clean.includes('.')) {
    const parts = clean.split('.');
    // If all groups after the first are exactly 3 digits, treat as thousands separator.
    if (parts.length > 1 && parts.slice(1).every((p) => /^\d{3}$/.test(p))) {
      return parseFloat(clean.replace(/\./g, ''));
    }
    // Otherwise treat as decimal.
    return parseFloat(clean);
  }
  return parseFloat(clean);
}

export function parseDeductible(text: string | null | undefined): {
  deductible: StructuredDeductible;
  isAmbiguous: boolean;
} {
  const raw = text ?? '';
  if (raw.trim() === '') {
    return { deductible: { type: 'see_conditions' }, isAmbiguous: true };
  }

  const normalized = normalizeDeductibleText(raw);

  if (/\bno aplica\b/.test(normalized) || /\bn\/a\b/.test(normalized)) {
    return { deductible: { type: 'not_applicable' }, isAmbiguous: false };
  }

  if (
    /\bver condiciones\b/.test(normalized) ||
    /\bver clausulado\b/.test(normalized) ||
    /\bsegun condiciones\b/.test(normalized) ||
    /\bsegun clausulado\b/.test(normalized) ||
    /\ba definir\b/.test(normalized) ||
    /\bpor determinar\b/.test(normalized)
  ) {
    return { deductible: { type: 'see_conditions' }, isAmbiguous: true };
  }

  const percentageMatch = normalized.match(/([\d.,]+)\s*%/);
  const percentage = percentageMatch ? parseDeductibleNumber(percentageMatch[1]) : undefined;

  let minimum: number | undefined;
  let currency: string | undefined;

  const minSmmlvMatch = normalized.match(
    /m[i\u00ed]n\.?\s*([\d.,]+)\s*(?:smmlv|salarios?|smlv|ums)/i
  );
  if (minSmmlvMatch) {
    minimum = parseDeductibleNumber(minSmmlvMatch[1]);
    currency = 'SMMLV';
  }

  if (minimum === undefined) {
    const standaloneSmmlvMatch = normalized.match(/([\d.,]+)\s*(?:smmlv|salarios?|smlv|ums)/i);
    if (standaloneSmmlvMatch) {
      minimum = parseDeductibleNumber(standaloneSmmlvMatch[1]);
      currency = 'SMMLV';
    }
  }

  if (minimum === undefined) {
    const minMoneyMatch = normalized.match(
      /m[i\u00ed]n\.?\s*[$]?\s*([\d.,]+)\s*(?:cop|usd|uf|ums)?/i
    );
    if (minMoneyMatch) {
      minimum = parseDeductibleNumber(minMoneyMatch[1]);
      currency = (minMoneyMatch[2] || 'COP').toUpperCase();
    }
  }

  // If no percentage and no minimum, look for a standalone money amount as fixed deductible.
  if (percentage === undefined && minimum === undefined) {
    const fixedMoneyMatch = normalized.match(/[$]?\s*([\d.,]+)\s*(?:cop|usd|uf|ums)?/);
    if (fixedMoneyMatch) {
      minimum = parseDeductibleNumber(fixedMoneyMatch[1]);
      currency = (fixedMoneyMatch[2] || 'COP').toUpperCase();
      return { deductible: { minimum, currency, type: 'fixed' }, isAmbiguous: false };
    }
  }

  if (percentage !== undefined && minimum !== undefined) {
    return {
      deductible: { percentage, minimum, currency, type: 'percentage_with_minimum' },
      isAmbiguous: false,
    };
  }
  if (percentage !== undefined) {
    return { deductible: { percentage, type: 'percentage' }, isAmbiguous: false };
  }
  if (minimum !== undefined) {
    return { deductible: { minimum, currency, type: 'minimum' }, isAmbiguous: false };
  }

  return { deductible: { type: 'see_conditions' }, isAmbiguous: true };
}

// ---------------------------------------------------------------------------
// Row-label normalization (accent-tolerant, case-insensitive)
// ---------------------------------------------------------------------------

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

function paddedOrNull(values: RowValues, index: number): string | null {
  const value = values[index];
  return value === undefined || value === null || value.trim() === '' ? null : value;
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

function buildV2Cell(
  insurer: string,
  rawValue: string | null | undefined,
  aliasQuality: number,
  isAmbiguous: boolean,
  section?: string
) {
  const raw = rawValue ?? '';
  let notFound = isEmptyValue(raw);
  let value = notFound ? 'No informado' : raw.trim();
  let deductible: StructuredDeductible | undefined;

  if (section === SchemaSection.DEDUCIBLES) {
    const parsed = parseDeductible(rawValue);
    deductible = parsed.deductible;

    if (deductible.type === 'see_conditions') {
      value = 'Ver condiciones';
      notFound = false;
    } else if (deductible.type === 'not_applicable') {
      value = 'No aplica';
      notFound = false;
    }

    isAmbiguous = isAmbiguous || parsed.isAmbiguous;
  }

  const cell = {
    insurer,
    value,
    rawText: rawValue ?? undefined,
    notFound: notFound || undefined,
    ...(isAmbiguous ? { isAmbiguous: true } : {}),
    ...(deductible ? { deductible } : {}),
  };
  return {
    ...cell,
    confidence: computeCellConfidence(cell, aliasQuality),
  };
}

// ---------------------------------------------------------------------------
// v2 JSON parser (keeps raw labels for alias normalization)
// ---------------------------------------------------------------------------

function extractCellValueV2(cell: unknown): string {
  return extractCellValue(cell);
}

function parseJsonV2(raw: string): RawTable {
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

  const insurers = Array.isArray((data as Record<string, unknown>).insurers)
    ? ((data as Record<string, unknown>).insurers as unknown[])
        .map((item) => String(item).trim())
        .filter(Boolean)
    : [];
  const inputRows = Array.isArray((data as Record<string, unknown>).rows)
    ? ((data as Record<string, unknown>).rows as unknown[])
    : [];

  const rows = new Map<string, RowValues>();
  const extraRows = new Map<string, RowValues>();

  for (const row of inputRows) {
    if (typeof row !== 'object' || row === null || !('label' in row)) continue;

    const label = String((row as { label: unknown }).label).trim();
    if (!label) continue;

    let values: string[] = [];
    if ('cells' in row && Array.isArray((row as { cells: unknown }).cells)) {
      const cells = (row as { cells: unknown[] }).cells;
      values = insurers.map((insurer) => {
        const matched = cells.find(
          (cell) =>
            typeof cell === 'object' &&
            cell !== null &&
            String((cell as { insurer?: unknown }).insurer).trim() === insurer
        );
        if (matched != null) {
          return extractCellValueV2(matched);
        }
        const idx = insurers.indexOf(insurer);
        return extractCellValueV2(cells[idx]);
      });
    }

    // Keep the raw label; alias normalization happens in buildV2Result.
    rows.set(label, padValues(values, insurers.length));
  }

  const quoteMetadata = Array.isArray((data as Record<string, unknown>).quoteMetadata)
    ? ((data as Record<string, unknown>).quoteMetadata as any[])
    : undefined;

  return { insurers, rows, extraRows, quoteMetadata };
}

// ---------------------------------------------------------------------------
// v2 result builder
// ---------------------------------------------------------------------------

function buildV2Result(
  rawTable: RawTable,
  options: ParseOptions = {},
  warnings: string[] = []
): FlatComparisonResultV2 {
  const insurers = rawTable.insurers.filter(Boolean);
  if (insurers.length === 0) {
    throw new FlatTableParseError('No insurers detected in the table', []);
  }

  const rows: FlatComparisonResultV2['rows'] = [];
  const extraRows: FlatComparisonResultV2['extraRows'] = [];

  for (const [label, values] of rawTable.rows.entries()) {
    const normalized = normalizeAlias(label);

    if (normalized) {
      rows.push({
        label: normalized.canonical,
        section: normalized.section,
        cells: insurers.map((insurer, index) =>
          buildV2Cell(
            insurer,
            paddedOrNull(values, index),
            normalized.quality,
            false,
            normalized.section
          )
        ),
      });
    } else {
      // Ambiguous or unmapped label: keep as extra row with isAmbiguous flag.
      const isAmbiguous = ALIAS_MAP.some((entry) =>
        entry.aliases.some(
          (alias) => normalizeLabel(label).includes(alias) || alias.includes(normalizeLabel(label))
        )
      );
      const fallbackSection = sectionByKeyword(label);
      extraRows.push({
        label,
        section: fallbackSection,
        cells: insurers.map((insurer, index) =>
          buildV2Cell(insurer, paddedOrNull(values, index), 0.5, isAmbiguous, fallbackSection)
        ),
      });
    }
  }

  for (const [label, values] of rawTable.extraRows.entries()) {
    const fallbackSection = sectionByKeyword(label);
    extraRows.push({
      label,
      section: fallbackSection,
      cells: insurers.map((insurer, index) =>
        buildV2Cell(insurer, paddedOrNull(values, index), 0.5, false, fallbackSection)
      ),
    });
  }

  const now = new Date().toISOString();
  const result: FlatComparisonResultV2 = {
    metadata: {
      generatedAt: options.generatedAt ?? now,
      model: options.model ?? 'unknown',
      pdfCount: options.pdfCount ?? insurers.length,
      processingTimeMs: options.processingTimeMs ?? 0,
      confidence: options.confidence ?? 0,
      needsHumanReview: options.needsHumanReview ?? true,
    },
    insurers,
    schemaVersion: 2,
    rows,
    extraRows,
    warnings,
    quoteMetadata: rawTable.quoteMetadata,
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

  parseV2(raw: string, options?: ParseOptions): FlatComparisonResultV2 {
    const format = detectFormat(raw);
    if (format !== 'json') {
      throw new FlatTableParseError('v2 parser only supports JSON input', []);
    }

    let rawTable: RawTable;
    const warnings: string[] = [];

    try {
      rawTable = parseJsonV2(raw);
    } catch (error) {
      throw new FlatTableParseError('Failed to parse granular JSON table', [
        { message: error instanceof Error ? error.message : String(error) },
      ]);
    }

    return buildV2Result(rawTable, options, warnings);
  }
}

export const flatTableParser = new FlatTableParser();
export default flatTableParser;
