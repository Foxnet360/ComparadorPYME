-- 002_vector_functions.sql
-- Funciones SQL para búsqueda vectorial y validación

-- Función: Búsqueda semántica focalizada por cobertura
CREATE OR REPLACE FUNCTION search_chunks_by_coverage(
    p_embedding vector(3072),
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

-- Función: Búsqueda semántica con filtros avanzados
CREATE OR REPLACE FUNCTION search_chunks_advanced(
    p_embedding vector(3072),
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

-- Función: Validar cotización contra clausulado
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
    v_quote_embedding vector(3072);
BEGIN
    -- Obtener embedding representativo de la cotización para esta cobertura
    SELECT c.embedding INTO v_quote_embedding
    FROM chunks c
    WHERE c.document_id = p_quote_document_id
      AND p_coverage_tag = ANY(c.coverage_tags)
    ORDER BY c.created_at DESC
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

-- Función: Obtener chunks con sus imágenes de página
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

-- Función: Listar documentos por aseguradora con conteo de chunks
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

-- Función: Eliminar documento completo (cascada manual)
CREATE OR REPLACE FUNCTION delete_document_complete(
    p_document_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
    v_insurer_id UUID;
    v_storage_path TEXT;
BEGIN
    -- Obtener información del documento
    SELECT insurer_id, storage_path INTO v_insurer_id, v_storage_path
    FROM documents WHERE id = p_document_id;
    
    IF v_insurer_id IS NULL THEN
        RETURN false;
    END IF;
    
    -- Los chunks se eliminan automáticamente por ON DELETE CASCADE
    -- Las imágenes de página también por ON DELETE CASCADE
    
    -- Eliminar el documento
    DELETE FROM documents WHERE id = p_document_id;
    
    RETURN true;
END;
$$ LANGUAGE plpgsql;

-- Comentarios
COMMENT ON FUNCTION search_chunks_by_coverage IS 'Búsqueda semántica filtrada por aseguradora y cobertura';
COMMENT ON FUNCTION search_chunks_advanced IS 'Búsqueda semántica con múltiples filtros';
COMMENT ON FUNCTION validate_quote_coverage IS 'Compara chunks de cotización contra clausulado';
COMMENT ON FUNCTION get_chunks_with_images IS 'Obtiene chunks junto con URLs de imágenes de página';
