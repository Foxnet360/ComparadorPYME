## Context

The current system is in a broken state after a series of failed attempts to fix JSON truncation in Gemini outputs. The original system worked by having Gemini generate free text with structural markers (===), which was then parsed locally. A well-intentioned change to enforce structured JSON output (`responseSchema` + `responseMimeType: "application/json"`) broke the system because Gemini's output token limit (8192 for gemini-2.5-flash) is insufficient for generating complex JSON with 14+ coverages across 3-5 quotes. Each subsequent fix added architectural complexity (multi-phase processing, individual quote processing, schema simplification) without addressing the root cause.

The business logic requires:
1. Extracting structured data from unstructured insurance quotes (different formats, different insurers)
2. Normalizing coverage names using a thesaurus (e.g., "Inmuebles y mejoras locativas" → "Incendio (Edificio y Contenidos)")
3. Cross-referencing quote data against clause documents via RAG
4. Generating consistent, deterministic scoring
5. Producing a narrative recommendation

## Goals / Non-Goals

**Goals:**
- Restore functional quote analysis for 3-5 simultaneous quotes
- Separate quote analysis from clause processing architecturally
- Implement async clause indexing with RAG retrieval
- Use deterministic local parsing instead of forced JSON schema
- Reserve Gemini for tasks where LLM adds value (narrative generation)
- Achieve sub-10-second analysis time for 3 quotes

**Non-Goals:**
- Real-time clause indexing (clauses are uploaded async before analysis)
- Multi-language support (Spanish only for now)
- Support for more than 5 quotes per analysis
- Complex discrepancy detection beyond deducible/coverage mismatches
- Machine learning-based scoring (rules only)

## Decisions

### 1. Text-Based Extraction with Local Parsing

**Decision:** Use Gemini with free-text prompts (no responseSchema) and parse the output locally with regex.

**Rationale:**
- Gemini cannot reliably generate valid JSON for complex structures within 8192 output tokens
- Text generation is what LLMs do best; structured extraction is better done deterministically
- Local parsing is fast, testable, and doesn't consume API tokens

**Alternative Considered:** Multi-phase JSON generation (3 separate API calls). Rejected because it triples API cost and latency without solving the token limit problem.

### 2. One Quote Per API Call

**Decision:** Send each quote's text to Gemini individually, not batched.

**Rationale:**
- Even with text output, 3 quotes × 16 pages each = ~60K tokens input
- Gemini processes single documents more reliably than multiple concatenated documents
- Allows parallel processing (if rate limits permit)
- Easier to debug when one quote fails

**Alternative Considered:** Batch all quotes in one call. Rejected due to input token limits and context window pollution.

### 3. Async Clause Indexing

**Decision:** Clausulados are uploaded and indexed asynchronously via a separate endpoint, not during quote analysis.

**Rationale:**
- Clause indexing involves: PDF extraction → chunking → embedding generation → vector storage
- This takes 30-60 seconds per document and shouldn't block quote analysis
- Once indexed, clauses are reused across multiple quote analyses
- Aligns with the business process: clauses are reference documents, not analysis inputs

**Implementation:**
- Endpoint: `POST /api/clauses/index` → returns `jobId`
- Status endpoint: `GET /api/clauses/status/:jobId`
- Background processing via queue or direct async handling

### 4. Hybrid RAG Search (Vector + Full-Text)

**Decision:** Use pgvector for similarity search combined with PostgreSQL full-text search for clause retrieval.

**Rationale:**
- Vector search finds semantically similar clauses (e.g., "incendio" matches "fuego" and "quemadura")
- Full-text search finds exact keyword matches (e.g., "deducible incendio 10%")
- Hybrid approach provides both recall and precision
- Supabase/pgvector supports both natively

**Schema:**
```sql
create table clause_chunks (
    id uuid primary key default gen_random_uuid(),
    document_id uuid references documents(id),
    insurer_name text not null,
    document_type text not null,
    section_type text, -- 'COBERTURA', 'EXCLUSION', 'DEDUCIBLE'
    coverage_tags text[], -- normalized coverage names from thesaurus
    content text not null,
    content_normalized text, -- lowercase, no accents
    embedding vector(768),
    page_number int,
    chunk_level int, -- 1=document, 2=chapter, 3=coverage
    created_at timestamp default now()
);

create index on clause_chunks using hnsw (embedding vector_cosine_ops);
create index on clause_chunks using gin (coverage_tags);
create index on clause_chunks (insurer_name, document_type);
```

### 5. Rule-Based Scoring

**Decision:** Implement scoring as a deterministic rule engine, not via LLM.

**Rationale:**
- Scoring must be consistent and reproducible
- Business rules are well-defined (deductible thresholds, coverage completeness)
- LLM scoring is non-deterministic even with temperature=0
- Rules are auditable and adjustable by business users

**Scoring Dimensions:**
- Coverage completeness (0-10): Based on presence of standard PYME coverages
- Deductible favorability (0-10): Lower deductibles score higher
- Price ratio (0-10): Compared against market average
- Exclusion risk (0-10): Based on RAG-retrieved exclusion clauses
- Sub-limit impact (0-10): Based on presence and severity of sub-limits
- Warranty ease (0-10): Based on clause requirements

**Formula:** `score = (coverage*0.25 + deductibles*0.20 + exclusions*0.20 + priceRatio*0.15 + sublimits*0.10 + warranties*0.10) * 10`

### 6. Tesauro-Driven Normalization

**Decision:** Use the existing `thesaurusService` to normalize coverage names before storage and comparison.

**Rationale:**
- Different insurers use different names for the same coverage
- Normalization enables accurate comparison and RAG retrieval
- The thesaurus already exists and is populated

**Process:**
1. Extract raw coverage name from quote (e.g., "Inmuebles y mejoras locativas")
2. Match against thesaurus synonyms (e.g., "inmuebles", "mejoras", "locativas")
3. Return canonical name (e.g., "Incendio (Edificio y Contenidos)")
4. Store canonical name in `coverage_tags` for RAG filtering

## Risks / Trade-offs

- **[Risk] Regex parsing fails on novel quote formats** → **Mitigation:** Fallback to manual extraction prompt if parser confidence is low; log failures for pattern updates
- **[Risk] Tesauro doesn't cover all coverage name variations** → **Mitigation:** Add synonym suggestion endpoint; quarterly review of unmatched terms
- **[Risk] RAG retrieves irrelevant clauses** → **Mitigation:** Hybrid search with metadata filtering (insurer_name + coverage_tags); human-in-the-loop review for first month
- **[Risk] Rule-based scoring feels rigid to users** → **Mitigation:** Expose scoring weights as configurable parameters; A/B test with user feedback
- **[Risk] Async clause indexing delays first use** → **Mitigation:** Pre-index clauses for top 5 insurers; provide real-time status updates during upload

## Migration Plan

### Phase 1: Revert and Restore (Week 1)
1. Revert `gemini.ts` to text-based extraction (remove responseSchema/responseMimeType)
2. Remove broken services: `multiPhaseAnalyzer`, `quoteExtractor`, `quoteScorer`, `quoteNarrative`, `contextOptimizer`
3. Create `quoteParser.ts` with regex-based extraction
4. Test with 3-5 quotes to verify restoration

### Phase 2: RAG Foundation (Week 2)
1. Create `clause_chunks` table with pgvector
2. Implement `clauseIndexer.ts` for async processing
3. Create hybrid search RPC function
4. Build clause upload endpoints with status tracking

### Phase 3: Cross-Reference Engine (Week 3)
1. Implement `crossReferenceEngine.ts` for coverage-clause matching
2. Create rule-based scoring with configurable weights
3. Integrate RAG retrieval into analysis flow
4. Add discrepancy detection (quote vs clause mismatches)

### Phase 4: Optimization (Week 4)
1. Parallel processing for multiple quotes
2. Caching for clause retrieval
3. Performance tuning (chunk size, embedding batch size)
4. Comprehensive testing with real-world quote sets

## Open Questions

1. Should we implement a queue system (BullMQ) for clause indexing, or is direct async sufficient?
2. How do we handle clause versioning when insurers update their terms?
3. Should scoring weights be hardcoded or configurable per client?
4. What's the fallback when no matching clause is found in RAG?