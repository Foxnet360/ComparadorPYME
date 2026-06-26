interface FetchWithRetryOptions extends RequestInit {
  retries?: number;
  backoff?: 'exponential' | 'linear' | 'fixed';
  baseDelay?: number;
  timeout?: number;
  retryOn?: number[];
}

interface FetchResult {
  ok: boolean;
  status: number;
  data?: unknown;
  error?: string;
  retriesAttempted: number;
}

/**
 * Fetch con retry automático y circuit breaker simple
 */
export async function fetchWithRetry(
  url: string,
  options: FetchWithRetryOptions = {}
): Promise<FetchResult> {
  const {
    retries = 3,
    backoff = 'exponential',
    baseDelay = 1000,
    timeout = 10000,
    retryOn = [408, 429, 500, 502, 503, 504],
    ...fetchOptions
  } = options;

  let lastError: Error | null = null;
  let retriesAttempted = 0;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(url, {
        ...fetchOptions,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Si la respuesta es exitosa, retornar inmediatamente
      if (response.ok) {
        const data = await response.json().catch(() => null);
        return {
          ok: true,
          status: response.status,
          data,
          retriesAttempted,
        };
      }

      // Si no debe reintentar este código de estado, retornar error
      if (!retryOn.includes(response.status)) {
        const errorText = await response.text().catch(() => 'Unknown error');
        return {
          ok: false,
          status: response.status,
          error: errorText,
          retriesAttempted,
        };
      }

      // Si es el último intento, retornar error
      if (attempt === retries) {
        const errorText = await response.text().catch(() => 'Unknown error');
        return {
          ok: false,
          status: response.status,
          error: errorText,
          retriesAttempted,
        };
      }

      // Calcular delay antes del siguiente retry
      const delay = calculateDelay(attempt, backoff, baseDelay);
      await sleep(delay);
      retriesAttempted++;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error');
      
      if (attempt === retries) {
        return {
          ok: false,
          status: 0,
          error: lastError.message,
          retriesAttempted,
        };
      }

      const delay = calculateDelay(attempt, backoff, baseDelay);
      await sleep(delay);
      retriesAttempted++;
    }
  }

  return {
    ok: false,
    status: 0,
    error: lastError?.message || 'All retries failed',
    retriesAttempted,
  };
}

function calculateDelay(attempt: number, backoff: string, baseDelay: number): number {
  switch (backoff) {
    case 'exponential':
      return baseDelay * Math.pow(2, attempt);
    case 'linear':
      return baseDelay * (attempt + 1);
    case 'fixed':
    default:
      return baseDelay;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
