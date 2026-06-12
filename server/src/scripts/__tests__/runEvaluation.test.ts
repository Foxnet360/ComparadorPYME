import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import { main, RunEvaluationCliResult } from '../runEvaluation';

async function createTempFixturesDir(): Promise<string> {
  const dir = path.join('/tmp', `golden-cli-test-${Date.now()}`);
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

async function writeFixture(dir: string, fixture: any): Promise<void> {
  await fs.writeFile(path.join(dir, `${fixture.fixtureId}.json`), JSON.stringify(fixture, null, 2));
}

async function cleanup(dir: string): Promise<void> {
  await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
}

describe('runEvaluation CLI', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await createTempFixturesDir();
  });

  afterEach(async () => {
    await cleanup(tempDir);
  });

  it('returns success and perfect metrics for a valid fixture', async () => {
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

    const { report, exitCode } = await main([tempDir]);

    expect(exitCode).toBe(0);
    expect(report.aggregate.totalFixtures).toBe(1);
    expect(report.aggregate.coverageAccuracy).toBe(1);
    expect(report.aggregate.deductibleAccuracy).toBe(1);
    expect(report.regressions).toHaveLength(0);
  });

  it('throws when the fixtures directory does not exist', async () => {
    await expect(main([path.join(tempDir, 'missing')])).rejects.toThrow('Fixtures directory not found');
  });
});
