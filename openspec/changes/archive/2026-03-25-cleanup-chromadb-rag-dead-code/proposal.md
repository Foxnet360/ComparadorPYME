## Why

The project was working locally with Gemini for embeddings and Supabase for vector storage, but deployment to Railway failed because dead ChromaDB code was being imported and executed. Additionally, autocommit pushed broken versions to the repository. The project has two competing vector storage systems (ChromaDB and Supabase) causing confusion and deployment failures. We need to consolidate on the working Supabase implementation and remove all ChromaDB-related dead code.

## What Changes

- **Remove ChromaDB dependency** from package.json
- **Delete or rewrite vectorStore.ts** to use Supabase instead of ChromaDB
- **Update ragClauseController.ts** to use Supabase/pgvector instead of ChromaDB collections
- **Update ragRetrieval.ts** to query Supabase with vector similarity search
- **Clean up docker-compose.yml** - remove ChromaDB service and environment variables
- **Remove ChromaDB integration tests** that are no longer relevant
- **Archive OpenSpec artifacts** related to the old ChromaDB implementation
- Verify all RAG endpoints (/api/rag/*) work correctly with Supabase

## Capabilities

### New Capabilities

### Modified Capabilities

## Impact

**Files to modify:**
- `server/package.json` - remove "chromadb" dependency
- `server/src/services/vectorStore.ts` - rewrite to use Supabase
- `server/src/controllers/ragClauseController.ts` - update to use Supabase
- `server/src/services/ragRetrieval.ts` - update queries to use Supabase
- `docker-compose.yml` - remove ChromaDB service
- `server/src/services/__tests__/vectorStore.integration.test.ts` - remove or update

**API Routes affected:**
- `POST /api/rag/clauses` - index clauses (will use Supabase)
- `GET /api/rag/clauses` - list clauses (will use Supabase)
- `DELETE /api/rag/clauses` - delete clauses (will use Supabase)
- `POST /api/rag/search` - search clauses (will use Supabase pgvector)

**Breaking Changes:**
- Requires existing ChromaDB data to be re-indexed into Supabase
- Environment variables CHROMA_HOST and CHROMA_PORT will be removed
