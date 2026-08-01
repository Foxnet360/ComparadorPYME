-- 026_reconcile_prod_schema.sql
-- Idempotent reconciliation migration for prod schema alignment (base-hardening PR3)

-- 1. Ensure client_profiles has all expected production columns
ALTER TABLE public.client_profiles ADD COLUMN IF NOT EXISTS user_id TEXT;
ALTER TABLE public.client_profiles ADD COLUMN IF NOT EXISTS client_name TEXT;
ALTER TABLE public.client_profiles ADD COLUMN IF NOT EXISTS raw_client_data JSONB;

-- 2. Ensure analysis_history has correlation_id and document array columns
ALTER TABLE public.analysis_history ADD COLUMN IF NOT EXISTS correlation_id TEXT;
ALTER TABLE public.analysis_history ADD COLUMN IF NOT EXISTS quote_document_ids TEXT[];
ALTER TABLE public.analysis_history ADD COLUMN IF NOT EXISTS clause_document_ids TEXT[];

-- 3. Ensure correlation_id index exists
CREATE INDEX IF NOT EXISTS idx_analysis_history_correlation_id ON public.analysis_history(correlation_id);

-- 4. Ensure chunks embedding column is vector(3072)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'chunks' 
          AND column_name = 'embedding'
    ) THEN
        ALTER TABLE public.chunks ALTER COLUMN embedding TYPE vector(3072);
    END IF;
END $$;
