-- Migration 020: Safely add missing columns to public.analysis_history table
-- Prevents PGRST204 errors when inserting per-domain analytics metadata

ALTER TABLE public.analysis_history ADD COLUMN IF NOT EXISTS domain TEXT DEFAULT 'pyme';
ALTER TABLE public.analysis_history ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.analysis_history ADD COLUMN IF NOT EXISTS engine_type TEXT;
ALTER TABLE public.analysis_history ADD COLUMN IF NOT EXISTS processing_time_ms INTEGER;
ALTER TABLE public.analysis_history ADD COLUMN IF NOT EXISTS confidence_score INTEGER;
ALTER TABLE public.analysis_history ADD COLUMN IF NOT EXISTS extraction_confidence INTEGER;
ALTER TABLE public.analysis_history ADD COLUMN IF NOT EXISTS needs_review BOOLEAN DEFAULT false;
ALTER TABLE public.analysis_history ADD COLUMN IF NOT EXISTS validation_flags_count INTEGER DEFAULT 0;
ALTER TABLE public.analysis_history ADD COLUMN IF NOT EXISTS unified_result JSONB;
ALTER TABLE public.analysis_history ADD COLUMN IF NOT EXISTS fallback_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_analysis_history_domain ON public.analysis_history(domain);
