import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const MIGRATIONS_DIR = path.join(__dirname, '../../../server/supabase/migrations');
const REPO_ROOT = path.join(__dirname, '../../..');

function readMigration(name: string): string {
  return fs.readFileSync(path.join(MIGRATIONS_DIR, name), 'utf-8');
}

describe('PR4 orphan-writers migrations and cleanup', () => {
  it('4.1 migration 027 creates analysis_logs and unified_engine_errors with RLS', () => {
    const sql = readMigration('027_monitoring_and_error_logs.sql');

    expect(sql).toContain('CREATE TABLE IF NOT EXISTS public.analysis_logs');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS public.unified_engine_errors');
    expect(sql).toContain('ALTER TABLE public.analysis_logs ENABLE ROW LEVEL SECURITY');
    expect(sql).toContain('ALTER TABLE public.unified_engine_errors ENABLE ROW LEVEL SECURITY');
  });

  it('4.2 documentRepository.ts is removed from codebase', () => {
    const targetFile = path.join(REPO_ROOT, 'server/src/repositories/documentRepository.ts');
    expect(fs.existsSync(targetFile)).toBe(false);
  });
});
