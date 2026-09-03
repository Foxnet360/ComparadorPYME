import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  auth: {
    signInWithPassword: vi.fn(),
    signOut: vi.fn(),
    getUser: vi.fn(),
    updateUser: vi.fn(),
    resetPasswordForEmail: vi.fn(),
    onAuthStateChange: vi.fn(),
  },
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({ auth: mocks.auth })),
}));

import { authService } from '../../../services/authService';

/**
 * ERR-4: no auth data may be persisted in localStorage/IndexedDB. The
 * session lives in the Supabase client; legacy local copies were removed.
 */

describe('authService local persistence removed (ERR-4)', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    globalThis.localStorage.clear();
  });

  const supabaseUser = {
    id: 'user-1',
    email: 'u@example.com',
    user_metadata: { name: 'Usuario Uno', role: 'ally_admin' },
  };

  it('signIn establishes the session without writing auth data to localStorage', async () => {
    mocks.auth.signInWithPassword.mockResolvedValue({ data: { user: supabaseUser }, error: null });

    const profile = await authService.signIn('u@example.com', 'secret');

    expect(profile.email).toBe('u@example.com');
    expect(globalThis.localStorage.getItem('seguro_app_user')).toBeNull();
    expect(globalThis.localStorage.length).toBe(0);
  });

  it('signOut clears the session without touching local auth keys', async () => {
    mocks.auth.signOut.mockResolvedValue({ error: null });

    await authService.signOut();

    expect(mocks.auth.signOut).toHaveBeenCalled();
    expect(globalThis.localStorage.getItem('seguro_app_user')).toBeNull();
  });

  it('getCurrentUser ignores legacy local copies and relies on the session only', async () => {
    globalThis.localStorage.setItem(
      'seguro_app_user',
      JSON.stringify({ id: 'legacy', email: 'legacy@example.com' })
    );
    mocks.auth.getUser.mockResolvedValue({ data: { user: null }, error: null });

    const profile = await authService.getCurrentUser();

    expect(profile).toBeNull();
    expect(globalThis.localStorage.getItem('seguro_app_user')).toBe(
      JSON.stringify({ id: 'legacy', email: 'legacy@example.com' })
    );
  });

  it('onAuthStateChange does not persist the profile locally on SIGNED_IN', async () => {
    let handler: ((event: string, session: { user: unknown } | null) => void) | undefined;
    mocks.auth.onAuthStateChange.mockImplementation(
      (cb: typeof handler & ((event: string, session: { user: unknown } | null) => void)) => {
        handler = cb;
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      }
    );

    authService.onAuthStateChange(() => undefined);
    handler?.('SIGNED_IN', { user: supabaseUser });

    expect(globalThis.localStorage.getItem('seguro_app_user')).toBeNull();
  });
});
