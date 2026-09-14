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
const PUBLIC_EXACT_PATHS: ReadonlySet<string> = new Set(['/analyze', '/history']);

const PUBLIC_PREFIXES: readonly string[] = ['/comparison'];

const PUBLIC_METHOD_PREFIXES: ReadonlyArray<{
  prefix: string;
  methods: readonly string[];
}> = [
  // Chat works anonymously by design (threads bucket as 'anonymous'); only
  // destructive thread operations require a session.
  { prefix: '/chat', methods: ['GET', 'POST'] },
  // Read-only knowledge base: document metadata/content have no ownership
  // checks in the controllers; mutations stay behind the full middleware.
  { prefix: '/documents', methods: ['GET'] },
];

const PUBLIC_PATTERNS: readonly RegExp[] = [/^\/analysis\/[^/]+\/export$/];

export const isPublicPath = (path: string, method?: string): boolean => {
  if (PUBLIC_EXACT_PATHS.has(path)) {
    return true;
  }
  if (PUBLIC_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))) {
    return true;
  }
  if (
    method &&
    PUBLIC_METHOD_PREFIXES.some(
      (entry) =>
        entry.methods.includes(method) &&
        (path === entry.prefix || path.startsWith(`${entry.prefix}/`))
    )
  ) {
    return true;
  }
  return PUBLIC_PATTERNS.some((pattern) => pattern.test(path));
};

export const authGate = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  if (isPublicPath(req.path, req.method)) {
    optionalAuthMiddleware(req, res, next);
    return;
  }
  authMiddleware(req, res, next);
};
