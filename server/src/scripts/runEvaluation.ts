/**
 * CLI entry point to run the golden-set evaluation harness locally.
 *
 * Usage:
 *   ts-node server/src/scripts/runEvaluation.ts [fixtures-dir] [--runner=echo|pipeline]
 *
 * The default runner invokes the real multimodal extraction pipeline
 * (processQuoteMultimodal) with the LLM/vision and embedding calls mocked so the
 * harness can run without real API keys. The "echo" runner treats the annotated
 * expected coverages as the actual extraction output and is kept as a fast
 * fallback for validating the harness and fixtures.
 *
 * A non-zero exit code is returned when any fixture regresses against the
 * configured thresholds.
 */

// Provide harmless defaults for the credentials that env.ts validates. This lets
// the local evaluation script run without a real .env file, because every
// external service call is mocked inside the pipeline runner.
const REQUIRED_ENV_DEFAULTS: Record<string, string> = {
  GEMINI_API_KEY: 'evaluation-dummy-key',
  SUPABASE_URL: 'https://evaluation-dummy.supabase.co',
  SUPABASE_ANON_KEY: 'evaluation-dummy-key',
  SUPABASE_SERVICE_ROLE_KEY: 'evaluation-dummy-key',
  SUPABASE_JWT_SECRET: 'evaluation-dummy-key',
  REDIS_URL: 'redis://localhost:6379',
  NODE_ENV: 'test',
  LOG_LEVEL: 'warn',
};

for (const [key, value] of Object.entries(REQUIRED_ENV_DEFAULTS)) {
  if (!process.env[key]) {
    process.env[key] = value;
  }
}

import { promises as fs } from 'fs';
import path from 'path';
import {
  runEvaluation,
  EvaluationReport,
  PipelineOutput,
  PipelineRunner,
  DEFAULT_THRESHOLDS,
  GoldenQuote,
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

function buildSyntheticExtraction(fixture: GoldenQuote): any {
  return {
    insurerName: fixture.insurer,
    policyName: `${fixture.insurer} PYME Policy`,
    premium: {
      netPremium: 7_000_000,
      fees: 500_000,
      taxes: 1_000_000,
      otherCharges: 0,
      totalPayable: 8_500_000,
      currency: 'COP',
      periodicity: 'anual',
    },
    currency: 'COP',
    validityPeriod: '2024-01-01 - 2024-12-31',
    insuredAssets: [],
    rawCoverages: fixture.expectedCoverages.map((c) => ({
      rawName: c.canonicalName,
      insuredAmount: c.insuredAmount ?? 0,
      deductible: c.deductible || 'No aplica',
      premium: 0,
    })),
    subLimits: [],
    generalDeductibles: [],
    specialConditions: [],
    exclusions: [],
    warranties: [],
  };
}

function parseAmount(value?: string): number {
  if (!value || value === 'NO ESPECIFICADO') return 0;
  return parseInt(value.replace(/\D/g, ''), 10) || 0;
}

function makeFakeMulterFile(filename: string): Express.Multer.File {
  return {
    path: '/tmp/evaluation-mock.pdf',
    originalname: filename,
    mimetype: 'application/pdf',
    size: 0,
    fieldname: 'quote',
    filename,
    destination: '/tmp',
    encoding: 'utf8',
    buffer: Buffer.from(''),
    stream: null as any,
  } as Express.Multer.File;
}

export async function createPipelineRunner(): Promise<PipelineRunner> {
  // Dynamic imports are used so the environment defaults above are set before
  // any module that transitively imports env.ts is loaded.
  const [{ processQuoteMultimodal }, { pdfExtractor }, { geminiService }, { featureFlags }, { embeddingService }, { coverageGraphService }, { reconciliationService }] =
    await Promise.all([
      import('../services/quoteProcessingService'),
      import('../services/pdfExtractor'),
      import('../services/gemini'),
      import('../config/featureFlags'),
      import('../services/vector/embeddingService'),
      import('../services/coverageGraphService'),
      import('../services/reconciliationService'),
    ]);

  const originals = {
    extractTextFromPdf: pdfExtractor.extractTextFromPdf,
    extractFromPdfWithVision: geminiService.extractFromPdfWithVision,
    extractDeductible: geminiService.extractDeductible,
    isEnabled: featureFlags.isEnabled,
    generateEmbedding: embeddingService.generateEmbedding,
    generateEmbeddingsBatch: embeddingService.generateEmbeddingsBatch,
    cosineSimilarity: embeddingService.cosineSimilarity,
    graphQuery: coverageGraphService.query,
    graphQueryDeductible: coverageGraphService.queryDeductible,
    reconcileQuote: reconciliationService.reconcileQuote,
  };

  const mockEmbedding = Array(768)
    .fill(0)
    .map((_, i) => i / 768);

  return async (fixture): Promise<PipelineOutput> => {
    pdfExtractor.extractTextFromPdf = async () => ({
      text: fixture.pdfText || '',
      pageTextMap: { 1: fixture.pdfText || '' },
      pageTextItems: fixture.pageTextItems || [],
      metadata: { pageCount: 1 },
    });

    geminiService.extractFromPdfWithVision = async () => buildSyntheticExtraction(fixture);
    geminiService.extractDeductible = async () => ({
      components: [{ type: 'unknown', value: 0 }],
      isZero: false,
      hasMinimum: false,
      hasMaximum: false,
      isComposite: false,
    });

    featureFlags.isEnabled = (flag: string) =>
      flag === 'useTemplateGraphPipeline' ||
      flag === 'semanticCoverageOntology' ||
      flag === 'templateBbvaV1' ||
      flag === 'templateSbsV1' ||
      flag === 'templateMapfreV1';

    embeddingService.generateEmbedding = async () => mockEmbedding;
    embeddingService.generateEmbeddingsBatch = async (texts: string[]) =>
      texts.map((text) => ({
        text,
        embedding: mockEmbedding,
        model: 'gemini-embedding-001',
      }));
    embeddingService.cosineSimilarity = () => 0.95;

    coverageGraphService.query = async () => ({ mappings: [], composite: false });
    coverageGraphService.queryDeductible = async () => [];
    reconciliationService.reconcileQuote = async () => [];

    try {
      const parsed = await processQuoteMultimodal(
        makeFakeMulterFile(fixture.fileName),
        0,
        1,
        { domain: 'pyme' }
      );

      return {
        insurerName: parsed.insurerName,
        templateId: fixture.templateId,
        coverages: parsed.coverages
          .filter((c) => c.value !== 'NO ESPECIFICADO')
          .map((c) => ({
            canonicalName: c.canonicalName || c.name,
            insuredAmount: parseAmount(c.value),
            deductible: c.deductible,
            premium: c.premium ?? 0,
          })),
        uncategorizedCoverages: (parsed.uncategorizedCoverages || []).map((c) => ({
          canonicalName: c.canonicalName || c.name,
          insuredAmount: parseAmount(c.value),
          deductible: c.deductible,
          premium: c.premium ?? 0,
        })),
        rawCoverageCount:
          parsed.coverages.length + (parsed.uncategorizedCoverages?.length || 0),
      };
    } finally {
      pdfExtractor.extractTextFromPdf = originals.extractTextFromPdf;
      geminiService.extractFromPdfWithVision = originals.extractFromPdfWithVision;
      geminiService.extractDeductible = originals.extractDeductible;
      featureFlags.isEnabled = originals.isEnabled;
      embeddingService.generateEmbedding = originals.generateEmbedding;
      embeddingService.generateEmbeddingsBatch = originals.generateEmbeddingsBatch;
      embeddingService.cosineSimilarity = originals.cosineSimilarity;
      coverageGraphService.query = originals.graphQuery;
      coverageGraphService.queryDeductible = originals.graphQueryDeductible;
      reconciliationService.reconcileQuote = originals.reconcileQuote;
    }
  };
}

export interface RunEvaluationCliResult {
  report: EvaluationReport;
  exitCode: number;
}

function parseCliArgs(args: string[]): { fixturesDir: string; runner: 'echo' | 'pipeline' } {
  let fixturesDir: string | undefined;
  let runner: 'echo' | 'pipeline' = 'pipeline';

  for (const arg of args) {
    if (arg.startsWith('--runner=')) {
      const value = arg.slice('--runner='.length);
      if (value !== 'echo' && value !== 'pipeline') {
        throw new Error(`Unknown runner "${value}". Use "echo" or "pipeline".`);
      }
      runner = value;
    } else if (!arg.startsWith('--')) {
      fixturesDir = arg;
    }
  }

  return {
    fixturesDir: fixturesDir ? path.resolve(fixturesDir) : DEFAULT_FIXTURES_DIR,
    runner,
  };
}

export async function main(args: string[] = process.argv.slice(2)): Promise<RunEvaluationCliResult> {
  const { fixturesDir, runner } = parseCliArgs(args);

  if (!(await fs.access(fixturesDir).then(() => true).catch(() => false))) {
    throw new Error(`Fixtures directory not found: ${fixturesDir}`);
  }

  const selectedRunner = runner === 'echo' ? createEchoRunner() : await createPipelineRunner();

  const report = await runEvaluation(fixturesDir, selectedRunner, fs, {
    thresholds: DEFAULT_THRESHOLDS,
    onProgress: (completed, total) => {
      console.log(`⏳ Evaluated ${completed}/${total} fixtures`);
    },
  });

  console.log('\n📊 Golden-set evaluation report');
  console.log(`   Runner: ${runner}`);
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
