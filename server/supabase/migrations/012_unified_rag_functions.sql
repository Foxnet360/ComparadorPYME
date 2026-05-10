-- 012_unified_rag_functions.sql
-- Migration: Create unified RAG functions using chunks table (3072 dims)
-- This consolidates clause retrieval to use the main chunks table

-- Function: Hybrid search combining vector similarity and full-text search
-- Uses chunks table with document_type filter for clause documents
CREATE OR REPLACE FUNCTION match_chunks_unified(
    query_embedding vector(3072),
    query_text text,
    insurer_filter text DEFAULT NULL,
    coverage_filter text[] DEFAULT NULL,
    section_filter text DEFAULT NULL,
    match_count int DEFAULT 5
)
RETURNS TABLE (
    id uuid,
    document_id uuid,
    insurer_name text,
    section_type text,
    coverage_tags text[],
    content text,
    page_number int,
    similarity float,
    rank bigint
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    WITH vector_search AS (
        SELECT 
            c.id,
            c.document_id,
            d.document_name as insurer_name,
            c.section_type,
            c.coverage_tags,
            c.content,
            c.page_number,
            1 - (c.embedding <=> query_embedding) AS vector_score
        FROM chunks c
        JOIN documents d ON c.document_id = d.id
        WHERE c.embedding IS NOT NULL
        AND d.document_type IN ('CLAUSULADO_GENERAL', 'CLAUSULADO_PARTICULAR')
        AND d.is_active = true
        AND (insurer_filter IS NULL OR d.document_name ILIKE '%' || insurer_filter || '%')
        AND (coverage_filter IS NULL OR c.coverage_tags && coverage_filter)
        AND (section_filter IS NULL OR c.section_type = section_filter)
        ORDER BY c.embedding <=> query_embedding
        LIMIT match_count * 2
    ),
    text_search AS (
        SELECT 
            c.id,
            c.document_id,
            d.document_name as insurer_name,
            c.section_type,
            c.coverage_tags,
            c.content,
            c.page_number,
            ts_rank(
                to_tsvector('spanish', COALESCE(c.content_normalized, '')),
                plainto_tsquery('spanish', query_text)
            ) AS text_score
        FROM chunks c
        JOIN documents d ON c.document_id = d.id
        WHERE d.document_type IN ('CLAUSULADO_GENERAL', 'CLAUSULADO_PARTICULAR')
        AND d.is_active = true
        AND (insurer_filter IS NULL OR d.document_name ILIKE '%' || insurer_filter || '%')
        AND (coverage_filter IS NULL OR c.coverage_tags && coverage_filter)
        AND (section_filter IS NULL OR c.section_type = section_filter)
        AND to_tsvector('spanish', COALESCE(c.content_normalized, '')) @@ plainto_tsquery('spanish', query_text)
        ORDER BY text_score DESC
        LIMIT match_count * 2
    ),
    combined AS (
        SELECT 
            vs.id, vs.document_id, vs.insurer_name, vs.section_type,
            vs.coverage_tags, vs.content, vs.page_number,
            vs.vector_score AS score, 'vector' AS source
        FROM vector_search vs
        
        UNION ALL
        
        SELECT 
            ts.id, ts.document_id, ts.insurer_name, ts.section_type,
            ts.coverage_tags, ts.content, ts.page_number,
            ts.text_score AS score, 'text' AS source
        FROM text_search ts
    )
    SELECT 
        c.id, c.document_id, c.insurer_name, c.section_type,
        c.coverage_tags, c.content, c.page_number,
        MAX(c.score) AS similarity,
        ROW_NUMBER() OVER (ORDER BY MAX(c.score) DESC) AS rank
    FROM combined c
    GROUP BY c.id, c.document_id, c.insurer_name, c.section_type,
             c.coverage_tags, c.content, c.page_number
    ORDER BY MAX(c.score) DESC
    LIMIT match_count;
END;
$$;

-- Function: Simple vector-only search (fallback for when full-text is not needed)
CREATE OR REPLACE FUNCTION match_chunks_vector_unified(
    query_embedding vector(3072),
    insurer_filter text DEFAULT NULL,
    coverage_filter text[] DEFAULT NULL,
    match_count int DEFAULT 5
)
RETURNS TABLE (
    id uuid,
    document_id uuid,
    insurer_name text,
    section_type text,
    coverage_tags text[],
    content text,
    page_number int,
    similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.id,
        c.document_id,
        d.document_name as insurer_name,
        c.section_type,
        c.coverage_tags,
        c.content,
        c.page_number,
        1 - (c.embedding <=> query_embedding) AS similarity
    FROM chunks c
    JOIN documents d ON c.document_id = d.id
    WHERE c.embedding IS NOT NULL
    AND d.document_type IN ('CLAUSULADO_GENERAL', 'CLAUSULADO_PARTICULAR')
    AND d.is_active = true
    AND (insurer_filter IS NULL OR d.document_name ILIKE '%' || insurer_filter || '%')
    AND (coverage_filter IS NULL OR c.coverage_tags && coverage_filter)
    ORDER BY c.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

-- Function: Get chunks by coverage name (for cross-referencing quotes)
CREATE OR REPLACE FUNCTION get_chunks_by_coverage_unified(
    coverage_name text,
    insurer_filter text DEFAULT NULL,
    section_filter text DEFAULT NULL,
    match_count int DEFAULT 3
)
RETURNS TABLE (
    id uuid,
    document_id uuid,
    insurer_name text,
    section_type text,
    coverage_tags text[],
    content text,
    page_number int
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.id,
        c.document_id,
        d.document_name as insurer_name,
        c.section_type,
        c.coverage_tags,
        c.content,
        c.page_number
    FROM chunks c
    JOIN documents d ON c.document_id = d.id
    WHERE d.document_type IN ('CLAUSULADO_GENERAL', 'CLAUSULADO_PARTICULAR')
    AND d.is_active = true
    AND c.coverage_tags @> ARRAY[coverage_name]
    AND (insurer_filter IS NULL OR d.document_name ILIKE '%' || insurer_filter || '%')
    AND (section_filter IS NULL OR c.section_type = section_filter)
    ORDER BY c.created_at DESC
    LIMIT match_count;
END;
$$;

-- Add indexes for performance if they don't exist
CREATE INDEX IF NOT EXISTS idx_chunks_document_type ON chunks(document_id);
CREATE INDEX IF NOT EXISTS idx_chunks_coverage_tags ON chunks USING GIN(coverage_tags);

-- Comments for documentation
COMMENT ON FUNCTION match_chunks_unified IS 'Hybrid search combining vector similarity and full-text search for clause retrieval using unified chunks table';
COMMENT ON FUNCTION match_chunks_vector_unified IS 'Vector-only similarity search for clause retrieval using unified chunks table';
COMMENT ON FUNCTION get_chunks_by_coverage_unified IS 'Retrieve clause chunks by coverage name for quote cross-referencing using unified chunks table';
