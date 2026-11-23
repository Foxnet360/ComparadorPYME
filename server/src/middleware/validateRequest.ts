import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { ValidationError } from '../errors';

// AUTH-2: a client-supplied userId (body or query) is never trusted; the
// backend derives ownership from the authenticated session instead.
export const hasClientSuppliedUserId = (req: Request): boolean =>
  req.query.userId !== undefined ||
  (req.body !== undefined &&
    typeof req.body === 'object' &&
    (req.body as Record<string, unknown>).userId !== undefined);

export const rejectClientSuppliedUserId = (req: Request, res: Response): boolean => {
  if (!hasClientSuppliedUserId(req)) {
    return false;
  }
  res.status(400).json({
    error: 'Bad Request',
    message: 'userId is derived from the authenticated session; do not send it',
  });
  return true;
};

export const rejectSpoofedUserId = (req: Request, res: Response, next: NextFunction): void => {
  if (!rejectClientSuppliedUserId(req, res)) {
    next();
  }
};

/**
 * Validate request body against a Zod schema
 */
export const validateBody = (schema: ZodSchema) => {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const details = error.issues.map((err) => ({
          field: err.path.join('.'),
          message: err.message,
        }));
        next(new ValidationError('Validation failed', details));
      } else {
        next(error);
      }
    }
  };
};

/**
 * Validate request query against a Zod schema
 */
export const validateQuery = (schema: ZodSchema) => {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      // Express 5 defines req.query as a read-only getter; validate without reassigning it
      schema.parse(req.query);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const details = error.issues.map((err) => ({
          field: err.path.join('.'),
          message: err.message,
        }));
        next(new ValidationError('Query validation failed', details));
      } else {
        next(error);
      }
    }
  };
};

/**
 * Validate request params against a Zod schema
 */
export const validateParams = (schema: ZodSchema) => {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      req.params = schema.parse(req.params) as Record<string, string>;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const details = error.issues.map((err) => ({
          field: err.path.join('.'),
          message: err.message,
        }));
        next(new ValidationError('Params validation failed', details));
      } else {
        next(error);
      }
    }
  };
};
