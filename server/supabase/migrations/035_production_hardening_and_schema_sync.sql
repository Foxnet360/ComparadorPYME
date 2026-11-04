-- Migration 035: Production Hardening, Security Hardening & Schema Synchronization
-- Remediates Supabase Security Advisor & Performance Linter findings and synchronizes chat/policy/index contracts.

-- 1. Security Definer View Fix: Change document_insurer_view to security_invoker = true
ALTER VIEW IF EXISTS public.document_insurer_view SET (security_invoker = true);

-- 2. Revoke Public and Anon execute on Security Definer RPCs
REVOKE EXECUTE ON FUNCTION public.get_organization_directory() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.assign_default_tenant_org() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_org_member(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_super_admin() FROM PUBLIC, anon;

-- 3. Search Path Immutability on Functions Flagged by Security Linter
ALTER FUNCTION public.update_updated_at_column() SET search_path = public;
ALTER FUNCTION public.match_clauses_vector(vector, double precision, integer, text, text) SET search_path = public;
ALTER FUNCTION public.get_clauses_by_coverage(text, text, integer) SET search_path = public;
ALTER FUNCTION public.normalize_clause_content(text) SET search_path = public;
ALTER FUNCTION public.match_clauses(text, double precision, integer, text, text) SET search_path = public;
ALTER FUNCTION public.update_chat_threads_updated_at() SET search_path = public;
ALTER FUNCTION public.try_acquire_campaign_lock(text, integer) SET search_path = public;
ALTER FUNCTION public.release_campaign_lock(text) SET search_path = public;

-- 4. Enable RLS and Policies for Tables Flagged with rls_enabled_no_policy
ALTER TABLE IF EXISTS public.analysis_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role and admins access analysis logs" ON public.analysis_logs;
CREATE POLICY "Service role and admins access analysis logs" ON public.analysis_logs
  FOR ALL
  USING (
    current_user IN ('postgres', 'service_role')
    OR current_setting('request.jwt.claim.role', true) = 'service_role'
    OR COALESCE(auth.role(), '') = 'service_role'
    OR public.is_super_admin()
  );

ALTER TABLE IF EXISTS public.clause_chunks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public view active clause chunks" ON public.clause_chunks;
CREATE POLICY "Public view active clause chunks" ON public.clause_chunks
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Super admins manage clause chunks" ON public.clause_chunks;
CREATE POLICY "Super admins manage clause chunks" ON public.clause_chunks
  FOR ALL
  USING (
    current_user IN ('postgres', 'service_role')
    OR current_setting('request.jwt.claim.role', true) = 'service_role'
    OR COALESCE(auth.role(), '') = 'service_role'
    OR public.is_super_admin()
  );

ALTER TABLE IF EXISTS public.unified_engine_errors ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role and super admins manage engine errors" ON public.unified_engine_errors;
CREATE POLICY "Service role and super admins manage engine errors" ON public.unified_engine_errors
  FOR ALL
  USING (
    current_user IN ('postgres', 'service_role')
    OR current_setting('request.jwt.claim.role', true) = 'service_role'
    OR COALESCE(auth.role(), '') = 'service_role'
    OR public.is_super_admin()
  );

-- 5. Performance: Add Covering Indexes for Unindexed Foreign Keys
CREATE INDEX IF NOT EXISTS idx_analysis_history_renewal_id ON public.analysis_history(renewal_id);
CREATE INDEX IF NOT EXISTS idx_clause_chunks_document_id ON public.clause_chunks(document_id);
CREATE INDEX IF NOT EXISTS idx_clause_versions_parent_version_id ON public.clause_versions(parent_version_id);
CREATE INDEX IF NOT EXISTS idx_policies_client_id ON public.policies(client_id);
CREATE INDEX IF NOT EXISTS idx_policies_source_analysis_id ON public.policies(source_analysis_id);
CREATE INDEX IF NOT EXISTS idx_structured_clauses_document_id ON public.structured_clauses(document_id);

-- Drop duplicate index on client_profiles
DROP INDEX IF EXISTS public.idx_client_profiles_client;

-- 6. Schema Synchronization: Chat Threads & Chat Messages
ALTER TABLE IF EXISTS public.chat_threads
  ADD COLUMN IF NOT EXISTS client_name TEXT,
  ADD COLUMN IF NOT EXISTS insurer_names TEXT[],
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS context_summary TEXT;

CREATE INDEX IF NOT EXISTS idx_chat_threads_status_user ON public.chat_threads(user_id, status);

ALTER TABLE IF EXISTS public.chat_messages
  DROP CONSTRAINT IF EXISTS chat_messages_role_check;

ALTER TABLE IF EXISTS public.chat_messages
  ADD CONSTRAINT chat_messages_role_check CHECK (role IN ('user', 'assistant', 'system', 'model'));

ALTER TABLE IF EXISTS public.chat_messages
  ADD COLUMN IF NOT EXISTS sources_used INT,
  ADD COLUMN IF NOT EXISTS citations JSONB,
  ADD COLUMN IF NOT EXISTS model_used TEXT,
  ADD COLUMN IF NOT EXISTS tokens_input INT,
  ADD COLUMN IF NOT EXISTS tokens_output INT,
  ADD COLUMN IF NOT EXISTS tokens_used INT,
  ADD COLUMN IF NOT EXISTS latency_ms INT;

-- 7. Schema Synchronization: Policies Ramo Normalization
ALTER TABLE IF EXISTS public.policies
  DROP CONSTRAINT IF EXISTS policies_ramo_check;

ALTER TABLE IF EXISTS public.policies
  ADD CONSTRAINT policies_ramo_check CHECK (
    ramo IN (
      'pyme', 'copropiedades', 'autos', 'transporte', 'cumplimiento',
      'responsabilidad_civil', 'vida_grupo', 'hogar', 'salud',
      'equipo_maquinaria', 'casco_embarcacion', 'equipo', 'casco'
    )
  );

-- 8. Unique Index on DaaS Market Snapshots to prevent duplicates
CREATE UNIQUE INDEX IF NOT EXISTS idx_daas_snapshots_source_quote 
  ON public.daas_market_snapshots(source_analysis_id, quote_index);
