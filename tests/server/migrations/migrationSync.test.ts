import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const MIGRATIONS_DIR = path.join(__dirname, '../../../server/supabase/migrations');
const DOCS_DIR = path.join(__dirname, '../../../docs');

function readMigration(name: string): string {
  return fs.readFileSync(path.join(MIGRATIONS_DIR, name), 'utf-8');
}

function readDoc(name: string): string {
  return fs.readFileSync(path.join(DOCS_DIR, name), 'utf-8');
}

// The individual pre-consolidation migrations (008/017/026) were intentionally
// folded into the baseline 001_initial_schema by 7a38962. These tests assert the
// consolidated ledger instead of the removed files.
describe('consolidated baseline 001 schema', () => {
  it('3.1 client_profiles uses CREATE TABLE IF NOT EXISTS without non-existent clients FK', () => {
    const sql = readMigration('001_initial_schema.sql');

    expect(sql).toContain('CREATE TABLE IF NOT EXISTS public.client_profiles');
    expect(sql).not.toContain('REFERENCES clients(id)');
    expect(sql).toContain('client_id UUID');
  });

  it('3.2 chunks.embedding is vector(3072) without ivfflat index error', () => {
    const sql = readMigration('001_initial_schema.sql');

    expect(sql).toContain('embedding vector(3072)');
    expect(sql).not.toMatch(/CREATE\s+INDEX.*USING\s+ivfflat.*vector\(3072\)/i);
  });

  it('3.3 analysis_history carries the prod-reconciled columns', () => {
    const sql = readMigration('001_initial_schema.sql');

    expect(sql).toContain('correlation_id TEXT');
    expect(sql).toContain('quote_document_ids UUID[]');
    expect(sql).toContain('clause_document_ids UUID[]');
  });
});

describe('PR3 canonical embedding dimension documentation', () => {
  it('3.4 embedding-dimension.md documents 3072 vs 768 dimension strategy', () => {
    const md = readDoc('embedding-dimension.md');

    expect(md).toContain('gemini-embedding-2');
    expect(md).toContain('vector(3072)');
    expect(md).toContain('vector(768)');
    expect(md).toContain('2000-dimension limit');
    expect(md).toContain('halfvec(3072)');
  });
});

describe('migration directory parity (026+)', () => {
  const ROOT_MIGRATIONS_DIR = path.join(__dirname, '../../../supabase/migrations');

  it('keeps server/supabase/migrations (026+) in byte-for-byte parity with supabase/migrations', () => {
    const canonicalFiles = fs
      .readdirSync(MIGRATIONS_DIR)
      .filter((f) => /^\d{3}_.*\.sql$/.test(f))
      .filter((f) => Number(f.slice(0, 3)) >= 26)
      .sort();

    const mirrorFiles = fs.readdirSync(ROOT_MIGRATIONS_DIR);

    for (const file of canonicalFiles) {
      const seq = file.slice(0, 3);
      const rest = file.slice(3); // includes leading underscore
      const match = mirrorFiles.find((m) => m.endsWith(`000${seq}${rest}`));
      expect(match, `Missing supabase/migrations mirror for ${file}`).toBeDefined();
      const canonicalSql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf-8');
      const mirrorSql = fs.readFileSync(path.join(ROOT_MIGRATIONS_DIR, match!), 'utf-8');
      expect(mirrorSql, `Drift detected between ${file} and ${match}`).toBe(canonicalSql);
    }
  });
});
