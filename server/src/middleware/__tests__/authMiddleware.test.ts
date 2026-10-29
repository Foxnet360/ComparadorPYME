import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { Response } from 'express';
import {
  assertProductionJwtSecret,
  requireUser,
  getTenantScope,
  requireRole,
  authMiddleware,
  optionalAuthMiddleware,
  verifyToken,
  AuthenticatedRequest,
} from '../auth';
import { AuthenticationError } from '../../errors';

describe('assertProductionJwtSecret (SEC-2)', () => {
  it('throws when NODE_ENV is production and SUPABASE_JWT_SECRET is missing', () => {
    expect(() =>
      assertProductionJwtSecret({ NODE_ENV: 'production', SUPABASE_JWT_SECRET: '' })
    ).toThrow(/SUPABASE_JWT_SECRET/);
  });

  it('throws when NODE_ENV is production and SUPABASE_JWT_SECRET is undefined', () => {
    expect(() => assertProductionJwtSecret({ NODE_ENV: 'production' })).toThrow(
      /SUPABASE_JWT_SECRET/
    );
  });

  it('passes in production when SUPABASE_JWT_SECRET is set', () => {
    expect(() =>
      assertProductionJwtSecret({ NODE_ENV: 'production', SUPABASE_JWT_SECRET: 'secret' })
    ).not.toThrow();
  });

  it('passes outside production without SUPABASE_JWT_SECRET (development fallback)', () => {
    expect(() => assertProductionJwtSecret({ NODE_ENV: 'development' })).not.toThrow();
    expect(() => assertProductionJwtSecret({})).not.toThrow();
  });
});

describe('requireUser (AUTH-2)', () => {
  it('returns the authenticated user id', () => {
    const req = { user: { id: 'user-123' } } as AuthenticatedRequest;
    expect(requireUser(req)).toBe('user-123');
  });

  it('throws AuthenticationError when no user is attached', () => {
    const req = {} as AuthenticatedRequest;
    expect(() => requireUser(req)).toThrow(AuthenticationError);
  });

  it('throws AuthenticationError when the user has no id', () => {
    const req = { user: {} } as unknown as AuthenticatedRequest;
    expect(() => requireUser(req)).toThrow(AuthenticationError);
  });
});

describe('getTenantScope', () => {
  it('extracts userId and orgId', () => {
    const req = { user: { id: 'user-123', orgId: 'org-456', role: 'ally_admin' } } as AuthenticatedRequest;
    const scope = getTenantScope(req);
    expect(scope).toEqual({
      userId: 'user-123',
      orgId: 'org-456',
      role: 'ally_admin',
    });
  });
});

describe('requireRole middleware', () => {
  it('rejects unauthenticated requests with 401', () => {
    const guard = requireRole('super_admin');
    const req = {} as AuthenticatedRequest;
    let statusCode = 0;
    let body: unknown = null;
    const res = {
      status: (code: number) => {
        statusCode = code;
        return {
          json: (data: unknown) => {
            body = data;
          },
        };
      },
    } as unknown as Response;
    let nextCalled = false;
    guard(req, res, () => {
      nextCalled = true;
    });

    expect(nextCalled).toBe(false);
    expect(statusCode).toBe(401);
  });

  it('rejects unauthorized roles with 403', () => {
    const guard = requireRole('super_admin', 'ally_admin');
    const req = { user: { id: 'u1', role: 'ally_technical' } } as AuthenticatedRequest;
    let statusCode = 0;
    const res = {
      status: (code: number) => {
        statusCode = code;
        return {
          json: () => {},
        };
      },
    } as unknown as Response;
    let nextCalled = false;
    guard(req, res, () => {
      nextCalled = true;
    });

    expect(nextCalled).toBe(false);
    expect(statusCode).toBe(403);
  });

  it('allows authorized roles through', () => {
    const guard = requireRole('super_admin', 'ally_admin');
    const req = { user: { id: 'u1', role: 'ally_admin' } } as AuthenticatedRequest;
    const res = {} as Response;
    let nextCalled = false;
    guard(req, res, () => {
      nextCalled = true;
    });

    expect(nextCalled).toBe(true);
  });
});

describe('authMiddleware and verifyToken', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('rejects request with missing Authorization header', async () => {
    const req = { headers: {} } as AuthenticatedRequest;
    const res = {} as Response;
    let err: unknown;

    await authMiddleware(req, res, (e) => {
      err = e;
    });

    expect(err).toBeInstanceOf(AuthenticationError);
  });

  it('verifies valid HS256 JWT when SUPABASE_JWT_SECRET is configured', async () => {
    const secret = 'test-secret-12345';
    process.env.SUPABASE_JWT_SECRET = secret;

    const token = jwt.sign(
      { sub: 'user-hs256', email: 'test@csa.com', role: 'super_admin' },
      secret,
      { algorithm: 'HS256' }
    );

    const req = {
      headers: { authorization: `Bearer ${token}` },
    } as AuthenticatedRequest;
    const res = {} as Response;
    let err: unknown;

    await authMiddleware(req, res, (e) => {
      err = e;
    });

    expect(err).toBeUndefined();
    expect(req.user?.id).toBe('user-hs256');
    expect(req.user?.email).toBe('test@csa.com');
    expect(req.user?.role).toBe('super_admin');
  });

  it('verifies valid ES256 JWT with mocked JWKS public key', async () => {
    // Generate EC keypair for ES256
    const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', {
      namedCurve: 'prime256v1',
    });
    const jwk = publicKey.export({ format: 'jwk' });
    const kid = 'test-ec-kid-123';

    // Mock fetch for JWKS endpoint
    process.env.SUPABASE_URL = 'https://mock.supabase.co';
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        keys: [{ ...jwk, kid, kty: 'EC', alg: 'ES256' }],
      }),
    } as unknown as globalThis.Response);

    const token = jwt.sign(
      { sub: 'user-es256', email: 'claudia@csa.com', role: 'super_admin' },
      privateKey,
      { algorithm: 'ES256', keyid: kid }
    );

    const req = {
      headers: { authorization: `Bearer ${token}` },
    } as AuthenticatedRequest;
    const res = {} as Response;
    let err: unknown;

    await authMiddleware(req, res, (e) => {
      err = e;
    });

    expect(err).toBeUndefined();
    expect(req.user?.id).toBe('user-es256');
    expect(req.user?.email).toBe('claudia@csa.com');
    expect(req.user?.role).toBe('super_admin');
  });

  it('optionalAuthMiddleware attaches user when valid token provided', async () => {
    const secret = 'test-secret-12345';
    process.env.SUPABASE_JWT_SECRET = secret;

    const token = jwt.sign(
      { sub: 'optional-user', email: 'opt@csa.com', role: 'ally_admin' },
      secret,
      { algorithm: 'HS256' }
    );

    const req = {
      headers: { authorization: `Bearer ${token}` },
    } as AuthenticatedRequest;
    const res = {} as Response;

    await optionalAuthMiddleware(req, res, () => {});

    expect(req.user?.id).toBe('optional-user');
    expect(req.user?.role).toBe('ally_admin');
  });

  it('optionalAuthMiddleware continues anonymously without error when token missing', async () => {
    const req = { headers: {} } as AuthenticatedRequest;
    const res = {} as Response;
    let nextCalled = false;

    await optionalAuthMiddleware(req, res, () => {
      nextCalled = true;
    });

    expect(nextCalled).toBe(true);
    expect(req.user).toBeUndefined();
  });
});
