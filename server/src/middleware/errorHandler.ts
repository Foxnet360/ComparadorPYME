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
  // ERR-1: every response carries a traceId so clients and structured logs
  // can be correlated. The requestId middleware seeds res.locals.requestId.
  const traceId = (res.locals.requestId ?? res.locals.traceId) as string | undefined;

  if (err instanceof GeminiError) {
    const response = {
      success: false,
      error: {
        code: err.errorCode,
        message: err.userMessage,
        requestId: traceId,
        ...(traceId ? { traceId } : {}),
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
      ...(traceId ? { traceId } : {}),
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
  logger.error({ err, traceId }, 'Unexpected error');

  // Don't leak internal error details to clients
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    ...(traceId ? { traceId } : {}),
  });
};
