-- Migration 023: Enable Row-Level Security on template_registry and coverage_graph_edges
-- PR1 security-hardening
-- Decision: deny-by-default. No policies are created; backend uses service-role exclusively.

ALTER TABLE IF EXISTS public.template_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.coverage_graph_edges ENABLE ROW LEVEL SECURITY;
