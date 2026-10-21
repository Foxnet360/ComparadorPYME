-- Migration 029: Organizations and Team-Level RLS (Multi-Tenant Core)
-- Evolve from single-user isolation to collaborative organization-level RLS.
--
-- Preserves backwards compatibility: a record is accessible if the user
-- belongs to its organization OR owns it directly (user_id match).

-- 1. Create organizations table ----------------------------------------------
CREATE TABLE IF NOT EXISTS public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  nit TEXT UNIQUE,
  contact_email TEXT,
  phone TEXT,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE', 'SUSPENDED')),
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Create organization members table ---------------------------------------
CREATE TABLE IF NOT EXISTS public.organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('super_admin', 'ally_admin', 'ally_technical')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(org_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_org_members_user_id ON public.organization_members(user_id);
CREATE INDEX IF NOT EXISTS idx_org_members_org_id ON public.organization_members(org_id);
CREATE INDEX IF NOT EXISTS idx_org_members_lookup ON public.organization_members(org_id, user_id);

-- Enable RLS on organizations and organization_members
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations FORCE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members FORCE ROW LEVEL SECURITY;

-- 3. Security Definer Helper Functions for RLS -------------------------------
-- Optimized with search_path = '' to prevent security search-path exploits
-- and wrapped in SELECT to evaluate in an InitPlan once per query.

CREATE OR REPLACE FUNCTION public.is_org_member(lookup_org_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE org_id = lookup_org_id
      AND (
        user_id = ((SELECT auth.uid())::text)
        OR user_id = (SELECT current_setting('app.current_user_id', true))
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE (
        user_id = ((SELECT auth.uid())::text)
        OR user_id = (SELECT current_setting('app.current_user_id', true))
      )
      AND role = 'super_admin'
  );
$$;

-- 4. RLS for organizations & members ----------------------------------------
DROP POLICY IF EXISTS "Members can view own organization" ON public.organizations;
CREATE POLICY "Members can view own organization" ON public.organizations FOR SELECT
  USING (
    public.is_super_admin()
    OR public.is_org_member(id)
  );

DROP POLICY IF EXISTS "Members can view own memberships" ON public.organization_members;
CREATE POLICY "Members can view own memberships" ON public.organization_members FOR SELECT
  USING (
    public.is_super_admin()
    OR user_id = ((SELECT auth.uid())::text)
    OR user_id = (SELECT current_setting('app.current_user_id', true))
    OR public.is_org_member(org_id)
  );

-- 5. Foreign Keys on Existing Tables -----------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_clients_org_id'
  ) THEN
    ALTER TABLE public.clients
      ADD CONSTRAINT fk_clients_org_id
      FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_policies_org_id'
  ) THEN
    ALTER TABLE public.policies
      ADD CONSTRAINT fk_policies_org_id
      FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_renewals_org_id'
  ) THEN
    ALTER TABLE public.renewals
      ADD CONSTRAINT fk_renewals_org_id
      FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_clients_org_id ON public.clients(org_id);
CREATE INDEX IF NOT EXISTS idx_policies_org_id ON public.policies(org_id);
CREATE INDEX IF NOT EXISTS idx_renewals_org_id ON public.renewals(org_id);

-- 6. Team-Level RLS for Portfolio Tables -------------------------------------

-- clients --------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can select own clients" ON public.clients;
CREATE POLICY "Users can select own clients" ON public.clients FOR SELECT
  USING (
    public.is_super_admin()
    OR (org_id IS NOT NULL AND public.is_org_member(org_id))
    OR user_id = ((SELECT auth.uid())::text)
    OR user_id = (SELECT current_setting('app.current_user_id', true))
  );

DROP POLICY IF EXISTS "Users can update own clients" ON public.clients;
CREATE POLICY "Users can update own clients" ON public.clients FOR UPDATE
  USING (
    public.is_super_admin()
    OR (org_id IS NOT NULL AND public.is_org_member(org_id))
    OR user_id = ((SELECT auth.uid())::text)
    OR user_id = (SELECT current_setting('app.current_user_id', true))
  )
  WITH CHECK (
    public.is_super_admin()
    OR (org_id IS NOT NULL AND public.is_org_member(org_id))
    OR user_id = ((SELECT auth.uid())::text)
    OR user_id = (SELECT current_setting('app.current_user_id', true))
  );

-- policies -------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can select own policies" ON public.policies;
CREATE POLICY "Users can select own policies" ON public.policies FOR SELECT
  USING (
    public.is_super_admin()
    OR (org_id IS NOT NULL AND public.is_org_member(org_id))
    OR user_id = ((SELECT auth.uid())::text)
    OR user_id = (SELECT current_setting('app.current_user_id', true))
  );

DROP POLICY IF EXISTS "Users can update own policies" ON public.policies;
CREATE POLICY "Users can update own policies" ON public.policies FOR UPDATE
  USING (
    public.is_super_admin()
    OR (org_id IS NOT NULL AND public.is_org_member(org_id))
    OR user_id = ((SELECT auth.uid())::text)
    OR user_id = (SELECT current_setting('app.current_user_id', true))
  )
  WITH CHECK (
    public.is_super_admin()
    OR (org_id IS NOT NULL AND public.is_org_member(org_id))
    OR user_id = ((SELECT auth.uid())::text)
    OR user_id = (SELECT current_setting('app.current_user_id', true))
  );

-- renewals -------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can select own renewals" ON public.renewals;
CREATE POLICY "Users can select own renewals" ON public.renewals FOR SELECT
  USING (
    public.is_super_admin()
    OR (org_id IS NOT NULL AND public.is_org_member(org_id))
    OR user_id = ((SELECT auth.uid())::text)
    OR user_id = (SELECT current_setting('app.current_user_id', true))
  );

DROP POLICY IF EXISTS "Users can update own renewals" ON public.renewals;
CREATE POLICY "Users can update own renewals" ON public.renewals FOR UPDATE
  USING (
    public.is_super_admin()
    OR (org_id IS NOT NULL AND public.is_org_member(org_id))
    OR user_id = ((SELECT auth.uid())::text)
    OR user_id = (SELECT current_setting('app.current_user_id', true))
  )
  WITH CHECK (
    public.is_super_admin()
    OR (org_id IS NOT NULL AND public.is_org_member(org_id))
    OR user_id = ((SELECT auth.uid())::text)
    OR user_id = (SELECT current_setting('app.current_user_id', true))
  );

-- 7. Backfill Idempotente Inicial --------------------------------------------
-- Crea una organización predeterminada y asocia a usuarios existentes para
-- que ninguna fila quede en un limbo de aislamiento.
DO $$
DECLARE
  default_org_id UUID;
  rec RECORD;
BEGIN
  -- Insertar organización piloto si no existe ninguna
  INSERT INTO public.organizations (name, nit, status)
  VALUES ('Correduría Andina de Seguros S.A.', '900.543.210-1', 'ACTIVE')
  ON CONFLICT (nit) DO UPDATE SET updated_at = now()
  RETURNING id INTO default_org_id;

  -- Asociar a usuarios huérfanos que tengan clientes o pólizas
  FOR rec IN (
    SELECT DISTINCT user_id FROM public.clients WHERE org_id IS NULL AND user_id IS NOT NULL
  ) LOOP
    INSERT INTO public.organization_members (org_id, user_id, role)
    VALUES (default_org_id, rec.user_id, 'ally_technical')
    ON CONFLICT (org_id, user_id) DO NOTHING;

    UPDATE public.clients SET org_id = default_org_id WHERE user_id = rec.user_id AND org_id IS NULL;
    UPDATE public.policies SET org_id = default_org_id WHERE user_id = rec.user_id AND org_id IS NULL;
    UPDATE public.renewals SET org_id = default_org_id WHERE user_id = rec.user_id AND org_id IS NULL;
  END LOOP;
END $$;
