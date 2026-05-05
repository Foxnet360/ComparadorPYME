-- 010_add_clause_versions.sql
-- Historial de versiones de clausulados

CREATE TABLE clause_versions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
  version_number TEXT NOT NULL,
  parent_version_id UUID REFERENCES clause_versions(id),
  change_summary TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_clause_versions_document ON clause_versions(document_id);

COMMENT ON TABLE clause_versions IS 'Historial de versiones de clausulados para comparativa';
