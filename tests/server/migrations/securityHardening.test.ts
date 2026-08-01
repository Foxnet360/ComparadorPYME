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

describe('PR1 security-hardening migrations', () => {
  it('1.1 migration 023 enables RLS on template_registry and coverage_graph_edges without policies', () => {
    const sql = readMigration('023_rls_template_and_graph.sql');

    expect(sql).toContain('ALTER TABLE IF EXISTS public.template_registry ENABLE ROW LEVEL SECURITY');
    expect(sql).toContain('ALTER TABLE IF EXISTS public.coverage_graph_edges ENABLE ROW LEVEL SECURITY');
    expect(sql).not.toMatch(/CREATE\s+POLICY.*template_registry/i);
    expect(sql).not.toMatch(/CREATE\s+POLICY.*coverage_graph_edges/i);
  });

  it('1.2 migration 024 pins search_path on all 19 mutable-search_path functions', () => {
    const sql = readMigration('024_fix_rpc_search_path.sql');

    const expectedFunctions = [
      'update_updated_at_column()',
      'search_chunks_by_coverage(vector(3072), uuid, text, integer)',
      'search_chunks_advanced(vector(3072), uuid, text[], text[], text[], integer, double precision)',
      'validate_quote_coverage(uuid, uuid, text, integer)',
      'get_chunks_with_images(uuid[])',
      'list_documents_by_insurer(uuid, text)',
      'delete_document_complete(uuid)',
      'match_clauses(vector(768), text, text, text[], text, integer)',
      'match_clauses_vector(vector(768), text, text[], integer)',
      'get_clauses_by_coverage(text, text, text, integer)',
      'normalize_clause_content()',
      'match_chunks_unified(vector(3072), text, text, text[], text, integer)',
      'match_chunks_vector_unified(vector(3072), text, text[], integer)',
      'get_chunks_by_coverage_unified(text, text, text, integer)',
      'match_chunks_hybrid(vector(3072), text, text, text[], text, integer, double precision, double precision)',
      'search_structured_clauses(text, text, text, integer)',
      'get_clause_deductible(text, text)',
      'expand_search_query(text, jsonb)',
      'index_document_transaction(uuid, text, text, text, integer, text, text, jsonb, jsonb, text)',
    ];

    for (const fn of expectedFunctions) {
      expect(sql).toContain(`ALTER FUNCTION IF EXISTS ${fn} SET search_path = public, pg_temp;`);
    }

    expect(sql.match(/SET search_path = public, pg_temp/g)?.length).toBe(19);
  });

  it('1.3 migration 025 recreates document_insurer_view with security_invoker', () => {
    const sql = readMigration('025_document_insurer_view_invoker.sql');

    expect(sql).toContain('DROP VIEW IF EXISTS public.document_insurer_view');
    expect(sql).toMatch(/CREATE\s+(OR REPLACE\s+)?VIEW\s+public\.document_insurer_view\s+WITH\s*\(\s*security_invoker\s*=\s*true\s*\)/i);
    expect(sql).toContain('FROM public.documents d');
    expect(sql).toContain('JOIN public.insurers i ON d.insurer_id = i.id');
  });
});

describe('PR1 security-hardening runbook', () => {
  it('1.4 security-runbook documents Supabase Auth leaked-password protection verification', () => {
    const md = readDoc('security-runbook.md');

    expect(md).toMatch(/leaked-password protection/i);
    expect(md).toMatch(/project\s*settings\s*\/?\s*auth/i);
    expect(md).toMatch(/verified on:\s*\d{4}-\d{2}-\d{2}/i);
  });
});
