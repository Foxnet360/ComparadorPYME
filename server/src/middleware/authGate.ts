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
 * - prefix:  /comparison/*, /clients/*
 * - pattern: /analysis/:id/export
 *
 * /health is registered outside /api and never reaches this gate.
 * Static assets are not under /api either.
 *
 * Allowlisted routes use optional auth: a valid token is attached when
 * present, but anonymous traffic is allowed through.
 */
const PUBLIC_EXACT_PATHS: ReadonlySet<string> = new Set(['/analyze', '/history']);

const PUBLIC_PREFIXES: readonly string[] = ['/comparison', '/clients'];

const PUBLIC_PATTERNS: readonly RegExp[] = [/^\/analysis\/[^/]+\/export$/];

export const isPublicPath = (path: string): boolean => {
  if (PUBLIC_EXACT_PATHS.has(path)) {
    return true;
  }
  if (PUBLIC_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))) {
    return true;
  }
  return PUBLIC_PATTERNS.some((pattern) => pattern.test(path));
};

export const authGate = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  if (isPublicPath(req.path)) {
    optionalAuthMiddleware(req, res, next);
    return;
  }
  authMiddleware(req, res, next);
};
