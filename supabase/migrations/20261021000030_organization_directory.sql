-- Migration 030: Organization Directory & User Management RPC
-- Provides secure directory listing of members, organizations, and user profiles.

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
  -- If caller is super_admin, return all members across all organizations
  IF public.is_super_admin() THEN
    RETURN QUERY
    SELECT 
      om.id,
      om.user_id,
      u.email::text,
      COALESCE(u.raw_user_meta_data->>'name', split_part(u.email::text, '@', 1)) AS name,
      om.role,
      om.org_id,
      o.name AS org_name,
      'ACTIVE'::text AS status,
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
      'ACTIVE'::text AS status,
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
GRANT SELECT ON public.organizations TO authenticated;
GRANT SELECT ON public.organization_members TO authenticated;
