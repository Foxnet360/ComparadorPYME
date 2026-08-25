# Proposal: Integration of Gemini File Search RAG & Dual-Track Model Pipeline

## Intent
Implement a dual-track model pipeline in Gemini API to optimize insurance quote comparisons and policy clause verification for reliability, speed, and cost efficiency. Short quote PDFs (2-15 pages) use full multimodal zero-chunking with `gemini-3.7-flash` (high reasoning), while long policy clauses (100+ pages) use Gemini native `File Search` (`fileSearchStore`) with `gemini-embedding-2`.

## Scope
- Centralize Gemini model configuration in `server/src/config/env.ts` with strong typing for `GEMINI_MODEL`, `GEMINI_THINKING_LEVEL`, `GEMINI_CLAUSE_MODEL`, `GEMINI_CHAT_MODEL`, `GEMINI_EMBEDDING_MODEL`, and `ENABLE_FILE_SEARCH_CLAUSES`.
- Create `server/src/services/clauseSearchStore.ts` to manage native Gemini `fileSearchStore` containers, uploading and importing 100+ page policy clause PDFs with `gemini-embedding-2`.
- Update `server/src/services/unifiedComparison/unifiedComparisonEngine.ts` and `server/src/services/gemini.ts` to attach `tools: [{ type: 'file_search', file_search_store_names: [...] }]` and enforce `thinkingConfig: { thinkingLevel: 'high' }`.
- Update `.env.example` with standard Gemini API production defaults.

## Impact
- High-fidelity extraction of deductibles and sublimits without truncation or decimal formatting errors.
- Instant, zero-query-cost semantic search on 100+ page clause manuals with native page citations (`page_number`).
- Fast interactive chat response times using `gemini-3.1-flash-lite`.
