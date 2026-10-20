# Security

Security model and operational requirements for the comparadorpyme platform
(Express + React SPA). This document reflects the state after the
`tech-debt-remediation` change (slices 1–5) and must be kept in sync with
`server/src/middleware/*` and `server/src/config/*`.

## 1. JWT verification flow

- Every route under `/api` passes through the global `authGate`
  (`server/src/middleware/authGate.ts`). It is **fail-closed**: any path not
  on the explicit public allowlist requires a valid `Bearer` token via
  `authMiddleware`.
- Public allowlist (anonymous traffic allowed, token attached when present):
  - exact: `/analyze`, `/history`
  - prefix: `/comparison/*`, `/clients/*`
  - pattern: `/analysis/:id/export`
- Token verification (`server/src/middleware/auth.ts`):
  - When `SUPABASE_JWT_SECRET` is set, tokens are verified with
    `jsonwebtoken.verify` (signature, expiry). Invalid or expired tokens are
    rejected with `401 AuthenticationError`.
  - Without the secret (development only), tokens are merely decoded. In
    production this path is unreachable: `assertProductionJwtSecret` runs at
    startup and refuses to bind the port if `SUPABASE_JWT_SECRET` is missing.
- Ownership: controllers derive the user id exclusively from
  `requireUser(req)`. A client-supplied `userId` in body or query is never
  trusted (spoofing vector).

## 2. Rate limiting

`server/src/middleware/rateLimiter.ts` (`express-rate-limit`):

| Limiter | Window | Max | Applied to |
|---|---|---|---|
| `globalRateLimiter` | 15 min | 100 req | all `/api/*` |
| `analyzeRateLimiter` | 1 min | 10 req | `/api/analyze`, analysis routes |
| `chatRateLimiter` | 1 min | 20 req | `/api/chat` |

- When `REDIS_URL` is set, limits are shared through Redis
  (`rate-limit-redis`); otherwise the in-memory store is used (single
  instance only).
- Limit violations throw `RateLimitError` (HTTP 429) with the retry window.

## 3. Input validation

- Request payloads are validated with Ajv schemas
  (`server/src/middleware/validateRequest.ts` +
  `server/src/middleware/validationSchemas.ts`) before reaching controllers;
  invalid payloads are rejected with `400` and the schema errors.
- Domain schemas in `server/src/schemas/` (extraction, template registry,
  domain bundle) define the accepted shapes for pipeline inputs and outputs.
- File uploads are constrained by `MAX_FILE_SIZE`, `MAX_PAGES_LIMIT` and
  `UPLOAD_TIMEOUT` (see `server/src/config/env.ts`).

## 4. CORS policy

`server/src/config/cors.ts` (fail-closed):

- Allowed origins come **only** from the `CORS_ORIGINS` environment variable,
  formatted as a JSON string array, e.g.
  `CORS_ORIGINS='["https://app.example.com"]'`.
- Unlisted origins are rejected with an error (no permissive wildcard).
- If `CORS_ORIGINS` is unset or malformed, the process falls back to
  localhost development origins only. Production deployments **must** set
  `CORS_ORIGINS` explicitly.

## 5. Environment variables and secrets

- All configuration is centralized and validated at startup in
  `server/src/config/env.ts` (`validateEnv`).
- Secrets are injected via Railway/CI environment variables. `.env*` files
  are git-ignored and excluded from the Docker build context via
  `.dockerignore`; the multi-stage `Dockerfile` never copies them.
- The production image runs as the non-root `node` user and keeps only
  production dependencies (`npm ci --omit=dev` in the `prod-deps` stage).
- The backend connects to Supabase with the service-role key, which bypasses
  RLS by design; authorization is therefore enforced exclusively by the
  backend middleware described above, never by the client.

## 6. Secret rotation — maintainer-owned requirement

The audit (`Informe_deuda.md`, critical finding) confirmed that production
secrets (Supabase service-role key, anon key, Gemini API key) were committed
to the repository history. **Removing them from the working tree is not
enough — anyone with history access retains them.** These tasks are owned by
the repository maintainer and are tracked as tasks 0.1–0.3 of the
`tech-debt-remediation` change:

- **0.1 Rotate committed secrets** (Supabase service-role, anon, Gemini) via
  the Railway/CI secret stores. Time-critical.
- **0.2 Purge `.env*` from git history** with `git-filter-repo` or BFG, and
  verify with `git ls-files | grep '\.env'`.
- **0.3 Update CI/deployment secret references** so the hardened
  JWT-secret and CORS configuration (slice 1) start from clean secrets.

### 2026-09-04 evidence update (db-coherence-remediation)

- The `.env` `GEMINI_API_KEY` (committed, `AIza…` prefix) is **invalid** —
  Google API returns `API_KEY_INVALID`. Production works because Railway
  carries a different key (`AQ.…` prefix). Rotate the Railway key and remove
  the dead one from `.env`.
- A Supabase personal access token (`sbp_…`) was used for migration work and
  appears in session tooling logs — rotate it at
  <https://supabase.com/dashboard/account/tokens> after the DB migration work
  is done.
- The DB password (SCRAM) and service-role key remain in committed history —
  include them in 0.1/0.2 scope.

Until rotation is complete, all committed credentials must be treated as
compromised.
