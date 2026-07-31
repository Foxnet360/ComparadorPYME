import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const migrationsDir = path.resolve(__dirname, '..', '..', '..', 'supabase', 'migrations');

describe('migration 022_coverage_mappings_domain_scoped', () => {
  const migrationPath = path.join(migrationsDir, '022_coverage_mappings_domain_scoped.sql');
  const indexPath = path.join(
    migrationsDir,
    '022b_coverage_mappings_domain_index_concurrently.sql'
  );

  it('exists alongside the concurrent index migration', () => {
    expect(fs.existsSync(migrationPath)).toBe(true);
    expect(fs.existsSync(indexPath)).toBe(true);
  });

  it('backfills domain=pyme and deduplicates with a deterministic CTE', () => {
    const sql = fs.readFileSync(migrationPath, 'utf-8').toLowerCase();

    expect(sql).toContain("domain = 'pyme'");
    expect(sql).toMatch(/with\s+ranked\s+as\s*\(/);
    expect(sql).toContain('row_number() over (');
    expect(sql).toContain('partition by');
    expect(sql).toContain('user_corrected');
    expect(sql).toContain('correction_count');
  });

  it('validates uniqueness with a composite-row distinct check before applying the new index', () => {
    const sql = fs.readFileSync(migrationPath, 'utf-8').toLowerCase();

    expect(sql).toContain('count(*)');
    expect(sql).toContain('select distinct');
    expect(sql).toContain('raise exception');
    expect(sql).not.toContain("|| ':' ||");
  });

  it('drops the old unique index', () => {
    const sql = fs.readFileSync(migrationPath, 'utf-8').toLowerCase();

    expect(sql).toMatch(/drop index.*idx_coverage_mappings_unique/);
  });

  it('contains rollback instructions', () => {
    const sql = fs.readFileSync(migrationPath, 'utf-8');

    expect(sql).toContain('Rollback:');
  });
});

describe('migration 022b domain unique index', () => {
  const indexPath = path.join(
    migrationsDir,
    '022b_coverage_mappings_domain_index_concurrently.sql'
  );

  it('is non-transactional', () => {
    const sql = fs.readFileSync(indexPath, 'utf-8');

    expect(sql).toMatch(/^-- disables transactions/m);
  });

  it('creates the domain-scoped unique index concurrently', () => {
    const sql = fs.readFileSync(indexPath, 'utf-8').toLowerCase();

    expect(sql).toMatch(/create unique index concurrently/);
    expect(sql).toContain('idx_coverage_mappings_domain_unique');
    expect(sql).toContain('domain');
    expect(sql).toContain('coalesce(insurer_name');
  });

  it('is idempotent and includes rollback instructions', () => {
    const sql = fs.readFileSync(indexPath, 'utf-8');

    expect(sql).toContain('pg_class');
    expect(sql).toContain('pg_namespace');
    expect(sql).toContain('Rollback:');
  });
});
