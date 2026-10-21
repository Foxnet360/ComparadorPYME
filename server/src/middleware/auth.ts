import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AuthenticationError } from '../errors';

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

export const authMiddleware = (
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): void => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AuthenticationError('Authentication required');
    }

    const token = authHeader.substring(7);

    if (!token) {
      throw new AuthenticationError('Authentication required');
    }

    const jwtSecret = getJwtSecret();

    // If JWT secret is configured, verify the token
    if (jwtSecret) {
      try {
        const decoded = jwt.verify(token, jwtSecret) as unknown as JwtUserPayload;
        req.user = buildUserFromPayload(decoded);
      } catch (_jwtError) {
        throw new AuthenticationError('Invalid or expired token');
      }
    } else {
      // Fallback: decode without verification (for development)
      // In production, SUPABASE_JWT_SECRET must be set
      const decoded = jwt.decode(token) as unknown as JwtUserPayload;
      if (decoded) {
        req.user = buildUserFromPayload(decoded);
      }
    }

    next();
  } catch (error) {
    next(error);
  }
};

export const optionalAuthMiddleware = (
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): void => {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);

      const jwtSecret = getJwtSecret();

      if (jwtSecret) {
        try {
          const decoded = jwt.verify(token, jwtSecret) as unknown as JwtUserPayload;
          req.user = buildUserFromPayload(decoded);
        } catch {
          // Invalid token is OK for optional auth
        }
      } else {
        const decoded = jwt.decode(token) as unknown as JwtUserPayload;
        if (decoded) {
          req.user = buildUserFromPayload(decoded);
        }
      }
    }

    next();
  } catch (error) {
    next(error);
  }
};
