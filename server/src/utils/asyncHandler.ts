import { Request, Response, NextFunction, RequestHandler } from 'express';

/**
 * Wraps an async route handler to catch errors and forward them to Express error middleware.
 * This eliminates the need for try/catch blocks in every route.
 */
export const asyncHandler = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>
): RequestHandler => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
