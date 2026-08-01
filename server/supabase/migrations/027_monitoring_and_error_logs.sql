-- 027_monitoring_and_error_logs.sql
-- Base-hardening PR4: Create missing telemetry and error tracking tables

-- 1. Table for analysis performance and execution logs
CREATE TABLE IF NOT EXISTS public.analysis_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    analysis_id TEXT,
    duration_ms INTEGER NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('success', 'error')),
    error_type TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for analysis_logs
CREATE INDEX IF NOT EXISTS idx_analysis_logs_created_at ON public.analysis_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analysis_logs_status ON public.analysis_logs(status);
CREATE INDEX IF NOT EXISTS idx_analysis_logs_analysis_id ON public.analysis_logs(analysis_id);

-- Enable RLS for analysis_logs
ALTER TABLE public.analysis_logs ENABLE ROW LEVEL SECURITY;

-- 2. Table for tracking errors in the unified comparison engine
CREATE TABLE IF NOT EXISTS public.unified_engine_errors (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    correlation_id TEXT,
    category TEXT NOT NULL,
    error_code TEXT,
    error_message TEXT NOT NULL,
    stack_trace TEXT,
    metadata JSONB,
    resolved BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for unified_engine_errors
CREATE INDEX IF NOT EXISTS idx_unified_engine_errors_created_at ON public.unified_engine_errors(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_unified_engine_errors_category ON public.unified_engine_errors(category);
CREATE INDEX IF NOT EXISTS idx_unified_engine_errors_correlation_id ON public.unified_engine_errors(correlation_id);

-- Enable RLS for unified_engine_errors
ALTER TABLE public.unified_engine_errors ENABLE ROW LEVEL SECURITY;

-- Comments
COMMENT ON TABLE public.analysis_logs IS 'Logs performance and execution metrics for quote analyses';
COMMENT ON TABLE public.unified_engine_errors IS 'Tracks errors occurring during unified comparison engine execution';
