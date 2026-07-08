import { supabase } from './authService';
import { API_BASE_URL } from './apiConfig';

export async function getAuthToken(): Promise<string | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

export interface ApiClientOptions extends RequestInit {
  headers?: Record<string, string>;
}

export const apiClient = {
  fetch: async (url: string, options: ApiClientOptions = {}): Promise<Response> => {
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

    const response = await fetch(normalizedUrl, {
      ...options,
      headers,
    });

    if (response.status === 401) {
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
      return Promise.reject(new Error('Sesión expirada. Por favor inicia sesión nuevamente.'));
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
