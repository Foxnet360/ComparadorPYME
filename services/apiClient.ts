import { supabase } from './authService';
import { API_BASE_URL } from './apiConfig';

export async function getAuthToken(): Promise<string | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const token = session?.access_token ?? null;

  // Proactively refresh when the cached token is expired or about to expire.
  // Supabase auto-refresh runs on a timer and can be missed (sleeping tab,
  // transient network failure), leaving an expired token in storage.
  if (token && isTokenExpiringSoon(token)) {
    return (await refreshAccessToken()) ?? token;
  }

  return token;
}

let refreshPromise: Promise<string | null> | null = null;

/**
 * Serialize concurrent refresh attempts so a burst of parallel API calls
 * triggers a single /auth/v1/token request instead of one per call.
 * Resolves to null when the refresh fails (network, revoked session, etc.).
 */
function refreshAccessToken(): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const { data } = await supabase.auth.refreshSession();
        return data.session?.access_token ?? null;
      } catch {
        return null;
      }
    })().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

const TOKEN_REFRESH_SKEW_MS = 60_000;

function isTokenExpiringSoon(accessToken: string): boolean {
  try {
    const [, payloadPart] = accessToken.split('.');
    if (!payloadPart) return false;
    const payload = JSON.parse(atob(payloadPart)) as { exp?: number };
    if (typeof payload.exp !== 'number') return false;
    return payload.exp * 1000 - Date.now() < TOKEN_REFRESH_SKEW_MS;
  } catch {
    return false;
  }
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

/**
 * Thrown when the API answers 401 and the session could not be recovered
 * (refresh failed or no session exists). Callers can catch this type to
 * prompt login instead of surfacing a generic failure.
 */
export class SessionExpiredError extends Error {
  constructor() {
    super('Sesión expirada. Por favor inicia sesión nuevamente.');
    this.name = 'SessionExpiredError';
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
    let token = await getAuthToken();

    const isRelative = url.startsWith('/api/') || url.startsWith('/');
    // API_BASE_URL already includes /api, so strip the /api prefix for relative API paths.
    const normalizedUrl = isRelative
      ? `${API_BASE_URL}${url.startsWith('/api/') ? url.replace('/api', '') : url}`
      : url;

    const executeFetch = (authToken: string | null): Promise<Response> => {
      const headers: Record<string, string> = { ...(options.headers || {}) };

      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
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

      return fetch(normalizedUrl, {
        ...rest,
        headers,
        signal: controller.signal,
      })
        .catch((error: unknown) => {
          // A caller-initiated abort is propagated as-is; a timeout abort is
          // surfaced as a dedicated ApiTimeoutError.
          if (controller.signal.aborted && !callerSignal?.aborted) {
            throw new ApiTimeoutError(timeoutMs);
          }
          throw error;
        })
        .finally(() => {
          clearTimeout(timeoutTimer);
          callerSignal?.removeEventListener('abort', onCallerAbort);
        });
    };

    let response = await executeFetch(token);

    // Access tokens live ~1h and the client-side copy can be stale (sleeping
    // tab, missed auto-refresh). The backend rejects expired JWTs with 401
    // (AUTH-1), so refresh once and retry before declaring the session dead.
    // A one-shot ReadableStream body cannot be re-sent, so it never retries.
    const canRetry = !(options.body instanceof ReadableStream);
    if (response.status === 401 && token && canRetry) {
      const freshToken = await refreshAccessToken();
      if (freshToken && freshToken !== token) {
        token = freshToken;
        response = await executeFetch(token);
      }
    }

    if (response.status === 401) {
      throw new SessionExpiredError();
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
