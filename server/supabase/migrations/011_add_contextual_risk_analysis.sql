-- 011_add_contextual_risk_analysis.sql
-- Análisis de riesgo contextualizado

CREATE TABLE contextual_risk_analysis (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  analysis_history_id UUID REFERENCES analysis_history(id) ON DELETE CASCADE,
  coverage_name TEXT,
  risk_type TEXT,
  risk_level TEXT,
  explanation TEXT,
  mitigation_suggestion TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_contextual_risk_analysis_history ON contextual_risk_analysis(analysis_history_id);

COMMENT ON TABLE contextual_risk_analysis IS 'Análisis de riesgo contextualizado por perfil de cliente';
