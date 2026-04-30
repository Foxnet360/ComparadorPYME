-- Migration: Create clause_chunks table with pgvector support for RAG
-- Run this in Supabase SQL Editor

-- Enable pgvector extension if not already enabled
create extension if not exists vector;

-- Create clause_chunks table for RAG retrieval
create table if not exists clause_chunks (
    id uuid primary key default gen_random_uuid(),
    document_id uuid references documents(id) on delete cascade,
    insurer_name text not null,
    document_type text not null default 'CLAUSULADO_GENERAL',
    section_type text, -- 'COBERTURA', 'EXCLUSION', 'DEDUCIBLE', 'CONDICION', 'GENERAL'
    coverage_tags text[] default '{}', -- Array of normalized coverage names from thesaurus
    content text not null,
    content_normalized text, -- lowercase, no accents for full-text search
    embedding vector(768), -- Gemini embedding-001 dimensions
    page_number int,
    chunk_level int default 2, -- 1=document, 2=chapter/section, 3=coverage
    created_at timestamp with time zone default now(),
    updated_at timestamp with time zone default now()
);

-- Add comments for documentation
comment on table clause_chunks is 'Stores chunked clause documents with embeddings for RAG retrieval';
comment on column clause_chunks.coverage_tags is 'Array of canonical coverage names from thesaurus (e.g., {Incendio (Edificio y Contenidos), Lucro Cesante})';
comment on column clause_chunks.section_type is 'Classification: COBERTURA, EXCLUSION, DEDUCIBLE, CONDICION, GENERAL';
comment on column clause_chunks.chunk_level is '1=document level, 2=chapter/section level, 3=individual coverage level';

-- Create HNSW index for vector similarity search (fast approximate nearest neighbors)
create index if not exists idx_clause_chunks_embedding 
on clause_chunks 
using hnsw (embedding vector_cosine_ops)
with (m = 16, ef_construction = 64);

-- Create GIN index for coverage_tags array (fast array containment queries)
create index if not exists idx_clause_chunks_coverage_tags 
on clause_chunks 
using gin (coverage_tags);

-- Create index for insurer filtering
create index if not exists idx_clause_chunks_insurer 
on clause_chunks (insurer_name, document_type);

-- Create index for section type filtering
create index if not exists idx_clause_chunks_section 
on clause_chunks (section_type);

-- Create full-text search index on normalized content
create index if not exists idx_clause_chunks_fts 
on clause_chunks 
using gin (to_tsvector('spanish', coalesce(content_normalized, '')));

-- Function: Hybrid search combining vector similarity and full-text search
-- Returns ranked results with combined score
create or replace function match_clauses(
    query_embedding vector(768),
    query_text text,
    insurer_filter text default null,
    coverage_filter text[] default null,
    section_filter text default null,
    match_count int default 5
)
returns table (
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
language plpgsql
as $$
begin
    return query
    with vector_search as (
        select 
            cc.id,
            cc.document_id,
            cc.insurer_name,
            cc.section_type,
            cc.coverage_tags,
            cc.content,
            cc.page_number,
            1 - (cc.embedding <=> query_embedding) as vector_score
        from clause_chunks cc
        where cc.embedding is not null
        and (insurer_filter is null or cc.insurer_name = insurer_filter)
        and (coverage_filter is null or cc.coverage_tags && coverage_filter)
        and (section_filter is null or cc.section_type = section_filter)
        order by cc.embedding <=> query_embedding
        limit match_count * 2
    ),
    text_search as (
        select 
            cc.id,
            cc.document_id,
            cc.insurer_name,
            cc.section_type,
            cc.coverage_tags,
            cc.content,
            cc.page_number,
            ts_rank(
                to_tsvector('spanish', coalesce(cc.content_normalized, '')),
                plainto_tsquery('spanish', query_text)
            ) as text_score
        from clause_chunks cc
        where (insurer_filter is null or cc.insurer_name = insurer_filter)
        and (coverage_filter is null or cc.coverage_tags && coverage_filter)
        and (section_filter is null or cc.section_type = section_filter)
        and to_tsvector('spanish', coalesce(cc.content_normalized, '')) @@ plainto_tsquery('spanish', query_text)
        order by text_score desc
        limit match_count * 2
    ),
    combined as (
        -- Vector search results
        select 
            vs.id,
            vs.document_id,
            vs.insurer_name,
            vs.section_type,
            vs.coverage_tags,
            vs.content,
            vs.page_number,
            vs.vector_score as score,
            'vector' as source
        from vector_search vs
        
        union all
        
        -- Text search results
        select 
            ts.id,
            ts.document_id,
            ts.insurer_name,
            ts.section_type,
            ts.coverage_tags,
            ts.content,
            ts.page_number,
            ts.text_score as score,
            'text' as source
        from text_search ts
    )
    select 
        c.id,
        c.document_id,
        c.insurer_name,
        c.section_type,
        c.coverage_tags,
        c.content,
        c.page_number,
        max(c.score) as similarity,
        row_number() over (order by max(c.score) desc) as rank
    from combined c
    group by c.id, c.document_id, c.insurer_name, c.section_type, c.coverage_tags, c.content, c.page_number
    order by max(c.score) desc
    limit match_count;
end;
$$;

-- Function: Simple vector-only search (fallback for when full-text is not needed)
create or replace function match_clauses_vector(
    query_embedding vector(768),
    insurer_filter text default null,
    coverage_filter text[] default null,
    match_count int default 5
)
returns table (
    id uuid,
    document_id uuid,
    insurer_name text,
    section_type text,
    coverage_tags text[],
    content text,
    page_number int,
    similarity float
)
language plpgsql
as $$
begin
    return query
    select 
        cc.id,
        cc.document_id,
        cc.insurer_name,
        cc.section_type,
        cc.coverage_tags,
        cc.content,
        cc.page_number,
        1 - (cc.embedding <=> query_embedding) as similarity
    from clause_chunks cc
    where cc.embedding is not null
    and (insurer_filter is null or cc.insurer_name = insurer_filter)
    and (coverage_filter is null or cc.coverage_tags && coverage_filter)
    order by cc.embedding <=> query_embedding
    limit match_count;
end;
$$;

-- Function: Get clauses by coverage (for cross-referencing quotes)
create or replace function get_clauses_by_coverage(
    coverage_name text,
    insurer_filter text default null,
    section_filter text default null,
    match_count int default 3
)
returns table (
    id uuid,
    document_id uuid,
    insurer_name text,
    section_type text,
    coverage_tags text[],
    content text,
    page_number int
)
language plpgsql
as $$
begin
    return query
    select 
        cc.id,
        cc.document_id,
        cc.insurer_name,
        cc.section_type,
        cc.coverage_tags,
        cc.content,
        cc.page_number
    from clause_chunks cc
    where cc.coverage_tags @> array[coverage_name]
    and (insurer_filter is null or cc.insurer_name = insurer_filter)
    and (section_filter is null or cc.section_type = section_filter)
    order by cc.created_at desc
    limit match_count;
end;
$$;

-- Trigger to automatically update content_normalized on insert/update
create or replace function normalize_clause_content()
returns trigger as $$
begin
    new.content_normalized := lower(
        regexp_replace(
            new.content,
            '[áàäâã]', 'a', 'g'
        )
    );
    new.content_normalized := regexp_replace(new.content_normalized, '[éèëê]', 'e', 'g');
    new.content_normalized := regexp_replace(new.content_normalized, '[íìïî]', 'i', 'g');
    new.content_normalized := regexp_replace(new.content_normalized, '[óòöôõ]', 'o', 'g');
    new.content_normalized := regexp_replace(new.content_normalized, '[úùüû]', 'u', 'g');
    new.content_normalized := regexp_replace(new.content_normalized, '[ñ]', 'n', 'g');
    return new;
end;
$$ language plpgsql;

create trigger trigger_normalize_clause_content
    before insert or update on clause_chunks
    for each row
    execute function normalize_clause_content();

-- Add updated_at trigger
create or replace function update_updated_at_column()
returns trigger as $$
begin
    new.updated_at = now();
    return new;
end;
$$ language plpgsql;

create trigger trigger_clause_chunks_updated_at
    before update on clause_chunks
    for each row
    execute function update_updated_at_column();

-- Grant permissions (adjust as needed for your setup)
-- grant all on clause_chunks to authenticated;
-- grant all on clause_chunks to anon;

-- Grant execute permissions on functions
-- grant execute on function match_clauses to authenticated;
-- grant execute on function match_clauses_vector to authenticated;
-- grant execute on function get_clauses_by_coverage to authenticated;

comment on function match_clauses is 'Hybrid search combining vector similarity and full-text search for clause retrieval';
comment on function match_clauses_vector is 'Vector-only similarity search for clause retrieval';
comment on function get_clauses_by_coverage is 'Retrieve clause chunks by coverage name for quote cross-referencing';