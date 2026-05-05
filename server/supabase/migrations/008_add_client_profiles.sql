-- 008_add_client_profiles.sql
-- Perfil de cliente para contextualización de riesgos

CREATE TABLE client_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  industry_type TEXT CHECK (industry_type IN ('manufactura', 'comercio', 'servicios', 'construccion', 'transporte', 'otro')),
  location_city TEXT,
  location_zone TEXT CHECK (location_zone IN ('costera', 'montana', 'urbana', 'industrial', 'rural')),
  has_single_supplier BOOLEAN DEFAULT false,
  employee_count INTEGER,
  building_type TEXT CHECK (building_type IN ('propio', 'arrendado', 'mixto')),
  primary_activity TEXT,
  annual_revenue BIGINT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_client_profiles_client ON client_profiles(client_id);

-- Trigger para updated_at
CREATE TRIGGER update_client_profiles_updated_at
    BEFORE UPDATE ON client_profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE client_profiles IS 'Perfil del cliente para contextualización de análisis de riesgos';
