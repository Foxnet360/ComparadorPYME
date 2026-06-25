import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AuthenticationError } from '../errors';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email?: string;
    role?: string;
  };
}

const SUPABASE_JWT_SECRET = process.env.SUPABASE_JWT_SECRET || '';

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

    // If JWT secret is configured, verify the token
    if (SUPABASE_JWT_SECRET) {
      try {
        const decoded = jwt.verify(token, SUPABASE_JWT_SECRET) as any;
        req.user = {
          id: decoded.sub || decoded.id,
          email: decoded.email,
          role: decoded.role,
        };
      } catch (_jwtError) {
        throw new AuthenticationError('Invalid or expired token');
      }
    } else {
      // Fallback: decode without verification (for development)
      // In production, SUPABASE_JWT_SECRET must be set
      const decoded = jwt.decode(token) as any;
      if (decoded) {
        req.user = {
          id: decoded.sub || decoded.id,
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

      if (SUPABASE_JWT_SECRET) {
        try {
          const decoded = jwt.verify(token, SUPABASE_JWT_SECRET) as any;
          req.user = {
            id: decoded.sub || decoded.id,
            email: decoded.email,
            role: decoded.role,
          };
        } catch {
          // Invalid token is OK for optional auth
        }
      } else {
        const decoded = jwt.decode(token) as any;
        if (decoded) {
          req.user = {
            id: decoded.sub || decoded.id,
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


