## Why

The document analysis pipeline is currently non-functional due to a cascade of architectural errors introduced while attempting to fix JSON truncation. The system now fails to process even 2 insurance quotes simultaneously, despite originally handling 3-5 quotes with clauses. The root cause is the forced use of `responseSchema` and `responseMimeType: "application/json"` with Gemini, which causes output token exhaustion when generating structured JSON for multiple quotes with 14+ coverages each. Each subsequent "fix" added complexity (multi-phase processing, individual quote processing, simplified schemas) without addressing the fundamental issue.

## What Changes

- **Revert Gemini integration to text-based extraction** (no forced JSON schema or mime type)
- **Implement deterministic local parser** for quote data extraction using regex and thesaurus normalization
- **Build async clause indexing system** with embeddings and pgvector storage in Supabase
- **Create RAG retrieval pipeline** for cross-referencing quote coverages against clause documents
- **Implement rule-based scoring engine** (deterministic, no LLM dependency)
- **Reserve Gemini usage solely for narrative generation** (final recommendation text)
- **Remove broken abstractions**: `multiPhaseAnalyzer`, `quoteExtractor`, `quoteScorer`, `quoteNarrative`, `contextOptimizer`

## Capabilities

### New Capabilities
- `text-based-quote-extraction`: Extract quote data using free-text Gemini prompts with local deterministic parsing
- `clause-rag-indexing`: Async upload and indexing of clause documents with embeddings and hybrid search
- `coverage-cross-reference`: RAG-based retrieval of clause sections for each coverage in a quote
- `rule-based-scoring`: Deterministic scoring engine using business rules, not LLM
- `deterministic-quote-parser`: Local parser that converts Gemini text output into structured data using regex and thesaurus

### Modified Capabilities
- `quote-analysis-v2`: Reverts to text-based analysis instead of forced JSON schema; separates quote analysis from clause processing
- `rag-retrieval`: Extends to support clause lookup by coverage name for cross-referencing

## Impact

- **Backend**: Major refactoring of `gemini.ts`, removal of 4 broken service files, creation of 3 new services (`quoteParser.ts`, `clauseIndexer.ts`, `crossReferenceEngine.ts`)
- **Database**: New table `clause_chunks` with pgvector embeddings; RPC function for hybrid search
- **API**: `/api/analyze` endpoint contract preserved but internal implementation completely rewritten
- **Performance**: Faster analysis (single Gemini call per quote + local processing vs 3-5 API calls); clauses indexed once and reused
- **Reliability**: Deterministic parsing eliminates JSON truncation failures; rule-based scoring is consistent
- **Breaking**: Output format may change slightly during transition period; clause upload endpoint becomes async with status tracking