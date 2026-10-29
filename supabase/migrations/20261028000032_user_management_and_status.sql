-- Migration 032: User Management and Status Persistence
-- Adds status column to organization_members and enhances get_organization_directory RPC.

-- 1. Add status column to organization_members
ALTER TABLE public.organization_members 
ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'ACTIVE' 
CHECK (status IN ('ACTIVE', 'INACTIVE', 'SUSPENDED'));

CREATE INDEX IF NOT EXISTS idx_org_members_status ON public.organization_members(status);

-- 2. Update get_organization_directory RPC
CREATE OR REPLACE FUNCTION public.get_organization_directory()
RETURNS TABLE (
  id UUID,
  user_id TEXT,
  email TEXT,
  name TEXT,
  role TEXT,
  org_id UUID,
  org_name TEXT,
  status TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- If caller is service_role, postgres, or super_admin, return all members across all organizations
  IF (current_user IN ('postgres', 'service_role'))
     OR (current_setting('request.jwt.claim.role', true) = 'service_role')
     OR (COALESCE(auth.role(), '') = 'service_role')
     OR public.is_super_admin() THEN
    RETURN QUERY
    SELECT 
      om.id,
      om.user_id,
      u.email::text,
      COALESCE(u.raw_user_meta_data->>'name', split_part(u.email::text, '@', 1)) AS name,
      om.role,
      om.org_id,
      o.name AS org_name,
      om.status,
      om.created_at
    FROM public.organization_members om
    JOIN public.organizations o ON om.org_id = o.id
    JOIN auth.users u ON om.user_id = u.id::text
    ORDER BY o.name ASC, om.role ASC;
  ELSE
    -- Otherwise, return only members within caller's organization
    RETURN QUERY
    SELECT 
      om.id,
      om.user_id,
      u.email::text,
      COALESCE(u.raw_user_meta_data->>'name', split_part(u.email::text, '@', 1)) AS name,
      om.role,
      om.org_id,
      o.name AS org_name,
      om.status,
      om.created_at
    FROM public.organization_members om
    JOIN public.organizations o ON om.org_id = o.id
    JOIN auth.users u ON om.user_id = u.id::text
    WHERE public.is_org_member(om.org_id)
    ORDER BY om.role ASC;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_organization_directory() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_organization_directory() TO service_role;
