import { Request, Response, NextFunction } from 'express';
import { AppError, ValidationError, RateLimitError, sanitizeErrorMessage } from '../errors';
import { GeminiError } from '../errors/geminiErrors';
import logger from '../config/logger';

export const errorHandler = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  if (err instanceof GeminiError) {
    const response = {
      success: false,
      error: {
        code: err.errorCode,
        message: err.userMessage,
        requestId: res.locals.requestId,
        ...(err.retryAfter ? { retryAfter: err.retryAfter } : {}),
      },
    };

    res.status(err.statusCode).json(response);
    return;
  }

  if (err instanceof AppError) {
    const response: Record<string, unknown> = {
      success: false,
      error: sanitizeErrorMessage(err),
    };

    if (err instanceof ValidationError && err.details.length > 0) {
      response.details = err.details;
    }

    if (err instanceof RateLimitError) {
      response.retryAfter = err.retryAfter;
    }

    res.status(err.statusCode).json(response);
    return;
  }

  // Log unexpected errors
  logger.error({ err }, 'Unexpected error');

  // Don't leak internal error details to clients
  res.status(500).json({
    success: false,
    error: 'Internal server error',
  });
};
