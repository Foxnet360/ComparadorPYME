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

// The individual pre-consolidation migrations (023/024/025) were intentionally
// folded into the baseline 001_initial_schema by 7a38962, and the RPC functions
// were reconstructed in 021. These tests assert the consolidated ledger.
describe('consolidated baseline 001 security hardening', () => {
  it('1.1 RLS enabled on template_registry and coverage_graph_edges', () => {
    const sql = readMigration('001_initial_schema.sql');

    expect(sql).toContain('ALTER TABLE public.template_registry ENABLE ROW LEVEL SECURITY');
    expect(sql).toContain('ALTER TABLE public.coverage_graph_edges ENABLE ROW LEVEL SECURITY');
    // 7a38962 deliberately added permissive public-read policies on lookup
    // tables; RLS stays enabled so stricter policies can replace them.
    expect(sql).toMatch(/CREATE POLICY.*template_registry/i);
    expect(sql).toMatch(/CREATE POLICY.*coverage_graph_edges/i);
  });

  it('1.2 every reconstructed RPC pins search_path = public, pg_temp', () => {
    const sql = readMigration('021_recreate_rpc_functions.sql');

    const functionCount = (sql.match(/CREATE OR REPLACE FUNCTION/g) || []).length;
    const pinnedCount = (sql.match(/SET search_path = public, pg_temp/g) || []).length;

    expect(functionCount).toBeGreaterThan(0);
    expect(pinnedCount).toBe(functionCount);
  });

  it('1.3 document_insurer_view uses security_invoker', () => {
    const sql = readMigration('001_initial_schema.sql');

    expect(sql).toMatch(
      /CREATE\s+(OR REPLACE\s+)?VIEW\s+public\.document_insurer_view\s+WITH\s*\(\s*security_invoker\s*=\s*true\s*\)/i
    );
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
