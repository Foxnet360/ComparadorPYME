/**
 * Evaluation Harness
 *
 * Loads an annotated golden-set of quotes, runs them through an extraction
 * pipeline, and computes accuracy metrics against the annotated truth.
 */

import path from 'path';
import { PageTextItems } from './templateRegistryService';
import { LayoutTable } from '../schemas/templateRegistrySchema';

// ---------------------------------------------------------------------------
// Domain types
// ---------------------------------------------------------------------------

export interface GoldenCoverage {
  canonicalName: string;
  insuredAmount?: number;
  deductible?: string;
  premium?: number;
}

export interface GoldenQuote {
  fixtureId: string;
  insurer: string;
  templateId: string | null;
  fileName: string;
  pdfText?: string;
  pageTextItems?: PageTextItems[];
  layoutTables?: LayoutTable[];
  expectedCoverages: GoldenCoverage[];
  annotatedBy: string;
  notes?: string;
}

export interface PipelineCoverage {
  canonicalName: string;
  insuredAmount?: number;
  deductible?: string;
  premium?: number;
  confidence?: number;
  graphConfidence?: number | null;
  matchMethod?: string | null;
  isImplicit?: boolean;
  rawName?: string;
}

export interface PipelineOutput {
  insurerName: string;
  templateId: string | null;
  coverages: PipelineCoverage[];
  uncategorizedCoverages: PipelineCoverage[];
  rawCoverageCount: number;
  generalDeductibles?: Array<{ appliesTo: string; deductibleText: string }>;
  specialConditions?: string[];
}

export interface FixtureResult {
  fixtureId: string;
  insurer: string;
  coverageAccuracy: number;
  deductibleAccuracy: number;
  uncategorizedRate: number;
  manualCompletionRate: number;
  correctionRate: number;
  correctCoverageCount: number;
  missingCoverageCount: number;
  falsePositiveCoverageCount: number;
  deductibleMismatchCount: number;
  uncategorizedCoverageCount: number;
  expectedCoverageCount: number;
  rawCoverageCount: number;
  needsManualCompletion: boolean;
  regressions: RegressionItem[];
}

export interface EvaluationMetrics {
  coverageAccuracy: number;
  deductibleAccuracy: number;
  uncategorizedRate: number;
  manualCompletionRate: number;
  correctionRate: number;
  totalFixtures: number;
  totalExpectedCoverages: number;
  totalCorrectCoverages: number;
  totalDeductibleMismatches: number;
  totalUncategorizedCoverages: number;
  fixtureCount?: number;
}

export interface EvaluationThresholds {
  coverageAccuracyThreshold: number;
  deductibleAccuracyThreshold: number;
  uncategorizedRateThreshold: number;
}

export interface RegressionItem {
  fixtureId: string;
  insurer: string;
  type: 'coverage' | 'deductible' | 'uncategorized' | 'manual-completion';
  message: string;
  value: number;
}

export interface EvaluationReport {
  aggregate: EvaluationMetrics;
  perInsurer: Record<string, EvaluationMetrics>;
  perSlice?: Record<string, EvaluationMetrics>;
  fixtures: FixtureResult[];
  regressions: RegressionItem[];
  thresholds: EvaluationThresholds;
  generatedAt: string;
}

export interface FileSystemLike {
  readdir: (dir: string) => Promise<string[]>;
  readFile: (filePath: string, encoding?: string) => Promise<string | Buffer>;
}

export interface PipelineRunner {
  (fixture: GoldenQuote): Promise<PipelineOutput>;
}

export const DEFAULT_THRESHOLDS: EvaluationThresholds = {
  coverageAccuracyThreshold: 0.85,
  deductibleAccuracyThreshold: 0.8,
  uncategorizedRateThreshold: 0.1,
};

// ---------------------------------------------------------------------------
// Comparison helpers
// ---------------------------------------------------------------------------

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

function normalizeDeductible(text?: string): string {
  if (!text) return '';
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '')
    .replace(/,/g, '.');
}

function valuesMatch(expected?: number, actual?: number): boolean {
  if (expected === undefined || actual === undefined) return true;
  return expected === actual;
}

function findMatchingCoverage(
  expected: GoldenCoverage,
  actualCoverages: PipelineCoverage[]
): PipelineCoverage | undefined {
  return actualCoverages.find(
    (c) => normalizeName(c.canonicalName) === normalizeName(expected.canonicalName)
  );
}

// ---------------------------------------------------------------------------
// Per-fixture evaluation
// ---------------------------------------------------------------------------

export function evaluateFixture(
  golden: GoldenQuote,
  actual: PipelineOutput,
  thresholds: EvaluationThresholds = DEFAULT_THRESHOLDS
): FixtureResult {
  const expectedCount = golden.expectedCoverages.length;
  let correctCoverageCount = 0;
  let deductibleMismatchCount = 0;
  let missingCoverageCount = 0;

  for (const expected of golden.expectedCoverages) {
    const matched = findMatchingCoverage(expected, actual.coverages);
    if (!matched) {
      missingCoverageCount++;
      if (expected.deductible !== undefined) {
        deductibleMismatchCount++;
      }
      continue;
    }

    const nameMatch =
      normalizeName(matched.canonicalName) === normalizeName(expected.canonicalName);
    const valueMatch = valuesMatch(expected.insuredAmount, matched.insuredAmount);
    const deductibleMatch =
      expected.deductible === undefined ||
      normalizeDeductible(expected.deductible) === normalizeDeductible(matched.deductible);

    if (nameMatch && valueMatch) {
      correctCoverageCount++;
    }

    if (!deductibleMatch) {
      deductibleMismatchCount++;
    }
  }

  const expectedWithDeductible = golden.expectedCoverages.filter(
    (e) => e.deductible !== undefined
  ).length;

  const falsePositiveCoverageCount = actual.coverages.filter(
    (c) =>
      !golden.expectedCoverages.some(
        (e) => normalizeName(e.canonicalName) === normalizeName(c.canonicalName)
      )
  ).length;

  const uncategorizedCoverageCount = actual.uncategorizedCoverages.length;
  const rawCoverageCount = Math.max(
    actual.rawCoverageCount,
    actual.coverages.length + uncategorizedCoverageCount
  );

  const coverageAccuracy = expectedCount > 0 ? correctCoverageCount / expectedCount : 0;
  const deductibleAccuracy =
    expectedWithDeductible > 0
      ? (expectedWithDeductible - deductibleMismatchCount) / expectedWithDeductible
      : 1;
  const uncategorizedRate =
    rawCoverageCount > 0 ? uncategorizedCoverageCount / rawCoverageCount : 0;

  const needsManualCompletion =
    coverageAccuracy < thresholds.coverageAccuracyThreshold ||
    deductibleAccuracy < thresholds.deductibleAccuracyThreshold ||
    uncategorizedRate > thresholds.uncategorizedRateThreshold;

  const manualCompletionRate = needsManualCompletion ? 1 : 0;
  const correctionRate =
    expectedCount > 0 ? (expectedCount - correctCoverageCount) / expectedCount : 0;

  return {
    fixtureId: golden.fixtureId,
    insurer: golden.insurer,
    coverageAccuracy,
    deductibleAccuracy,
    uncategorizedRate,
    manualCompletionRate,
    correctionRate,
    correctCoverageCount,
    missingCoverageCount,
    falsePositiveCoverageCount,
    deductibleMismatchCount,
    uncategorizedCoverageCount,
    expectedCoverageCount: expectedCount,
    rawCoverageCount,
    needsManualCompletion,
    regressions: [],
  };
}

// ---------------------------------------------------------------------------
// Aggregation
// ---------------------------------------------------------------------------

export function computeAggregateMetrics(results: FixtureResult[]): EvaluationMetrics {
  const totalFixtures = results.length;
  if (totalFixtures === 0) {
    return {
      coverageAccuracy: 0,
      deductibleAccuracy: 0,
      uncategorizedRate: 0,
      manualCompletionRate: 0,
      correctionRate: 0,
      totalFixtures: 0,
      totalExpectedCoverages: 0,
      totalCorrectCoverages: 0,
      totalDeductibleMismatches: 0,
      totalUncategorizedCoverages: 0,
      fixtureCount: 0,
    };
  }

  const totalExpectedCoverages = results.reduce((sum, r) => sum + r.expectedCoverageCount, 0);
  const totalCorrectCoverages = results.reduce((sum, r) => sum + r.correctCoverageCount, 0);
  const totalDeductibleMismatches = results.reduce((sum, r) => sum + r.deductibleMismatchCount, 0);
  const totalUncategorizedCoverages = results.reduce(
    (sum, r) => sum + r.uncategorizedCoverageCount,
    0
  );

  // Coverage accuracy weighted by expected coverages so large quotes don't skew the unweighted mean.
  const coverageAccuracy =
    totalExpectedCoverages > 0 ? totalCorrectCoverages / totalExpectedCoverages : 0;

  // Deductible accuracy weighted by fixtures with expected deductibles.
  const fixturesWithDeductibles = results.filter(
    (r) => r.expectedCoverageCount > 0 && r.deductibleMismatchCount >= 0
  );
  const deductibleAccuracy =
    fixturesWithDeductibles.length > 0
      ? fixturesWithDeductibles.reduce((sum, r) => sum + r.deductibleAccuracy, 0) /
        fixturesWithDeductibles.length
      : 0;

  const uncategorizedRate =
    results.reduce((sum, r) => sum + r.uncategorizedRate, 0) / totalFixtures;
  const manualCompletionRate =
    results.reduce((sum, r) => sum + r.manualCompletionRate, 0) / totalFixtures;
  const correctionRate =
    totalExpectedCoverages > 0
      ? (totalExpectedCoverages - totalCorrectCoverages) / totalExpectedCoverages
      : 0;

  return {
    coverageAccuracy: round4(coverageAccuracy),
    deductibleAccuracy: round4(deductibleAccuracy),
    uncategorizedRate: round4(uncategorizedRate),
    manualCompletionRate: round4(manualCompletionRate),
    correctionRate: round4(correctionRate),
    totalFixtures,
    totalExpectedCoverages,
    totalCorrectCoverages,
    totalDeductibleMismatches,
    totalUncategorizedCoverages,
    fixtureCount: totalFixtures,
  };
}

function round4(value: number): number {
  return Math.round(value * 10000) / 10000;
}

function buildMetricsForGroup(results: FixtureResult[]): EvaluationMetrics {
  return computeAggregateMetrics(results);
}

// ---------------------------------------------------------------------------
// Regression detection
// ---------------------------------------------------------------------------

export function detectRegressions(
  result: FixtureResult,
  thresholds: EvaluationThresholds
): RegressionItem[] {
  const regressions: RegressionItem[] = [];

  if (result.coverageAccuracy < thresholds.coverageAccuracyThreshold) {
    regressions.push({
      fixtureId: result.fixtureId,
      insurer: result.insurer,
      type: 'coverage',
      message: `Coverage accuracy ${(result.coverageAccuracy * 100).toFixed(1)}% is below threshold ${(
        thresholds.coverageAccuracyThreshold * 100
      ).toFixed(1)}%`,
      value: result.coverageAccuracy,
    });
  }

  if (result.deductibleAccuracy < thresholds.deductibleAccuracyThreshold) {
    regressions.push({
      fixtureId: result.fixtureId,
      insurer: result.insurer,
      type: 'deductible',
      message: `Deductible accuracy ${(result.deductibleAccuracy * 100).toFixed(1)}% is below threshold ${(
        thresholds.deductibleAccuracyThreshold * 100
      ).toFixed(1)}%`,
      value: result.deductibleAccuracy,
    });
  }

  if (result.uncategorizedRate > thresholds.uncategorizedRateThreshold) {
    regressions.push({
      fixtureId: result.fixtureId,
      insurer: result.insurer,
      type: 'uncategorized',
      message: `Uncategorized rate ${(result.uncategorizedRate * 100).toFixed(1)}% exceeds threshold ${(
        thresholds.uncategorizedRateThreshold * 100
      ).toFixed(1)}%`,
      value: result.uncategorizedRate,
    });
  }

  return regressions;
}

// ---------------------------------------------------------------------------
// Report building
// ---------------------------------------------------------------------------

export function buildEvaluationReport(
  results: FixtureResult[],
  thresholds: EvaluationThresholds = DEFAULT_THRESHOLDS
): EvaluationReport {
  const fixturesWithRegressions = results.map((r) => ({
    ...r,
    regressions: detectRegressions(r, thresholds),
  }));

  const aggregate = computeAggregateMetrics(fixturesWithRegressions);

  const byInsurer: Record<string, FixtureResult[]> = {};
  for (const r of fixturesWithRegressions) {
    byInsurer[r.insurer] = byInsurer[r.insurer] ?? [];
    byInsurer[r.insurer].push(r);
  }

  const perInsurer: Record<string, EvaluationMetrics> = {};
  for (const [insurer, group] of Object.entries(byInsurer)) {
    perInsurer[insurer] = buildMetricsForGroup(group);
  }

  const regressions = fixturesWithRegressions.flatMap((r) => r.regressions);

  return {
    aggregate,
    perInsurer,
    fixtures: fixturesWithRegressions,
    regressions,
    thresholds,
    generatedAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Fixture loading
// ---------------------------------------------------------------------------

function isGoldenQuote(data: unknown): data is GoldenQuote {
  if (!data || typeof data !== 'object') return false;
  const d = data as Record<string, unknown>;
  return (
    typeof d.fixtureId === 'string' &&
    typeof d.insurer === 'string' &&
    Array.isArray(d.expectedCoverages) &&
    d.expectedCoverages.every(
      (c: unknown) =>
        typeof c === 'object' &&
        c !== null &&
        typeof (c as Record<string, unknown>).canonicalName === 'string'
    ) &&
    typeof d.annotatedBy === 'string'
  );
}

export async function loadGoldenSet(directory: string, fs: FileSystemLike): Promise<GoldenQuote[]> {
  const files = await fs.readdir(directory);
  const jsonFiles = files.filter((f) => f.toLowerCase().endsWith('.json'));

  const fixtures: GoldenQuote[] = [];
  for (const file of jsonFiles) {
    try {
      const content = await fs.readFile(path.join(directory, file), 'utf8');
      const parsed = JSON.parse(content as string);
      if (isGoldenQuote(parsed)) {
        fixtures.push(parsed);
      } else {
        console.warn(`⚠️ [EvaluationHarness] Skipping invalid fixture ${file}`);
      }
    } catch (error: unknown) {
      console.warn(
        `⚠️ [EvaluationHarness] Failed to load fixture ${file}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  return fixtures.sort((a, b) => a.fixtureId.localeCompare(b.fixtureId));
}

// ---------------------------------------------------------------------------
// End-to-end evaluation
// ---------------------------------------------------------------------------

export interface EvaluationOptions {
  thresholds?: Partial<EvaluationThresholds>;
  onProgress?: (completed: number, total: number) => void;
}

export async function runEvaluation(
  directory: string,
  runner: PipelineRunner,
  fs: FileSystemLike,
  options: EvaluationOptions = {}
): Promise<EvaluationReport> {
  const thresholds = { ...DEFAULT_THRESHOLDS, ...(options.thresholds ?? {}) };
  const fixtures = await loadGoldenSet(directory, fs);

  const results: FixtureResult[] = [];
  for (let i = 0; i < fixtures.length; i++) {
    const fixture = fixtures[i];
    try {
      const output = await runner(fixture);
      results.push(evaluateFixture(fixture, output, thresholds));
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`❌ [EvaluationHarness] Fixture ${fixture.fixtureId} failed: ${message}`);
      results.push({
        fixtureId: fixture.fixtureId,
        insurer: fixture.insurer,
        coverageAccuracy: 0,
        deductibleAccuracy: 0,
        uncategorizedRate: 0,
        manualCompletionRate: 1,
        correctionRate: 1,
        correctCoverageCount: 0,
        missingCoverageCount: fixture.expectedCoverages.length,
        falsePositiveCoverageCount: 0,
        deductibleMismatchCount: 0,
        uncategorizedCoverageCount: 0,
        expectedCoverageCount: fixture.expectedCoverages.length,
        rawCoverageCount: 0,
        needsManualCompletion: true,
        regressions: [
          {
            fixtureId: fixture.fixtureId,
            insurer: fixture.insurer,
            type: 'manual-completion',
            message: `Pipeline error: ${message}`,
            value: 1,
          },
        ],
      });
    }
    if (options.onProgress) {
      options.onProgress(i + 1, fixtures.length);
    }
  }

  return buildEvaluationReport(results, thresholds);
}
