-- Migration: Add domain columns and review queue index
-- Created: 2026-06-10

-- Add domain column to structured_clauses for per-domain clause lookup
ALTER TABLE structured_clauses
  ADD COLUMN IF NOT EXISTS domain TEXT DEFAULT 'pyme';

-- Add domain column to coverage_mappings for per-domain mapping isolation
ALTER TABLE coverage_mappings
  ADD COLUMN IF NOT EXISTS domain TEXT DEFAULT 'pyme';

-- Partial index for fast review queue queries (only rows that need review)
CREATE INDEX IF NOT EXISTS idx_coverage_mappings_needs_human_review
  ON coverage_mappings(needs_human_review) WHERE needs_human_review = TRUE;

-- Index for filtering coverage mappings by domain
CREATE INDEX IF NOT EXISTS idx_coverage_mappings_domain
  ON coverage_mappings(domain);

-- Index for filtering structured clauses by domain
CREATE INDEX IF NOT EXISTS idx_structured_clauses_domain
  ON structured_clauses(domain);

-- Composite index for common domain + insurer queries on structured_clauses
CREATE INDEX IF NOT EXISTS idx_structured_clauses_domain_insurer
  ON structured_clauses(domain, insurer_name);

-- Composite index for domain + insurer queries on coverage_mappings
CREATE INDEX IF NOT EXISTS idx_coverage_mappings_domain_insurer
  ON coverage_mappings(domain, insurer_name);
