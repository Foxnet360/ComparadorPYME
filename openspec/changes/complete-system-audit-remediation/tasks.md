# Tasks: Complete System Audit Remediation

## 1. Security - Credential Cleanup & Auth

- [ ] 1.1 Rotate all exposed API keys (Gemini, Supabase service_role, Supabase anon)
- [x] 1.2 Delete scripts with hardcoded credentials: `verifySetup.js`, `runMigrations.js`, `listGeminiModels.js`
- [ ] 1.3 Purge `.env` files from git history using BFG Repo-Cleaner
- [x] 1.4 Add `server/.env` and all `.env*` patterns to `.gitignore`
- [x] 1.5 Install `jsonwebtoken` and `@supabase/supabase-js` (server-side JWT verification)
- [x] 1.6 Create `server/src/middleware/auth.ts` with JWT verification middleware
- [x] 1.7 Create `server/src/errors/` directory with custom error classes (AppError, ValidationError, AuthenticationError, AuthorizationError, RateLimitError, NotFoundError)
- [x] 1.8 Apply auth middleware to all protected routes in `server/src/index.ts`
- [x] 1.9 Update frontend to send JWT in Authorization header for all API calls
- [x] 1.10 Remove all `req.body.userId` usage, replace with `req.user.id` from JWT
- [x] 1.11 Add authorization checks to ensure users can only access their own resources

## 2. Security - Rate Limiting & Headers

- [x] 2.1 Install `express-rate-limit` and `rate-limit-redis`
- [x] 2.2 Configure Redis connection for distributed rate limiting
- [x] 2.3 Add global rate limiter: 100 requests per 15 minutes
- [x] 2.4 Add strict rate limiter for `/api/analyze`: 10 requests per minute
- [x] 2.5 Add rate limiter for `/api/chat`: 20 requests per minute
- [x] 2.6 Add rate limit headers (`X-RateLimit-Limit`, `X-RateLimit-Remaining`)
- [x] 2.7 Install `helmet` and configure security headers (CSP, HSTS, X-Frame-Options, X-Content-Type-Options)
- [x] 2.8 Fix CORS to exclude localhost origins in production (env-based config)
- [x] 2.9 Add `/health` endpoint with database connectivity check

## 3. Critical Bug Fixes - Financial Calculations

- [x] 3.1 Fix `parseCoverageValue` in `coverageValueValidator.ts` to preserve decimal points in abbreviations ("1.5M" → 1,500,000 not 15,000,000)
- [x] 3.2 Fix `parseMonetaryValue` in `winnerDetection.ts` with same decimal preservation logic
- [x] 3.3 Install `decimal.js` for precise financial calculations
- [x] 3.4 Refactor `quoteScorer.ts` price calculations to use Decimal
- [x] 3.5 Make SMMLV and UVT configurable via environment variables with validation
- [x] 3.6 Update `deductibleParser.ts` to use env-based SMMLV/UVT values
- [x] 3.7 Add currency normalization before value range validation
- [x] 3.8 Fix race condition in `analysisController.ts` batch processing (parallelized validation and dual extraction)
- [x] 3.9 Implement AbortController support in `callWithTimeout` to cancel Gemini requests
- [x] 3.10 Add idempotency keys for `analysis_history` inserts

## 4. Architecture - Error Handling & Validation

- [x] 4.1 Create centralized error handling middleware in `server/src/middleware/errorHandler.ts`
- [x] 4.2 Remove all duplicated try/catch blocks from routes (100+ instances)
- [x] 4.3 Standardize all API responses to `{success, data, error, meta}` format
- [x] 4.4 Install `zod` validation middleware (or create custom wrapper)
- [x] 4.5 Create Zod schemas for all API endpoints:
  - [x] 4.5.1 `/api/analyze` request schema
  - [x] 4.5.2 `/api/chat` request schema
  - [x] 4.5.3 `/api/documents` CRUD schemas
  - [x] 4.5.4 `/api/history` query schema
  - [x] 4.5.5 `/api/analysis/*` endpoints schemas
- [x] 4.6 Add validation middleware to analysis routes
- [x] 4.7 Sanitize error messages sent to clients (don't expose internal details)
- [x] 4.8 Install `pino` and configure structured logging
- [x] 4.9 Replace all `console.log/error/warn` in backend with Pino logger
- [x] 4.10 Create `server/src/config/env.ts` to centralize and validate environment variables

## 5. Architecture - Refactoring

- [x] 5.1 Extract prompt templates from `analysisController.ts` to `server/src/config/prompts.ts`
- [x] 5.2 Create `server/src/services/quoteProcessingService.ts` for orchestration logic
- [x] 5.3 Move business logic from `routes/analysis.ts` to `controllers/analysisController.ts`
- [x] 5.4 Split `analysisController.ts` into smaller focused controllers
- [x] 5.5 Create `server/src/middleware/upload.ts` for multer configuration
- [x] 5.6 Remove multer config from `documentController.ts`
- [x] 5.7 Create `server/src/repositories/` layer for database access patterns
- [x] 5.8 Move database queries from controllers/services to repositories
- [x] 5.9 Create `server/src/middleware/` directory with auth, validation, logging, rate limiting

## 6. Performance - Parallelization

- [x] 6.1 Parallelize validation loop in `analysisController.ts` (line 546)
- [x] 6.2 Parallelize scoring loop in `analysisController.ts` (line 759)
- [x] 6.3 Parallelize narrative generation loop in `analysisController.ts` (line 778) with `p-limit(3)`
- [x] 6.4 Install `p-limit` for concurrency control
- [x] 6.5 Parallelize PDF extraction in `pdfExtractor.ts` with `p-limit(3)`
- [x] 6.6 Batch query expansion embeddings in `ragRetrievalService.ts`
- [x] 6.7 Limit concurrency for re-ranking embeddings to 5 parallel requests
- [x] 6.8 Add request coalescing for concurrent embedding requests
- [x] 6.9 Parallelize chunk+image count queries in `documentController.ts`

## 7. Performance - Caching & Memory

- [x] 7.1 Add cleanup handlers for Redis intervals on SIGTERM/SIGINT
- [x] 7.2 Implement LRU + TTL for `analysisCache` in `useAdvancedAnalysis.ts`
- [x] 7.3 Add TTL cleanup for chat rate limiter Map
- [x] 7.4 Add request coalescing to embedding service
- [x] 7.5 Configure Vite code splitting in `vite.config.ts`:
  - [x] 7.5.1 Manual chunk for `recharts`
  - [x] 7.5.2 Manual chunk for vendor libraries
  - [x] 7.5.3 Manual chunk for PDF libraries
- [x] 7.6 Add `React.lazy()` + `Suspense` for ChatBot, ClauseAdmin, ProfileScreen
- [x] 7.7 Ensure server-only dependencies are excluded from frontend bundle

## 8. Code Quality - Cleanup & Consolidation

- [x] 8.1 Remove dead state (`progress`, `setProgress`) and empty `useEffect` from `App.tsx`
- [x] 8.2 Move debug files to `scripts/debug/` or delete them
- [x] 8.3 Remove orphaned scripts from `/server/` root
- [x] 8.4 Consolidate `utils/textUtils.ts` and `server/src/utils/textUtils.ts`
- [x] 8.5 Consolidate `utils/stringUtils.ts` and `server/src/utils/stringUtils.ts`
- [x] 8.6 Consolidate `utils/formatCurrency.ts` and `server/src/utils/formatCurrency.ts`
- [x] 8.7 Fix duplicate `QuoteAnalysis` interface in `types.ts`
- [x] 8.8 Remove `as any` casts from Supabase queries (reduced from 93 to 5 remaining - remaining require schema regeneration)
- [x] 8.9 Add explicit return types to all service functions ( codebase was already well-typed - added 3 missing return types in gemini.ts)
- [x] 8.10 Set up pre-commit hooks with husky + lint-staged:
  - [x] 8.10.1 TypeScript compilation check
  - [x] 8.10.2 ESLint check
  - [x] 8.10.3 Secret detection (git-secrets or detect-secrets)

## 9. UX/UI - Accessibility & State Management

- [x] 9.1 Create `AuthContext` for user authentication state
- [x] 9.2 Create `AnalysisContext` for analysis workflow state
- [x] 9.3 Create `UIContext` for modals and toasts
- [x] 9.4 Replace App.tsx state with context providers
- [x] 9.5 Add Error Boundary component
- [x] 9.6 Wrap main sections (ComparisonReport, TechnicalDashboard) with Error Boundaries
- [x] 9.7 Add `aria-label` to all icon-only buttons (App.tsx header buttons)
- [x] 9.11 Fix `key={idx}` anti-pattern in FileUploader (using file.name + idx)
- [x] 9.8 Fix label-input associations (`htmlFor` + `id`) in RegisterScreen
- [x] 9.9 Replace clickable `<div>` elements with `<button>` in ClauseSelector
- [x] 9.10 Implement modal focus trap + Escape to close
- [x] 9.14 Replace `alert()` with console.log (temporary) in ComparisonReport.tsx
- [x] 9.15 Remove or wrap `console.*` statements in frontend (development-only logger)

## 10. Testing & Deployment

- [x] 10.1 Write unit tests for `parseCoverageValue` (decimal handling, edge cases)
- [x] 10.2 Write unit tests for `parseMonetaryValue` in winnerDetection
- [x] 10.3 Write unit tests for custom error classes
- [x] 10.4 Write unit tests for Zod schemas (valid/invalid inputs)
- [x] 10.5 Write integration test for complete analysis flow
- [x] 10.6 Add GitHub Actions CI workflow (lint, typecheck, test)
- [ ] 10.7 Deploy to staging environment
- [ ] 10.8 Run security scan on staging
- [ ] 10.9 Run performance benchmarks on staging
- [ ] 10.10 Deploy to production with feature flags enabled gradually
