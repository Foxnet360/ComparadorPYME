import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('database.ts lazy initialization', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    // Restore env vars
    Object.keys(process.env).forEach((key) => {
      if (!(key in originalEnv)) {
        delete process.env[key];
      }
    });
    Object.assign(process.env, originalEnv);
  });

  it('should import successfully when env vars are missing', async () => {
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.SUPABASE_ANON_KEY;

    const db = await import('../database');
    expect(db.supabase).toBeDefined();
    expect(db.supabaseAnon).toBeDefined();
    expect(db.createSupabaseClient).toBeDefined();
    expect(db.createSupabaseAnonClient).toBeDefined();
  });

  it('should throw descriptive error on first .from access when env vars are missing', async () => {
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;

    const db = await import('../database');
    expect(() => db.supabase.from('test')).toThrow(
      /SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required/
    );
  });

  it('should throw descriptive error on first .rpc access when env vars are missing', async () => {
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;

    const db = await import('../database');
    expect(() => (db.supabase as { rpc: (name: string) => unknown }).rpc('test_fn')).toThrow(
      /SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required/
    );
  });

  it('should throw descriptive error on first .auth access when env vars are missing', async () => {
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;

    const db = await import('../database');
    expect(() => db.supabase.auth).toThrow(
      /SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required/
    );
  });

  it('should create client on first .from access when env vars are present', async () => {
    process.env.SUPABASE_URL = 'https://test-project.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';

    const db = await import('../database');
    const fromResult = db.supabase.from('test');
    expect(fromResult).toBeDefined();
    expect(typeof fromResult.select).toBe('function');
  });

  it('should support .rpc access through the Proxy when env vars are present', async () => {
    process.env.SUPABASE_URL = 'https://test-project.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';

    const db = await import('../database');
    const rpcResult = (db.supabase as { rpc: (name: string) => unknown }).rpc('test_fn');
    expect(rpcResult).toBeDefined();
  });

  it('should support .auth access through the Proxy when env vars are present', async () => {
    process.env.SUPABASE_URL = 'https://test-project.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';

    const db = await import('../database');
    const auth = db.supabase.auth;
    expect(auth).toBeDefined();
    expect(typeof auth.getUser).toBe('function');
  });

  it('should create Supabase client only once across multiple accesses', async () => {
    process.env.SUPABASE_URL = 'https://test-project.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';

    const db = await import('../database');

    // Access auth object multiple times; same reference proves singleton
    const auth1 = db.supabase.auth;
    const auth2 = db.supabase.auth;
    const auth3 = db.supabase.auth;

    expect(auth1).toBe(auth2);
    expect(auth2).toBe(auth3);
  });

  it('should return null-like supabaseAnon when SUPABASE_ANON_KEY is missing', async () => {
    delete process.env.SUPABASE_ANON_KEY;
    process.env.SUPABASE_URL = 'https://test-project.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';

    const db = await import('../database');
    // Proxy itself is defined; accessing methods returns undefined
    expect(db.supabaseAnon).toBeDefined();
    expect((db.supabaseAnon as { from?: (table: string) => unknown })?.from).toBeUndefined();
  });

  it('should create supabaseAnon client on first access when SUPABASE_ANON_KEY is present', async () => {
    process.env.SUPABASE_URL = 'https://test-project.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
    process.env.SUPABASE_ANON_KEY = 'test-anon-key';

    const db = await import('../database');
    const fromResult = (db.supabaseAnon as { from: (table: string) => unknown })?.from('test');
    expect(fromResult).toBeDefined();
    expect(typeof (fromResult as { select?: unknown }).select).toBe('function');
  });
});
