-- 009_add_clause_coverages.sql
-- Coberturas extraídas de clausulados para validación inversa

CREATE TABLE clause_coverages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
  coverage_name TEXT NOT NULL,
  is_mandatory BOOLEAN DEFAULT false,
  deductible_text TEXT,
  exclusions TEXT[],
  conditions TEXT[],
  page_number INTEGER,
  extracted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_clause_coverages_document ON clause_coverages(document_id);
CREATE INDEX idx_clause_coverages_name ON clause_coverages(coverage_name);

COMMENT ON TABLE clause_coverages IS 'Coberturas extraídas de clausulados para validación bidireccional';
