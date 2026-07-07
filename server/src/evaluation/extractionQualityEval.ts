/**
 * Extraction Quality Evaluation Harness
 *
 * Compares the production tool path (unified comparison engine) against a
 * direct-LLM baseline for a fixed set of quote PDFs. Reports cell-level match
 * rate and fallback rate so regressions in extraction quality are caught in CI.
 */

import fs from 'fs/promises';
import path from 'path';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import { comparisonPromptBuilder } from '../services/unifiedComparison/comparisonPromptBuilder';
import { flatTableParser } from '../services/unifiedComparison/flatTableParser';
import { comparisonEngineAdapter } from '../services/unifiedComparison/comparisonEngineAdapter';
import type { FlatComparisonResult } from '../services/unifiedComparison/comparisonSchema';
import { SchemaSection } from '../services/unifiedComparison/comparisonSchema';
import type { MatrixRow } from '../types';

export interface ExtractionQualityFixture {
  name: string;
  description: string;
  pdfPaths: string[];
  baselineSnapshotPath: string;
}

export interface ExtractionQualityReport {
  baseline: FlatComparisonResult;
  tool: FlatComparisonResult;
  matchRate: number;
  mismatches: Array<{ row: string; insurer: string; baseline: string; tool: string }>;
  fallbackRate: number;
  passed: boolean;
}

interface MatchResult {
  matchRate: number;
  mismatches: ExtractionQualityReport['mismatches'];
  totalCells: number;
}

interface ToolComparisonResult {
  result: FlatComparisonResult;
  engine: 'unified' | 'fallback';
  fallbackReason?: string;
}

interface GeminiFile {
  name?: string;
  displayName?: string;
  uri?: string;
  state?: string;
}

const V1_CANONICAL_ROW_LABELS = [
  'Bienes Asegurados',
  'Deducibles',
  'Prima con IVA',
  'Forma de Pago',
];

const GEMINI_TIMEOUT_MS = 60_000;
const MATCH_RATE_THRESHOLD = 0.9;
const FALLBACK_RATE_THRESHOLD = 0.1;

// ---------------------------------------------------------------------------
// Cell-level matcher
// ---------------------------------------------------------------------------

/**
 * Normalize a cell value so semantic differences (case, accents, punctuation,
 * currency symbols, whitespace) do not count as mismatches.
 *
 * Missing-value markers such as "No informado" normalize to the empty string
 * so they are treated as equivalent across baseline and tool.
 */
export function normalizeCellValue(value: string | null | undefined): string {
  if (value === null || value === undefined) return '';
  const stripped = value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (stripped === 'no informado' || stripped === 'no especificado') return '';
  return stripped;
}

/**
 * Decide whether two cell values are semantically equivalent.
 */
export function compareCellValues(
  a: string | null | undefined,
  b: string | null | undefined
): boolean {
  const normalizedA = normalizeCellValue(a);
  const normalizedB = normalizeCellValue(b);
  if (normalizedA === '' && normalizedB === '') return true;
  return normalizedA === normalizedB;
}

/**
 * Map each baseline insurer to the tool insurer index with the closest
 * normalized name. Returns -1 when no reasonable match is found.
 */
function alignInsurers(baselineInsurers: string[], toolInsurers: string[]): number[] {
  const normalizedTool = toolInsurers.map((name) => normalizeCellValue(name));

  return baselineInsurers.map((baselineName) => {
    const normalizedBaseline = normalizeCellValue(baselineName);
    let bestIndex = -1;
    let bestScore = 0;

    for (let i = 0; i < normalizedTool.length; i++) {
      const toolName = normalizedTool[i];
      if (toolName === normalizedBaseline) {
        return i;
      }
      const score = longestCommonSubstringLength(normalizedBaseline, toolName);
      if (score > bestScore && score >= 3) {
        bestScore = score;
        bestIndex = i;
      }
    }

    return bestIndex;
  });
}

function longestCommonSubstringLength(a: string, b: string): number {
  if (a.length === 0 || b.length === 0) return 0;
  const matrix: number[][] = Array.from({ length: a.length + 1 }, () =>
    Array(b.length + 1).fill(0)
  );
  let max = 0;

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      if (a[i - 1] === b[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1] + 1;
        max = Math.max(max, matrix[i][j]);
      }
    }
  }

  return max;
}

/**
 * Compare every cell in the baseline against the aligned tool cell and report
 * the match rate plus a list of mismatches. Rows are matched by canonical label,
 * so variable row counts are supported. A baseline row that is missing from the
 * tool counts as a mismatch for every cell.
 */
export function calculateMatchRate(
  baseline: FlatComparisonResult,
  tool: FlatComparisonResult
): MatchResult {
  const mapping = alignInsurers(baseline.insurers, tool.insurers);
  let matches = 0;
  const mismatches: MatchResult['mismatches'] = [];
  let totalCells = 0;

  for (const baselineRow of baseline.rows) {
    const toolRow = tool.rows.find(
      (r) => normalizeCellValue(r.label) === normalizeCellValue(baselineRow.label)
    );

    for (let baselineIdx = 0; baselineIdx < baselineRow.cells.length; baselineIdx++) {
      totalCells++;
      const baselineCell = baselineRow.cells[baselineIdx];
      const baselineValue = baselineCell.value ?? 'No informado';

      if (!toolRow) {
        mismatches.push({
          row: baselineRow.label,
          insurer: baselineCell.insurer,
          baseline: baselineValue,
          tool: 'No informado',
        });
        continue;
      }

      const toolIdx = mapping[baselineIdx];

      if (toolIdx < 0) {
        mismatches.push({
          row: baselineRow.label,
          insurer: baselineCell.insurer,
          baseline: baselineValue,
          tool: 'No informado',
        });
        continue;
      }

      const toolCell = toolRow.cells[toolIdx];
      const toolValue = toolCell?.value ?? 'No informado';

      if (compareCellValues(baselineValue, toolValue)) {
        matches++;
      } else {
        mismatches.push({
          row: baselineRow.label,
          insurer: baselineCell.insurer,
          baseline: baselineValue,
          tool: toolValue,
        });
      }
    }
  }

  return {
    matchRate: totalCells > 0 ? matches / totalCells : 0,
    mismatches,
    totalCells,
  };
}

// ---------------------------------------------------------------------------
// Matrix → FlatComparisonResult adapter
// ---------------------------------------------------------------------------

function extractInsurersFromMatrix(matrix: MatrixRow[]): string[] {
  const header = matrix.find((row) => row.type === 'header' && row.id === 'client_info');
  if (header?.label) {
    const separator = ' - ';
    const idx = header.label.indexOf(separator);
    if (idx >= 0) {
      return header.label
        .slice(idx + separator.length)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    }
  }
  return [];
}

function findMatrixRowByLabel(matrix: MatrixRow[], label: string): MatrixRow | undefined {
  return matrix.find(
    (row) => row.type === 'data' && normalizeCellValue(row.label) === normalizeCellValue(label)
  );
}

function buildFlatCell(
  insurer: string,
  value: string | null | undefined,
  confidence?: number
): {
  insurer: string;
  value: string;
  rawText?: string;
  notFound?: boolean;
  confidence?: number;
} {
  const notFound = value === null || value === 'No informado' || value === '';
  const cell: {
    insurer: string;
    value: string;
    rawText?: string;
    notFound?: boolean;
    confidence?: number;
  } = {
    insurer,
    value: notFound ? 'No informado' : (value as string),
    notFound: notFound || undefined,
  };

  if (value !== undefined && value !== null) {
    cell.rawText = value;
  }
  if (confidence !== undefined) {
    cell.confidence = confidence;
  }

  return cell;
}

function matrixRowsToFlatResultV1(matrix: MatrixRow[]): FlatComparisonResult {
  const insurers = extractInsurersFromMatrix(matrix);
  const now = new Date().toISOString();

  const rows = V1_CANONICAL_ROW_LABELS.map((label) => {
    const matrixRow = findMatrixRowByLabel(matrix, label);
    const cells = insurers.map((insurer, idx) => {
      const matrixCell = matrixRow?.cells[idx];
      return buildFlatCell(insurer, matrixCell?.value ?? null, matrixCell?.confidence);
    });
    return { label, cells };
  });

  const canonicalNormalized = new Set(V1_CANONICAL_ROW_LABELS.map(normalizeCellValue));
  const extraRows = matrix
    .filter((row) => row.type === 'data' && !canonicalNormalized.has(normalizeCellValue(row.label)))
    .map((row) => ({
      label: row.label,
      cells: insurers.map((insurer, idx) =>
        buildFlatCell(insurer, row.cells[idx]?.value ?? null, row.cells[idx]?.confidence)
      ),
    }));

  return {
    metadata: {
      generatedAt: now,
      model: 'adapter',
      pdfCount: insurers.length,
      processingTimeMs: 0,
      confidence: 0.85,
      needsHumanReview: false,
    },
    insurers,
    schemaVersion: 1,
    rows,
    extraRows,
    warnings: [],
  };
}

function matrixRowsToFlatResultV2(matrix: MatrixRow[]): FlatComparisonResult {
  const insurers = extractInsurersFromMatrix(matrix);
  const now = new Date().toISOString();

  const rows: FlatComparisonResult['rows'] = [];
  let currentSection: SchemaSection | undefined;

  for (const row of matrix) {
    if (row.type === 'header') {
      // The top-level header carries insurer names, not a data section.
      if (row.id !== 'client_info') {
        currentSection = row.label as SchemaSection;
      }
      continue;
    }

    if (row.type === 'data') {
      rows.push({
        label: row.label,
        section: currentSection,
        cells: insurers.map((insurer, idx) =>
          buildFlatCell(insurer, row.cells[idx]?.value ?? null, row.cells[idx]?.confidence)
        ),
      });
    }
  }

  return {
    metadata: {
      generatedAt: now,
      model: 'adapter',
      pdfCount: insurers.length,
      processingTimeMs: 0,
      confidence: 0.85,
      needsHumanReview: false,
    },
    insurers,
    schemaVersion: 2,
    rows,
    extraRows: [],
    warnings: [],
  };
}

/**
 * Reconstruct a FlatComparisonResult from the MatrixRow[] produced by the
 * comparison engine adapter. This lets the harness compare the tool path to
 * the direct-LLM baseline using the same cell coordinates.
 *
 * The reconstruction respects the schema version returned by the adapter so that
 * v1 cached results keep the legacy four-row shape while v2 results preserve
 * section-aware granular rows and per-cell confidence.
 */
export function matrixRowsToFlatResult(
  matrix: MatrixRow[],
  schemaVersion: 1 | 2 = 1
): FlatComparisonResult {
  return schemaVersion === 2 ? matrixRowsToFlatResultV2(matrix) : matrixRowsToFlatResultV1(matrix);
}

// ---------------------------------------------------------------------------
// Baseline runner (direct-LLM)
// ---------------------------------------------------------------------------

function getGenAI(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not set in environment');
  }
  return new GoogleGenAI({ apiKey });
}

async function uploadFiles(filePaths: string[]): Promise<GeminiFile[]> {
  const ai = getGenAI();
  const uploadedFiles: GeminiFile[] = [];

  for (const filePath of filePaths) {
    const uploadedFile = await ai.files.upload({
      file: filePath,
      config: {
        mimeType: 'application/pdf',
        displayName: path.basename(filePath),
      },
    });

    const fileName = uploadedFile.name || '';
    let file = await ai.files.get({ name: fileName });
    while (file.state === 'PROCESSING') {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      file = await ai.files.get({ name: fileName });
    }

    if (file.state !== 'ACTIVE') {
      throw new Error(`File ${fileName} failed to process`);
    }

    uploadedFiles.push(file);
  }

  return uploadedFiles;
}

async function callGeminiBaseline(files: GeminiFile[], prompt: string): Promise<string> {
  const ai = getGenAI();
  const model = process.env.GEMINI_MODEL || 'gemini-3.5-flash';

  const contents = [
    ...files.map((file) => ({
      fileData: {
        fileUri: file.uri,
        mimeType: 'application/pdf',
      },
    })),
    { text: prompt },
  ];

  const geminiPromise = ai.models.generateContent({
    model,
    contents,
    config: {
      thinkingConfig: { thinkingLevel: ThinkingLevel.MEDIUM },
      responseMimeType: 'application/json',
    },
  });

  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(
      () => reject(new Error(`Baseline Gemini call timed out after ${GEMINI_TIMEOUT_MS}ms`)),
      GEMINI_TIMEOUT_MS
    )
  );

  const result = await Promise.race([geminiPromise, timeoutPromise]);
  if (!result.text) {
    throw new Error('Empty response from Gemini baseline');
  }
  return result.text;
}

async function runBaselineComparison(
  pdfPaths: string[],
  granularEnabled: boolean
): Promise<FlatComparisonResult> {
  let uploadedFiles: GeminiFile[] = [];

  try {
    uploadedFiles = await uploadFiles(pdfPaths);
    const promptContext = {
      insurerCount: pdfPaths.length,
      hasClauses: false,
    };
    const prompt = granularEnabled
      ? comparisonPromptBuilder.buildV2ComparisonPrompt(promptContext)
      : comparisonPromptBuilder.buildComparisonPrompt(promptContext);
    const responseText = await callGeminiBaseline(uploadedFiles, prompt);

    const parseOptions = {
      pdfCount: pdfPaths.length,
      model: process.env.GEMINI_MODEL || 'gemini-3.5-flash',
      confidence: 0.85,
      needsHumanReview: false,
    };

    return granularEnabled
      ? flatTableParser.parseV2(responseText, parseOptions)
      : flatTableParser.parse(responseText, parseOptions);
  } finally {
    if (uploadedFiles.length > 0) {
      const ai = getGenAI();
      for (const file of uploadedFiles) {
        try {
          await ai.files.delete({ name: file.name ?? '' });
        } catch (_error) {
          // Best-effort cleanup; do not fail the evaluation over deletion errors.
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Tool path runner (production adapter)
// ---------------------------------------------------------------------------

async function runToolComparison(
  pdfPaths: string[],
  userId?: string,
  granularComparisonSchema?: boolean
): Promise<ToolComparisonResult> {
  const adapterResult = await comparisonEngineAdapter.generateComparison(pdfPaths, {
    userId,
    granularComparisonSchema,
  });
  const result = matrixRowsToFlatResult(adapterResult.matrix, adapterResult.schemaVersion);

  return {
    result,
    engine: adapterResult.engine,
    fallbackReason: adapterResult.fallbackReason,
  };
}

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

function resolveProjectPath(inputPath: string): string {
  if (path.isAbsolute(inputPath)) return inputPath;
  return path.resolve(process.cwd(), inputPath);
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function loadJson<T>(filePath: string): Promise<T | undefined> {
  if (!(await pathExists(filePath))) return undefined;
  const raw = await fs.readFile(filePath, 'utf-8');
  return JSON.parse(raw) as T;
}

async function saveJson(filePath: string, data: unknown): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface RunExtractionQualityEvalOptions {
  updateBaseline?: boolean;
  userId?: string;
  granularComparisonSchema?: boolean;
}

/**
 * Run the extraction-quality evaluation for a fixed quote set.
 *
 * - Loads a persisted baseline snapshot when one exists.
 * - Regenerates the baseline from a direct Gemini call when `updateBaseline` is
 *   true or the snapshot is missing.
 * - Runs the production tool path through `comparisonEngineAdapter`.
 * - Reports cell-level match rate and whether the adapter fell back to the
 *   legacy per-quote pipeline.
 */
export async function runExtractionQualityEval(
  fixture: ExtractionQualityFixture,
  options: RunExtractionQualityEvalOptions = {}
): Promise<ExtractionQualityReport> {
  const snapshotPath = resolveProjectPath(fixture.baselineSnapshotPath);
  const pdfPaths = fixture.pdfPaths.map(resolveProjectPath);
  const granularEnabled = options.granularComparisonSchema ?? false;

  for (const pdfPath of pdfPaths) {
    if (!(await pathExists(pdfPath))) {
      throw new Error(`Fixture PDF not found: ${pdfPath}`);
    }
  }

  let baseline = options.updateBaseline
    ? undefined
    : await loadJson<FlatComparisonResult>(snapshotPath);

  try {
    if (!baseline) {
      baseline = await runBaselineComparison(pdfPaths, granularEnabled);
      await saveJson(snapshotPath, baseline);
    }

    const tool = await runToolComparison(pdfPaths, options.userId, granularEnabled);
    const { matchRate, mismatches } = calculateMatchRate(baseline, tool.result);
    const fallbackRate = tool.engine === 'fallback' ? 1 : 0;
    const passed = matchRate >= MATCH_RATE_THRESHOLD && fallbackRate <= FALLBACK_RATE_THRESHOLD;

    return {
      baseline,
      tool: tool.result,
      matchRate,
      mismatches,
      fallbackRate,
      passed,
    };
  } finally {
    // No global state is mutated by this harness; the finally block is kept for
    // future cleanup, but feature-flag overrides are now passed locally to the
    // adapter instead of being written to the shared singleton.
  }
}

/**
 * Load a fixture definition from a JSON file.
 */
export async function loadFixture(fixturePath: string): Promise<ExtractionQualityFixture> {
  const resolved = resolveProjectPath(fixturePath);
  const fixture = await loadJson<ExtractionQualityFixture>(resolved);
  if (!fixture) {
    throw new Error(`Fixture file not found: ${resolved}`);
  }
  return fixture;
}
