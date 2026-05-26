# Complete System Audit Remediation

## Why

A comprehensive audit revealed critical security vulnerabilities (hardcoded API keys, zero authentication, missing rate limiting), severe financial calculation bugs (parsing errors, outdated SMMLV values), architectural debt (god controllers, no input validation), and performance bottlenecks (sequential processing, memory leaks) that make the system unsafe, inaccurate, and slow. Immediate remediation is required to prevent data breaches, financial misquotations, and system instability before production scaling.

## What Changes

### Security & Authentication
- **BREAKING**: Implement JWT-based authentication middleware using Supabase Auth for all API endpoints
- **BREAKING**: Replace `req.body.userId` with verified user identity from JWT tokens
- Add `express-rate-limit` with Redis backing for all endpoints (stricter limits on AI endpoints)
- Remove all hardcoded API keys from source files (7 files affected)
- Purge `.env` files containing real credentials from git history
- Add Helmet.js for security headers (CSP, HSTS, X-Frame-Options)
- Fix CORS to exclude localhost origins in production
- Implement proper file upload validation (magic numbers, size limits)

### Critical Bug Fixes
- Fix `parseCoverageValue` dot-removal bug that corrupts decimal abbreviations (e.g., "1.5M" → "15M")
- Fix `parseMonetaryValue` in `winnerDetection.ts` with same parsing bug
- Update or externalize SMMLV/UVT values (currently hardcoded 2024 values)
- Fix race condition in batch quote processing (array index assignment)
- Implement `AbortController` support to cancel Gemini requests on timeout
- Add input validation for `req.files`, `req.body.clientProfile`, and file types
- Add idempotency keys for `analysis_history` inserts

### Performance & Efficiency
- Parallelize sequential loops in `analysisController.ts` (validation, scoring, narratives)
- Batch query expansion embeddings instead of sequential calls
- Add code splitting to Vite config (manual chunks for recharts, vendor, pdf)
- Implement `React.lazy()` + `Suspense` for modal components
- Fix memory leaks: clear intervals on shutdown, LRU cache limits, TTL for rate limiter
- Add request coalescing for concurrent embedding requests
- Limit concurrency on AI API calls with `p-limit`

### Architecture & Code Quality
- **BREAKING**: Add Zod schema validation for ALL API endpoints
- Create centralized error handling middleware (eliminate 100+ duplicated try/catch blocks)
- Standardize API response format across all endpoints
- Split `analysisController.ts` (1,149 lines) into orchestration service + smaller controllers
- Move business logic from `routes/` files to `controllers/`
- Extract prompt templates to `config/prompts.ts`
- Create `middleware/` directory (auth, validation, logging, rate limiting)
- Centralize environment variables in `config/env.ts` with validation
- Remove dead code: unused state, debug files, orphaned scripts
- Consolidate duplicate utilities between `/utils/` and `/server/src/utils/`
- Fix duplicate `QuoteAnalysis` interface in `types.ts`

### UX/UI & Accessibility
- Add Error Boundaries to prevent complete app crashes
- Remove `alert()` calls from production code, use toast notifications
- Add `aria-label` to all icon-only buttons
- Fix `key={idx}` anti-pattern, use unique IDs
- Create React Context providers for auth, analysis, and UI state
- Add form validation (email regex, phone format, password strength)
- Implement modal focus trap and Escape-to-close
- Add `aria-live` regions for dynamic status updates
- Support `prefers-reduced-motion`

### Testing & Observability
- Add unit tests for value parsing functions (critical financial logic)
- Add integration tests for complete analysis flow
- Implement Pino structured logging (replace console.log)
- Add health check endpoint with database connectivity verification
- Add memory and performance metrics collection

## Capabilities

### New Capabilities
- `security-auth`: JWT-based authentication, authorization middleware, user identity verification
- `rate-limiting`: Request rate limiting per endpoint with Redis backing
- `api-validation`: Zod schema validation for all API endpoints
- `error-handling`: Centralized error handling middleware and standardized response format
- `performance-optimization`: Parallel processing, caching improvements, bundle optimization
- `code-quality-standards`: Dead code removal, consolidation of duplicates, type safety improvements
- `frontend-accessibility`: ARIA labels, error boundaries, focus management, motion preferences

### Modified Capabilities
- `value-validation`: Fix decimal parsing bug, add currency normalization, externalize SMMLV/UVT values
- `deductible-extraction-v2`: Update SMMLV reference values or make configurable
- `quote-analysis-v2`: Fix race conditions in batch processing, add idempotency
- `rag-retrieval`: Batch query expansion embeddings, add request coalescing
- `supabase-auth`: Integrate with new JWT middleware (currently only has client-side storage)

## Impact

### Affected Code
- `server/src/index.ts` - CORS, rate limiting, Helmet, global middleware
- `server/src/controllers/analysisController.ts` - Split into smaller services
- `server/src/routes/analysis.ts` - Move logic to controllers
- `server/src/routes/chat.ts` - Add auth middleware, fix rate limiter memory leak
- `server/src/controllers/documentController.ts` - Add validation, fix upload security
- `server/src/services/` - Multiple services for parallelization and caching fixes
- `server/src/config/database.ts` - Use anon key with RLS instead of service_role
- `App.tsx` - Split state into contexts, add error boundaries
- `components/` - Add a11y attributes, fix keys, memoization
- `utils/` and `server/src/utils/` - Consolidate duplicates
- `types.ts` - Fix duplicate interface

### Affected APIs
- ALL endpoints require JWT authentication (breaking change)
- Standardized response envelope: `{success, data, error}`
- Rate limits: 100 req/15min general, 10 req/min for `/api/analyze`

### Dependencies Added
- `express-rate-limit` - Rate limiting
- `helmet` - Security headers
- `zod` - Already in package.json, will be used
- `pino` or `winston` - Structured logging
- `decimal.js` or `big.js` - Precise financial calculations

### Systems
- Supabase: Enable RLS policies, rotate exposed service_role key
- Railway: Update environment variables, add Redis for rate limiting
- Git: Purge credential files from history using BFG or git-filter-repo
