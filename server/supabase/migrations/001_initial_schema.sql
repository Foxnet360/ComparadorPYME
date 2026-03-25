-- 001_initial_schema.sql
-- Migración inicial: Esquema de base de datos para Agente Comparador PYME

-- Habilitar extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS vector;

-- Tabla: Aseguradoras
CREATE TABLE insurers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT UNIQUE NOT NULL,
    nit TEXT,
    contact_email TEXT,
    phone TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla: Documentos de Clausulado/Cotización
CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    insurer_id UUID REFERENCES insurers(id) ON DELETE CASCADE,
    document_name TEXT NOT NULL,
    document_type TEXT CHECK (document_type IN ('CLAUSULADO_GENERAL', 'CLAUSULADO_PARTICULAR', 'COTIZACION')),
    version TEXT,
    total_pages INTEGER,
    storage_path TEXT NOT NULL, -- Ruta en Storage: clause-pages/{insurer_id}/{doc_id}/
    file_hash TEXT, -- Para detectar duplicados
    is_active BOOLEAN DEFAULT true,
    uploaded_by TEXT, -- User ID o sistema
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(insurer_id, document_name, document_type)
);

-- Tabla: Imágenes de Páginas (Evidencia Visual)
CREATE TABLE page_images (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
    page_number INTEGER NOT NULL,
    storage_url TEXT NOT NULL,
    storage_path TEXT NOT NULL,
    ocr_text TEXT, -- Texto extraído de la página (para búsqueda fallback)
    width INTEGER, -- Dimensiones de la imagen
    height INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(document_id, page_number)
);

-- Tabla: Chunks Vectoriales
CREATE TABLE chunks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
    page_number INTEGER NOT NULL,
    content TEXT NOT NULL,
    content_normalized TEXT, -- Texto normalizado (sin tildes, minúsculas)
    embedding vector(3072), -- Gemini embedding-001
    metadata JSONB DEFAULT '{}',
    coverage_tags TEXT[], -- Tags de cobertura para filtrado rápido
    section_type TEXT CHECK (section_type IN ('COBERTURA', 'EXCLUSION', 'DEDUCIBLE', 'CONDICION', 'GENERAL')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla: Historial de Análisis
CREATE TABLE analysis_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id TEXT,
    client_name TEXT NOT NULL,
    quote_document_ids UUID[], -- Array de documentos de cotización analizados
    clause_document_ids UUID[], -- Array de clausulados usados
    analysis_result JSONB NOT NULL, -- Resultado completo del análisis
    recommendation TEXT,
    total_score INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX idx_chunks_embedding ON chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX idx_chunks_document ON chunks(document_id);
CREATE INDEX idx_chunks_coverage ON chunks USING GIN(coverage_tags);
CREATE INDEX idx_chunks_section ON chunks(section_type);
CREATE INDEX idx_page_images_document ON page_images(document_id);
CREATE INDEX idx_documents_insurer ON documents(insurer_id);
CREATE INDEX idx_documents_active ON documents(is_active) WHERE is_active = true;
CREATE INDEX idx_analysis_history_user ON analysis_history(user_id);

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_documents_updated_at 
    BEFORE UPDATE ON documents 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Comentarios para documentación
COMMENT ON TABLE insurers IS 'Catálogo de aseguradoras disponibles';
COMMENT ON TABLE documents IS 'Documentos PDF indexados (clausulados y cotizaciones)';
COMMENT ON TABLE page_images IS 'Imágenes PNG de cada página para evidencia visual';
COMMENT ON TABLE chunks IS 'Fragmentos de texto con embeddings vectoriales';
COMMENT ON TABLE analysis_history IS 'Historial de análisis realizados por usuarios';
