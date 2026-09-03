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

describe('PR3 migration-prod-sync migrations', () => {
  it('3.1 migration 008 uses CREATE TABLE IF NOT EXISTS and removes non-existent clients FK', () => {
    const sql = readMigration('008_add_client_profiles.sql');

    expect(sql).toContain('CREATE TABLE IF NOT EXISTS client_profiles');
    expect(sql).not.toContain('REFERENCES clients(id)');
    expect(sql).toContain('client_id UUID');
  });

  it('3.2 migration 017 alters chunks.embedding to vector(3072) without ivfflat index error', () => {
    const sql = readMigration('017_align_embeddings_3072.sql');

    expect(sql).toContain('ALTER TABLE chunks ALTER COLUMN embedding TYPE vector(3072)');
    expect(sql).not.toMatch(/CREATE\s+INDEX.*USING\s+ivfflat.*vector\(3072\)/i);
  });

  it('3.3 migration 026 reconciles prod schema columns idempotently', () => {
    const sql = readMigration('026_reconcile_prod_schema.sql');

    expect(sql).toContain(
      'ALTER TABLE public.client_profiles ADD COLUMN IF NOT EXISTS user_id TEXT'
    );
    expect(sql).toContain(
      'ALTER TABLE public.analysis_history ADD COLUMN IF NOT EXISTS correlation_id TEXT'
    );
    expect(sql).toContain(
      'ALTER TABLE public.analysis_history ADD COLUMN IF NOT EXISTS quote_document_ids TEXT[]'
    );
    expect(sql).toContain(
      'ALTER TABLE public.analysis_history ADD COLUMN IF NOT EXISTS clause_document_ids TEXT[]'
    );
  });
});

describe('PR3 canonical embedding dimension documentation', () => {
  it('3.4 embedding-dimension.md documents 3072 vs 768 dimension strategy', () => {
    const md = readDoc('embedding-dimension.md');

    expect(md).toContain('gemini-embedding-2');
    expect(md).toContain('vector(3072)');
    expect(md).toContain('vector(768)');
    expect(md).toContain('2000-dimension limit');
  });
});
