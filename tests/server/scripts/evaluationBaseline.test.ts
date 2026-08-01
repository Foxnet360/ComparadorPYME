import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const DOCS_DIR = path.join(__dirname, '../../../docs');

describe('PR7 evaluation-baseline verification', () => {
  it('7.1 golden-set-baseline.md documents 93.6% coverage accuracy and 93.7% deductible accuracy', () => {
    const md = fs.readFileSync(path.join(DOCS_DIR, 'golden-set-baseline.md'), 'utf-8');

    expect(md).toContain('93.6%');
    expect(md).toContain('93.7%');
    expect(md).toContain('30');
    expect(md).toContain('Coverage Accuracy');
    expect(md).toContain('Deductible Accuracy');
  });

  it('7.2 golden-set-baseline.md documents threshold gates and CI consumption recipe', () => {
    const md = fs.readFileSync(path.join(DOCS_DIR, 'golden-set-baseline.md'), 'utf-8');

    expect(md).toContain('≥ 85.0%');
    expect(md).toContain('≥ 80.0%');
    expect(md).toContain('CI Consumption');
    expect(md).toContain('npm run evaluate:golden');
  });
});
