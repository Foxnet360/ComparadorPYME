import { GoogleGenAI } from '@google/genai';

let _cachedGenAI: GoogleGenAI | null = null;
let _cachedApiKey: string | null = null;

/**
 * Lazily initialize and return the singleton GoogleGenAI instance.
 * Allows empty API key in test environment to permit mocking.
 */
export const getGenAI = (): GoogleGenAI => {
  const apiKey = process.env.GEMINI_API_KEY || '';
  if (!apiKey && process.env.NODE_ENV !== 'test') {
    throw new Error('GEMINI_API_KEY is not set in environment');
  }
  if (_cachedGenAI && _cachedApiKey === apiKey) {
    return _cachedGenAI;
  }
  _cachedApiKey = apiKey;
  _cachedGenAI = new GoogleGenAI({ apiKey });
  return _cachedGenAI;
};

/**
 * Reset the cached singleton instance (useful for testing).
 */
export const resetGenAI = (): void => {
  _cachedGenAI = null;
  _cachedApiKey = null;
};
