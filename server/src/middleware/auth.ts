import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AuthenticationError } from '../errors';

interface JwtUserPayload {
  sub?: string;
  id?: string;
  email?: string;
  role?: string;
}

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email?: string;
    role?: string;
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
  };
}

const getJwtSecret = (): string => process.env.SUPABASE_JWT_SECRET || '';

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
        req.user = {
          id: (decoded.sub || decoded.id) as string,
          email: decoded.email,
          role: decoded.role,
        };
      } catch (_jwtError) {
        throw new AuthenticationError('Invalid or expired token');
      }
    } else {
      // Fallback: decode without verification (for development)
      // In production, SUPABASE_JWT_SECRET must be set
      const decoded = jwt.decode(token) as unknown as JwtUserPayload;
      if (decoded) {
        req.user = {
          id: (decoded.sub || decoded.id) as string,
          email: decoded.email,
          role: decoded.role,
        };
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
          req.user = {
            id: (decoded.sub || decoded.id) as string,
            email: decoded.email,
            role: decoded.role,
          };
        } catch {
          // Invalid token is OK for optional auth
        }
      } else {
        const decoded = jwt.decode(token) as unknown as JwtUserPayload;
        if (decoded) {
          req.user = {
            id: (decoded.sub || decoded.id) as string,
            email: decoded.email,
            role: decoded.role,
          };
        }
      }
    }

    next();
  } catch (error) {
    next(error);
  }
};
