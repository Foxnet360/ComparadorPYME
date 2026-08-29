/**
 * SEC-2: CORS configuration (fail-closed).
 * Only origins explicitly listed via CORS_ORIGINS (JSON array) are allowed.
 * Defaults cover local development only; production deployments MUST set
 * CORS_ORIGINS to their real frontend origins.
 */

const DEFAULT_ORIGINS = ['http://localhost:3000', 'http://localhost:8080'];

export const getCorsOrigins = (env: NodeJS.ProcessEnv = process.env): string[] => {
  if (!env.CORS_ORIGINS) {
    return DEFAULT_ORIGINS;
  }

  try {
    const parsed: unknown = JSON.parse(env.CORS_ORIGINS);
    if (Array.isArray(parsed) && parsed.every((origin) => typeof origin === 'string')) {
      return parsed as string[];
    }
    console.warn('⚠️ [CORS] CORS_ORIGINS is not a valid JSON string array, using defaults');
    return DEFAULT_ORIGINS;
  } catch (error) {
    console.error('❌ [CORS] Failed to parse CORS_ORIGINS:', error);
    return DEFAULT_ORIGINS;
  }
};

type CorsOriginCallback = (err: Error | null, allow?: boolean) => void;

/**
 * Returns a CORS origin callback that rejects disallowed origins with an
 * error instead of silently omitting CORS headers.
 * Requests without an Origin header (server-to-server, same-origin, curl)
 * are allowed since CORS does not apply to them.
 */
export const createCorsOrigin = (allowedOrigins: string[]) => {
  return (origin: string | undefined, callback: CorsOriginCallback): void => {
    if (!origin) {
      callback(null, true);
      return;
    }
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error(`Origin not allowed by CORS: ${origin}`));
  };
};
