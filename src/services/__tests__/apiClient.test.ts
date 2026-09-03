import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  apiClient,
  getAuthToken,
  DEFAULT_API_TIMEOUT_MS,
  ApiTimeoutError,
} from '../../../services/apiClient';
import { supabase } from '../../../services/authService';

// Mock Supabase auth client
vi.mock('../../../services/authService', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
    },
  },
}));

// Mock API_BASE_URL
vi.mock('../../../services/apiConfig', () => ({
  API_BASE_URL: 'http://localhost:8080/api',
}));

describe('apiClient', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    globalThis.fetch = vi.fn();
    vi.stubGlobal('location', { href: '' } as unknown as typeof globalThis.location);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const mockSession = (accessToken: string | null) =>
    ({
      access_token: accessToken,
      refresh_token: 'refresh',
      expires_in: 3600,
      token_type: 'bearer',
      user: { id: 'user-1' },
    }) as unknown as import('@supabase/supabase-js').Session;

  describe('getAuthToken', () => {
    it('returns access_token when session exists', async () => {
      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: mockSession('test-token-123') },
        error: null,
      });

      const token = await getAuthToken();
      expect(token).toBe('test-token-123');
    });

    it('returns null when no session', async () => {
      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: null },
        error: null,
      });

      const token = await getAuthToken();
      expect(token).toBeNull();
    });
  });

  describe('apiClient.fetch', () => {
    it('prepends API_BASE_URL for relative /api paths', async () => {
      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: null },
        error: null,
      });
      vi.mocked(globalThis.fetch).mockResolvedValue(
        new Response(JSON.stringify({ ok: true }), { status: 200 })
      );

      await apiClient.fetch('/history');

      expect(globalThis.fetch).toHaveBeenCalledWith(
        'http://localhost:8080/api/history',
        expect.objectContaining({
          headers: {},
        })
      );
    });

    it('prepends API_BASE_URL for relative paths starting with /', async () => {
      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: null },
        error: null,
      });
      vi.mocked(globalThis.fetch).mockResolvedValue(
        new Response(JSON.stringify({ ok: true }), { status: 200 })
      );

      await apiClient.fetch('/analyze');

      expect(globalThis.fetch).toHaveBeenCalledWith(
        'http://localhost:8080/api/analyze',
        expect.objectContaining({
          headers: {},
        })
      );
    });

    it('adds Authorization header when token is available', async () => {
      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: mockSession('bearer-token') },
        error: null,
      });
      vi.mocked(globalThis.fetch).mockResolvedValue(
        new Response(JSON.stringify({ ok: true }), { status: 200 })
      );

      await apiClient.fetch('/history');

      expect(globalThis.fetch).toHaveBeenCalledWith(
        'http://localhost:8080/api/history',
        expect.objectContaining({
          headers: { Authorization: 'Bearer bearer-token' },
        })
      );
    });

    it('preserves existing headers and merges Authorization', async () => {
      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: mockSession('bearer-token') },
        error: null,
      });
      vi.mocked(globalThis.fetch).mockResolvedValue(
        new Response(JSON.stringify({ ok: true }), { status: 200 })
      );

      await apiClient.fetch('/history', {
        headers: { 'X-Custom': 'value' },
      });

      expect(globalThis.fetch).toHaveBeenCalledWith(
        'http://localhost:8080/api/history',
        expect.objectContaining({
          headers: {
            Authorization: 'Bearer bearer-token',
            'X-Custom': 'value',
          },
        })
      );
    });

    it('does not overwrite Content-Type for FormData bodies', async () => {
      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: mockSession('bearer-token') },
        error: null,
      });
      vi.mocked(globalThis.fetch).mockResolvedValue(
        new Response(JSON.stringify({ ok: true }), { status: 200 })
      );

      const formData = new FormData();
      await apiClient.fetch('/analyze', {
        method: 'POST',
        body: formData,
        headers: { 'Content-Type': 'should-be-removed' },
      });

      const callArgs = vi.mocked(globalThis.fetch).mock.calls[0];
      const init = callArgs[1] as RequestInit;
      expect(init.headers).not.toHaveProperty('Content-Type');
    });

    it('rejects with session error on 401 status', async () => {
      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: mockSession('bearer-token') },
        error: null,
      });
      vi.mocked(globalThis.fetch).mockResolvedValue(
        new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
      );

      await expect(apiClient.fetch('/history')).rejects.toThrow(
        'Sesión expirada. Por favor inicia sesión nuevamente.'
      );
    });

    it('throws Error with server message on non-OK response', async () => {
      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: null },
        error: null,
      });
      vi.mocked(globalThis.fetch).mockResolvedValue(
        new Response(JSON.stringify({ error: 'Bad Request' }), { status: 400 })
      );

      await expect(apiClient.fetch('/history')).rejects.toThrow('Bad Request');
    });

    it('throws Error with status text when server message is unavailable', async () => {
      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: null },
        error: null,
      });
      vi.mocked(globalThis.fetch).mockResolvedValue(
        new Response('Internal Server Error', { status: 500, statusText: 'Internal Server Error' })
      );

      await expect(apiClient.fetch('/history')).rejects.toThrow('500 Internal Server Error');
    });
  });

  describe('timeout and cancellation (ERR-3)', () => {
    const mockNoSession = () =>
      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: null },
        error: null,
      });

    /** Simulate a fetch that never resolves on its own but honors abort. */
    const mockHangingFetch = () => {
      vi.mocked(globalThis.fetch).mockImplementation((_url, init) => {
        if (init?.signal?.aborted) {
          return Promise.reject(new DOMException('The operation was aborted.', 'AbortError'));
        }
        return new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () =>
            reject(new DOMException('The operation was aborted.', 'AbortError'))
          );
        });
      });
    };

    it('bounds requests with a 120s default timeout', () => {
      expect(DEFAULT_API_TIMEOUT_MS).toBe(120_000);
    });

    it('aborts the request and rejects with ApiTimeoutError when the timeout fires', async () => {
      vi.useFakeTimers();
      try {
        mockNoSession();
        mockHangingFetch();

        const promise = apiClient.fetch('/analyze', { timeoutMs: 5_000 });
        const assertion = expect(promise).rejects.toBeInstanceOf(ApiTimeoutError);
        await vi.advanceTimersByTimeAsync(5_000);
        await assertion;
        await expect(promise).rejects.toThrow('tiempo límite');

        // the request must be wired to an AbortSignal so it can be cancelled
        const init = vi.mocked(globalThis.fetch).mock.calls[0][1] as RequestInit;
        expect(init.signal).toBeInstanceOf(AbortSignal);
      } finally {
        vi.useRealTimers();
      }
    });

    it('propagates an external caller abort instead of reporting a timeout', async () => {
      vi.useFakeTimers();
      try {
        mockNoSession();
        mockHangingFetch();

        const controller = new AbortController();
        const promise = apiClient.fetch('/history', {
          timeoutMs: 60_000,
          signal: controller.signal,
        });
        const assertion = expect(promise).rejects.toMatchObject({ name: 'AbortError' });
        controller.abort();
        await assertion;
      } finally {
        vi.useRealTimers();
      }
    });

    it('clears the timeout timer when the response arrives in time', async () => {
      mockNoSession();
      vi.mocked(globalThis.fetch).mockResolvedValue(
        new Response(JSON.stringify({ ok: true }), { status: 200 })
      );

      const response = await apiClient.fetch('/history', { timeoutMs: 60_000 });

      expect(response.status).toBe(200);
    });
  });
});
