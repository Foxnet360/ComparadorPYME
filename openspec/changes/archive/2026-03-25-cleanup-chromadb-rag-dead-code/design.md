## Context

The CSA Comparator project currently has a hybrid architecture with two competing vector storage systems:

1. **Supabase/pgvector** (working): Used by `documentIndexingService.ts`, `searchController.ts`, and the main `/api/documents/*` endpoints. This system successfully stores document chunks with embeddings in Supabase and performs vector similarity searches.

2. **ChromaDB** (dead code): Used by `vectorStore.ts`, `ragClauseController.ts`, and `ragRetrieval.ts` via the `/api/rag/*` endpoints. This code attempts to connect to a ChromaDB server that doesn't exist in production, causing deployment failures on Railway.

The ChromaDB code was part of an earlier architecture but was never fully removed when migrating to Supabase. During local development, this code might not have been triggered (if the RAG endpoints weren't used), or Docker Compose might have masked the issue by providing a local ChromaDB instance.

When attempting to deploy to Railway, the ChromaDB code became active and caused crashes because:
- The `chromadb` package is still in package.json
- Environment variables (CHROMA_HOST, CHROMA_PORT) are referenced
- The code attempts to connect to localhost:8000 which doesn't exist

## Goals / Non-Goals

**Goals:**
- Remove all ChromaDB dependencies and dead code
- Ensure RAG functionality (clause indexing, search, retrieval) works with Supabase/pgvector
- Fix deployment issues on Railway
- Clean up docker-compose.yml to remove unused ChromaDB service
- Maintain backward compatibility for existing Supabase-based document storage

**Non-Goals:**
- Adding new RAG features beyond what's currently implemented
- Migrating data from ChromaDB (assumes data will be re-indexed)
- Changing the core analysis functionality that already works with Supabase
- Supporting both ChromaDB and Supabase simultaneously

## Decisions

### Decision 1: Rewrite vectorStore.ts to use Supabase

**Rationale:** The existing `vectorStore.ts` has the right interface but wrong implementation. Instead of deleting it, we'll rewrite it to use Supabase queries with pgvector.

**Implementation:**
- Replace ChromaDB client with Supabase client
- Use `supabase.rpc('match_chunks', ...)` for vector similarity search
- Maintain the same interface: `addChunks()`, `search()`, `deleteDocument()`, `listDocuments()`

### Decision 2: Keep RAG endpoints but change implementation

**Rationale:** The `/api/rag/*` endpoints provide useful functionality for clause indexing and semantic search. We should preserve the API contract but change the underlying storage.

**Implementation:**
- `ragClauseController.ts` stays but uses new Supabase-based `vectorStore`
- `ragRetrieval.ts` updates its queries to use Supabase
- API responses remain the same

### Decision 3: Use existing Supabase schema

**Rationale:** The project already has a working `chunks` table in Supabase with embeddings. We'll reuse this schema.

**Schema:**
- `chunks` table: id, document_id, page_number, content, content_normalized, embedding, metadata, coverage_tags, section_type
- Vector similarity via `match_chunks` RPC function

### Decision 4: Remove ChromaDB from docker-compose.yml

**Rationale:** ChromaDB service is no longer needed and just consumes resources.

**Changes:**
- Remove `chromadb` service
- Remove `CHROMA_HOST` and `CHROMA_PORT` environment variables from server service
- Remove `chromadb` volume

## Risks / Trade-offs

**[Risk] Breaking existing RAG workflows** → Users who had indexed clauses in ChromaDB will need to re-index them in Supabase.

**[Risk] Vector similarity performance** → ChromaDB is optimized for vector search; Supabase/pgvector may have different performance characteristics. Mitigation: Use appropriate indexes and monitor query performance.

**[Risk] Data loss if ChromaDB had important data** → Since ChromaDB wasn't working in production, this is low risk. Local development data can be re-indexed.

**[Trade-off] Code complexity** → We're keeping the RAG abstraction layer (`vectorStore.ts`) rather than removing it entirely. This adds a small maintenance overhead but preserves the clean separation between controllers and storage.

**[Risk] Railway deployment still fails** → Mitigation: Test deployment in stages. First verify the code compiles without ChromaDB, then verify Supabase connection works, then test full deployment.

## Migration Plan

1. **Phase 1: Code cleanup**
   - Remove `chromadb` from package.json
   - Rewrite `vectorStore.ts` to use Supabase
   - Update `ragRetrieval.ts` to use new vectorStore
   - Update `ragClauseController.ts` imports
   - Remove ChromaDB integration tests

2. **Phase 2: Configuration cleanup**
   - Update docker-compose.yml
   - Remove CHROMA_HOST and CHROMA_PORT from .env files
   - Update documentation

3. **Phase 3: Verification**
   - Run existing tests (minus ChromaDB tests)
   - Manually test RAG endpoints
   - Verify Supabase operations work correctly

4. **Phase 4: Deployment**
   - Deploy to Railway
   - Monitor logs for errors
   - Re-index any necessary documents

## Open Questions

1. Should we keep the `ragClauseController` endpoints or consolidate them with the existing `documentController` endpoints?
2. Do we need to migrate any test data, or can we start fresh?
3. Are there any other files referencing ChromaDB that we haven't identified yet?
