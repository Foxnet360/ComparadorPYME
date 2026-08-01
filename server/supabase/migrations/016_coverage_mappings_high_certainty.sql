-- Migration: Add high certainty columns and vector embedding to coverage_mappings
-- Created: 2026-05-28

ALTER TABLE coverage_mappings
  ADD COLUMN IF NOT EXISTS raw_text_snippet TEXT,
  ADD COLUMN IF NOT EXISTS ai_justification TEXT,
  ADD COLUMN IF NOT EXISTS page_number INTEGER,
  ADD COLUMN IF NOT EXISTS needs_human_review BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS embedding VECTOR(3072);

-- NOTE (fixed 2026-08-01): an ivfflat index on `embedding` was removed from this
-- migration. ivfflat supports at most 2000 dimensions and this column is
-- VECTOR(3072), so the statement always failed with:
--   ERROR: column cannot have more than 2000 dimensions for ivfflat index
-- Vector similarity search on coverage_mappings currently runs as an exact
-- scan (acceptable at this table size). An HNSW index over halfvec(3072) is a
-- separate design decision and must be added in its own migration.
