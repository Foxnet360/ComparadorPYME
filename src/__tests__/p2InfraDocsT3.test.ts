import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { describe, expect, it } from 'vitest';

const repoRoot = path.resolve(__dirname, '../..');

describe('P2-T3: Multi-stage Dockerfile, README alignment & Smoke Tests (S3)', () => {
  it('configures Dockerfile as a real multi-stage build without compiler toolchain or duplicate tesauro copies in final stage', () => {
    const dockerfile = fs.readFileSync(path.join(repoRoot, 'Dockerfile'), 'utf-8');

    const stages = dockerfile.match(/^FROM\s+[^\n]+/gm) || [];
    expect(stages.length).toBeGreaterThanOrEqual(2);
    expect(dockerfile).toMatch(/^FROM\s+node:20-alpine\s+AS\s+builder/m);

    const finalStageIndex = dockerfile.lastIndexOf('FROM ');
    const finalStage = dockerfile.slice(finalStageIndex);

    expect(finalStage).not.toMatch(
      /\bpython3\b|\bmake\b|\bg\+\+\b|\bcairo-dev\b|\bpango-dev\b|\bpixman-dev\b/
    );
    expect(finalStage).toMatch(/\bgraphicsmagick\b/);
    expect(finalStage).toMatch(/\bghostscript\b/);
    expect(dockerfile).not.toMatch(/COPY\s+docs\/tesauro[^\n]*\s+\/app\/?$/m);
    expect(finalStage).toMatch(/COPY\s+--from=builder\s+\/app\/dist\s+/);
    expect(finalStage).toMatch(/COPY\s+--from=builder\s+\/app\/server\/dist\s+/);
  });

  it('aligns README.md with actual scripts, env.ts Gemini models, docs/DEPLOY.md, and implemented routes', () => {
    const readme = fs.readFileSync(path.join(repoRoot, 'README.md'), 'utf-8');

    expect(readme).not.toContain('DOMPurify');
    expect(readme).not.toContain('cd server\nnpm run dev');
    expect(readme).not.toContain('gemini-embedding-001');
    expect(readme).not.toContain('Gemini 2.5');
    expect(readme).not.toContain('/api/rag/clauses');
    expect(readme).not.toContain('/api/rag/search');
    expect(readme).toContain('npm run server:dev');
    expect(readme).toContain('docs/DEPLOY.md');
    expect(readme).toContain('gemini-4-hydrogen');
    expect(readme).toContain('gemini-embedding-2');
    expect(readme).toContain('GET /api');
  });

  it('fixes scripts/smoke-tests.sh against real Express routes and passes bash -n syntax check', () => {
    const smokePath = path.join(repoRoot, 'scripts/smoke-tests.sh');
    const smokeScript = fs.readFileSync(smokePath, 'utf-8');

    expect(smokeScript).not.toContain('/api/analysis/status');
    expect(smokeScript).not.toContain('/api/health/detailed');
    expect(smokeScript).not.toContain('/api/clauses/structured');
    expect(smokeScript).not.toContain('fluidArchitecture');

    expect(smokeScript).toContain('/health');
    expect(smokeScript).toContain('/api/features');
    expect(smokeScript).toContain('/api/analysis/extract-structured-clause');
    expect(smokeScript).toContain('/api/chat');
    expect(smokeScript).toContain('supabase');
    expect(smokeScript).toContain('AUTH_TOKEN');

    execFileSync('bash', ['-n', smokePath]);
  });
});
