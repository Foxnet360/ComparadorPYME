-- ============================================================================
-- Migration 034: Client Sharing, Lead Delegation & Delegation Audit (Opción A)
-- ============================================================================
-- - Shared organization directory for duplicate prevention (RPC)
-- - Admins (super_admin, ally_admin) see all org clients and delegate leads
-- - Técnicos Analistas (ally_technical) see clients assigned to or shared with them
-- ============================================================================

-- 1. Extend public.clients with assignment & lead lifecycle columns
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS lead_status TEXT NOT NULL DEFAULT 'nuevo'
    CHECK (lead_status IN ('nuevo', 'asignado', 'en_gestion', 'cotizado', 'cerrado', 'perdido')),
  ADD COLUMN IF NOT EXISTS delegated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS delegated_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_clients_assigned_to ON public.clients(assigned_to);
CREATE INDEX IF NOT EXISTS idx_clients_lead_status ON public.clients(lead_status);

-- 2. Granular client sharing between Técnicos Analistas
CREATE TABLE IF NOT EXISTS public.client_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  shared_with_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  shared_by_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  permission TEXT NOT NULL DEFAULT 'edit' CHECK (permission IN ('view', 'edit')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_client_shares_client_user UNIQUE (client_id, shared_with_user_id)
);

CREATE INDEX IF NOT EXISTS idx_client_shares_user ON public.client_shares(shared_with_user_id);
CREATE INDEX IF NOT EXISTS idx_client_shares_client ON public.client_shares(client_id);

ALTER TABLE public.client_shares ENABLE ROW LEVEL SECURITY;

-- 3. Lead delegation & sharing audit trail
CREATE TABLE IF NOT EXISTS public.client_delegation_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  actor_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('delegated', 'reassigned', 'shared', 'unshared', 'status_changed')),
  from_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  to_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  previous_status TEXT,
  new_status TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_delegation_audit_org_created
  ON public.client_delegation_audit(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_delegation_audit_client
  ON public.client_delegation_audit(client_id, created_at DESC);

ALTER TABLE public.client_delegation_audit ENABLE ROW LEVEL SECURITY;

-- 4. Helper functions for Opción A RLS
CREATE OR REPLACE FUNCTION public.is_org_admin(p_org_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_members om
    WHERE om.org_id = p_org_id
      AND om.user_id = auth.uid()
      AND om.role IN ('ally_admin', 'super_admin')
      AND om.status = 'active'
  );
$$;

-- Shared organization client directory (minimal fields for duplicate detection)
CREATE OR REPLACE FUNCTION public.get_org_client_directory(
  p_org_id UUID,
  p_search TEXT DEFAULT ''
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  tax_id TEXT,
  lead_status TEXT,
  assigned_to UUID,
  created_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT c.id, c.name, c.tax_id, c.lead_status, c.assigned_to, c.created_at
  FROM public.clients c
  WHERE c.org_id = p_org_id
    AND (
      public.is_super_admin()
      OR public.is_org_member(p_org_id)
    )
    AND (
      p_search = ''
      OR c.name ILIKE '%' || p_search || '%'
      OR COALESCE(c.tax_id, '') ILIKE '%' || p_search || '%'
    )
  ORDER BY c.name ASC
  LIMIT 100;
$$;

-- 5. Updated RLS policies on public.clients (Opción A)
DROP POLICY IF EXISTS "Users can select own clients" ON public.clients;
CREATE POLICY "Users can select own clients" ON public.clients FOR SELECT
  USING (
    public.is_super_admin()
    OR (org_id IS NOT NULL AND public.is_org_admin(org_id))
    OR assigned_to = (SELECT auth.uid())
    OR (assigned_to IS NULL AND user_id = ((SELECT auth.uid())::text))
    OR EXISTS (
      SELECT 1 FROM public.client_shares cs
      WHERE cs.client_id = id
        AND cs.shared_with_user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can update own clients" ON public.clients;
CREATE POLICY "Users can update own clients" ON public.clients FOR UPDATE
  USING (
    public.is_super_admin()
    OR (org_id IS NOT NULL AND public.is_org_admin(org_id))
    OR assigned_to = (SELECT auth.uid())
    OR (assigned_to IS NULL AND user_id = ((SELECT auth.uid())::text))
    OR EXISTS (
      SELECT 1 FROM public.client_shares cs
      WHERE cs.client_id = id
        AND cs.shared_with_user_id = (SELECT auth.uid())
        AND cs.permission = 'edit'
    )
  )
  WITH CHECK (
    public.is_super_admin()
    OR (org_id IS NOT NULL AND public.is_org_admin(org_id))
    OR assigned_to = (SELECT auth.uid())
    OR (assigned_to IS NULL AND user_id = ((SELECT auth.uid())::text))
    OR EXISTS (
      SELECT 1 FROM public.client_shares cs
      WHERE cs.client_id = id
        AND cs.shared_with_user_id = (SELECT auth.uid())
        AND cs.permission = 'edit'
    )
  );

-- 6. RLS for client_shares & client_delegation_audit
DROP POLICY IF EXISTS "Org members can view client shares" ON public.client_shares;
CREATE POLICY "Org members can view client shares" ON public.client_shares FOR SELECT
  USING (
    public.is_super_admin()
    OR public.is_org_admin(org_id)
    OR shared_with_user_id = (SELECT auth.uid())
    OR shared_by_user_id = (SELECT auth.uid())
  );

DROP POLICY IF EXISTS "Authorized users can manage client shares" ON public.client_shares;
CREATE POLICY "Authorized users can manage client shares" ON public.client_shares FOR ALL
  USING (
    public.is_super_admin()
    OR public.is_org_admin(org_id)
    OR shared_by_user_id = (SELECT auth.uid())
  );

DROP POLICY IF EXISTS "Admins can view delegation audit" ON public.client_delegation_audit;
CREATE POLICY "Admins can view delegation audit" ON public.client_delegation_audit FOR SELECT
  USING (
    public.is_super_admin()
    OR public.is_org_admin(org_id)
  );
