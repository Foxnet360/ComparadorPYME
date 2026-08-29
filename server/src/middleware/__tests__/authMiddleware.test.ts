import { describe, it, expect } from 'vitest';
import { assertProductionJwtSecret } from '../auth';

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
