import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import { main, createPipelineRunner} from '../runEvaluation';
import { GoldenQuote } from '../services/evaluationHarness';

// ---------------------------------------------------------------------------
// Mocks for the pipeline runner
// ---------------------------------------------------------------------------

vi.mock('../../services/pdfExtractor', () => ({
  pdfExtractor: {
    extractTextFromPdf: vi.fn(),
  },
}));

vi.mock('../../services/gemini', () => ({
  geminiService: {
    extractFromPdfWithVision: vi.fn(),
    extractDeductible: vi.fn(),
    extractStructured: vi.fn(),
  },
}));

vi.mock('../../../config/featureFlags', () => ({
  featureFlags: {
    isEnabled: vi.fn(),
    getFlags: vi.fn(),
    updateFlag: vi.fn(),
  },
}));

vi.mock('../../services/vector/embeddingService', () => ({
  embeddingService: {
    generateEmbedding: vi.fn(),
    generateEmbeddingsBatch: vi.fn(),
    cosineSimilarity: vi.fn(),
  },
}));

vi.mock('../../services/coverageGraphService', () => ({
  coverageGraphService: {
    query: vi.fn(),
    queryDeductible: vi.fn(),
  },
}));

vi.mock('../../services/reconciliationService', () => ({
  reconciliationService: {
    reconcileQuote: vi.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function createTempFixturesDir(): Promise<string> {
  const dir = path.join('/tmp', `golden-cli-test-${Date.now()}`);
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

async function writeFixture(
  dir: string,
  fixture: { fixtureId: string } & Record<string, unknown>
): Promise<void> {
  await fs.writeFile(path.join(dir, `${fixture.fixtureId}.json`), JSON.stringify(fixture, null, 2));
}

async function cleanup(dir: string): Promise<void> {
  await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
}

function makeFixture(overrides: Partial<GoldenQuote> = {}): GoldenQuote {
  return {
    fixtureId: 'bbva-001',
    insurer: 'BBVA',
    templateId: 'bbva-pyme-v1',
    fileName: 'bbva-001.pdf',
    pdfText: 'BBVA SEGUROS COBERTURAS',
    pageTextItems: [
      {
        page: 1,
        items: [
          { text: 'BBVA SEGUROS', x: 0, y: 0, width: 100, height: 12 },
          { text: 'Cobertura', x: 0, y: 20, width: 50, height: 12 },
        ],
      },
    ],
    expectedCoverages: [
      { canonicalName: 'Incendio (Edificio y Contenidos)', insuredAmount: 500000000, deductible: '10%' },
    ],
    annotatedBy: 'analyst-a',
    ...overrides,
  } as GoldenQuote;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('runEvaluation CLI', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await createTempFixturesDir();
  });

  afterEach(async () => {
    await cleanup(tempDir);
  });

  it('returns success and perfect metrics with the echo runner', async () => {
    await writeFixture(tempDir, {
      fixtureId: 'bbva-001',
      insurer: 'BBVA',
      templateId: 'bbva-pyme-v1',
      fileName: 'bbva-001.pdf',
      expectedCoverages: [
        { canonicalName: 'Incendio (Edificio y Contenidos)', insuredAmount: 500000000, deductible: '10%' },
      ],
      annotatedBy: 'analyst-a',
    });

    const { report, exitCode } = await main([tempDir, '--runner=echo']);

    expect(exitCode).toBe(0);
    expect(report.aggregate.totalFixtures).toBe(1);
    expect(report.aggregate.coverageAccuracy).toBe(1);
    expect(report.aggregate.deductibleAccuracy).toBe(1);
    expect(report.regressions).toHaveLength(0);
  });

  it('defaults to the pipeline runner when no --runner flag is provided', async () => {
    await writeFixture(tempDir, makeFixture());

    const { report, exitCode } = await main([tempDir]);

    expect(exitCode).toBe(0);
    expect(report.aggregate.totalFixtures).toBe(1);
    expect(report.aggregate.coverageAccuracy).toBe(1);
    expect(report.regressions).toHaveLength(0);
  }, 15_000);

  it('throws when the fixtures directory does not exist', async () => {
    await expect(main([path.join(tempDir, 'missing')])).rejects.toThrow('Fixtures directory not found');
  });

  it('throws for an unknown runner flag', async () => {
    await expect(main([tempDir, '--runner=unknown'])).rejects.toThrow('Unknown runner');
  });
});

describe('createPipelineRunner', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await createTempFixturesDir();
  });

  afterEach(async () => {
    await cleanup(tempDir);
  });

  it('invokes processQuoteMultimodal and returns the expected pipeline output', async () => {
    const fixture = makeFixture();
    const runner = await createPipelineRunner();

    const output = await runner(fixture);

    expect(output.insurerName).toBe('BBVA');
    expect(output.templateId).toBe('bbva-pyme-v1');
    const present = output.coverages.filter(
      (c) => c.canonicalName === 'Incendio (Edificio y Contenidos)'
    );
    expect(present.length).toBe(1);
    expect(present[0].insuredAmount).toBe(500000000);
    expect(present[0].deductible).toBe('10%');
    expect(output.rawCoverageCount).toBeGreaterThan(0);
  }, 15_000);

  it('restores mocked services after the runner finishes', async () => {
    const fixture = makeFixture();
    const runner = await createPipelineRunner();

    await runner(fixture);

    // If the restoration logic is broken, these properties would still be the
    // mock arrow functions we assigned inside the runner.
    expect(typeof (await import('../../services/pdfExtractor')).pdfExtractor.extractTextFromPdf).toBe('function');
    expect(typeof (await import('../../services/gemini')).geminiService.extractFromPdfWithVision).toBe('function');
  }, 15_000);
});
