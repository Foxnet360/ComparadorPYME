-- disables transactions
-- Migration: create domain-scoped unique index concurrently on coverage_mappings.
-- Created: 2026-07-22
--
-- This file is intentionally non-transactional because
-- CREATE UNIQUE INDEX CONCURRENTLY cannot run inside a transaction.
-- Run this only after 022_coverage_mappings_domain_scoped.sql has succeeded.
--
-- Rollback:
--   DROP INDEX IF EXISTS idx_coverage_mappings_domain_unique;
--   CREATE UNIQUE INDEX idx_coverage_mappings_unique
--   ON coverage_mappings(raw_name, COALESCE(insurer_name,''));

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'idx_coverage_mappings_domain_unique'
      AND n.nspname = 'public'
  ) THEN
    RAISE NOTICE 'idx_coverage_mappings_domain_unique already exists; skipping';
    RETURN;
  END IF;
END $$;

DROP INDEX CONCURRENTLY IF EXISTS idx_coverage_mappings_unique;

CREATE UNIQUE INDEX CONCURRENTLY idx_coverage_mappings_domain_unique
ON coverage_mappings(domain, COALESCE(insurer_name, ''), raw_name);
