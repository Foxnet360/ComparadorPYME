-- =====================================================
-- MIGRACIÓN COMPLETA: Agente Comparador PYME
-- Dimensión: 768 (compatible con índice ivfflat)
-- Copia TODO este contenido y pégalo en:
-- https://supabase.com/dashboard/project/nubiecwypgfekhvaffxm/sql/new
-- =====================================================

-- 1. HABILITAR EXTENSIONES
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. TABLA: ASEGURADORAS
CREATE TABLE IF NOT EXISTS insurers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT UNIQUE NOT NULL,
    nit TEXT,
    contact_email TEXT,
    phone TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. TABLA: DOCUMENTOS
CREATE TABLE IF NOT EXISTS documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    insurer_id UUID REFERENCES insurers(id) ON DELETE CASCADE,
    document_name TEXT NOT NULL,
    document_type TEXT CHECK (document_type IN ('CLAUSULADO_GENERAL', 'CLAUSULADO_PARTICULAR', 'COTIZACION')),
    version TEXT,
    total_pages INTEGER,
    storage_path TEXT NOT NULL,
    file_hash TEXT,
    is_active BOOLEAN DEFAULT true,
    uploaded_by TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(insurer_id, document_name, document_type)
);

-- 4. TABLA: IMÁGENES DE PÁGINAS
CREATE TABLE IF NOT EXISTS page_images (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
    page_number INTEGER NOT NULL,
    storage_url TEXT NOT NULL,
    storage_path TEXT NOT NULL,
    ocr_text TEXT,
    width INTEGER,
    height INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(document_id, page_number)
);

-- 5. TABLA: CHUNKS VECTORIALES (768 dimensiones para compatibilidad con ivfflat)
CREATE TABLE IF NOT EXISTS chunks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
    page_number INTEGER NOT NULL,
    content TEXT NOT NULL,
    content_normalized TEXT,
    embedding vector(768),
    metadata JSONB DEFAULT '{}',
    coverage_tags TEXT[],
    section_type TEXT CHECK (section_type IN ('COBERTURA', 'EXCLUSION', 'DEDUCIBLE', 'CONDICION', 'GENERAL')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. TABLA: HISTORIAL DE ANÁLISIS
CREATE TABLE IF NOT EXISTS analysis_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id TEXT,
    client_name TEXT NOT NULL,
    quote_document_ids UUID[],
    clause_document_ids UUID[],
    analysis_result JSONB NOT NULL,
    recommendation TEXT,
    total_score INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. ÍNDICES (usando ivfflat con 768 dimensiones máximo)
CREATE INDEX IF NOT EXISTS idx_chunks_embedding ON chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX IF NOT EXISTS idx_chunks_document ON chunks(document_id);
CREATE INDEX IF NOT EXISTS idx_chunks_coverage ON chunks USING GIN(coverage_tags);
CREATE INDEX IF NOT EXISTS idx_chunks_section ON chunks(section_type);
CREATE INDEX IF NOT EXISTS idx_page_images_document ON page_images(document_id);
CREATE INDEX IF NOT EXISTS idx_documents_insurer ON documents(insurer_id);
CREATE INDEX IF NOT EXISTS idx_documents_active ON documents(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_analysis_history_user ON analysis_history(user_id);

-- 8. TRIGGER PARA UPDATED_AT
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_documents_updated_at ON documents;
CREATE TRIGGER update_documents_updated_at 
    BEFORE UPDATE ON documents 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- 9. FUNCIÓN: BÚSQUEDA POR COBERTURA
CREATE OR REPLACE FUNCTION search_chunks_by_coverage(
    p_embedding vector(768),
    p_insurer_id UUID,
    p_coverage_tag TEXT DEFAULT NULL,
    p_match_count INTEGER DEFAULT 5
)
RETURNS TABLE(
    id UUID,
    content TEXT,
    page_number INTEGER,
    document_id UUID,
    document_type TEXT,
    document_name TEXT,
    similarity FLOAT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.id,
        c.content,
        c.page_number,
        c.document_id,
        d.document_type,
        d.document_name,
        1 - (c.embedding <=> p_embedding) AS similarity
    FROM chunks c
    JOIN documents d ON c.document_id = d.id
    WHERE d.insurer_id = p_insurer_id
      AND d.is_active = true
      AND (p_coverage_tag IS NULL OR p_coverage_tag = ANY(c.coverage_tags))
    ORDER BY c.embedding <=> p_embedding
    LIMIT p_match_count;
END;
$$ LANGUAGE plpgsql;

-- 10. FUNCIÓN: BÚSQUEDA AVANZADA
CREATE OR REPLACE FUNCTION search_chunks_advanced(
    p_embedding vector(768),
    p_insurer_id UUID,
    p_coverage_tags TEXT[] DEFAULT NULL,
    p_section_types TEXT[] DEFAULT NULL,
    p_document_types TEXT[] DEFAULT NULL,
    p_match_count INTEGER DEFAULT 5,
    p_min_similarity FLOAT DEFAULT 0.7
)
RETURNS TABLE(
    id UUID,
    content TEXT,
    page_number INTEGER,
    document_id UUID,
    document_name TEXT,
    document_type TEXT,
    section_type TEXT,
    coverage_tags TEXT[],
    similarity FLOAT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.id,
        c.content,
        c.page_number,
        c.document_id,
        d.document_name,
        d.document_type,
        c.section_type,
        c.coverage_tags,
        1 - (c.embedding <=> p_embedding) AS similarity
    FROM chunks c
    JOIN documents d ON c.document_id = d.id
    WHERE d.insurer_id = p_insurer_id
      AND d.is_active = true
      AND 1 - (c.embedding <=> p_embedding) >= p_min_similarity
      AND (p_coverage_tags IS NULL OR c.coverage_tags && p_coverage_tags)
      AND (p_section_types IS NULL OR c.section_type = ANY(p_section_types))
      AND (p_document_types IS NULL OR d.document_type = ANY(p_document_types))
    ORDER BY c.embedding <=> p_embedding
    LIMIT p_match_count;
END;
$$ LANGUAGE plpgsql;

-- 11. FUNCIÓN: VALIDAR COTIZACIÓN VS CLAUSULADO
CREATE OR REPLACE FUNCTION validate_quote_coverage(
    p_quote_document_id UUID,
    p_clause_document_id UUID,
    p_coverage_tag TEXT,
    p_match_count INTEGER DEFAULT 3
)
RETURNS TABLE(
    quote_chunk_id UUID,
    quote_content TEXT,
    quote_page INTEGER,
    clause_chunk_id UUID,
    clause_content TEXT,
    clause_page INTEGER,
    similarity FLOAT
) AS $$
DECLARE
    v_quote_embedding vector(768);
BEGIN
    SELECT embedding INTO v_quote_embedding
    FROM chunks
    WHERE document_id = p_quote_document_id
      AND p_coverage_tag = ANY(coverage_tags)
    ORDER BY created_at DESC
    LIMIT 1;
    
    IF v_quote_embedding IS NULL THEN
        RETURN;
    END IF;
    
    RETURN QUERY
    SELECT 
        qc.id as quote_chunk_id,
        qc.content as quote_content,
        qc.page_number as quote_page,
        cc.id as clause_chunk_id,
        cc.content as clause_content,
        cc.page_number as clause_page,
        1 - (cc.embedding <=> v_quote_embedding) as similarity
    FROM chunks cc
    WHERE cc.document_id = p_clause_document_id
      AND p_coverage_tag = ANY(cc.coverage_tags)
    ORDER BY cc.embedding <=> v_quote_embedding
    LIMIT p_match_count;
END;
$$ LANGUAGE plpgsql;

-- 12. FUNCIÓN: OBTENER CHUNKS CON IMÁGENES
CREATE OR REPLACE FUNCTION get_chunks_with_images(
    p_chunk_ids UUID[]
)
RETURNS TABLE(
    chunk_id UUID,
    content TEXT,
    page_number INTEGER,
    document_id UUID,
    document_name TEXT,
    image_url TEXT,
    image_path TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.id as chunk_id,
        c.content,
        c.page_number,
        c.document_id,
        d.document_name,
        pi.storage_url as image_url,
        pi.storage_path as image_path
    FROM chunks c
    JOIN documents d ON c.document_id = d.id
    LEFT JOIN page_images pi ON c.document_id = pi.document_id AND c.page_number = pi.page_number
    WHERE c.id = ANY(p_chunk_ids);
END;
$$ LANGUAGE plpgsql;

-- 13. FUNCIÓN: LISTAR DOCUMENTOS
CREATE OR REPLACE FUNCTION list_documents_by_insurer(
    p_insurer_id UUID,
    p_document_type TEXT DEFAULT NULL
)
RETURNS TABLE(
    document_id UUID,
    document_name TEXT,
    document_type TEXT,
    version TEXT,
    total_pages INTEGER,
    chunk_count BIGINT,
    is_active BOOLEAN,
    created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        d.id as document_id,
        d.document_name,
        d.document_type,
        d.version,
        d.total_pages,
        COUNT(c.id) as chunk_count,
        d.is_active,
        d.created_at
    FROM documents d
    LEFT JOIN chunks c ON d.id = c.document_id
    WHERE d.insurer_id = p_insurer_id
      AND (p_document_type IS NULL OR d.document_type = p_document_type)
    GROUP BY d.id, d.document_name, d.document_type, d.version, d.total_pages, d.is_active, d.created_at
    ORDER BY d.created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- 14. FUNCIÓN: ELIMINAR DOCUMENTO
CREATE OR REPLACE FUNCTION delete_document_complete(
    p_document_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
    v_insurer_id UUID;
    v_storage_path TEXT;
BEGIN
    SELECT insurer_id, storage_path INTO v_insurer_id, v_storage_path
    FROM documents WHERE id = p_document_id;
    
    IF v_insurer_id IS NULL THEN
        RETURN false;
    END IF;
    
    DELETE FROM documents WHERE id = p_document_id;
    
    RETURN true;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- VERIFICACIÓN: Insertar aseguradora de prueba
-- =====================================================
INSERT INTO insurers (name, nit) 
VALUES ('Aseguradora de Prueba', '123456789')
ON CONFLICT (name) DO NOTHING;

-- Mostrar resultados
SELECT 'Tablas creadas exitosamente' as status;
SELECT COUNT(*) as total_aseguradoras FROM insurers;
