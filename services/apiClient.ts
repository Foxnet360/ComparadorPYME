import { supabase } from './authService';
import { API_BASE_URL } from './apiConfig';

export async function getAuthToken(): Promise<string | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

/**
 * ERR-3: upper bound for every API call. The /analyze upload can be slow, so
 * the default is generous (120s) — but every request is cancellable and will
 * never hang forever.
 */
export const DEFAULT_API_TIMEOUT_MS = 120_000;

export class ApiTimeoutError extends Error {
  readonly code = 'API_TIMEOUT';
  readonly timeoutMs: number;

  constructor(timeoutMs: number) {
    super(`La solicitud excedió el tiempo límite de ${Math.round(timeoutMs / 1000)}s.`);
    this.name = 'ApiTimeoutError';
    this.timeoutMs = timeoutMs;
  }
}

export interface ApiClientOptions extends RequestInit {
  headers?: Record<string, string>;
  /** Per-request timeout override. Defaults to DEFAULT_API_TIMEOUT_MS. */
  timeoutMs?: number;
}

export const apiClient = {
  fetch: async (url: string, options: ApiClientOptions = {}): Promise<Response> => {
    const { timeoutMs = DEFAULT_API_TIMEOUT_MS, signal: callerSignal, ...rest } = options;
    const token = await getAuthToken();

    const isRelative = url.startsWith('/api/') || url.startsWith('/');
    // API_BASE_URL already includes /api, so strip the /api prefix for relative API paths.
    const normalizedUrl = isRelative
      ? `${API_BASE_URL}${url.startsWith('/api/') ? url.replace('/api', '') : url}`
      : url;

    const headers: Record<string, string> = { ...(options.headers || {}) };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    // Don't set Content-Type for FormData; let the browser set it with boundary.
    if (options.body instanceof FormData) {
      delete headers['Content-Type'];
    }

    const controller = new AbortController();
    const onCallerAbort = () => controller.abort();
    if (callerSignal) {
      if (callerSignal.aborted) {
        controller.abort();
      } else {
        callerSignal.addEventListener('abort', onCallerAbort, { once: true });
      }
    }
    const timeoutTimer = setTimeout(() => controller.abort(), timeoutMs);

    let response: Response;
    try {
      response = await fetch(normalizedUrl, {
        ...rest,
        headers,
        signal: controller.signal,
      });
    } catch (error: unknown) {
      // A caller-initiated abort is propagated as-is; a timeout abort is
      // surfaced as a dedicated ApiTimeoutError.
      if (controller.signal.aborted && !callerSignal?.aborted) {
        throw new ApiTimeoutError(timeoutMs);
      }
      throw error;
    } finally {
      clearTimeout(timeoutTimer);
      callerSignal?.removeEventListener('abort', onCallerAbort);
    }

    if (response.status === 401) {
      throw new Error('Sesión expirada. Por favor inicia sesión nuevamente.');
    }

    if (!response.ok) {
      let message = `${response.status} ${response.statusText}`;
      try {
        const data = await response.json();
        if (data?.error) {
          message = data.error;
        } else if (typeof data?.message === 'string') {
          message = data.message;
        }
      } catch {
        // Ignore parse errors and fall back to status text
      }
      throw new Error(message);
    }

    return response;
  },
};
