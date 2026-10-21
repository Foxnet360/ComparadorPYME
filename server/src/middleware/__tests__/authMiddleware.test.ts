import { describe, it, expect } from 'vitest';
import { Response } from 'express';
import {
  assertProductionJwtSecret,
  requireUser,
  getTenantScope,
  requireRole,
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
