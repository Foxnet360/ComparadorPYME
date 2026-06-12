import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('migration 019_template_registry_and_graph', () => {
  const migrationPath = path.resolve(
    process.cwd(),
    'server/supabase/migrations/019_template_registry_and_graph.sql'
  );

  it('exists as the next migration file', () => {
    expect(fs.existsSync(migrationPath)).toBe(true);
  });

  it('creates the template_registry table with the expected columns', () => {
    const sql = fs.readFileSync(migrationPath, 'utf-8').toLowerCase();

    expect(sql).toMatch(/create table if not exists\s+template_registry/);
    expect(sql).toContain('id');
    expect(sql).toContain('template_id');
    expect(sql).toContain('insurer');
    expect(sql).toContain('display_name');
    expect(sql).toContain('version');
    expect(sql).toContain('fingerprints');
    expect(sql).toContain('schema');
    expect(sql).toContain('hints');
    expect(sql).toContain('prompt_addon');
    expect(sql).toContain('is_active');
    expect(sql).toContain('domain');
  });

  it('creates the coverage_graph_edges table with the expected columns', () => {
    const sql = fs.readFileSync(migrationPath, 'utf-8').toLowerCase();

    expect(sql).toMatch(/create table if not exists\s+coverage_graph_edges/);
    expect(sql).toContain('from_node');
    expect(sql).toContain('to_node');
    expect(sql).toContain('edge_type');
    expect(sql).toContain('weight');
    expect(sql).toContain('insurer');
    expect(sql).toContain('correction_count');
    expect(sql).toContain('domain');
  });

  it('adds indexes for common lookup patterns', () => {
    const sql = fs.readFileSync(migrationPath, 'utf-8').toLowerCase();

    expect(sql).toMatch(/create index.*idx_template_registry_/);
    expect(sql).toMatch(/create index.*idx_coverage_graph_edges_/);
  });
});
