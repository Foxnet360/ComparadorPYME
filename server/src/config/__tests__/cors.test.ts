import { describe, it, expect, vi } from 'vitest';
import { createCorsOrigin, getCorsOrigins } from '../cors';

describe('getCorsOrigins (SEC-2)', () => {
  it('uses safe local defaults when CORS_ORIGINS is not set', () => {
    expect(getCorsOrigins({})).toEqual(['http://localhost:3000', 'http://localhost:8080']);
  });

  it('parses a JSON array from CORS_ORIGINS', () => {
    expect(getCorsOrigins({ CORS_ORIGINS: '["https://app.example.com"]' })).toEqual([
      'https://app.example.com',
    ]);
  });

  it('falls back to defaults when CORS_ORIGINS is invalid JSON', () => {
    expect(getCorsOrigins({ CORS_ORIGINS: 'not-json' })).toEqual([
      'http://localhost:3000',
      'http://localhost:8080',
    ]);
  });

  it('falls back to defaults when CORS_ORIGINS is not an array of strings', () => {
    expect(getCorsOrigins({ CORS_ORIGINS: '{"origin":"x"}' })).toEqual([
      'http://localhost:3000',
      'http://localhost:8080',
    ]);
  });
});

describe('createCorsOrigin (SEC-2, fail-closed)', () => {
  const origin = createCorsOrigin(['https://app.example.com']);

  it('allows a listed origin', () => {
    const callback = vi.fn();
    origin('https://app.example.com', callback);
    expect(callback).toHaveBeenCalledWith(null, true);
  });

  it('rejects a disallowed origin with an error', () => {
    const callback = vi.fn();
    origin('https://evil.example.com', callback);
    expect(callback).toHaveBeenCalledWith(expect.any(Error));
  });

  it('allows requests without an Origin header (server-to-server, same-origin)', () => {
    const callback = vi.fn();
    origin(undefined, callback);
    expect(callback).toHaveBeenCalledWith(null, true);
  });
});
