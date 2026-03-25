-- 004_fix_embedding_dimension.sql
-- Corregir dimensión de embeddings de 768 a 3072 (gemini-embedding-001)

-- Eliminar índice existente
DROP INDEX IF EXISTS idx_chunks_embedding;

-- Alterar columna embedding para usar 3072 dimensiones
ALTER TABLE chunks ALTER COLUMN embedding TYPE vector(3072);

-- Recrear índice con nueva dimensión
CREATE INDEX idx_chunks_embedding ON chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Actualizar funciones SQL para usar 3072 dimensiones
DROP FUNCTION IF EXISTS search_chunks_by_coverage(vector, UUID, TEXT, INTEGER);
DROP FUNCTION IF EXISTS search_chunks_advanced(vector, UUID, TEXT[], TEXT[], TEXT[], INTEGER, FLOAT);
DROP FUNCTION IF EXISTS validate_quote_coverage(UUID, UUID, TEXT, INTEGER);

-- Recrear funciones con dimensión correcta
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
