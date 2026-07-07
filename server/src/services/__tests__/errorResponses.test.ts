import { describe, it, expect, vi } from 'vitest';
import { Request, Response } from 'express';

import { errorHandler } from '../../middleware/errorHandler';
import {
  GeminiRateLimitError,
  GeminiServiceUnavailableError,
  GeminiTimeoutError,
  GeminiInvalidResponseError,
  GeminiUnknownError,
} from '../../errors/geminiErrors';

// Mock the logger to avoid initialization issues
vi.mock('../../config/logger', () => ({
  default: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

describe('Error Response Format', () => {
  const createMockResponse = (): Response => {
    const res = {
      statusCode: 200,
      json: vi.fn(),
      status: vi.fn(function (code: number) {
        this.statusCode = code;
        return this;
      }),
      locals: {
        requestId: 'test-request-id-123',
      },
      setHeader: vi.fn(),
    } as unknown as Response;
    return res;
  };

  const createMockRequest = (): Request =>
    ({
      headers: {},
    }) as unknown as Request;

  describe('GeminiError responses', () => {
    it('should include requestId in Gemini error responses', () => {
      const req = createMockRequest();
      const res = createMockResponse();
      const error = new GeminiServiceUnavailableError();

      errorHandler(error, req, res, vi.fn());

      expect(res.json).toHaveBeenCalled();
      const response = res.json.mock.calls[0][0];

      expect(response).toHaveProperty('success', false);
      expect(response).toHaveProperty('error');
      expect(response.error).toHaveProperty('requestId', 'test-request-id-123');
    });

    it('should return structured error with code and message', () => {
      const req = createMockRequest();
      const res = createMockResponse();
      const error = new GeminiRateLimitError('Rate limit exceeded', 60);

      errorHandler(error, req, res, vi.fn());

      const response = res.json.mock.calls[0][0];

      expect(response.error).toHaveProperty('code', 'GEMINI_RATE_LIMIT');
      expect(response.error).toHaveProperty('message');
      expect(response.error.message).toBe(
        'Límite de requests excedido. Espera 1 minuto y reintenta.'
      );
    });

    it('should include retryAfter for rate limit errors', () => {
      const req = createMockRequest();
      const res = createMockResponse();
      const error = new GeminiRateLimitError('Rate limit exceeded', 120);

      errorHandler(error, req, res, vi.fn());

      const response = res.json.mock.calls[0][0];

      expect(response.error).toHaveProperty('retryAfter', 120);
    });

    it('should return correct status codes for each error type', () => {
      const testCases = [
        { error: new GeminiRateLimitError(), expectedStatus: 429 },
        { error: new GeminiServiceUnavailableError(), expectedStatus: 503 },
        { error: new GeminiTimeoutError(), expectedStatus: 504 },
        { error: new GeminiInvalidResponseError(), expectedStatus: 502 },
        { error: new GeminiUnknownError(), expectedStatus: 500 },
      ];

      testCases.forEach(({ error, expectedStatus }) => {
        const req = createMockRequest();
        const res = createMockResponse();

        errorHandler(error, req, res, vi.fn());

        expect(res.statusCode).toBe(expectedStatus);
      });
    });

    it('should return Spanish user-friendly messages', () => {
      const req = createMockRequest();
      const res = createMockResponse();
      const error = new GeminiTimeoutError();

      errorHandler(error, req, res, vi.fn());

      const response = res.json.mock.calls[0][0];

      expect(response.error.message).toContain('demasiado tiempo');
      expect(response.error.message).toContain('PDF');
    });
  });

  describe('Request ID propagation', () => {
    it('should include requestId from response locals', () => {
      const req = createMockRequest();
      const res = createMockResponse();
      res.locals.requestId = 'custom-request-id-456';
      const error = new GeminiUnknownError();

      errorHandler(error, req, res, vi.fn());

      const response = res.json.mock.calls[0][0];

      expect(response.error.requestId).toBe('custom-request-id-456');
    });

    it('should handle missing requestId gracefully', () => {
      const req = createMockRequest();
      const res = createMockResponse();
      res.locals.requestId = undefined;
      const error = new GeminiServiceUnavailableError();

      errorHandler(error, req, res, vi.fn());

      const response = res.json.mock.calls[0][0];

      expect(response.error).toHaveProperty('requestId');
      expect(response.error.requestId).toBeUndefined();
    });
  });
});
