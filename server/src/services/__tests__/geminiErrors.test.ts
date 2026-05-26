import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  GeminiError,
  GeminiRateLimitError,
  GeminiServiceUnavailableError,
  GeminiTimeoutError,
  GeminiInvalidResponseError,
  GeminiUnknownError,
  categorizeGeminiError,
} from '../../errors/geminiErrors';

describe('GeminiError Classes', () => {
  describe('GeminiRateLimitError', () => {
    it('should have correct properties', () => {
      const error = new GeminiRateLimitError('Rate limit exceeded', 60);
      
      expect(error.statusCode).toBe(429);
      expect(error.errorCode).toBe('GEMINI_RATE_LIMIT');
      expect(error.userMessage).toBe('Límite de requests excedido. Espera 1 minuto y reintenta.');
      expect(error.retryAfter).toBe(60);
      expect(error.message).toBe('Rate limit exceeded');
    });

    it('should use default message when none provided', () => {
      const error = new GeminiRateLimitError();
      
      expect(error.message).toBe('Rate limit exceeded');
      expect(error.retryAfter).toBeUndefined();
    });
  });

  describe('GeminiServiceUnavailableError', () => {
    it('should have correct properties', () => {
      const error = new GeminiServiceUnavailableError();
      
      expect(error.statusCode).toBe(503);
      expect(error.errorCode).toBe('GEMINI_SERVICE_UNAVAILABLE');
      expect(error.userMessage).toBe('Gemini temporalmente no disponible. Reintenta en unos momentos.');
    });
  });

  describe('GeminiTimeoutError', () => {
    it('should have correct properties', () => {
      const error = new GeminiTimeoutError();
      
      expect(error.statusCode).toBe(504);
      expect(error.errorCode).toBe('GEMINI_TIMEOUT');
      expect(error.userMessage).toBe('La extracción tomó demasiado tiempo. Intenta con un PDF más pequeño.');
    });
  });

  describe('GeminiInvalidResponseError', () => {
    it('should have correct properties', () => {
      const error = new GeminiInvalidResponseError();
      
      expect(error.statusCode).toBe(502);
      expect(error.errorCode).toBe('GEMINI_INVALID_RESPONSE');
      expect(error.userMessage).toBe('Respuesta inesperada de Gemini. Contacta soporte si persiste.');
    });
  });

  describe('GeminiUnknownError', () => {
    it('should have correct properties', () => {
      const error = new GeminiUnknownError();
      
      expect(error.statusCode).toBe(500);
      expect(error.errorCode).toBe('GEMINI_UNKNOWN_ERROR');
      expect(error.userMessage).toBe('Error interno del servicio de IA. Contacta soporte.');
    });
  });

  describe('categorizeGeminiError', () => {
    it('should categorize 429 status as rate limit', () => {
      const error = { status: 429, message: 'Too many requests' };
      const result = categorizeGeminiError(error);
      
      expect(result).toBeInstanceOf(GeminiRateLimitError);
      expect(result.statusCode).toBe(429);
    });

    it('should categorize 503 status as service unavailable', () => {
      const error = { status: 503, message: 'Service Unavailable' };
      const result = categorizeGeminiError(error);
      
      expect(result).toBeInstanceOf(GeminiServiceUnavailableError);
      expect(result.statusCode).toBe(503);
    });

    it('should categorize timeout message as timeout', () => {
      const error = { message: 'Request timeout after 300000ms' };
      const result = categorizeGeminiError(error);
      
      expect(result).toBeInstanceOf(GeminiTimeoutError);
      expect(result.statusCode).toBe(504);
    });

    it('should categorize 502 status as invalid response', () => {
      const error = { status: 502, message: 'Bad Gateway' };
      const result = categorizeGeminiError(error);
      
      expect(result).toBeInstanceOf(GeminiInvalidResponseError);
      expect(result.statusCode).toBe(502);
    });

    it('should categorize unknown errors as GeminiUnknownError', () => {
      const error = { status: 500, message: 'Internal server error' };
      const result = categorizeGeminiError(error);
      
      expect(result).toBeInstanceOf(GeminiUnknownError);
      expect(result.statusCode).toBe(500);
    });

    it('should categorize Quota exceeded as rate limit', () => {
      const error = { message: 'Quota exceeded for quota metric' };
      const result = categorizeGeminiError(error);
      
      expect(result).toBeInstanceOf(GeminiRateLimitError);
    });

    it('should categorize high demand as service unavailable', () => {
      const error = { message: 'The model is overloaded. high demand' };
      const result = categorizeGeminiError(error);
      
      expect(result).toBeInstanceOf(GeminiServiceUnavailableError);
    });

    it('should handle errors with no status or message', () => {
      const error = {};
      const result = categorizeGeminiError(error);
      
      expect(result).toBeInstanceOf(GeminiUnknownError);
    });
  });
});
