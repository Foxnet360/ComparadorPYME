-- =====================================================
-- CANONICAL INITIAL SCHEMA: Agente Comparador PYME (CSA)
-- Single Consolidated Baseline Migration
-- Vector Dimension: 3072 (Gemini 2.5 / 3 embeddings)
-- PostgreSQL 15+ / Supabase
-- =====================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. TABLES

-- 2.1 Insurers
CREATE TABLE IF NOT EXISTS public.insurers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL,
    nit TEXT,
    contact_email TEXT,
    phone TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2.2 Documents
CREATE TABLE IF NOT EXISTS public.documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    insurer_id UUID REFERENCES public.insurers(id) ON DELETE CASCADE,
    document_name TEXT NOT NULL,
    document_type TEXT CHECK (document_type IN ('CLAUSULADO_GENERAL', 'CLAUSULADO_PARTICULAR', 'COTIZACION')),
    product_name TEXT,
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

-- 2.3 Page Images
CREATE TABLE IF NOT EXISTS public.page_images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID REFERENCES public.documents(id) ON DELETE CASCADE,
    page_number INTEGER NOT NULL,
    storage_url TEXT NOT NULL,
    storage_path TEXT NOT NULL,
    ocr_text TEXT,
    width INTEGER,
    height INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(document_id, page_number)
);

-- 2.4 Vector Chunks (Quotations & General RAG)
CREATE TABLE IF NOT EXISTS public.chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID REFERENCES public.documents(id) ON DELETE CASCADE,
    page_number INTEGER NOT NULL,
    content TEXT NOT NULL,
    content_normalized TEXT,
    embedding vector(3072),
    metadata JSONB DEFAULT '{}',
    coverage_tags TEXT[],
    section_type TEXT CHECK (section_type IN ('COBERTURA', 'EXCLUSION', 'DEDUCIBLE', 'CONDICION', 'GENERAL')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2.5 Clause Versions
CREATE TABLE IF NOT EXISTS public.clause_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID REFERENCES public.documents(id) ON DELETE CASCADE,
    insurer_name TEXT NOT NULL,
    product_name TEXT NOT NULL,
    version_tag TEXT NOT NULL,
    effective_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2.6 Clause Chunks (Clause RAG Indexing)
CREATE TABLE IF NOT EXISTS public.clause_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID REFERENCES public.documents(id) ON DELETE CASCADE,
    clause_version_id UUID REFERENCES public.clause_versions(id) ON DELETE CASCADE,
    chunk_index INTEGER NOT NULL,
    content TEXT NOT NULL,
    embedding vector(3072),
    insurer_name TEXT NOT NULL,
    coverage_type TEXT,
    semantic_tags TEXT[],
    product_name TEXT,
    domain TEXT DEFAULT 'pyme',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2.7 Structured Clauses (Gemini JSON Extractions)
CREATE TABLE IF NOT EXISTS public.structured_clauses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID REFERENCES public.documents(id) ON DELETE SET NULL,
    insurer_name TEXT NOT NULL,
    product_name TEXT,
    document_type TEXT,
    extracted_data JSONB NOT NULL,
    raw_text TEXT,
    page_count INTEGER,
    domain TEXT DEFAULT 'pyme',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2.8 Clause Coverages
CREATE TABLE IF NOT EXISTS public.clause_coverages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clause_version_id UUID REFERENCES public.clause_versions(id) ON DELETE CASCADE,
    coverage_name TEXT NOT NULL,
    coverage_type TEXT,
    limit_amount NUMERIC,
    deductible_text TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2.9 Analysis History
CREATE TABLE IF NOT EXISTS public.analysis_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT,
    client_name TEXT NOT NULL,
    quote_document_ids UUID[],
    clause_document_ids UUID[],
    analysis_result JSONB NOT NULL,
    recommendation TEXT,
    total_score INTEGER,
    correlation_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2.10 Contextual Risk Analysis
CREATE TABLE IF NOT EXISTS public.contextual_risk_analysis (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    analysis_history_id UUID REFERENCES public.analysis_history(id) ON DELETE CASCADE,
    coverage_name TEXT NOT NULL,
    risk_type TEXT NOT NULL,
    risk_level TEXT NOT NULL,
    explanation TEXT,
    mitigation_suggestion TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2.11 Client Profiles
CREATE TABLE IF NOT EXISTS public.client_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT,
    client_name TEXT NOT NULL,
    primary_activity TEXT,
    annual_revenue BIGINT,
    employee_count INTEGER,
    building_type TEXT,
    has_single_supplier BOOLEAN,
    raw_client_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2.12 Chat System (Threads & Messages)
CREATE TABLE IF NOT EXISTS public.chat_threads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    title TEXT NOT NULL DEFAULT 'Nueva Consulta',
    report_id UUID REFERENCES public.analysis_history(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    thread_id UUID NOT NULL REFERENCES public.chat_threads(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    sources JSONB,
    confidence_score DOUBLE PRECISION,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2.13 Coverage Mappings & Graph
CREATE TABLE IF NOT EXISTS public.coverage_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    raw_name TEXT NOT NULL,
    insurer_name TEXT,
    canonical_name TEXT NOT NULL,
    semantic_tags TEXT[],
    confidence DOUBLE PRECISION DEFAULT 1.0,
    is_composite BOOLEAN DEFAULT false,
    components TEXT[],
    user_corrected BOOLEAN DEFAULT false,
    correction_count INTEGER DEFAULT 0,
    raw_text_snippet TEXT,
    ai_justification TEXT,
    page_number INTEGER,
    needs_human_review BOOLEAN DEFAULT false,
    embedding vector(3072),
    domain TEXT DEFAULT 'pyme',
    last_used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.coverage_graph_edges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    from_node TEXT NOT NULL,
    to_node TEXT NOT NULL,
    edge_type TEXT NOT NULL,
    weight DOUBLE PRECISION DEFAULT 1.0,
    insurer TEXT,
    correction_count INTEGER DEFAULT 0,
    domain TEXT DEFAULT 'pyme',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2.14 Coverage Embeddings Cache & Benchmarks
CREATE TABLE IF NOT EXISTS public.coverage_embeddings_cache (
    id SERIAL PRIMARY KEY,
    coverage_name TEXT NOT NULL,
    embedding JSONB NOT NULL,
    model TEXT NOT NULL,
    dimensions INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.deductible_benchmarks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    coverage_type TEXT NOT NULL,
    benchmark_name TEXT NOT NULL,
    benchmark_data JSONB NOT NULL,
    market_region TEXT DEFAULT 'CO',
    effective_date DATE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2.15 Template Registry
CREATE TABLE IF NOT EXISTS public.template_registry (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id TEXT NOT NULL,
    insurer TEXT NOT NULL,
    display_name TEXT NOT NULL,
    version INTEGER DEFAULT 1,
    fingerprints JSONB NOT NULL,
    schema JSONB NOT NULL,
    hints JSONB DEFAULT '{}',
    prompt_addon TEXT DEFAULT '',
    is_active BOOLEAN DEFAULT true,
    domain TEXT DEFAULT 'pyme',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2.16 Telemetry & Error Logging
CREATE TABLE IF NOT EXISTS public.analysis_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    analysis_id TEXT,
    duration_ms INTEGER NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('success', 'error')),
    error_type TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.unified_engine_errors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    correlation_id TEXT,
    category TEXT NOT NULL,
    error_code TEXT,
    error_message TEXT NOT NULL,
    stack_trace TEXT,
    metadata JSONB,
    resolved BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. VIEWS
CREATE OR REPLACE VIEW public.document_insurer_view
WITH (security_invoker = true)
AS
SELECT 
    d.id AS document_id,
    d.document_name,
    d.document_type,
    d.version,
    d.total_pages,
    d.storage_path,
    d.file_hash,
    d.is_active,
    d.uploaded_by,
    d.created_at,
    d.updated_at,
    d.product_name,
    i.name AS insurer_name
FROM public.documents d
LEFT JOIN public.insurers i ON d.insurer_id = i.id;

-- 4. INDEXES
CREATE INDEX IF NOT EXISTS idx_chunks_document_type ON public.chunks(document_id, section_type);
CREATE INDEX IF NOT EXISTS idx_chunks_coverage_tags ON public.chunks USING GIN(coverage_tags);
CREATE INDEX IF NOT EXISTS idx_clause_chunks_document ON public.clause_chunks(document_id);
CREATE INDEX IF NOT EXISTS idx_clause_chunks_version ON public.clause_chunks(clause_version_id);
CREATE INDEX IF NOT EXISTS idx_clause_chunks_coverage ON public.clause_chunks(coverage_type);
CREATE INDEX IF NOT EXISTS idx_structured_clauses_insurer ON public.structured_clauses(insurer_name);
CREATE INDEX IF NOT EXISTS idx_structured_clauses_document ON public.structured_clauses(document_id);
CREATE INDEX IF NOT EXISTS idx_page_images_document ON public.page_images(document_id);
CREATE INDEX IF NOT EXISTS idx_documents_insurer ON public.documents(insurer_id);
CREATE INDEX IF NOT EXISTS idx_documents_active ON public.documents(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_analysis_history_user_id ON public.analysis_history(user_id);
CREATE INDEX IF NOT EXISTS idx_analysis_history_correlation ON public.analysis_history(correlation_id);
CREATE INDEX IF NOT EXISTS idx_chat_threads_user ON public.chat_threads(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_thread ON public.chat_messages(thread_id);
CREATE INDEX IF NOT EXISTS idx_coverage_mappings_raw ON public.coverage_mappings(raw_name);
CREATE INDEX IF NOT EXISTS idx_coverage_mappings_canonical ON public.coverage_mappings(canonical_name);
CREATE INDEX IF NOT EXISTS idx_coverage_graph_from ON public.coverage_graph_edges(from_node);
CREATE INDEX IF NOT EXISTS idx_coverage_graph_to ON public.coverage_graph_edges(to_node);
CREATE INDEX IF NOT EXISTS idx_analysis_logs_status ON public.analysis_logs(status);
CREATE INDEX IF NOT EXISTS idx_unified_engine_errors_category ON public.unified_engine_errors(category);

-- 5. FUNCTIONS & TRIGGERS

-- 5.1 Trigger updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public, pg_temp;

CREATE TRIGGER update_documents_updated_at BEFORE UPDATE ON public.documents FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_structured_clauses_updated_at BEFORE UPDATE ON public.structured_clauses FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_client_profiles_updated_at BEFORE UPDATE ON public.client_profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_coverage_mappings_updated_at BEFORE UPDATE ON public.coverage_mappings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_template_registry_updated_at BEFORE UPDATE ON public.template_registry FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5.2 RAG Search RPC Functions
CREATE OR REPLACE FUNCTION public.match_chunks_unified(
    query_embedding vector(3072),
    match_count INT DEFAULT 5,
    filter_insurer_id UUID DEFAULT NULL,
    filter_coverage TEXT DEFAULT NULL,
    filter_document_id UUID DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    document_id UUID,
    page_number INT,
    content TEXT,
    similarity FLOAT,
    metadata JSONB,
    coverage_tags TEXT[]
)
LANGUAGE plpgsql SET search_path = public, pg_temp
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.id,
        c.document_id,
        c.page_number,
        c.content,
        (1 - (c.embedding <=> query_embedding))::FLOAT AS similarity,
        c.metadata,
        c.coverage_tags
    FROM public.chunks c
    JOIN public.documents d ON c.document_id = d.id
    WHERE d.is_active = true
      AND (filter_insurer_id IS NULL OR d.insurer_id = filter_insurer_id)
      AND (filter_document_id IS NULL OR c.document_id = filter_document_id)
      AND (filter_coverage IS NULL OR filter_coverage = ANY(c.coverage_tags))
    ORDER BY c.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

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
    page_number INT,
    relevance FLOAT
)
LANGUAGE plpgsql SET search_path = public, pg_temp
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
    FROM public.structured_clauses sc
    WHERE (p_insurer_name IS NULL OR sc.insurer_name = p_insurer_name)
      AND (p_domain IS NULL OR sc.domain = p_domain)
      AND (p_coverage_name IS NULL OR sc.extracted_data::TEXT ILIKE '%' || p_coverage_name || '%')
      AND (p_field_type IS NULL OR sc.extracted_data->p_field_type IS NOT NULL)
    ORDER BY relevance DESC, sc.created_at DESC
    LIMIT match_count;
END;
$$;

-- 6. ROW LEVEL SECURITY (RLS) & POLICIES
ALTER TABLE public.insurers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.page_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clause_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clause_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.structured_clauses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clause_coverages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analysis_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contextual_risk_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coverage_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coverage_graph_edges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coverage_embeddings_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deductible_benchmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.template_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analysis_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unified_engine_errors ENABLE ROW LEVEL SECURITY;

-- Read policies for reference tables
CREATE POLICY "Public read insurers" ON public.insurers FOR SELECT USING (true);
CREATE POLICY "Public read documents" ON public.documents FOR SELECT USING (true);
CREATE POLICY "Public read page_images" ON public.page_images FOR SELECT USING (true);
CREATE POLICY "Public read chunks" ON public.chunks FOR SELECT USING (true);
CREATE POLICY "Public read clause_versions" ON public.clause_versions FOR SELECT USING (true);
CREATE POLICY "Public read clause_chunks" ON public.clause_chunks FOR SELECT USING (true);
CREATE POLICY "Public read structured_clauses" ON public.structured_clauses FOR SELECT USING (true);
CREATE POLICY "Public read clause_coverages" ON public.clause_coverages FOR SELECT USING (true);
CREATE POLICY "Public read coverage_mappings" ON public.coverage_mappings FOR SELECT USING (true);
CREATE POLICY "Public read coverage_graph_edges" ON public.coverage_graph_edges FOR SELECT USING (true);
CREATE POLICY "Public read template_registry" ON public.template_registry FOR SELECT USING (true);

-- User-scoped policies (InitPlan subqueries)
CREATE POLICY "Users can view own analysis history" ON public.analysis_history FOR SELECT USING (user_id = ((SELECT auth.uid())::text) OR user_id = (SELECT current_setting('app.current_user_id', true)));
CREATE POLICY "Users can insert own analysis history" ON public.analysis_history FOR INSERT WITH CHECK (user_id = ((SELECT auth.uid())::text) OR user_id = (SELECT current_setting('app.current_user_id', true)));

CREATE POLICY "Users can select own client profiles" ON public.client_profiles FOR SELECT USING (user_id = ((SELECT auth.uid())::text) OR user_id = (SELECT current_setting('app.current_user_id', true)));
CREATE POLICY "Users can insert own client profiles" ON public.client_profiles FOR INSERT WITH CHECK (user_id = ((SELECT auth.uid())::text) OR user_id = (SELECT current_setting('app.current_user_id', true)));
CREATE POLICY "Users can update own client profiles" ON public.client_profiles FOR UPDATE USING (user_id = ((SELECT auth.uid())::text) OR user_id = (SELECT current_setting('app.current_user_id', true))) WITH CHECK (user_id = ((SELECT auth.uid())::text) OR user_id = (SELECT current_setting('app.current_user_id', true)));
CREATE POLICY "Users can delete own client profiles" ON public.client_profiles FOR DELETE USING (user_id = ((SELECT auth.uid())::text) OR user_id = (SELECT current_setting('app.current_user_id', true)));

CREATE POLICY "Users can select own chat threads" ON public.chat_threads FOR SELECT USING (user_id = ((SELECT auth.uid())::text) OR user_id = (SELECT current_setting('app.current_user_id', true)));
CREATE POLICY "Users can insert own chat threads" ON public.chat_threads FOR INSERT WITH CHECK (user_id = ((SELECT auth.uid())::text) OR user_id = (SELECT current_setting('app.current_user_id', true)));
CREATE POLICY "Users can update own chat threads" ON public.chat_threads FOR UPDATE USING (user_id = ((SELECT auth.uid())::text) OR user_id = (SELECT current_setting('app.current_user_id', true))) WITH CHECK (user_id = ((SELECT auth.uid())::text) OR user_id = (SELECT current_setting('app.current_user_id', true)));
CREATE POLICY "Users can delete own chat threads" ON public.chat_threads FOR DELETE USING (user_id = ((SELECT auth.uid())::text) OR user_id = (SELECT current_setting('app.current_user_id', true)));

CREATE POLICY "Users can select own chat messages" ON public.chat_messages FOR SELECT USING (EXISTS (SELECT 1 FROM public.chat_threads WHERE chat_threads.id = chat_messages.thread_id AND (chat_threads.user_id = ((SELECT auth.uid())::text) OR chat_threads.user_id = (SELECT current_setting('app.current_user_id', true)))));
CREATE POLICY "Users can insert own chat messages" ON public.chat_messages FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.chat_threads WHERE chat_threads.id = chat_messages.thread_id AND (chat_threads.user_id = ((SELECT auth.uid())::text) OR chat_threads.user_id = (SELECT current_setting('app.current_user_id', true)))));
CREATE POLICY "Users can update own chat messages" ON public.chat_messages FOR UPDATE USING (EXISTS (SELECT 1 FROM public.chat_threads WHERE chat_threads.id = chat_messages.thread_id AND (chat_threads.user_id = ((SELECT auth.uid())::text) OR chat_threads.user_id = (SELECT current_setting('app.current_user_id', true)))));
CREATE POLICY "Users can delete own chat messages" ON public.chat_messages FOR DELETE USING (EXISTS (SELECT 1 FROM public.chat_threads WHERE chat_threads.id = chat_messages.thread_id AND (chat_threads.user_id = ((SELECT auth.uid())::text) OR chat_threads.user_id = (SELECT current_setting('app.current_user_id', true)))));
