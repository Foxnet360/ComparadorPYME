-- Migration: Add structured clause extraction and hybrid search support
-- Created: 2026-05-14

-- ============================================
-- 1. Structured Clauses Table
-- ============================================
CREATE TABLE IF NOT EXISTS structured_clauses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    insurer_name TEXT NOT NULL,
    product_name TEXT,
    document_type TEXT CHECK (document_type IN ('CLAUSULADO_GENERAL', 'CLAUSULADO_PARTICULAR')),
    extracted_data JSONB NOT NULL DEFAULT '{}',
    raw_text TEXT,
    page_count INTEGER,
    document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- GIN index for full-text search on JSONB
CREATE INDEX IF NOT EXISTS idx_structured_clauses_data_gin 
ON structured_clauses USING GIN (extracted_data jsonb_path_ops);

-- Index for insurer search
CREATE INDEX IF NOT EXISTS idx_structured_clauses_insurer 
ON structured_clauses(insurer_name);

-- Index for document type
CREATE INDEX IF NOT EXISTS idx_structured_clauses_type 
ON structured_clauses(document_type);

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_structured_clauses_updated_at
    BEFORE UPDATE ON structured_clauses
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 2. Coverage Mappings Table (Learning Engine)
-- ============================================
CREATE TABLE IF NOT EXISTS coverage_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    raw_name TEXT NOT NULL,
    insurer_name TEXT,
    canonical_name TEXT,
    semantic_tags TEXT[],
    confidence FLOAT DEFAULT 0,
    is_composite BOOLEAN DEFAULT FALSE,
    components TEXT[],
    user_corrected BOOLEAN DEFAULT FALSE,
    correction_count INTEGER DEFAULT 0,
    last_used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Unique constraint for raw_name + insurer combination
CREATE UNIQUE INDEX IF NOT EXISTS idx_coverage_mappings_unique 
ON coverage_mappings(raw_name, COALESCE(insurer_name, ''));

-- Index for searching by raw name
CREATE INDEX IF NOT EXISTS idx_coverage_mappings_raw_name 
ON coverage_mappings(raw_name);

-- Index for corrected mappings
CREATE INDEX IF NOT EXISTS idx_coverage_mappings_corrected 
ON coverage_mappings(user_corrected) WHERE user_corrected = TRUE;

CREATE TRIGGER update_coverage_mappings_updated_at
    BEFORE UPDATE ON coverage_mappings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 3. Deductible Benchmarks Table
-- ============================================
CREATE TABLE IF NOT EXISTS deductible_benchmarks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    coverage_type TEXT NOT NULL,
    benchmark_name TEXT NOT NULL,
    benchmark_data JSONB NOT NULL DEFAULT '{}',
    market_region TEXT DEFAULT 'Colombia',
    effective_date DATE DEFAULT CURRENT_DATE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Unique constraint for coverage_type + benchmark_name
CREATE UNIQUE INDEX IF NOT EXISTS idx_deductible_benchmarks_unique 
ON deductible_benchmarks(coverage_type, benchmark_name);

-- Seed data for common benchmarks
INSERT INTO deductible_benchmarks (coverage_type, benchmark_name, benchmark_data, notes) VALUES
('Incendio (Edificio y Contenidos)', 'excellent', '{"type": "percentage", "value": 5}'::jsonb, 'Menos de 5% es excelente'),
('Incendio (Edificio y Contenidos)', 'standard', '{"type": "percentage", "value": 10}'::jsonb, 'Estándar de mercado: 10%'),
('Incendio (Edificio y Contenidos)', 'poor', '{"type": "percentage", "value": 20}'::jsonb, 'Más de 20% es desfavorable'),
('Terremoto y Eventos Catastróficos', 'excellent', '{"type": "percentage", "value": 10, "min": "2 SMMLV"}'::jsonb, 'Mínimo bajo'),
('Terremoto y Eventos Catastróficos', 'standard', '{"type": "percentage", "value": 10, "min": "5 SMMLV"}'::jsonb, 'Estándar: 10% min 5 SMMLV'),
('Terremoto y Eventos Catastróficos', 'poor', '{"type": "percentage", "value": 15, "min": "10 SMMLV"}'::jsonb, 'Elevado'),
('Responsabilidad Civil (RCE)', 'excellent', '{"type": "percentage", "value": 0}'::jsonb, 'Deducible 0% es ideal'),
('Responsabilidad Civil (RCE)', 'standard', '{"type": "percentage", "value": 0}'::jsonb, 'RC debería tener deducible 0%'),
('Responsabilidad Civil (RCE)', 'poor', '{"type": "percentage", "value": 5}'::jsonb, 'RC con deducible es desfavorable')
ON CONFLICT (coverage_type, benchmark_name) DO NOTHING;

-- ============================================
-- 4. Hybrid Search Functions (Vector + Full-Text)
-- ============================================

-- Function: Hybrid search combining vector similarity and full-text
CREATE OR REPLACE FUNCTION match_chunks_hybrid(
    query_embedding VECTOR(3072),
    query_text TEXT,
    insurer_filter TEXT DEFAULT NULL,
    coverage_filter TEXT[] DEFAULT NULL,
    section_filter TEXT DEFAULT NULL,
    match_count INT DEFAULT 10,
    vector_weight FLOAT DEFAULT 0.7,
    text_weight FLOAT DEFAULT 0.3
)
RETURNS TABLE (
    id UUID,
    document_id UUID,
    insurer_name TEXT,
    section_type TEXT,
    coverage_tags TEXT[],
    content TEXT,
    page_number INT,
    vector_similarity FLOAT,
    text_rank FLOAT,
    combined_score FLOAT
)
LANGUAGE plpgsql
AS $$
DECLARE
    query_tsquery TSQUERY;
BEGIN
    -- Convert query to tsquery for full-text search
    query_tsquery := plainto_tsquery('spanish', query_text);
    
    RETURN QUERY
    WITH vector_results AS (
        SELECT 
            cc.id,
            cc.document_id,
            cc.insurer_name,
            cc.section_type,
            cc.coverage_tags,
            cc.content,
            cc.page_number,
            1 - (cc.embedding <=> query_embedding) AS similarity
        FROM clause_chunks cc
        WHERE (insurer_filter IS NULL OR cc.insurer_name = insurer_filter)
          AND (coverage_filter IS NULL OR cc.coverage_tags && coverage_filter)
          AND (section_filter IS NULL OR cc.section_type = section_filter)
        ORDER BY cc.embedding <=> query_embedding
        LIMIT match_count * 2
    ),
    text_results AS (
        SELECT 
            cc.id,
            ts_rank(to_tsvector('spanish', cc.content), query_tsquery) AS rank
        FROM clause_chunks cc
        WHERE to_tsvector('spanish', cc.content) @@ query_tsquery
          AND (insurer_filter IS NULL OR cc.insurer_name = insurer_filter)
        ORDER BY ts_rank(to_tsvector('spanish', cc.content), query_tsquery) DESC
        LIMIT match_count * 2
    )
    SELECT 
        vr.id,
        vr.document_id,
        vr.insurer_name,
        vr.section_type,
        vr.coverage_tags,
        vr.content,
        vr.page_number,
        vr.similarity::FLOAT,
        COALESCE(tr.rank, 0)::FLOAT,
        (vector_weight * vr.similarity + text_weight * COALESCE(tr.rank, 0))::FLOAT AS combined_score
    FROM vector_results vr
    LEFT JOIN text_results tr ON vr.id = tr.id
    ORDER BY combined_score DESC
    LIMIT match_count;
END;
$$;

-- ============================================
-- 5. Structured Clause Search Functions
-- ============================================

-- Function: Search structured clauses by coverage name
CREATE OR REPLACE FUNCTION search_structured_clauses(
    p_insurer_name TEXT DEFAULT NULL,
    p_coverage_name TEXT DEFAULT NULL,
    p_field_type TEXT DEFAULT NULL,
    match_count INT DEFAULT 10
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
      AND (p_coverage_name IS NULL OR sc.extracted_data::TEXT ILIKE '%' || p_coverage_name || '%')
      AND (p_field_type IS NULL OR sc.extracted_data->p_field_type IS NOT NULL)
    ORDER BY relevance DESC, sc.created_at DESC
    LIMIT match_count;
END;
$$;

-- Function: Get deductible from structured clause
CREATE OR REPLACE FUNCTION get_clause_deductible(
    p_insurer_name TEXT,
    p_coverage_name TEXT
)
RETURNS TABLE (
    coverage_name TEXT,
    deductible JSONB,
    exclusions TEXT[],
    conditions TEXT[],
    page_number INT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        cov->>'name' AS coverage_name,
        cov->'deductible' AS deductible,
        ARRAY(SELECT jsonb_array_elements_text(cov->'exclusions')) AS exclusions,
        ARRAY(SELECT jsonb_array_elements_text(cov->'conditions')) AS conditions,
        (cov->>'sourcePage')::INT AS page_number
    FROM structured_clauses sc,
    LATERAL jsonb_array_elements(sc.extracted_data->'coverages') AS cov
    WHERE sc.insurer_name = p_insurer_name
      AND cov->>'name' ILIKE '%' || p_coverage_name || '%'
    LIMIT 1;
END;
$$;

-- ============================================
-- 6. Query Expansion Helper Function
-- ============================================

CREATE OR REPLACE FUNCTION expand_search_query(
    p_query TEXT,
    p_thesaurus JSONB DEFAULT '{}'
)
RETURNS TABLE (
    expanded_query TEXT,
    query_type TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_synonyms TEXT[];
    v_related TEXT[];
BEGIN
    -- Return original query
    RETURN QUERY SELECT p_query, 'original'::TEXT;
    
    -- Try to find synonyms in thesaurus
    IF p_thesaurus ? p_query THEN
        v_synonyms := ARRAY(SELECT jsonb_array_elements_text(p_thesaurus->p_query->'synonyms'));
        RETURN QUERY SELECT unnest(v_synonyms), 'synonym'::TEXT;
    END IF;
    
    -- Return related terms
    IF p_thesaurus ? p_query THEN
        v_related := ARRAY(SELECT jsonb_array_elements_text(p_thesaurus->p_query->'related'));
        RETURN QUERY SELECT unnest(v_related), 'related'::TEXT;
    END IF;
END;
$$;

-- ============================================
-- 7. Indexes for Performance
-- ============================================

-- Composite index for common query patterns
CREATE INDEX IF NOT EXISTS idx_structured_clauses_insurer_type 
ON structured_clauses(insurer_name, document_type);

-- Index for text search in raw_text
CREATE INDEX IF NOT EXISTS idx_structured_clauses_raw_text 
ON structured_clauses USING GIN(to_tsvector('spanish', COALESCE(raw_text, '')));

-- Partial index for particular clauses (commonly queried)
CREATE INDEX IF NOT EXISTS idx_structured_clauses_particular 
ON structured_clauses(insurer_name, product_name) 
WHERE document_type = 'CLAUSULADO_PARTICULAR';
