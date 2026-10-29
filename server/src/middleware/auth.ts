import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { AuthenticationError } from '../errors';
import { createSupabaseAnonClient, createSupabaseClient } from '../config/database';

interface JwtUserPayload {
  sub?: string;
  id?: string;
  email?: string;
  role?: string;
  org_id?: string;
  orgId?: string;
  ally_id?: string;
  allyId?: string;
  app_metadata?: {
    role?: string;
    org_id?: string;
    orgId?: string;
  };
  user_metadata?: {
    role?: string;
    org_id?: string;
    orgId?: string;
    ally_id?: string;
    allyId?: string;
    name?: string;
    intermediary_name?: string;
  };
}

export type UserRole = 'super_admin' | 'ally_admin' | 'ally_technical' | string;

export interface AuthenticatedUser {
  id: string;
  email?: string;
  role?: UserRole;
  orgId?: string;
  name?: string;
  intermediaryName?: string;
  registrationNumber?: string;
  address?: string;
  city?: string;
  agentDetails?: {
    phone?: string;
    field?: string;
    bio?: string;
    registrationNumber?: string;
    address?: string;
    city?: string;
    logoUrl?: string;
  };
}

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

const getJwtSecret = (): string => process.env.SUPABASE_JWT_SECRET || '';

/**
 * Extracts and normalizes the user profile from a decoded JWT payload.
 */
function buildUserFromPayload(decoded: JwtUserPayload): AuthenticatedUser {
  const orgId =
    decoded.app_metadata?.org_id ||
    decoded.app_metadata?.orgId ||
    decoded.org_id ||
    decoded.orgId ||
    decoded.user_metadata?.org_id ||
    decoded.user_metadata?.orgId ||
    decoded.user_metadata?.ally_id ||
    decoded.user_metadata?.allyId;

  const role =
    decoded.app_metadata?.role ||
    decoded.role ||
    decoded.user_metadata?.role ||
    'ally_technical';

  const name = decoded.user_metadata?.name || decoded.email?.split('@')[0];

  return {
    id: (decoded.sub || decoded.id) as string,
    email: decoded.email,
    role,
    orgId: orgId ? String(orgId) : undefined,
    name,
    intermediaryName: decoded.user_metadata?.intermediary_name,
  };
}

/**
 * AUTH-2: returns the authenticated user's id or throws.
 * Controllers MUST derive ownership from this value; a client-supplied
 * userId in body/query is never trusted (spoofing vector).
 */
export const requireUser = (req: AuthenticatedRequest): string => {
  const id = req.user?.id;
  if (!id) {
    throw new AuthenticationError('Authentication required');
  }
  return id;
};

/**
 * Returns tenant and identity scope for portfolio operations.
 */
export const getTenantScope = (
  req: AuthenticatedRequest
): { userId: string; orgId?: string; role?: string } => {
  const userId = requireUser(req);
  return {
    userId,
    orgId: req.user?.orgId,
    role: req.user?.role,
  };
};

/**
 * RBAC Guard: ensures the authenticated user has one of the allowed roles.
 */
export const requireRole = (...allowedRoles: string[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user?.id) {
      res.status(401).json({ error: 'Unauthorized', message: 'Authentication required' });
      return;
    }

    const userRole = req.user.role || 'ally_technical';
    if (!allowedRoles.includes(userRole)) {
      res.status(403).json({
        error: 'Forbidden',
        message: `Insufficient permissions. Required one of: ${allowedRoles.join(', ')}`,
      });
      return;
    }

    next();
  };
};

/**
 * SEC-2: In production the JWT secret is mandatory. Without it the middleware
 * silently decodes tokens WITHOUT verifying signatures, which lets anyone forge
 * any user identity. Fail fast at startup instead of binding the port.
 */
export const assertProductionJwtSecret = (env: NodeJS.ProcessEnv = process.env): void => {
  if (env.NODE_ENV === 'production' && !env.SUPABASE_JWT_SECRET) {
    throw new Error(
      'SUPABASE_JWT_SECRET is required in production. Refusing to start: ' +
        'without it, JWTs would be decoded without signature verification.'
    );
  }
};

interface JwkKey {
  kid: string;
  kty: string;
  alg?: string;
  crv?: string;
  x?: string;
  y?: string;
  [key: string]: unknown;
}

// In-memory cache for Supabase JWKS public keys
const jwksCache: Map<string, string> = new Map();
let jwksLastFetched = 0;
const JWKS_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

export async function getPublicKeyForKid(kid: string): Promise<string | null> {
  const now = Date.now();
  if (jwksCache.has(kid) && now - jwksLastFetched < JWKS_CACHE_TTL_MS) {
    return jwksCache.get(kid) || null;
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  if (!supabaseUrl) return null;

  try {
    const res = await fetch(`${supabaseUrl}/auth/v1/.well-known/jwks.json`);
    if (!res.ok) {
      console.warn(`[auth] Failed to fetch JWKS from Supabase: ${res.statusText}`);
      return null;
    }
    const data = (await res.json()) as { keys?: JwkKey[] };
    if (!data.keys || !Array.isArray(data.keys)) return null;

    jwksCache.clear();
    for (const key of data.keys) {
      if (key.kid && key.kty === 'EC') {
        try {
          const pubKey = (crypto.createPublicKey as (input: unknown) => crypto.KeyObject)({ key, format: 'jwk' });
          const pem = pubKey.export({ type: 'spki', format: 'pem' }) as string;
          jwksCache.set(key.kid, pem);
        } catch (convErr) {
          console.warn(`[auth] Error converting JWK key ${key.kid} to PEM:`, convErr);
        }
      }
    }
    jwksLastFetched = now;
    return jwksCache.get(kid) || null;
  } catch (fetchErr) {
    console.warn('[auth] Network error fetching JWKS:', fetchErr);
    return null;
  }
}

/**
 * Verifies a JWT token using:
 * 1. Asymmetric ES256 via cached Supabase JWKS (zero network latency once cached)
 * 2. Symmetric HS256 via SUPABASE_JWT_SECRET
 * 3. Authoritative Supabase Auth API fallback (supabase.auth.getUser)
 * 4. Development decode fallback
 */
export async function verifyToken(token: string): Promise<AuthenticatedUser | null> {
  const decodedToken = jwt.decode(token, { complete: true }) as {
    header?: { alg?: string; kid?: string };
    payload?: JwtUserPayload;
  } | null;

  const alg = decodedToken?.header?.alg;
  const kid = decodedToken?.header?.kid;
  const jwtSecret = getJwtSecret();

  // 1. Asymmetric ES256 verification via Supabase JWKS public keys
  if (alg === 'ES256' && kid) {
    try {
      const pem = await getPublicKeyForKid(kid);
      if (pem) {
        const decoded = jwt.verify(token, pem, { algorithms: ['ES256'] }) as unknown as JwtUserPayload;
        return buildUserFromPayload(decoded);
      }
    } catch (esErr: unknown) {
      const msg = esErr instanceof Error ? esErr.message : String(esErr);
      console.warn(`[auth] Local ES256 verification failed (${msg}), falling back to Supabase auth API`);
    }
  }

  // 2. Symmetric HS256 verification via SUPABASE_JWT_SECRET
  if (alg === 'HS256' && jwtSecret) {
    try {
      const decoded = jwt.verify(token, jwtSecret, { algorithms: ['HS256'] }) as unknown as JwtUserPayload;
      return buildUserFromPayload(decoded);
    } catch (hsErr: unknown) {
      const msg = hsErr instanceof Error ? hsErr.message : String(hsErr);
      console.warn(`[auth] Local HS256 verification failed (${msg}), falling back to Supabase auth API`);
    }
  }

  // 3. Direct verification via Supabase Auth API
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (supabaseUrl && supabaseKey) {
    try {
      const authClient = createSupabaseAnonClient() || createSupabaseClient();
      const { data, error } = await authClient.auth.getUser(token);
      if (!error && data?.user) {
        const u = data.user;
        const payload: JwtUserPayload = {
          sub: u.id,
          id: u.id,
          email: u.email,
          role: u.app_metadata?.role as string | undefined,
          org_id: u.app_metadata?.org_id as string | undefined,
          app_metadata: u.app_metadata as JwtUserPayload['app_metadata'],
          user_metadata: u.user_metadata as JwtUserPayload['user_metadata'],
        };
        return buildUserFromPayload(payload);
      }
      if (error) {
        console.warn(`[auth] Supabase auth.getUser rejected token: ${error.message}`);
      }
    } catch (sbErr: unknown) {
      console.warn('[auth] Error contacting Supabase auth:', sbErr);
    }
  }

  // 4. Fallback for test/development when secret is not set and supabase is not configured
  if (!jwtSecret && process.env.NODE_ENV !== 'production') {
    const decoded = jwt.decode(token) as unknown as JwtUserPayload;
    if (decoded) {
      return buildUserFromPayload(decoded);
    }
  }

  return null;
}

export const authMiddleware = async (
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AuthenticationError('Authentication required');
    }

    const token = authHeader.substring(7);

    if (!token) {
      throw new AuthenticationError('Authentication required');
    }

    const user = await verifyToken(token);
    if (!user) {
      throw new AuthenticationError('Invalid or expired token');
    }

    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
};

export const optionalAuthMiddleware = async (
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      if (token) {
        try {
          const user = await verifyToken(token);
          if (user) {
            req.user = user;
          }
        } catch {
          // Invalid token is OK for optional auth
        }
      }
    }

    next();
  } catch (error) {
    next(error);
  }
};
