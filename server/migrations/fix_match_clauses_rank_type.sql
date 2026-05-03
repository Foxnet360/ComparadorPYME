-- Fix: Change rank column type from int to bigint in match_clauses function
-- PostgreSQL row_number() returns bigint, not int

-- Drop existing function first
DROP FUNCTION IF EXISTS match_clauses(vector(768), text, text, text[], text, int);

-- Recreate with correct type
CREATE OR REPLACE FUNCTION match_clauses(
    query_embedding vector(768),
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
            cc.id,
            cc.document_id,
            cc.insurer_name,
            cc.section_type,
            cc.coverage_tags,
            cc.content,
            cc.page_number,
            1 - (cc.embedding <=> query_embedding) AS vector_score
        FROM clause_chunks cc
        WHERE cc.embedding IS NOT NULL
        AND (insurer_filter IS NULL OR cc.insurer_name = insurer_filter)
        AND (coverage_filter IS NULL OR cc.coverage_tags && coverage_filter)
        AND (section_filter IS NULL OR cc.section_type = section_filter)
        ORDER BY cc.embedding <=> query_embedding
        LIMIT match_count * 2
    ),
    text_search AS (
        SELECT 
            cc.id,
            cc.document_id,
            cc.insurer_name,
            cc.section_type,
            cc.coverage_tags,
            cc.content,
            cc.page_number,
            ts_rank(
                to_tsvector('spanish', COALESCE(cc.content_normalized, '')),
                plainto_tsquery('spanish', query_text)
            ) AS text_score
        FROM clause_chunks cc
        WHERE (insurer_filter IS NULL OR cc.insurer_name = insurer_filter)
        AND (coverage_filter IS NULL OR cc.coverage_tags && coverage_filter)
        AND (section_filter IS NULL OR cc.section_type = section_filter)
        AND to_tsvector('spanish', COALESCE(cc.content_normalized, '')) @@ plainto_tsquery('spanish', query_text)
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
