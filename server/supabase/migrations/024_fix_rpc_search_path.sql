-- Migration 024: Pin search_path on functions flagged by Supabase advisors
-- PR1 security-hardening
-- Uses IF EXISTS so the migration converges on both fresh installs (where some
-- functions may be absent) and current prod.

ALTER FUNCTION IF EXISTS update_updated_at_column() SET search_path = public, pg_temp;
ALTER FUNCTION IF EXISTS search_chunks_by_coverage(vector(3072), uuid, text, integer) SET search_path = public, pg_temp;
ALTER FUNCTION IF EXISTS search_chunks_advanced(vector(3072), uuid, text[], text[], text[], integer, double precision) SET search_path = public, pg_temp;
ALTER FUNCTION IF EXISTS validate_quote_coverage(uuid, uuid, text, integer) SET search_path = public, pg_temp;
ALTER FUNCTION IF EXISTS get_chunks_with_images(uuid[]) SET search_path = public, pg_temp;
ALTER FUNCTION IF EXISTS list_documents_by_insurer(uuid, text) SET search_path = public, pg_temp;
ALTER FUNCTION IF EXISTS delete_document_complete(uuid) SET search_path = public, pg_temp;
ALTER FUNCTION IF EXISTS match_clauses(vector(768), text, text, text[], text, integer) SET search_path = public, pg_temp;
ALTER FUNCTION IF EXISTS match_clauses_vector(vector(768), text, text[], integer) SET search_path = public, pg_temp;
ALTER FUNCTION IF EXISTS get_clauses_by_coverage(text, text, text, integer) SET search_path = public, pg_temp;
ALTER FUNCTION IF EXISTS normalize_clause_content() SET search_path = public, pg_temp;
ALTER FUNCTION IF EXISTS match_chunks_unified(vector(3072), text, text, text[], text, integer) SET search_path = public, pg_temp;
ALTER FUNCTION IF EXISTS match_chunks_vector_unified(vector(3072), text, text[], integer) SET search_path = public, pg_temp;
ALTER FUNCTION IF EXISTS get_chunks_by_coverage_unified(text, text, text, integer) SET search_path = public, pg_temp;
ALTER FUNCTION IF EXISTS match_chunks_hybrid(vector(3072), text, text, text[], text, integer, double precision, double precision) SET search_path = public, pg_temp;
ALTER FUNCTION IF EXISTS search_structured_clauses(text, text, text, integer) SET search_path = public, pg_temp;
ALTER FUNCTION IF EXISTS get_clause_deductible(text, text) SET search_path = public, pg_temp;
ALTER FUNCTION IF EXISTS expand_search_query(text, jsonb) SET search_path = public, pg_temp;
ALTER FUNCTION IF EXISTS index_document_transaction(uuid, text, text, text, integer, text, text, jsonb, jsonb, text) SET search_path = public, pg_temp;
