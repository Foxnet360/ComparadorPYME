-- Migration: Add high certainty columns and vector embedding to coverage_mappings
-- Created: 2026-05-28

ALTER TABLE coverage_mappings
  ADD COLUMN IF NOT EXISTS raw_text_snippet TEXT,
  ADD COLUMN IF NOT EXISTS ai_justification TEXT,
  ADD COLUMN IF NOT EXISTS page_number INTEGER,
  ADD COLUMN IF NOT EXISTS needs_human_review BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS embedding VECTOR(3072);

-- Create index for vector similarity search on coverage_mappings if not exists
CREATE INDEX IF NOT EXISTS idx_coverage_mappings_embedding 
ON coverage_mappings USING ivfflat (embedding vector_cosine_ops) WITH (lists = 10);
