-- Migration: Add correlation_id column to analysis_history table
-- Used to trace unified comparison engine requests and fallback events.

ALTER TABLE analysis_history
ADD COLUMN IF NOT EXISTS correlation_id TEXT;

-- Index for tracing/debugging specific comparison sessions
CREATE INDEX IF NOT EXISTS idx_analysis_history_correlation_id
ON analysis_history(correlation_id);

COMMENT ON COLUMN analysis_history.correlation_id IS
'Tracing identifier shared across unified engine, adapter fallback and logs.';
