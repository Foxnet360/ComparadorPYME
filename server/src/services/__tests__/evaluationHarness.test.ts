import { describe, it, expect, beforeEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import {
  evaluateFixture,
  computeAggregateMetrics,
  buildEvaluationReport,
  loadGoldenSet,
} from '../evaluationHarness';
import { GoldenQuote, FixtureResult, PipelineOutput } from '../evaluationHarness';

function makeGolden(overrides: Partial<GoldenQuote> = {}): GoldenQuote {
  return {
    fixtureId: 'fixture-001',
    insurer: 'BBVA',
    templateId: 'bbva-pyme-v1',
    fileName: 'bbva-001.pdf',
    pageTextItems: [],
    expectedCoverages: [
      { canonicalName: 'Incendio (Edificio y Contenidos)', insuredAmount: 500000000, deductible: '10%' },
      { canonicalName: 'Responsabilidad Civil (RCE)', insuredAmount: 100000000, deductible: '5 SMMLV' },
    ],
    annotatedBy: 'analyst-a',
    ...overrides,
  };
}

function makePipelineOutput(overrides: Partial<PipelineOutput> = {}): PipelineOutput {
  return {
    insurerName: 'BBVA',
    templateId: 'bbva-pyme-v1',
    coverages: [],
    uncategorizedCoverages: [],
    rawCoverageCount: 0,
    ...overrides,
  };
}

describe('evaluateFixture', () => {
  it('returns perfect scores when actual matches expected exactly', () => {
    const golden = makeGolden();
    const actual = makePipelineOutput({
      coverages: [
        { canonicalName: 'Incendio (Edificio y Contenidos)', insuredAmount: 500000000, deductible: '10%' },
        { canonicalName: 'Responsabilidad Civil (RCE)', insuredAmount: 100000000, deductible: '5 SMMLV' },
      ],
      rawCoverageCount: 2,
    });

    const result = evaluateFixture(golden, actual);

    expect(result.coverageAccuracy).toBe(1);
    expect(result.deductibleAccuracy).toBe(1);
    expect(result.uncategorizedRate).toBe(0);
    expect(result.correctCoverageCount).toBe(2);
    expect(result.missingCoverageCount).toBe(0);
  });

  it('marks missing expected coverages and lowers coverage accuracy', () => {
    const golden = makeGolden();
    const actual = makePipelineOutput({
      coverages: [
        { canonicalName: 'Incendio (Edificio y Contenidos)', insuredAmount: 500000000, deductible: '10%' },
      ],
      rawCoverageCount: 1,
    });

    const result = evaluateFixture(golden, actual);

    expect(result.coverageAccuracy).toBe(0.5);
    expect(result.deductibleAccuracy).toBe(0.5);
    expect(result.missingCoverageCount).toBe(1);
  });

  it('flags deductible mismatch separately from coverage name', () => {
    const golden = makeGolden();
    const actual = makePipelineOutput({
      coverages: [
        { canonicalName: 'Incendio (Edificio y Contenidos)', insuredAmount: 500000000, deductible: '15%' },
        { canonicalName: 'Responsabilidad Civil (RCE)', insuredAmount: 100000000, deductible: '5 SMMLV' },
      ],
      rawCoverageCount: 2,
    });

    const result = evaluateFixture(golden, actual);

    expect(result.coverageAccuracy).toBe(1);
    expect(result.deductibleAccuracy).toBe(0.5);
  });

  it('counts uncategorized raw coverages toward uncategorized rate', () => {
    const golden = makeGolden();
    const actual = makePipelineOutput({
      coverages: [
        { canonicalName: 'Incendio (Edificio y Contenidos)', insuredAmount: 500000000, deductible: '10%' },
      ],
      uncategorizedCoverages: [{ canonicalName: 'Cobertura Rara', insuredAmount: 0, deductible: '' }],
      rawCoverageCount: 2,
    });

    const result = evaluateFixture(golden, actual);

    expect(result.coverageAccuracy).toBe(0.5);
    expect(result.uncategorizedRate).toBe(0.5);
  });

  it('ignores unexpected coverages when computing coverage accuracy', () => {
    const golden = makeGolden({ expectedCoverages: [makeGolden().expectedCoverages[0]] });
    const actual = makePipelineOutput({
      coverages: [
        { canonicalName: 'Incendio (Edificio y Contenidos)', insuredAmount: 500000000, deductible: '10%' },
        { canonicalName: 'Rotura de Maquinaria', insuredAmount: 50000000, deductible: 'No aplica' },
      ],
      rawCoverageCount: 2,
    });

    const result = evaluateFixture(golden, actual);

    expect(result.coverageAccuracy).toBe(1);
    expect(result.falsePositiveCoverageCount).toBe(1);
  });
});

describe('computeAggregateMetrics', () => {
  it('averages fixture results into aggregate metrics', () => {
    const results: FixtureResult[] = [
      {
        fixtureId: 'a',
        insurer: 'BBVA',
        coverageAccuracy: 1,
        deductibleAccuracy: 1,
        uncategorizedRate: 0,
        manualCompletionRate: 0,
        correctionRate: 0,
        correctCoverageCount: 2,
        missingCoverageCount: 0,
        falsePositiveCoverageCount: 0,
        deductibleMismatchCount: 0,
        uncategorizedCoverageCount: 0,
        expectedCoverageCount: 2,
        rawCoverageCount: 2,
        needsManualCompletion: false,
        regressions: [],
      },
      {
        fixtureId: 'b',
        insurer: 'SBS',
        coverageAccuracy: 0.5,
        deductibleAccuracy: 0.5,
        uncategorizedRate: 0.25,
        manualCompletionRate: 1,
        correctionRate: 0.5,
        correctCoverageCount: 1,
        missingCoverageCount: 1,
        falsePositiveCoverageCount: 0,
        deductibleMismatchCount: 1,
        uncategorizedCoverageCount: 1,
        expectedCoverageCount: 2,
        rawCoverageCount: 4,
        needsManualCompletion: true,
        regressions: [{ type: 'coverage', message: 'below threshold' }],
      },
    ];

    const aggregate = computeAggregateMetrics(results);

    expect(aggregate.coverageAccuracy).toBe(0.75);
    expect(aggregate.deductibleAccuracy).toBe(0.75);
    expect(aggregate.uncategorizedRate).toBe(0.125);
    expect(aggregate.manualCompletionRate).toBe(0.5);
    expect(aggregate.correctionRate).toBe(0.25);
    expect(aggregate.totalFixtures).toBe(2);
  });

  it('produces zero metrics for empty results', () => {
    const aggregate = computeAggregateMetrics([]);

    expect(aggregate.coverageAccuracy).toBe(0);
    expect(aggregate.deductibleAccuracy).toBe(0);
    expect(aggregate.uncategorizedRate).toBe(0);
    expect(aggregate.totalFixtures).toBe(0);
  });
});

describe('buildEvaluationReport', () => {
  it('flags regressions when metrics fall below thresholds', () => {
    const results: FixtureResult[] = [
      {
        fixtureId: 'bad',
        insurer: 'MAPFRE',
        coverageAccuracy: 0.6,
        deductibleAccuracy: 0.9,
        uncategorizedRate: 0.05,
        manualCompletionRate: 1,
        correctionRate: 0.4,
        correctCoverageCount: 3,
        missingCoverageCount: 2,
        falsePositiveCoverageCount: 0,
        deductibleMismatchCount: 0,
        uncategorizedCoverageCount: 0,
        expectedCoverageCount: 5,
        rawCoverageCount: 5,
        needsManualCompletion: true,
        regressions: [],
      },
    ];

    const report = buildEvaluationReport(results, {
      coverageAccuracyThreshold: 0.85,
      deductibleAccuracyThreshold: 0.8,
      uncategorizedRateThreshold: 0.1,
    });

    expect(report.regressions).toHaveLength(1);
    expect(report.regressions[0].fixtureId).toBe('bad');
    expect(report.regressions[0].type).toBe('coverage');
    expect(report.aggregate.coverageAccuracy).toBe(0.6);
  });

  it('reports per-insurer breakdown', () => {
    const results: FixtureResult[] = [
      { fixtureId: 'b1', insurer: 'BBVA', coverageAccuracy: 1, deductibleAccuracy: 1, uncategorizedRate: 0, manualCompletionRate: 0, correctionRate: 0, correctCoverageCount: 1, missingCoverageCount: 0, falsePositiveCoverageCount: 0, deductibleMismatchCount: 0, uncategorizedCoverageCount: 0, expectedCoverageCount: 1, rawCoverageCount: 1, needsManualCompletion: false, regressions: [] },
      { fixtureId: 's1', insurer: 'SBS', coverageAccuracy: 0.8, deductibleAccuracy: 0.9, uncategorizedRate: 0.1, manualCompletionRate: 1, correctionRate: 0.2, correctCoverageCount: 4, missingCoverageCount: 1, falsePositiveCoverageCount: 0, deductibleMismatchCount: 0, uncategorizedCoverageCount: 1, expectedCoverageCount: 5, rawCoverageCount: 6, needsManualCompletion: true, regressions: [] },
    ];

    const report = buildEvaluationReport(results);

    expect(report.perInsurer.BBVA.coverageAccuracy).toBe(1);
    expect(report.perInsurer.SBS.coverageAccuracy).toBe(0.8);
    expect(report.perInsurer.BBVA.fixtureCount).toBe(1);
  });
});

describe('loadGoldenSet', () => {
  it('loads all JSON fixtures from a directory', async () => {
    const fs = {
      readdir: async () => ['bbva-001.json', 'sbs-001.json'],
      readFile: async (filePath: string) => {
        if (filePath.endsWith('/bbva-001.json')) {
          return JSON.stringify(makeGolden({ fixtureId: 'bbva-001', insurer: 'BBVA' }));
        }
        return JSON.stringify(makeGolden({ fixtureId: 'sbs-001', insurer: 'SBS' }));
      },
    };

    const fixtures = await loadGoldenSet('/fixtures', fs as any);

    expect(fixtures).toHaveLength(2);
    expect(fixtures.map((f) => f.fixtureId).sort()).toEqual(['bbva-001', 'sbs-001']);
  });

  it('loads the real golden-set fixture directory', async () => {
    const fixturesDir = path.resolve(__dirname, '..', '..', '..', '..', 'tests', 'fixtures', 'golden-set');
    const fixtures = await loadGoldenSet(fixturesDir, {
      readdir: (dir) => fs.readdir(dir),
      readFile: (filePath) => fs.readFile(filePath, 'utf8'),
    });

    expect(fixtures.length).toBeGreaterThanOrEqual(30);
    const insurers = new Set(fixtures.map((f) => f.insurer));
    expect(insurers.has('BBVA')).toBe(true);
    expect(insurers.has('SBS')).toBe(true);
    expect(insurers.has('MAPFRE')).toBe(true);
    for (const f of fixtures) {
      expect(f.fixtureId).toBeDefined();
      expect(f.expectedCoverages.length).toBeGreaterThan(0);
      expect(f.annotatedBy).toBeDefined();
    }
  });

  it('skips non-JSON files and invalid entries', async () => {
    const fs = {
      readdir: async () => ['valid.json', 'notes.txt', 'invalid.json'],
      readFile: async (filePath: string) => {
        if (filePath.endsWith('/valid.json')) return JSON.stringify(makeGolden());
        if (filePath.endsWith('/invalid.json')) return '{"fixtureId": "x"}'; // missing required fields
        return 'not json';
      },
    };

    const fixtures = await loadGoldenSet('/fixtures', fs as any);

    expect(fixtures).toHaveLength(1);
    expect(fixtures[0].fixtureId).toBe('fixture-001');
  });
});
