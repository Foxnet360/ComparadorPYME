import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express, { Request, Response, NextFunction } from 'express';

import { errorHandler } from '../errorHandler';
import { AppError, ValidationError, RateLimitError } from '../../errors';

/**
 * ERR-1: every error reaching the central handler must produce a response
 * that carries a traceId so clients and logs can be correlated.
 */

function createMockRes(locals: Record<string, unknown> = {}) {
  const jsonMock = vi.fn();
  const statusMock = vi.fn().mockReturnValue({ json: jsonMock });
  const res = { status: statusMock, json: jsonMock, locals } as unknown as Response;
  return { res, statusMock, jsonMock };
}

describe('errorHandler (ERR-1)', () => {
  const next = vi.fn() as NextFunction;
  const req = {} as Request;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('responds 500 with a traceId for unexpected errors', () => {
    const { res, statusMock, jsonMock } = createMockRes({ requestId: 'trace-abc-123' });

    errorHandler(new Error('boom'), req, res, next);

    expect(statusMock).toHaveBeenCalledWith(500);
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: 'Internal server error',
        traceId: 'trace-abc-123',
      })
    );
  });

  it('exposes the AppError status code and message along with the traceId', () => {
    const { res, statusMock, jsonMock } = createMockRes({ requestId: 'trace-502' });

    errorHandler(new AppError('Upstream Error: No response from Gemini AI.', 502), req, res, next);

    expect(statusMock).toHaveBeenCalledWith(502);
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: 'Upstream Error: No response from Gemini AI.',
        traceId: 'trace-502',
      })
    );
  });

  it('includes validation details for ValidationError', () => {
    const { res, statusMock, jsonMock } = createMockRes({ requestId: 'trace-400' });
    const details = [{ field: 'name', message: 'required' }];

    errorHandler(new ValidationError('Invalid payload', details), req, res, next);

    expect(statusMock).toHaveBeenCalledWith(400);
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, details, traceId: 'trace-400' })
    );
  });

  it('includes retryAfter for RateLimitError', () => {
    const { res, statusMock, jsonMock } = createMockRes({ requestId: 'trace-429' });

    errorHandler(new RateLimitError('Rate limit exceeded', 30), req, res, next);

    expect(statusMock).toHaveBeenCalledWith(429);
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, retryAfter: 30, traceId: 'trace-429' })
    );
  });

  it('returns a route-level 500 with traceId when a controller throws', async () => {
    const app = express();
    app.use((req, res, next) => {
      res.locals.requestId = req.headers['x-request-id'] ?? 'generated-trace-id';
      next();
    });
    app.get('/fail', async (_req: Request, _res: Response, next: NextFunction) => {
      next(new Error('controller exploded'));
    });
    app.use(errorHandler);

    const response = await request(app).get('/fail');

    expect(response.status).toBe(500);
    expect(response.body).toEqual(
      expect.objectContaining({
        success: false,
        error: 'Internal server error',
        traceId: expect.any(String),
      })
    );
    expect(response.body.traceId).toBe('generated-trace-id');
  });
});
