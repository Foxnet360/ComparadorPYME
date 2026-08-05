import { describe, it, expect, vi, beforeEach } from 'vitest';
import { geminiService } from '../gemini';
import { featureFlags } from '../../config/featureFlags';

// Mock env
vi.mock('../../config/env', () => ({
  env: {
    GEMINI_API_KEY: 'dummy-api-key',
    GEMINI_MODEL: 'gemini-3.5-flash',
    SUPABASE_URL: 'https://test.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'dummy',
    SMMLV_VALUE: 1423500,
    UVT_VALUE: 42412,
  },
}));

describe('Phase 4: Gemini Context Caching', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('should return null when enableGeminiContextCaching feature flag is disabled', async () => {
    vi.spyOn(featureFlags, 'isEnabled').mockReturnValue(false);

    const result = await geminiService.getOrCreateContextCache({
      contents: [{ text: 'Large clause text...' }],
    });

    expect(result).toBeNull();
  });

  it('should fall back gracefully to null without throwing when API call fails', async () => {
    vi.spyOn(featureFlags, 'isEnabled').mockReturnValue(true);

    const result = await geminiService.getOrCreateContextCache({
      contents: [{ text: 'Sample document contents' }],
    });

    // In test env without real API connection, it returns null safely without throwing
    expect(result).toBeNull();
  });
});
