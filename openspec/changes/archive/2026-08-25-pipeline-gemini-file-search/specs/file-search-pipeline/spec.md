# Spec: File Search Pipeline & Model Configuration

## Requirements

### Requirement 1: Type-Safe Environment Variables
`server/src/config/env.ts` MUST validate and export:
- `GEMINI_MODEL`: Defaults to `gemini-3.7-flash`.
- `GEMINI_THINKING_LEVEL`: Defaults to `high`.
- `GEMINI_CLAUSE_MODEL`: Defaults to `gemini-3.7-flash`.
- `GEMINI_CHAT_MODEL`: Defaults to `gemini-3.1-flash-lite`.
- `GEMINI_EMBEDDING_MODEL`: Defaults to `models/gemini-embedding-2`.
- `ENABLE_FILE_SEARCH_CLAUSES`: Defaults to `true`.

### Requirement 2: Clause Search Store Service
`server/src/services/clauseSearchStore.ts` MUST:
- Expose methods to create, list, and retrieve `fileSearchStore` resources in Gemini API.
- Support uploading/importing PDF documents into stores with `gemini-embedding-2`.
- Return proper tool attachment payloads for `interactions` and `generateContent` API calls.

### Requirement 3: Integration with Unified Comparison Engine
`server/src/services/unifiedComparison/unifiedComparisonEngine.ts` MUST:
- Use `gemini-3.7-flash` with `thinkingConfig: { thinkingLevel: 'high' }` for zero-chunking quote extraction.
- Attach `file_search` tool when verifying long policy clause manuals.
- Extract and map `page_number` from `file_citation` annotations into groundings.
