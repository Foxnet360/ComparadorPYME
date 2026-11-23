import { Response, NextFunction } from 'express';
import { AuthenticatedRequest, authMiddleware, optionalAuthMiddleware } from './auth';

/**
 * AUTH-1: global authentication gate for /api/*.
 *
 * Fail-closed: every route under /api requires a valid Bearer token EXCEPT
 * the explicit public allowlist below. Allowlist entries are matched against
 * the path relative to the /api mount point:
 *
 * - exact:   /analyze, /history
 * - prefix (all methods): /comparison/*
 * - method-scoped prefix: GET+POST /chat/*, GET /documents/*
 * - pattern: /analysis/:id/export
 *
 * /health is registered outside /api and never reaches this gate.
 * Static assets are not under /api either.
 *
 * The portfolio routes (/clients, /policies) are intentionally NOT
 * allowlisted: XC-1 requires a session for every portfolio read/write.
 *
 * Allowlisted routes use optional auth: a valid token is attached when
 * present, but anonymous traffic is allowed through. Chat and the clause
 * library (document reads) are anonymous-by-design: the controllers bucket
 * anonymous traffic as 'anonymous' and only mutations (POST /documents,
 * DELETE /api/chat/threads/:id) stay protected — POST /documents also
 * enforces upload ownership via requireUser().
 */
// Production: Core application routes require a valid session (XC-1 / SEC-AUDIT).
// Only public routes:
// - /v1/daas/* (authenticated independently via daasApiKeyAuth middleware using B2B API Keys)
// - GET /insurers (public read-only insurance catalog for branding)
// - GET /documents and GET /documents/:id (public clause library read-only reference data)
const PUBLIC_EXACT_PATHS: ReadonlySet<string> = new Set([]);

const PUBLIC_PREFIXES: readonly string[] = ['/v1/daas'];

const PUBLIC_METHOD_PREFIXES: ReadonlyArray<{
  prefix: string;
  methods: readonly string[];
}> = [
  // Read-only knowledge base: document metadata/content
  { prefix: '/documents', methods: ['GET'] },
  // Read-only insurer catalog: brand logos/profiles are reference data
  { prefix: '/insurers', methods: ['GET'] },
];

const PUBLIC_METHOD_EXACT: ReadonlyArray<{
  path: string;
  methods: readonly string[];
}> = [
  { path: '/openapi.json', methods: ['GET'] },
  { path: '/openapi.yaml', methods: ['GET'] },
];

const PUBLIC_PATTERNS: readonly RegExp[] = [];

function normalizeVersionedApiPath(path: string): string {
  if (path === '/v1') {
    return '/';
  }
  if (path.startsWith('/v1/') && !path.startsWith('/v1/daas')) {
    return path.slice(3);
  }
  return path;
}

export const isPublicPath = (path: string, method?: string): boolean => {
  const normalizedPath = normalizeVersionedApiPath(path);

  if (PUBLIC_EXACT_PATHS.has(normalizedPath)) {
    return true;
  }
  if (
    PUBLIC_PREFIXES.some(
      (prefix) => normalizedPath === prefix || normalizedPath.startsWith(`${prefix}/`)
    )
  ) {
    return true;
  }
  if (
    method &&
    PUBLIC_METHOD_EXACT.some(
      (entry) => entry.methods.includes(method) && normalizedPath === entry.path
    )
  ) {
    return true;
  }
  if (
    method &&
    PUBLIC_METHOD_PREFIXES.some(
      (entry) =>
        entry.methods.includes(method) &&
        (normalizedPath === entry.prefix || normalizedPath.startsWith(`${entry.prefix}/`))
    )
  ) {
    return true;
  }
  return PUBLIC_PATTERNS.some((pattern) => pattern.test(normalizedPath));
};

export const authGate = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  if (isPublicPath(req.path, req.method)) {
    optionalAuthMiddleware(req, res, next).catch(next);
    return;
  }
  authMiddleware(req, res, next).catch(next);
};
