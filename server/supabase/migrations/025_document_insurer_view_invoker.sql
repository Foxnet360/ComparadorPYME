-- Migration 025: Recreate document_insurer_view with security_invoker
-- PR1 security-hardening
-- Captures the prod-only view definition and removes SECURITY DEFINER semantics.
-- Apply-time note: verify the column list against prod DDL via pg_get_viewdef before applying.

DROP VIEW IF EXISTS public.document_insurer_view;

CREATE VIEW public.document_insurer_view
WITH (security_invoker = true)
AS
SELECT
    d.id,
    d.document_name,
    d.document_type,
    d.version,
    d.total_pages,
    d.storage_path,
    d.is_active,
    d.created_at,
    d.updated_at,
    d.uploaded_by,
    d.file_hash,
    i.name as insurer_name,
    d.insurer_id
FROM public.documents d
JOIN public.insurers i ON d.insurer_id = i.id;
