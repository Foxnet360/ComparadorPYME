-- Migration 031: Migrate client_profiles to clients and complete multi-tenant linkage
-- 1. Ensure foreign key from client_profiles(client_id) to clients(id)
-- 2. Migrate existing client_profiles into clients with proper org_id linkage
-- 3. Add org_id and team RLS to analysis_history
-- 4. Auto-assign tenant trigger for clients and analysis_history

-- 1. Migrate client_profiles into clients table ------------------------------
INSERT INTO public.clients (id, user_id, org_id, name, tax_id, contact, created_at, updated_at)
SELECT 
  cp.id,
  cp.user_id,
  om.org_id,
  COALESCE(cp.client_name, cp.raw_client_data->>'name', 'Cliente Sin Nombre'),
  COALESCE(cp.raw_client_data->>'nit', 'Sin NIT'),
  COALESCE(cp.raw_client_data, '{}'::jsonb),
  cp.created_at,
  COALESCE(cp.updated_at, cp.created_at)
FROM public.client_profiles cp
LEFT JOIN LATERAL (
  SELECT org_id 
  FROM public.organization_members 
  WHERE user_id = cp.user_id 
  ORDER BY created_at ASC 
  LIMIT 1
) om ON true
ON CONFLICT (id) DO UPDATE SET
  org_id = COALESCE(EXCLUDED.org_id, clients.org_id),
  name = EXCLUDED.name,
  tax_id = EXCLUDED.tax_id,
  contact = EXCLUDED.contact,
  updated_at = EXCLUDED.updated_at;

-- Link client_profiles.client_id to clients.id
UPDATE public.client_profiles cp
SET client_id = cp.id
WHERE cp.client_id IS NULL;

-- Add foreign key constraint if not present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_client_profiles_client_id'
  ) THEN
    ALTER TABLE public.client_profiles
      ADD CONSTRAINT fk_client_profiles_client_id
      FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_client_profiles_client_id ON public.client_profiles(client_id);

-- 2. Add org_id to analysis_history for collaborative team visibility --------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'analysis_history' AND column_name = 'org_id'
  ) THEN
    ALTER TABLE public.analysis_history ADD COLUMN org_id UUID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_analysis_history_org_id'
  ) THEN
    ALTER TABLE public.analysis_history
      ADD CONSTRAINT fk_analysis_history_org_id
      FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_analysis_history_org_id ON public.analysis_history(org_id);

-- Backfill org_id in analysis_history
UPDATE public.analysis_history ah
SET org_id = om.org_id
FROM (
  SELECT user_id, org_id
  FROM public.organization_members
) om
WHERE ah.user_id = om.user_id
  AND ah.org_id IS NULL;

-- Default anonymous / unassigned historical analysis to primary org (Corredores de Seguros SA)
UPDATE public.analysis_history
SET org_id = (SELECT id FROM public.organizations WHERE nit = '800.000.001-1' LIMIT 1)
WHERE org_id IS NULL;

-- 3. Update RLS policies for analysis_history to support team collaboration ---
DROP POLICY IF EXISTS "Users can view own analysis history" ON public.analysis_history;
CREATE POLICY "Users can view own analysis history" ON public.analysis_history FOR SELECT
  USING (
    public.is_super_admin()
    OR (org_id IS NOT NULL AND public.is_org_member(org_id))
    OR user_id = ((SELECT auth.uid())::text)
    OR user_id = (SELECT current_setting('app.current_user_id', true))
    OR user_id = 'anonymous'
  );

DROP POLICY IF EXISTS "Users can update own analysis history" ON public.analysis_history;
CREATE POLICY "Users can update own analysis history" ON public.analysis_history FOR UPDATE
  USING (
    public.is_super_admin()
    OR (org_id IS NOT NULL AND public.is_org_member(org_id))
    OR user_id = ((SELECT auth.uid())::text)
    OR user_id = (SELECT current_setting('app.current_user_id', true))
  );

-- 4. Automatic Org-Assignment Trigger for seamless insertions -----------------
CREATE OR REPLACE FUNCTION public.assign_default_tenant_org()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id TEXT;
  v_org_id UUID;
BEGIN
  IF NEW.org_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  v_user_id := COALESCE(
    NEW.user_id,
    ((SELECT auth.uid())::text),
    (SELECT current_setting('app.current_user_id', true))
  );

  IF v_user_id IS NOT NULL AND v_user_id <> 'anonymous' THEN
    SELECT org_id INTO v_org_id
    FROM public.organization_members
    WHERE user_id = v_user_id
    ORDER BY created_at ASC
    LIMIT 1;

    IF v_org_id IS NOT NULL THEN
      NEW.org_id := v_org_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assign_clients_org ON public.clients;
CREATE TRIGGER trg_assign_clients_org
  BEFORE INSERT ON public.clients
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_default_tenant_org();

DROP TRIGGER IF EXISTS trg_assign_analysis_history_org ON public.analysis_history;
CREATE TRIGGER trg_assign_analysis_history_org
  BEFORE INSERT ON public.analysis_history
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_default_tenant_org();
