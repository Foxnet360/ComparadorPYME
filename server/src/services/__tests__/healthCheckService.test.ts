import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { checkHealth, invalidateHealthCache } from '../healthCheckService';

// Mock external services
vi.mock('@google/genai', () => ({
  GoogleGenAI: vi.fn().mockImplementation(() => ({
    models: {
      list: vi.fn().mockResolvedValue([{ name: 'gemini-1.5-flash' }])
    }
  }))
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn().mockImplementation(() => ({
    rpc: vi.fn().mockResolvedValue({ error: null }),
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        count: vi.fn().mockReturnValue({ count: 'exact', head: true }),
        then: vi.fn().mockResolvedValue({ error: null })
      })
    })
  }))
}));

vi.mock('ioredis', () => ({
  Redis: vi.fn().mockImplementation(() => ({
    ping: vi.fn().mockResolvedValue('PONG'),
    quit: vi.fn().mockResolvedValue(undefined)
  }))
}));

describe('Health Check Service', () => {
  beforeEach(() => {
    invalidateHealthCache();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('checkHealth', () => {
    it('should return structured health status', async () => {
      process.env.GEMINI_API_KEY = 'test-key';
      process.env.SUPABASE_URL = 'https://test.supabase.co';
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
      delete process.env.REDIS_URL;

      const health = await checkHealth();

      expect(health).toHaveProperty('status');
      expect(health).toHaveProperty('timestamp');
      expect(health).toHaveProperty('services');
      expect(health.services).toHaveProperty('gemini');
      expect(health.services).toHaveProperty('supabase');
      expect(health.services).not.toHaveProperty('redis');
    });

    it('should include Redis when configured', async () => {
      process.env.GEMINI_API_KEY = 'test-key';
      process.env.SUPABASE_URL = 'https://test.supabase.co';
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
      process.env.REDIS_URL = 'redis://localhost:6379';

      const health = await checkHealth();

      expect(health.services).toHaveProperty('redis');
    });

    it('should include latency metrics', async () => {
      process.env.GEMINI_API_KEY = 'test-key';
      process.env.SUPABASE_URL = 'https://test.supabase.co';
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
      delete process.env.REDIS_URL;

      const health = await checkHealth();

      expect(health.services.gemini).toHaveProperty('latency');
      expect(typeof health.services.gemini.latency).toBe('number');
      expect(health.services.gemini.latency).toBeGreaterThanOrEqual(0);
    });

    it('should cache results', async () => {
      process.env.GEMINI_API_KEY = 'test-key';
      process.env.SUPABASE_URL = 'https://test.supabase.co';
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
      delete process.env.REDIS_URL;

      const health1 = await checkHealth();
      const health2 = await checkHealth();

      expect(health1.timestamp).toBe(health2.timestamp);
    });
  });

  describe('invalidateHealthCache', () => {
    it('should invalidate the cache', async () => {
      process.env.GEMINI_API_KEY = 'test-key';
      process.env.SUPABASE_URL = 'https://test.supabase.co';
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
      delete process.env.REDIS_URL;

      const health1 = await checkHealth();
      invalidateHealthCache();
      await new Promise(resolve => setTimeout(resolve, 10)); // Small delay to ensure different timestamp
      const health2 = await checkHealth();

      expect(health1.timestamp).not.toBe(health2.timestamp);
    });
  });
});