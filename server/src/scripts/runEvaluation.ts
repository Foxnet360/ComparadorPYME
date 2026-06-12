/**
 * CLI entry point to run the golden-set evaluation harness locally.
 *
 * Usage:
 *   ts-node server/src/scripts/runEvaluation.ts [fixtures-dir]
 *
 * By default it uses an "echo" runner that treats the annotated expected
 * coverages as the actual extraction output. This is useful for validating the
 * harness and fixtures without calling external services. A non-zero exit code
 * is returned when any fixture regresses against the configured thresholds.
 */

import { promises as fs } from 'fs';
import path from 'path';
import {
  runEvaluation,
  EvaluationReport,
  PipelineOutput,
  PipelineRunner,
  DEFAULT_THRESHOLDS,
} from '../services/evaluationHarness';

const DEFAULT_FIXTURES_DIR = path.resolve(__dirname, '../../../tests/fixtures/golden-set');

function createEchoRunner(): PipelineRunner {
  return async (fixture): Promise<PipelineOutput> => ({
    insurerName: fixture.insurer,
    templateId: fixture.templateId,
    coverages: fixture.expectedCoverages.map((c) => ({ ...c })),
    uncategorizedCoverages: [],
    rawCoverageCount: fixture.expectedCoverages.length,
  });
}

export interface RunEvaluationCliResult {
  report: EvaluationReport;
  exitCode: number;
}

export async function main(args: string[] = process.argv.slice(2)): Promise<RunEvaluationCliResult> {
  const fixturesDir = args[0] ? path.resolve(args[0]) : DEFAULT_FIXTURES_DIR;

  if (!await fs.access(fixturesDir).then(() => true).catch(() => false)) {
    throw new Error(`Fixtures directory not found: ${fixturesDir}`);
  }

  const report = await runEvaluation(fixturesDir, createEchoRunner(), fs, {
    thresholds: DEFAULT_THRESHOLDS,
    onProgress: (completed, total) => {
      console.log(`⏳ Evaluated ${completed}/${total} fixtures`);
    },
  });

  console.log('\n📊 Golden-set evaluation report');
  console.log(`   Fixtures: ${report.aggregate.totalFixtures}`);
  console.log(`   Coverage accuracy: ${(report.aggregate.coverageAccuracy * 100).toFixed(1)}%`);
  console.log(`   Deductible accuracy: ${(report.aggregate.deductibleAccuracy * 100).toFixed(1)}%`);
  console.log(`   Uncategorized rate: ${(report.aggregate.uncategorizedRate * 100).toFixed(1)}%`);
  console.log(`   Manual completion rate: ${(report.aggregate.manualCompletionRate * 100).toFixed(1)}%`);
  console.log(`   Correction rate: ${(report.aggregate.correctionRate * 100).toFixed(1)}%`);
  console.log(`   Regressions: ${report.regressions.length}`);

  if (report.regressions.length > 0) {
    console.log('\n❌ Regressions detected:');
    for (const regression of report.regressions) {
      console.log(`   - ${regression.fixtureId} (${regression.type}): ${regression.message}`);
    }
  } else {
    console.log('\n✅ No regressions detected.');
  }

  return {
    report,
    exitCode: report.regressions.length > 0 ? 1 : 0,
  };
}

if (require.main === module) {
  main()
    .then(({ exitCode }) => {
      process.exit(exitCode);
    })
    .catch((error) => {
      console.error('❌ Evaluation failed:', error.message);
      process.exit(1);
    });
}
