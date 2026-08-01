import { describe, it, expect, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const MIGRATIONS_DIR = path.join(__dirname, '../../../server/supabase/migrations');
const REPO_ROOT = path.join(__dirname, '../../..');

describe('PR6 clause-domain-plumbing verification', () => {
  it('6.1 migration 028 adds p_domain filter parameter to search_structured_clauses', () => {
    const sql = fs.readFileSync(
      path.join(MIGRATIONS_DIR, '028_domain_aware_clause_search.sql'),
      'utf-8'
    );

    expect(sql).toContain('p_domain TEXT DEFAULT NULL');
    expect(sql).toContain('AND (p_domain IS NULL OR sc.domain = p_domain)');
    expect(sql).toContain('SET search_path = public, pg_temp');
  });

  it('6.2 structuredClauseExtractor.searchClause passes domain to RPC', () => {
    const code = fs.readFileSync(
      path.join(REPO_ROOT, 'server/src/services/structuredClauseExtractor.ts'),
      'utf-8'
    );

    expect(code).toContain('domain?: string');
    expect(code).toContain('p_domain: domain || null');
  });

  it('6.3 reconciliationService passes options.domain to searchClause', () => {
    const code = fs.readFileSync(
      path.join(REPO_ROOT, 'server/src/services/reconciliationService.ts'),
      'utf-8'
    );

    expect(code).toContain('structuredClauseExtractor.searchClause(insurerName, undefined, options.domain)');
  });

  it('6.4 seedClauses.ts includes domain in document metadata', () => {
    const code = fs.readFileSync(
      path.join(REPO_ROOT, 'server/src/scripts/seedClauses.ts'),
      'utf-8'
    );

    expect(code).toContain("domain: (entry as { domain?: string }).domain || 'pyme'");
  });
});
