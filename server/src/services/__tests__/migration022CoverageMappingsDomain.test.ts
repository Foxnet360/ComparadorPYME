import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const migrationsDir = path.resolve(__dirname, '..', '..', '..', 'supabase', 'migrations');

describe('baseline migration 001_initial_schema', () => {
  const migrationPath = path.join(migrationsDir, '001_initial_schema.sql');

  it('exists as the consolidated baseline migration', () => {
    expect(fs.existsSync(migrationPath)).toBe(true);
  });

  it('contains coverage mappings schema with domain column', () => {
    const sql = fs.readFileSync(migrationPath, 'utf-8').toLowerCase();

    expect(sql).toContain('coverage_mappings');
    expect(sql).toContain('domain');
  });
});
