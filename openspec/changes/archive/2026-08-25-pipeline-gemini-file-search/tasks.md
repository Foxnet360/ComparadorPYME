# Tasks: Dual-Track Gemini Model Pipeline & File Search

## Phase 1: Environment & Config
- [x] 1.1 Update `server/src/config/env.ts` to type and validate `GEMINI_MODEL`, `GEMINI_THINKING_LEVEL`, `GEMINI_CLAUSE_MODEL`, `GEMINI_CHAT_MODEL`, `GEMINI_EMBEDDING_MODEL`, and `ENABLE_FILE_SEARCH_CLAUSES`.
- [x] 1.2 Update `server/.env.example` with standard Gemini API production defaults.

## Phase 2: Clause Search Store Service
- [x] 2.1 Create `server/src/services/clauseSearchStore.ts` for managing `fileSearchStore` creation, upload, and tool configuration via `@google/genai`.
- [x] 2.2 Add unit tests for `clauseSearchStore.ts` in `server/src/services/__tests__/clauseSearchStore.test.ts`.

## Phase 3: Engine Integration & Thinking Config
- [x] 3.1 Update `server/src/services/gemini.ts` and `server/src/services/unifiedComparison/unifiedComparisonEngine.ts` to use `gemini-3.7-flash` and `thinkingConfig: { thinkingLevel: 'high' }`.
- [x] 3.2 Wire `clauseSearchStore` into `unifiedComparisonEngine.ts` for long policy clause validation.

## Phase 4: Verification & Deployment
- [x] 4.1 Run unit test suite and verify clean compilation.
- [x] 4.2 Commit, push to GitHub, and deploy to Railway.
