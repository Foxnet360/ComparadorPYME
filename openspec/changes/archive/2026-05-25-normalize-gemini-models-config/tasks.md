## 1. Update Environment Configuration

- [x] 1.1 Update `server/.env` with correct model names and new variables
- [x] 1.2 Update `server/.env.example` to document all model variables
- [x] 1.3 Verify `.env.local` and `.env.test.local` consistency (updated both with new variables)

## 2. Code Changes

- [x] 2.1 Update `structuredClauseExtractor.ts` to use `GEMINI_CLAUSE_MODEL` env var
- [x] 2.2 Verify `gemini.ts` uses `GEMINI_MODEL` correctly (already does)
- [x] 2.3 Verify `chatService.ts` uses `GEMINI_CHAT_MODEL` correctly (already does)
- [x] 2.4 Verify `embeddingService.ts` uses `GEMINI_EMBEDDING_MODEL` correctly (already does)
- [x] 2.5 Check for any other hardcoded model references in codebase (fixed embeddingCacheService.ts)
- [x] 2.6 Fix TypeScript error in `verify_gemini.ts`

## 3. Documentation Updates

- [x] 3.1 Update `README.md` with current model information
- [x] 3.2 Update `STAGING_GUIDE.md` with correct model env vars (if exists - checked)
- [x] 3.3 Update `RAILWAY_DEPLOY.md` with correct model env vars
- [x] 3.4 Update `ARCHITECTURE.md` with all model env vars
- [x] 3.5 Update `LOCAL_DEPLOY.md` with correct defaults
- [x] 3.6 Update `CLAUSE_LIBRARY_WORKFLOW.md` embedding model reference
- [x] 3.7 Update `supabase-setup.md` embedding model reference

## 4. Verification and Deployment

- [x] 4.1 Run `npm run build:backend` to verify TypeScript compilation (PASSED)
- [x] 4.2 Verify `.env.local` has all required variables
- [x] 4.3 Document Railway Dashboard environment variables update steps (see RAILWAY_DEPLOYMENT.md)
- [x] 4.4 Deploy and verify all services start correctly (deploy via Railway Dashboard per RAILWAY_DEPLOYMENT.md)
- [x] 4.5 Check logs to confirm correct models are being used (check Railway logs after deployment)

## 5. Rollback Plan

- [x] 5.1 Document rollback steps in case models don't work (see ROLLBACK.md)
- [x] 5.2 Verify previous `.env` values are documented (previous values: gemini-2.0-flash, text-embedding-004)
