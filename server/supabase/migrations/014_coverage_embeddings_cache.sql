-- Migration: Add coverage_embeddings_cache table
-- Created: 2026-05-20
-- Purpose: Persistent storage of coverage embeddings to avoid recomputation

CREATE TABLE IF NOT EXISTS coverage_embeddings_cache (
  id SERIAL PRIMARY KEY,
  coverage_name TEXT NOT NULL,
  embedding JSONB NOT NULL,
  model TEXT NOT NULL DEFAULT 'gemini-embedding-001',
  dimensions INTEGER NOT NULL DEFAULT 3072,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add unique constraint to prevent duplicates
ALTER TABLE coverage_embeddings_cache
  ADD CONSTRAINT unique_coverage_embedding UNIQUE (coverage_name, model);

-- Add index for fast lookups
CREATE INDEX IF NOT EXISTS idx_coverage_embeddings_name 
  ON coverage_embeddings_cache(coverage_name);

-- Add index for model filtering
CREATE INDEX IF NOT EXISTS idx_coverage_embeddings_model 
  ON coverage_embeddings_cache(model);

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_coverage_embeddings_updated_at
  BEFORE UPDATE ON coverage_embeddings_cache
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add comment for documentation
COMMENT ON TABLE coverage_embeddings_cache IS 'Cache of coverage name embeddings to avoid repeated Gemini API calls';
