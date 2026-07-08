import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { apiClient, getAuthToken } from '../../../services/apiClient';
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
    } as unknown as import('@supabase/supabase-js').Session);

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

    it('redirects to /login on 401 and rejects with session error', async () => {
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
      expect(globalThis.location.href).toBe('/login');
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
});
