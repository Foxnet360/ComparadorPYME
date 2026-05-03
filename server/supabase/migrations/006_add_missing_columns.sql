-- Migration: Add missing columns to analysis_history table
-- These columns are used by the analysis controller

ALTER TABLE analysis_history 
ADD COLUMN IF NOT EXISTS extraction_confidence INTEGER,
ADD COLUMN IF NOT EXISTS needs_review BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS validation_flags_count INTEGER DEFAULT 0;