-- Migration: Template registry and coverage semantic graph tables
-- Created: 2026-06-11

-- Table: template_registry
-- Stores insurer-specific PDF templates with fingerprints, JSON schemas, and extraction hints.
CREATE TABLE IF NOT EXISTS template_registry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id TEXT NOT NULL UNIQUE,
  insurer TEXT NOT NULL,
  display_name TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  fingerprints JSONB NOT NULL DEFAULT '{}'::jsonb,
  schema JSONB NOT NULL DEFAULT '{}'::jsonb,
  hints JSONB NOT NULL DEFAULT '{}'::jsonb,
  prompt_addon TEXT NOT NULL DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  domain TEXT NOT NULL DEFAULT 'pyme',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table: coverage_graph_edges
-- Stores probabilistic edges for the coverage semantic graph.
CREATE TABLE IF NOT EXISTS coverage_graph_edges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_node TEXT NOT NULL,
  to_node TEXT NOT NULL,
  edge_type TEXT NOT NULL,
  weight FLOAT NOT NULL DEFAULT 0,
  insurer TEXT NOT NULL DEFAULT '',
  correction_count INTEGER NOT NULL DEFAULT 0,
  domain TEXT NOT NULL DEFAULT 'pyme',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for template_registry
CREATE INDEX IF NOT EXISTS idx_template_registry_template_id
  ON template_registry(template_id);

CREATE INDEX IF NOT EXISTS idx_template_registry_domain_insurer
  ON template_registry(domain, insurer);

CREATE INDEX IF NOT EXISTS idx_template_registry_active_domain
  ON template_registry(domain, is_active);

-- Indexes for coverage_graph_edges
CREATE INDEX IF NOT EXISTS idx_coverage_graph_edges_lookup
  ON coverage_graph_edges(from_node, edge_type, domain);

CREATE INDEX IF NOT EXISTS idx_coverage_graph_edges_to_node
  ON coverage_graph_edges(to_node, edge_type, domain);

CREATE INDEX IF NOT EXISTS idx_coverage_graph_edges_insurer
  ON coverage_graph_edges(insurer, domain);

-- Unique index to support idempotent upserts of semantic graph edges.
CREATE UNIQUE INDEX IF NOT EXISTS idx_coverage_graph_edges_unique
  ON coverage_graph_edges(from_node, to_node, edge_type, insurer, domain);
