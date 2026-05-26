# Design: Complete System Audit Remediation

## Context

The Comparador CSA is a Colombian PYME insurance quote comparison platform built on Node.js/Express backend with React frontend, Supabase PostgreSQL, and Google Gemini AI. A comprehensive audit revealed critical issues across security (Grade F), architecture (Grade D+), business logic (Grade C), performance (Grade D+), and UX/UI (Grade C+). The system is currently in production with real user data but lacks authentication, has exposed credentials, contains financial calculation bugs, and processes requests inefficiently.

Current architecture:
- **Backend**: Express + TypeScript, 1,149-line god controller, no middleware layer, no input validation
- **Frontend**: React 19 + Vite, 428-line App.tsx god component, no code splitting, zero accessibility
- **Database**: Supabase with service_role key (bypasses RLS), no transactions
- **AI**: Gemini API with sequential processing, no request cancellation, no rate limiting

## Goals / Non-Goals

**Goals:**
- Eliminate all critical and high-severity security vulnerabilities
- Fix financial calculation bugs that produce incorrect quotes
- Reduce analysis time by 50-70% through parallelization
- Establish proper architecture patterns (middleware, validation, error handling)
- Achieve basic accessibility compliance (ARIA labels, keyboard navigation)
- Remove dead code and consolidate duplicates

**Non-Goals:**
- Complete UI redesign or new features
- Migration to a different framework or database
- Implementing real-time collaboration
- Adding new AI models beyond Gemini
- Internationalization (i18n) - out of scope for this change

## Decisions

### 1. Authentication: Supabase Auth JWT vs Custom Auth
**Decision**: Use Supabase Auth with JWT middleware
**Rationale**: Supabase Auth is already integrated (client-side). Using it server-side requires only adding JWT verification middleware. Custom auth would add unnecessary complexity.
**Alternative considered**: Custom JWT implementation with `jsonwebtoken` library - rejected because Supabase Auth handles refresh tokens, password reset, and email verification.

### 2. Rate Limiting: express-rate-limit vs Custom Implementation
**Decision**: Use `express-rate-limit` with Redis store
**Rationale**: The custom in-memory rate limiter in `chat.ts` has memory leaks and doesn't work across instances. `express-rate-limit` is battle-tested and supports Redis for distributed deployments.
**Alternative considered**: Keep custom implementation and fix leaks - rejected because it would still not scale across multiple Railway instances.

### 3. Validation: Zod vs Joi vs Custom
**Decision**: Use Zod (already in package.json)
**Rationale**: Zod is already a dependency, provides TypeScript inference, and has excellent Express integration via `zod-express-middleware` or manual validation.
**Alternative considered**: Joi - rejected because Zod's TypeScript integration is superior and it's already installed.

### 4. Financial Precision: decimal.js vs Native Number
**Decision**: Use `decimal.js` for all monetary calculations
**Rationale**: Colombian peso values in billions approach JavaScript's safe integer limit. The audit found floating point accumulation in price scoring and parsing bugs with decimal abbreviations.
**Alternative considered**: `big.js` (smaller) - rejected because `decimal.js` has more comprehensive API for the complex calculations needed.

### 5. Parallelization: Promise.all vs p-limit
**Decision**: Use `Promise.all` for independent operations, `p-limit` for Gemini API calls
**Rationale**: Most per-quote operations are independent and can use `Promise.all`. However, Gemini API has rate limits, so `p-limit(3)` prevents 429 errors while still gaining parallelism.

### 6. Error Handling: Centralized Middleware vs Per-Route
**Decision**: Centralized error handling middleware with custom error classes
**Rationale**: Currently 100+ duplicated try/catch blocks across routes. Centralized middleware eliminates duplication and ensures consistent responses.
**Implementation**: 
```typescript
// Custom error classes
class AppError extends Error { statusCode: number; isOperational: boolean }
class ValidationError extends AppError {}
class AuthenticationError extends AppError {}
class RateLimitError extends AppError {}

// Middleware
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ success: false, error: err.message });
  } else {
    logger.error(err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});
```

### 7. State Management: React Context vs Zustand/Redux
**Decision**: Use React Context (built-in, no new dependencies)
**Rationale**: The state complexity doesn't yet justify an external state management library. Three contexts (Auth, Analysis, UI) will sufficiently decouple App.tsx.
**Alternative considered**: Zustand - rejected to minimize new dependencies for this remediation change.

### 8. Response Format: Standardized Envelope
**Decision**: All API responses use `{success: boolean, data?: any, error?: string, meta?: object}`
**Rationale**: Currently 4 different error formats. Standardization makes frontend error handling predictable and enables automatic retry logic.

## Risks / Trade-offs

| Risk | Severity | Mitigation |
|------|----------|------------|
| **Breaking change**: All endpoints now require JWT | High | Implement auth gradually with feature flag; frontend stores token in localStorage (existing pattern) |
| **Performance regression**: Zod validation adds latency | Low | Validation is synchronous and <1ms per request; negligible compared to AI processing |
| **Scope creep**: Audit found 60+ issues | Medium | Strict prioritization (P0/P1/P2); time-box each area to 1 week |
| **Redis dependency**: Rate limiting requires Redis | Medium | Redis is already in package.json; fallback to memory store if Redis unavailable |
| **Regression risk**: Large refactoring of analysisController | High | Maintain existing tests (add new ones), feature flag major changes, deploy to staging first |
| **User disruption**: Auth requirement breaks existing workflows | Medium | Add graceful degradation - allow anonymous access for analysis but require auth for history/saving |
| **SMMLV update impact**: All historical calculations change | Medium | Make SMMLV configurable via env var; don't retroactively change historical analyses |

## Migration Plan

### Phase 1: Security (Week 1)
1. Rotate all exposed API keys immediately
2. Remove hardcoded credential files from repo
3. Implement JWT middleware (behind feature flag)
4. Add rate limiting to non-AI endpoints
5. Deploy to staging for security testing

### Phase 2: Critical Bugs (Week 1-2)
1. Fix parsing bugs with decimal values
2. Update SMMLV/UVT or make configurable
3. Fix race conditions in batch processing
4. Add AbortController for timeouts
5. Deploy to staging with regression tests

### Phase 3: Architecture (Week 2-3)
1. Add centralized error handling
2. Implement Zod validation on all endpoints
3. Split analysisController into services
4. Standardize response format
5. Deploy to staging

### Phase 4: Performance (Week 3)
1. Parallelize quote processing loops
2. Add code splitting to frontend
3. Fix memory leaks
4. Batch embeddings
5. Deploy to staging with performance benchmarks

### Phase 5: UX/UI (Week 4)
1. Add Error Boundaries
2. Fix accessibility issues
3. Create React Contexts
4. Remove dead code
5. Final staging validation → production

### Rollback Strategy
- Feature flags for all breaking changes (auth, validation, new response format)
- Database migrations are additive only (no destructive changes)
- Keep old endpoints accessible via `/api/v1/` prefix during transition
- Monitor error rates and revert flags if >5% error rate

## Open Questions

1. **SMMLV source**: Should we fetch SMMLV from an external API (e.g., Colombian government) or maintain a config table in Supabase?
2. **Auth scope**: Should anonymous users still be able to analyze quotes (no auth required), or should auth be mandatory for all endpoints?
3. **Redis on Railway**: Does the current Railway deployment have Redis available, or do we need to add it?
4. **Test coverage baseline**: The project currently has 0% coverage on business logic. What's the minimum acceptable coverage for this remediation?
5. **Frontend bundle size target**: What's the maximum acceptable initial bundle size?
