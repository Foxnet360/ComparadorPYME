import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('template_registry and coverage_graph_edges (consolidated into baseline 001)', () => {
  const migrationPath = path.resolve(
    __dirname,
    '..',
    '..',
    '..',
    'supabase',
    'migrations',
    '001_initial_schema.sql'
  );

  it('exists as the next migration file', () => {
    expect(fs.existsSync(migrationPath)).toBe(true); // consolidated: 7a38962 folded 019 into baseline 001
  });

  it('creates the template_registry table with the expected columns', () => {
    const sql = fs.readFileSync(migrationPath, 'utf-8').toLowerCase();

    expect(sql).toMatch(/create table if not exists\s+(public\.)?template_registry/);
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

    expect(sql).toMatch(/create table if not exists\s+(public\.)?coverage_graph_edges/);
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
