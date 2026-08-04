import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const REPO_ROOT = path.join(__dirname, '../..');

// PR2 confirmed-dead files and directories (relative to REPO_ROOT).
const PR2_DELETIONS: string[] = [
  // Batch A: accident junk and logs
  '1',
  'nul',
  'docker',
  'frontend.log',
  'frontend.pid',
  'metadata.json',
  '.deploy-trigger.md',
  'server/backend.log',
  'server/backend.pid',
  'server/vitest-log.txt',

  // Batch B: stale tsc output
  'constants.js',
  'types.js',

  // Batch C: orphaned modules
  'rollback-scoring.ts',
  'test-server.js',
  'lib/fetchWithRetry.ts',
  'schemas/note.ts',
  'shared',
  'styles/premium.css',
  'utils/winnerDetection.ts',
  'components/ErrorBoundary.tsx',
  'components/FeedbackCollector.tsx',
  'hooks/useFocusTrap.ts',
  'server/src/services/coverageValueValidator.ts',

  // Batch D: dead tests
  'tests/winnerDetection.test.ts',
  'tests/coverageValueValidator.test.ts',
  'tests/errors.test.ts',

  // Batch E: stale design inputs
  'csa-prop.json',
  'csa-prop.txt',
  'csa-prop2.txt',
  'csa-proposal-instructions.json',
  'csa-instructions.md',
];

// Subset that could be referenced via imports by surviving code.
const IMPORTABLE_DELETIONS: string[] = [
  'rollback-scoring.ts',
  'test-server.js',
  'lib/fetchWithRetry.ts',
  'schemas/note.ts',
  'shared',
  'styles/premium.css',
  'utils/winnerDetection.ts',
  'components/ErrorBoundary.tsx',
  'components/FeedbackCollector.tsx',
  'hooks/useFocusTrap.ts',
  'server/src/services/coverageValueValidator.ts',
];

const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.css']);
const SKIPPED_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'coverage',
  'Ejemplos',
  'uploads',
  '.venv',
]);

function isDeletionTarget(relPath: string): boolean {
  return PR2_DELETIONS.some((target) => relPath === target || relPath.startsWith(`${target}/`));
}

function walkDir(dir: string, callback: (filePath: string) => void): void {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (SKIPPED_DIRS.has(entry.name)) {
      continue;
    }
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkDir(fullPath, callback);
    } else {
      callback(fullPath);
    }
  }
}

function getSurvivingSourceFiles(): string[] {
  const files: string[] = [];
  walkDir(REPO_ROOT, (fullPath) => {
    const relPath = path.relative(REPO_ROOT, fullPath);
    if (isDeletionTarget(relPath)) {
      return;
    }
    if (SOURCE_EXTENSIONS.has(path.extname(fullPath))) {
      files.push(relPath);
    }
  });
  return files;
}

function hasImport(content: string, moduleName: string): boolean {
  const base = moduleName.replace(/\.(ts|tsx|js|jsx|css)$/, '');
  const escaped = base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  const patterns = [
    // ES imports/exports with relative path containing the module name
    new RegExp(
      `(?:import|export).*?(?:from\\s+['"]\\.{0,2}/[^'"]*${escaped}['"]|['"]\\.{0,2}/[^'"]*${escaped}['"])`,
      'i'
    ),
    // CommonJS require with relative path
    new RegExp(`require\\s*\\(\\s*['"]\\.{0,2}/[^'"]*${escaped}['"]\\s*\\)`, 'i'),
    // Dynamic import / require by bare basename
    new RegExp(`(?:import|require)\\s*\\(\\s*['"]${escaped}['"]\\s*\\)`, 'i'),
    // Side-effect import
    new RegExp(`\\bimport\\s+['"]${escaped}['"]`, 'i'),
  ];

  return patterns.some((p) => p.test(content));
}

describe('PR2 dead-code purge verification', () => {
  it('all PR2 deletion targets are absent from the worktree', () => {
    const stillPresent: string[] = [];
    for (const rel of PR2_DELETIONS) {
      const fullPath = path.join(REPO_ROOT, rel);
      if (fs.existsSync(fullPath)) {
        stillPresent.push(rel);
      }
    }
    expect(
      stillPresent,
      `expected PR2 deletion targets to be removed, still present: ${stillPresent.join(', ')}`
    ).toEqual([]);
  });

  it('no surviving source file imports a deleted module', () => {
    const sourceFiles = getSurvivingSourceFiles();
    const violations: string[] = [];

    for (const relPath of sourceFiles) {
      const fullPath = path.join(REPO_ROOT, relPath);
      const content = fs.readFileSync(fullPath, 'utf-8');
      for (const moduleName of IMPORTABLE_DELETIONS) {
        if (hasImport(content, moduleName)) {
          violations.push(`${relPath} imports ${moduleName}`);
        }
      }
    }

    expect(
      violations,
      `expected zero surviving imports of deleted modules, found: ${violations.join('; ')}`
    ).toEqual([]);
  });
});
