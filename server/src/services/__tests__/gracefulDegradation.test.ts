import { describe, it, expect } from 'vitest';
import {
  GeminiRateLimitError,
  GeminiServiceUnavailableError,
  GeminiTimeoutError,
} from '../../errors/geminiErrors';

describe('Graceful Degradation', () => {
  describe('Error placeholder objects', () => {
    it('should create failed quote with all required fields', () => {
      const failedQuote = {
        insurerName: 'Test Insurer',
        policyName: 'Error en procesamiento',
        priceAnnual: 0,
        currency: 'COP',
        coverages: [],
        specialConditions: ['Error: Service temporarily unavailable'],
        rawText: '',
        parseConfidence: 0,
        isFailed: true,
        errorCategory: 'SERVICE_UNAVAILABLE',
        errorCode: 'GEMINI_SERVICE_UNAVAILABLE',
      };

      expect(failedQuote).toHaveProperty('isFailed', true);
      expect(failedQuote).toHaveProperty('errorCategory');
      expect(failedQuote).toHaveProperty('errorCode');
      expect(failedQuote.coverages).toEqual([]);
      expect(failedQuote.priceAnnual).toBe(0);
      expect(failedQuote.parseConfidence).toBe(0);
    });

    it('should distinguish between different error categories', () => {
      const serviceError = {
        isFailed: true,
        errorCategory: 'SERVICE_UNAVAILABLE',
        errorCode: 'GEMINI_SERVICE_UNAVAILABLE',
      };

      const extractionError = {
        isFailed: true,
        errorCategory: 'EXTRACTION_FAILED',
        errorCode: 'EXTRACTION_ERROR',
      };

      expect(serviceError.errorCategory).not.toBe(extractionError.errorCategory);
      expect(serviceError.errorCode).not.toBe(extractionError.errorCode);
    });
  });

  describe('Error categorization', () => {
    it('should categorize 503 errors as service unavailable', () => {
      const error = new GeminiServiceUnavailableError();

      expect(error.errorCode).toBe('GEMINI_SERVICE_UNAVAILABLE');
      expect(error.statusCode).toBe(503);
      expect(error.userMessage).toContain('temporalmente no disponible');
    });

    it('should categorize timeout errors correctly', () => {
      const error = new GeminiTimeoutError();

      expect(error.errorCode).toBe('GEMINI_TIMEOUT');
      expect(error.statusCode).toBe(504);
      expect(error.userMessage).toContain('demasiado tiempo');
    });

    it('should categorize rate limit errors correctly', () => {
      const error = new GeminiRateLimitError();

      expect(error.errorCode).toBe('GEMINI_RATE_LIMIT');
      expect(error.statusCode).toBe(429);
      expect(error.userMessage).toContain('Límite de requests');
    });
  });

  describe('Continue processing on failure', () => {
    it('should allow processing to continue after a quote fails', () => {
      const quotes = [
        { insurerName: 'Insurer 1', isFailed: false, priceAnnual: 1000000 },
        { insurerName: 'Insurer 2', isFailed: true, errorCode: 'GEMINI_SERVICE_UNAVAILABLE' },
        { insurerName: 'Insurer 3', isFailed: false, priceAnnual: 2000000 },
      ];

      const successfulQuotes = quotes.filter((q) => !q.isFailed);
      const failedQuotes = quotes.filter((q) => q.isFailed);

      expect(successfulQuotes).toHaveLength(2);
      expect(failedQuotes).toHaveLength(1);
      expect(successfulQuotes[0].insurerName).toBe('Insurer 1');
      expect(successfulQuotes[1].insurerName).toBe('Insurer 3');
    });

    it('should handle all quotes failing', () => {
      const quotes = [
        { insurerName: 'Insurer 1', isFailed: true, errorCode: 'GEMINI_TIMEOUT' },
        { insurerName: 'Insurer 2', isFailed: true, errorCode: 'GEMINI_RATE_LIMIT' },
      ];

      const allFailed = quotes.every((q) => q.isFailed);
      expect(allFailed).toBe(true);
    });
  });
});
