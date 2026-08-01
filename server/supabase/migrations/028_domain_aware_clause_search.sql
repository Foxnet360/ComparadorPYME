-- 028_domain_aware_clause_search.sql
-- Base-hardening PR6: Add p_domain filter parameter to search_structured_clauses RPC

CREATE OR REPLACE FUNCTION search_structured_clauses(
    p_insurer_name TEXT DEFAULT NULL,
    p_coverage_name TEXT DEFAULT NULL,
    p_field_type TEXT DEFAULT NULL,
    match_count INT DEFAULT 10,
    p_domain TEXT DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    insurer_name TEXT,
    product_name TEXT,
    document_type TEXT,
    coverage_data JSONB,
    page_number INT,
    relevance FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        sc.id,
        sc.insurer_name,
        sc.product_name,
        sc.document_type,
        jsonb_path_query_array(
            sc.extracted_data, 
            '$.coverages ? (@.name like_regex $coverage_name flag "i")',
            jsonb_build_object('coverage_name', COALESCE(p_coverage_name, '.*'))
        ) AS coverage_data,
        (sc.extracted_data->>'sourcePage')::INT AS page_number,
        CASE 
            WHEN p_coverage_name IS NOT NULL AND sc.extracted_data::TEXT ILIKE '%' || p_coverage_name || '%' THEN 1.0
            ELSE 0.5
        END::FLOAT AS relevance
    FROM structured_clauses sc
    WHERE (p_insurer_name IS NULL OR sc.insurer_name = p_insurer_name)
      AND (p_domain IS NULL OR sc.domain = p_domain)
      AND (p_coverage_name IS NULL OR sc.extracted_data::TEXT ILIKE '%' || p_coverage_name || '%')
      AND (p_field_type IS NULL OR sc.extracted_data->p_field_type IS NOT NULL)
    ORDER BY relevance DESC, sc.created_at DESC
    LIMIT match_count;
END;
$$;

ALTER FUNCTION IF EXISTS search_structured_clauses(text, text, text, integer, text) SET search_path = public, pg_temp;
COMMENT ON FUNCTION search_structured_clauses IS 'Searches structured clauses filtered by insurer, coverage, field type, and domain';
