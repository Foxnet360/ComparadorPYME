-- 021_recreate_rpc_functions.sql
-- db-coherence-remediation — Fase 1.1/1.2
-- Reconstructs the RPC functions lost from the live database, following the
-- CALL-SITE contracts in server/src (arg names, return fields), not the stale
-- versions in 001_initial_schema.sql.
--
-- Design notes:
-- * Vector params are JSONB: callers pass BOTH "raw number[]" (ragRetrievalService)
--   and string "[...]" (vectorStore, documentIndexingService). _to_vector
--   normalizes either form to vector(3072).
-- * All retrieval RPCs return the unified 8-field row the callers read:
--   (id, document_id, insurer_name, section_type, coverage_tags, content,
--    page_number, similarity).
-- * search_structured_clauses is CREATE OR REPLACE'd to ADD extracted_data to
--   its result (callers read row.extracted_data; live function only returned
--   coverage_data, so searchClause always fell back to null).
-- * documents.document_type CHECK widened with 'ANEXO' (code enum includes it).
-- * exec_sql is recreated for admin scripts but EXECUTE is revoked from
--   anon/authenticated (service_role only).

-- ---------------------------------------------------------------------------
-- Helper: normalize jsonb (string "[...]" OR number array) -> vector(3072)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._to_vector(p_val JSONB)
RETURNS public.vector LANGUAGE sql IMMUTABLE AS $$
    SELECT CASE
        WHEN p_val IS NULL OR p_val = 'null'::jsonb THEN NULL
        WHEN jsonb_typeof(p_val) = 'string' THEN (p_val #>> '{}')::public.vector
        ELSE ('[' || COALESCE((SELECT string_agg(x, ',') FROM jsonb_array_elements_text(p_val) AS t(x)), '') || ']')::public.vector
    END
$$;

-- ---------------------------------------------------------------------------
-- 1.1 index_document_transaction: atomic documents + page_images + chunks
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.index_document_transaction(
    p_insurer_id UUID,
    p_document_name TEXT,
    p_document_type TEXT,
    p_version TEXT DEFAULT NULL,
    p_total_pages INT DEFAULT NULL,
    p_storage_path TEXT DEFAULT NULL,
    p_uploaded_by TEXT DEFAULT 'anonymous',
    p_images JSONB DEFAULT '[]'::jsonb,
    p_chunks JSONB DEFAULT '[]'::jsonb,
    p_product_name TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE
    v_document_id UUID;
BEGIN
    INSERT INTO public.documents (
        insurer_id, document_name, document_type, version, total_pages,
        storage_path, uploaded_by, product_name, is_active
    )
    VALUES (
        p_insurer_id, p_document_name, p_document_type, p_version, p_total_pages,
        p_storage_path, p_uploaded_by, COALESCE(p_product_name, p_document_name), true
    )
    ON CONFLICT (insurer_id, document_name, document_type)
    DO UPDATE SET
        version = EXCLUDED.version,
        total_pages = EXCLUDED.total_pages,
        storage_path = EXCLUDED.storage_path,
        product_name = EXCLUDED.product_name,
        is_active = true,
        updated_at = now()
    RETURNING id INTO v_document_id;

    -- Replace page images and chunks (re-index semantics)
    DELETE FROM public.page_images WHERE document_id = v_document_id;
    DELETE FROM public.chunks WHERE document_id = v_document_id;

    INSERT INTO public.page_images (document_id, page_number, storage_url, storage_path, width, height)
    SELECT v_document_id,
           (img->>'page_number')::INT,
           img->>'storage_url',
           img->>'storage_path',
           NULLIF(img->>'width', '')::INT,
           NULLIF(img->>'height', '')::INT
    FROM jsonb_array_elements(p_images) AS img;

    INSERT INTO public.chunks (document_id, page_number, content, content_normalized, embedding, metadata, coverage_tags, section_type)
    SELECT v_document_id,
           (chk->>'page_number')::INT,
           chk->>'content',
           chk->>'content_normalized',
           public._to_vector(chk->'embedding'),
           COALESCE(chk->'metadata', '{}'::jsonb),
           COALESCE((SELECT array_agg(x) FROM jsonb_array_elements_text(chk->'coverage_tags') AS t(x)), '{}'::TEXT[]),
           chk->>'section_type'
    FROM jsonb_array_elements(p_chunks) AS chk;

    RETURN v_document_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- 1.2 Retrieval RPCs (unified 8-field rows)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.match_chunks_unified(
    query_embedding JSONB DEFAULT NULL,
    query_text TEXT DEFAULT NULL,
    insurer_filter TEXT DEFAULT NULL,
    coverage_filter TEXT[] DEFAULT NULL,
    section_filter TEXT DEFAULT NULL,
    match_count INT DEFAULT 15
)
RETURNS TABLE (id UUID, document_id UUID, insurer_name TEXT, section_type TEXT, coverage_tags TEXT[], content TEXT, page_number INT, similarity FLOAT)
LANGUAGE sql STABLE SET search_path = public, pg_temp AS $$
    WITH q AS (SELECT public._to_vector(query_embedding) AS v)
    SELECT c.id, c.document_id, i.name, c.section_type, c.coverage_tags, c.content, c.page_number,
        CASE WHEN q.v IS NOT NULL
             THEN (1 - (c.embedding <=> q.v))::FLOAT
             ELSE ts_rank(to_tsvector('spanish', c.content), plainto_tsquery('spanish', COALESCE(query_text, '')))
        END AS similarity
    FROM public.chunks c
    JOIN public.documents d ON d.id = c.document_id AND d.is_active = true
    JOIN public.insurers i ON i.id = d.insurer_id
    CROSS JOIN q
    WHERE (insurer_filter IS NULL OR i.name = insurer_filter)
      AND (section_filter IS NULL OR c.section_type = section_filter)
      AND (coverage_filter IS NULL OR c.coverage_tags && coverage_filter)
      AND (query_text IS NULL OR to_tsvector('spanish', c.content) @@ plainto_tsquery('spanish', query_text))
    ORDER BY similarity DESC, c.page_number
    LIMIT match_count;
$$;

CREATE OR REPLACE FUNCTION public.match_chunks_vector_unified(
    query_embedding JSONB DEFAULT NULL,
    insurer_filter TEXT DEFAULT NULL,
    coverage_filter TEXT[] DEFAULT NULL,
    match_count INT DEFAULT 5
)
RETURNS TABLE (id UUID, document_id UUID, insurer_name TEXT, section_type TEXT, coverage_tags TEXT[], content TEXT, page_number INT, similarity FLOAT)
LANGUAGE sql STABLE SET search_path = public, pg_temp AS $$
    WITH q AS (SELECT public._to_vector(query_embedding) AS v)
    SELECT c.id, c.document_id, i.name, c.section_type, c.coverage_tags, c.content, c.page_number,
           (1 - (c.embedding <=> q.v))::FLOAT AS similarity
    FROM public.chunks c
    JOIN public.documents d ON d.id = c.document_id AND d.is_active = true
    JOIN public.insurers i ON i.id = d.insurer_id
    CROSS JOIN q
    WHERE q.v IS NOT NULL
      AND (insurer_filter IS NULL OR i.name = insurer_filter)
      AND (coverage_filter IS NULL OR c.coverage_tags && coverage_filter)
    ORDER BY c.embedding <=> q.v
    LIMIT match_count;
$$;

CREATE OR REPLACE FUNCTION public.match_chunks_hybrid(
    query_embedding JSONB DEFAULT NULL,
    query_text TEXT DEFAULT NULL,
    insurer_filter TEXT DEFAULT NULL,
    coverage_filter TEXT[] DEFAULT NULL,
    section_filter TEXT DEFAULT NULL,
    match_count INT DEFAULT 15,
    vector_weight FLOAT DEFAULT 0.7,
    text_weight FLOAT DEFAULT 0.3
)
RETURNS TABLE (id UUID, document_id UUID, insurer_name TEXT, section_type TEXT, coverage_tags TEXT[], content TEXT, page_number INT, similarity FLOAT, combined_score FLOAT)
LANGUAGE sql STABLE SET search_path = public, pg_temp AS $$
    WITH q AS (SELECT public._to_vector(query_embedding) AS v),
    scored AS (
        SELECT c.id, c.document_id, i.name AS iname, c.section_type, c.coverage_tags, c.content, c.page_number,
            CASE WHEN q.v IS NOT NULL THEN (1 - (c.embedding <=> q.v))::FLOAT ELSE 0 END AS vsim,
            CASE WHEN query_text IS NOT NULL
                 THEN ts_rank(to_tsvector('spanish', c.content), plainto_tsquery('spanish', query_text))
                 ELSE 0 END AS tsim
        FROM public.chunks c
        JOIN public.documents d ON d.id = c.document_id AND d.is_active = true
        JOIN public.insurers i ON i.id = d.insurer_id
        CROSS JOIN q
        WHERE (insurer_filter IS NULL OR i.name = insurer_filter)
          AND (section_filter IS NULL OR c.section_type = section_filter)
          AND (coverage_filter IS NULL OR c.coverage_tags && coverage_filter)
          AND (query_text IS NULL OR to_tsvector('spanish', c.content) @@ plainto_tsquery('spanish', query_text))
    )
    SELECT s.id, s.document_id, s.iname, s.section_type, s.coverage_tags, s.content, s.page_number,
           s.vsim AS similarity,
           (vector_weight * s.vsim + text_weight * s.tsim)::FLOAT AS combined_score
    FROM scored s
    ORDER BY combined_score DESC, s.page_number
    LIMIT match_count;
$$;

-- vectorStore fallback: returns id, content, metadata, similarity
CREATE OR REPLACE FUNCTION public.match_chunks(
    query_embedding JSONB DEFAULT NULL,
    match_threshold FLOAT DEFAULT 0.5,
    match_count INT DEFAULT 10,
    insurer_filter TEXT DEFAULT NULL
)
RETURNS TABLE (id UUID, content TEXT, metadata JSONB, similarity FLOAT)
LANGUAGE sql STABLE SET search_path = public, pg_temp AS $$
    WITH q AS (SELECT public._to_vector(query_embedding) AS v)
    SELECT c.id, c.content, c.metadata, (1 - (c.embedding <=> q.v))::FLOAT AS similarity
    FROM public.chunks c
    JOIN public.documents d ON d.id = c.document_id AND d.is_active = true
    JOIN public.insurers i ON i.id = d.insurer_id
    CROSS JOIN q
    WHERE q.v IS NOT NULL
      AND (insurer_filter IS NULL OR i.name = insurer_filter)
      AND 1 - (c.embedding <=> q.v) >= match_threshold
    ORDER BY c.embedding <=> q.v
    LIMIT match_count;
$$;

CREATE OR REPLACE FUNCTION public.get_chunks_by_coverage_unified(
    coverage_name TEXT,
    insurer_filter TEXT DEFAULT NULL,
    section_filter TEXT DEFAULT NULL,
    match_count INT DEFAULT 3
)
RETURNS TABLE (id UUID, document_id UUID, insurer_name TEXT, section_type TEXT, coverage_tags TEXT[], content TEXT, page_number INT, similarity FLOAT)
LANGUAGE sql STABLE SET search_path = public, pg_temp AS $$
    SELECT c.id, c.document_id, i.name, c.section_type, c.coverage_tags, c.content, c.page_number,
        CASE WHEN coverage_name = ANY(c.coverage_tags) THEN 0.95::FLOAT
             ELSE ts_rank(to_tsvector('spanish', c.content), plainto_tsquery('spanish', coverage_name))::FLOAT
        END AS similarity
    FROM public.chunks c
    JOIN public.documents d ON d.id = c.document_id AND d.is_active = true
    JOIN public.insurers i ON i.id = d.insurer_id
    WHERE (insurer_filter IS NULL OR i.name = insurer_filter)
      AND (section_filter IS NULL OR c.section_type = section_filter)
      AND (coverage_name = ANY(c.coverage_tags) OR c.content ILIKE '%' || coverage_name || '%')
    ORDER BY similarity DESC, c.page_number
    LIMIT match_count;
$$;

CREATE OR REPLACE FUNCTION public.get_parent_chunks(
    document_id UUID,
    section_filter TEXT DEFAULT NULL,
    match_count INT DEFAULT 5
)
RETURNS TABLE (id UUID, document_id UUID, insurer_name TEXT, section_type TEXT, coverage_tags TEXT[], content TEXT, page_number INT, similarity FLOAT)
LANGUAGE sql STABLE SET search_path = public, pg_temp AS $$
    SELECT c.id, c.document_id, i.name, c.section_type, c.coverage_tags, c.content, c.page_number,
           0.85::FLOAT AS similarity
    FROM public.chunks c
    JOIN public.documents d ON d.id = c.document_id
    JOIN public.insurers i ON i.id = d.insurer_id
    WHERE c.document_id = get_parent_chunks.document_id
      AND (section_filter IS NULL OR c.section_type = section_filter)
    ORDER BY (c.section_type = 'GENERAL') DESC, c.page_number
    LIMIT match_count;
$$;

CREATE OR REPLACE FUNCTION public.search_chunks_advanced(
    p_embedding JSONB DEFAULT NULL,
    p_insurer_id UUID DEFAULT NULL,
    p_coverage_tags TEXT[] DEFAULT NULL,
    p_section_types TEXT[] DEFAULT NULL,
    p_match_count INT DEFAULT 10,
    p_min_similarity FLOAT DEFAULT 0.6
)
RETURNS TABLE (id UUID, content TEXT, page_number INT, document_id UUID, document_name TEXT, document_type TEXT, section_type TEXT, coverage_tags TEXT[], similarity FLOAT)
LANGUAGE sql STABLE SET search_path = public, pg_temp AS $$
    WITH q AS (SELECT public._to_vector(p_embedding) AS v)
    SELECT c.id, c.content, c.page_number, d.id, d.document_name, d.document_type, c.section_type, c.coverage_tags,
        CASE WHEN q.v IS NOT NULL
             THEN (1 - (c.embedding <=> q.v))::FLOAT
             ELSE ts_rank(to_tsvector('spanish', c.content), plainto_tsquery('spanish', ''))
        END AS similarity
    FROM public.chunks c
    JOIN public.documents d ON d.id = c.document_id AND d.is_active = true
    CROSS JOIN q
    WHERE (p_insurer_id IS NULL OR d.insurer_id = p_insurer_id)
      AND (p_section_types IS NULL OR c.section_type = ANY(p_section_types))
      AND (p_coverage_tags IS NULL OR c.coverage_tags && p_coverage_tags)
      AND (q.v IS NULL OR 1 - (c.embedding <=> q.v) >= p_min_similarity)
    ORDER BY similarity DESC, c.page_number
    LIMIT p_match_count;
$$;

CREATE OR REPLACE FUNCTION public.search_chunks_by_coverage(
    p_embedding JSONB DEFAULT NULL,
    p_insurer_id UUID DEFAULT NULL,
    p_coverage_tag TEXT DEFAULT NULL,
    p_match_count INT DEFAULT 10
)
RETURNS TABLE (id UUID, content TEXT, page_number INT, document_id UUID, document_type TEXT, document_name TEXT, similarity FLOAT)
LANGUAGE sql STABLE SET search_path = public, pg_temp AS $$
    WITH q AS (SELECT public._to_vector(p_embedding) AS v)
    SELECT c.id, c.content, c.page_number, d.id, d.document_type, d.document_name,
        CASE WHEN q.v IS NOT NULL THEN (1 - (c.embedding <=> q.v))::FLOAT
             WHEN p_coverage_tag = ANY(c.coverage_tags) THEN 0.9::FLOAT
             ELSE 0.5::FLOAT
        END AS similarity
    FROM public.chunks c
    JOIN public.documents d ON d.id = c.document_id AND d.is_active = true
    CROSS JOIN q
    WHERE (p_insurer_id IS NULL OR d.insurer_id = p_insurer_id)
      AND (p_coverage_tag IS NULL OR p_coverage_tag = ANY(c.coverage_tags))
    ORDER BY similarity DESC, c.page_number
    LIMIT p_match_count;
$$;

CREATE OR REPLACE FUNCTION public.get_chunks_with_images(p_chunk_ids UUID[])
RETURNS TABLE (chunk_id UUID, image_url TEXT, image_path TEXT)
LANGUAGE sql STABLE SET search_path = public, pg_temp AS $$
    SELECT c.id, pi.storage_url, pi.storage_path
    FROM public.chunks c
    JOIN public.page_images pi
      ON pi.document_id = c.document_id AND pi.page_number = c.page_number
    WHERE c.id = ANY(p_chunk_ids);
$$;

CREATE OR REPLACE FUNCTION public.validate_quote_coverage(
    p_quote_document_id UUID,
    p_clause_document_id UUID,
    p_coverage_tag TEXT DEFAULT 'general',
    p_match_count INT DEFAULT 5
)
RETURNS TABLE (quote_chunk_id UUID, quote_content TEXT, quote_page INT, clause_chunk_id UUID, clause_content TEXT, clause_page INT, similarity FLOAT)
LANGUAGE sql STABLE SET search_path = public, pg_temp AS $$
    SELECT qc.id, qc.content, qc.page_number, cc.id, cc.content, cc.page_number,
           (1 - (qc.embedding <=> cc.embedding))::FLOAT AS similarity
    FROM public.chunks qc
    JOIN public.chunks cc ON cc.document_id = p_clause_document_id
    WHERE qc.document_id = p_quote_document_id
      AND cc.section_type = 'COBERTURA'
      AND qc.coverage_tags && cc.coverage_tags
      AND (lower(p_coverage_tag) = 'general'
           OR (p_coverage_tag = ANY(qc.coverage_tags) AND p_coverage_tag = ANY(cc.coverage_tags)))
    ORDER BY qc.embedding <=> cc.embedding
    LIMIT p_match_count;
$$;

CREATE OR REPLACE FUNCTION public.get_clause_deductible(
    p_insurer_name TEXT,
    p_coverage_name TEXT
)
RETURNS JSONB
LANGUAGE plpgsql STABLE SET search_path = public, pg_temp AS $$
DECLARE
    v_result JSONB;
BEGIN
    SELECT (SELECT cov FROM jsonb_array_elements(sc.extracted_data->'coverages') cov
            WHERE COALESCE(p_coverage_name,'') = '' OR cov->>'name' ILIKE '%' || p_coverage_name || '%'
            LIMIT 1)
    INTO v_result
    FROM public.structured_clauses sc
    WHERE sc.insurer_name = p_insurer_name
    ORDER BY sc.created_at DESC
    LIMIT 1;
    RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.list_documents_by_insurer(
    p_insurer_id UUID,
    p_document_type TEXT DEFAULT NULL
)
RETURNS TABLE (document_id UUID, document_name TEXT, document_type TEXT, version TEXT, total_pages INT, chunk_count BIGINT, is_active BOOLEAN, created_at TIMESTAMPTZ)
LANGUAGE sql STABLE SET search_path = public, pg_temp AS $$
    SELECT d.id, d.document_name, d.document_type, d.version, d.total_pages,
           (SELECT count(*) FROM public.chunks c WHERE c.document_id = d.id),
           d.is_active, d.created_at
    FROM public.documents d
    WHERE d.insurer_id = p_insurer_id
      AND (p_document_type IS NULL OR d.document_type = p_document_type)
    ORDER BY d.created_at DESC;
$$;

CREATE OR REPLACE FUNCTION public.delete_document_complete(p_document_id UUID)
RETURNS BOOLEAN
LANGUAGE sql SET search_path = public, pg_temp AS $$
    WITH deleted AS (DELETE FROM public.documents WHERE id = p_document_id RETURNING id)
    SELECT EXISTS (SELECT 1 FROM deleted);
$$;

-- ---------------------------------------------------------------------------
-- search_structured_clauses: ADD extracted_data to the result set
-- (callers read row.extracted_data; previous definition only returned
-- coverage_data, making searchClause always return null)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.search_structured_clauses(
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
    extracted_data JSONB,
    page_number INT,
    relevance FLOAT
)
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
    RETURN QUERY
    SELECT
        sc.id,
        sc.insurer_name,
        sc.product_name,
        sc.document_type,
        COALESCE((SELECT jsonb_agg(cov) FROM jsonb_array_elements(sc.extracted_data->'coverages') cov
         WHERE COALESCE(p_coverage_name,'') = '' OR cov->>'name' ILIKE '%' || p_coverage_name || '%'), '[]'::jsonb) AS coverage_data,
        sc.extracted_data,
        (sc.extracted_data->>'sourcePage')::INT AS page_number,
        CASE
            WHEN p_coverage_name IS NOT NULL AND sc.extracted_data::TEXT ILIKE '%' || p_coverage_name || '%' THEN 1.0
            ELSE 0.5
        END::FLOAT AS relevance
    FROM public.structured_clauses sc
    WHERE (p_insurer_name IS NULL OR sc.insurer_name = p_insurer_name)
      AND (p_domain IS NULL OR sc.domain = p_domain)
      AND (p_coverage_name IS NULL OR sc.extracted_data::TEXT ILIKE '%' || p_coverage_name || '%')
      AND (p_field_type IS NULL OR sc.extracted_data->p_field_type IS NOT NULL)
    ORDER BY relevance DESC, sc.created_at DESC
    LIMIT match_count;
END;
$$;

-- ---------------------------------------------------------------------------
-- Widen documents.document_type CHECK with 'ANEXO' (code enum includes it)
-- ---------------------------------------------------------------------------
ALTER TABLE public.documents DROP CONSTRAINT IF EXISTS documents_document_type_check;
ALTER TABLE public.documents ADD CONSTRAINT documents_document_type_check
    CHECK (document_type IN ('CLAUSULADO_GENERAL', 'CLAUSULADO_PARTICULAR', 'COTIZACION', 'ANEXO'));

-- ---------------------------------------------------------------------------
-- exec_sql: admin-script pipe (runMigrations.js / setupSupabase.ts /
-- fixDatabaseView.ts). SELECTs return jsonb rows; other statements execute
-- and return "ok". NOT for runtime — revoke from anon/authenticated.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.exec_sql(sql TEXT)
RETURNS JSONB
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE
    v_result JSONB;
BEGIN
    IF lower(btrim(sql)) LIKE 'select%' OR lower(btrim(sql)) LIKE 'with%' THEN
        EXECUTE 'SELECT jsonb_agg(row_to_json(t)) FROM (' || sql || ') t' INTO v_result;
        RETURN COALESCE(v_result, '[]'::jsonb);
    ELSE
        EXECUTE sql;
        RETURN '"ok"'::jsonb;
    END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.exec_sql(TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.exec_sql(TEXT) FROM anon;
REVOKE EXECUTE ON FUNCTION public.exec_sql(TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.exec_sql(TEXT) TO service_role;
