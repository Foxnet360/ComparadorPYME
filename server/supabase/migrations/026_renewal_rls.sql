-- Migration 026: RLS hardening for renovacion-polizas tables (PR-1, task 1.5)
-- enable + FORCE per-verb policies on all new tables (XC-1).
--
-- Dual auth pattern (replicated from 001_initial_schema): a row is visible
-- when user_id matches either the Supabase JWT subject or the service-side
-- app.current_user_id GUC:
--   user_id = ((SELECT auth.uid())::text)
--      OR user_id = (SELECT current_setting('app.current_user_id', true))
--
-- renewal_events and campaign_deliveries have no user_id column; ownership
-- is resolved through the parent renewal, following the chat_messages →
-- chat_threads EXISTS precedent in 001.

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients FORCE ROW LEVEL SECURITY;
ALTER TABLE public.policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.policies FORCE ROW LEVEL SECURITY;
ALTER TABLE public.renewals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.renewals FORCE ROW LEVEL SECURITY;
ALTER TABLE public.renewal_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.renewal_events FORCE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_configs FORCE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_deliveries FORCE ROW LEVEL SECURITY;

-- clients --------------------------------------------------------------------
CREATE POLICY "Users can select own clients" ON public.clients FOR SELECT
  USING (user_id = ((SELECT auth.uid())::text) OR user_id = (SELECT current_setting('app.current_user_id', true)));
CREATE POLICY "Users can insert own clients" ON public.clients FOR INSERT
  WITH CHECK (user_id = ((SELECT auth.uid())::text) OR user_id = (SELECT current_setting('app.current_user_id', true)));
CREATE POLICY "Users can update own clients" ON public.clients FOR UPDATE
  USING (user_id = ((SELECT auth.uid())::text) OR user_id = (SELECT current_setting('app.current_user_id', true)))
  WITH CHECK (user_id = ((SELECT auth.uid())::text) OR user_id = (SELECT current_setting('app.current_user_id', true)));
CREATE POLICY "Users can delete own clients" ON public.clients FOR DELETE
  USING (user_id = ((SELECT auth.uid())::text) OR user_id = (SELECT current_setting('app.current_user_id', true)));

-- policies -------------------------------------------------------------------
CREATE POLICY "Users can select own policies" ON public.policies FOR SELECT
  USING (user_id = ((SELECT auth.uid())::text) OR user_id = (SELECT current_setting('app.current_user_id', true)));
CREATE POLICY "Users can insert own policies" ON public.policies FOR INSERT
  WITH CHECK (user_id = ((SELECT auth.uid())::text) OR user_id = (SELECT current_setting('app.current_user_id', true)));
CREATE POLICY "Users can update own policies" ON public.policies FOR UPDATE
  USING (user_id = ((SELECT auth.uid())::text) OR user_id = (SELECT current_setting('app.current_user_id', true)))
  WITH CHECK (user_id = ((SELECT auth.uid())::text) OR user_id = (SELECT current_setting('app.current_user_id', true)));
CREATE POLICY "Users can delete own policies" ON public.policies FOR DELETE
  USING (user_id = ((SELECT auth.uid())::text) OR user_id = (SELECT current_setting('app.current_user_id', true)));

-- renewals -------------------------------------------------------------------
CREATE POLICY "Users can select own renewals" ON public.renewals FOR SELECT
  USING (user_id = ((SELECT auth.uid())::text) OR user_id = (SELECT current_setting('app.current_user_id', true)));
CREATE POLICY "Users can insert own renewals" ON public.renewals FOR INSERT
  WITH CHECK (user_id = ((SELECT auth.uid())::text) OR user_id = (SELECT current_setting('app.current_user_id', true)));
CREATE POLICY "Users can update own renewals" ON public.renewals FOR UPDATE
  USING (user_id = ((SELECT auth.uid())::text) OR user_id = (SELECT current_setting('app.current_user_id', true)))
  WITH CHECK (user_id = ((SELECT auth.uid())::text) OR user_id = (SELECT current_setting('app.current_user_id', true)));
CREATE POLICY "Users can delete own renewals" ON public.renewals FOR DELETE
  USING (user_id = ((SELECT auth.uid())::text) OR user_id = (SELECT current_setting('app.current_user_id', true)));

-- renewal_events (via parent renewal) ----------------------------------------
CREATE POLICY "Users can select own renewal events" ON public.renewal_events FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.renewals WHERE renewals.id = renewal_events.renewal_id
    AND (renewals.user_id = ((SELECT auth.uid())::text) OR renewals.user_id = (SELECT current_setting('app.current_user_id', true)))));
CREATE POLICY "Users can insert own renewal events" ON public.renewal_events FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.renewals WHERE renewals.id = renewal_events.renewal_id
    AND (renewals.user_id = ((SELECT auth.uid())::text) OR renewals.user_id = (SELECT current_setting('app.current_user_id', true)))));
CREATE POLICY "Users can update own renewal events" ON public.renewal_events FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.renewals WHERE renewals.id = renewal_events.renewal_id
    AND (renewals.user_id = ((SELECT auth.uid())::text) OR renewals.user_id = (SELECT current_setting('app.current_user_id', true)))));
CREATE POLICY "Users can delete own renewal events" ON public.renewal_events FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.renewals WHERE renewals.id = renewal_events.renewal_id
    AND (renewals.user_id = ((SELECT auth.uid())::text) OR renewals.user_id = (SELECT current_setting('app.current_user_id', true)))));

-- campaign_configs -----------------------------------------------------------
CREATE POLICY "Users can select own campaign config" ON public.campaign_configs FOR SELECT
  USING (user_id = ((SELECT auth.uid())::text) OR user_id = (SELECT current_setting('app.current_user_id', true)));
CREATE POLICY "Users can insert own campaign config" ON public.campaign_configs FOR INSERT
  WITH CHECK (user_id = ((SELECT auth.uid())::text) OR user_id = (SELECT current_setting('app.current_user_id', true)));
CREATE POLICY "Users can update own campaign config" ON public.campaign_configs FOR UPDATE
  USING (user_id = ((SELECT auth.uid())::text) OR user_id = (SELECT current_setting('app.current_user_id', true)))
  WITH CHECK (user_id = ((SELECT auth.uid())::text) OR user_id = (SELECT current_setting('app.current_user_id', true)));
CREATE POLICY "Users can delete own campaign config" ON public.campaign_configs FOR DELETE
  USING (user_id = ((SELECT auth.uid())::text) OR user_id = (SELECT current_setting('app.current_user_id', true)));

-- campaign_deliveries (via parent renewal) -----------------------------------
CREATE POLICY "Users can select own campaign deliveries" ON public.campaign_deliveries FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.renewals WHERE renewals.id = campaign_deliveries.renewal_id
    AND (renewals.user_id = ((SELECT auth.uid())::text) OR renewals.user_id = (SELECT current_setting('app.current_user_id', true)))));
CREATE POLICY "Users can insert own campaign deliveries" ON public.campaign_deliveries FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.renewals WHERE renewals.id = campaign_deliveries.renewal_id
    AND (renewals.user_id = ((SELECT auth.uid())::text) OR renewals.user_id = (SELECT current_setting('app.current_user_id', true)))));
CREATE POLICY "Users can update own campaign deliveries" ON public.campaign_deliveries FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.renewals WHERE renewals.id = campaign_deliveries.renewal_id
    AND (renewals.user_id = ((SELECT auth.uid())::text) OR renewals.user_id = (SELECT current_setting('app.current_user_id', true)))));
CREATE POLICY "Users can delete own campaign deliveries" ON public.campaign_deliveries FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.renewals WHERE renewals.id = campaign_deliveries.renewal_id
    AND (renewals.user_id = ((SELECT auth.uid())::text) OR renewals.user_id = (SELECT current_setting('app.current_user_id', true)))));
