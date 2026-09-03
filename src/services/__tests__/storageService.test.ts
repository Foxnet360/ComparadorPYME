import { describe, it, expect, vi, beforeEach } from 'vitest';
import { storageService } from '../../../services/storageService';
import { apiClient } from '../../../services/apiClient';
import { dbService } from '../../../services/db';
import { authService } from '../../../services/authService';

vi.mock('../../../services/apiClient', () => ({
  apiClient: {
    fetch: vi.fn(),
  },
}));

vi.mock('../../../services/authService', () => ({
  authService: {
    getCurrentUser: vi.fn(),
    signOut: vi.fn(),
    updateProfile: vi.fn(),
  },
}));

vi.mock('../../../services/db', () => ({
  dbService: {
    getAll: vi.fn(),
    clearLegacyUsersStore: vi.fn(),
  },
}));

describe('storageService - local auth persistence removed (ERR-4)', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    globalThis.localStorage.clear();
  });

  it('no longer exposes the legacy local register/login methods', () => {
    const service = storageService as unknown as Record<string, unknown>;
    expect(service.register).toBeUndefined();
    expect(service.login).toBeUndefined();
  });

  it('cleanupLegacyAuthStorage removes legacy auth keys from localStorage', async () => {
    globalThis.localStorage.setItem('seguro_app_user', JSON.stringify({ id: 'legacy' }));
    globalThis.localStorage.setItem('authToken', 'legacy-token');
    globalThis.localStorage.setItem('user', JSON.stringify({ id: 'legacy' }));

    await storageService.cleanupLegacyAuthStorage();

    expect(globalThis.localStorage.getItem('seguro_app_user')).toBeNull();
    expect(globalThis.localStorage.getItem('authToken')).toBeNull();
    expect(globalThis.localStorage.getItem('user')).toBeNull();
  });

  it('cleanupLegacyAuthStorage clears the legacy IndexedDB users store', async () => {
    await storageService.cleanupLegacyAuthStorage();

    expect(dbService.clearLegacyUsersStore).toHaveBeenCalledTimes(1);
  });

  it('getCurrentUser derives from the session and writes no auth keys locally', async () => {
    vi.mocked(authService.getCurrentUser).mockResolvedValue({
      id: 'u1',
      name: 'U',
      email: 'u@example.com',
      role: 'TECHNICAL',
    });

    const user = await storageService.getCurrentUser();

    expect(user?.email).toBe('u@example.com');
    expect(authService.getCurrentUser).toHaveBeenCalledTimes(1);
    expect(globalThis.localStorage.getItem('seguro_app_user')).toBeNull();
    expect(globalThis.localStorage.length).toBe(0);
  });

  it('logout clears the session via the auth service', async () => {
    await storageService.logout();

    expect(authService.signOut).toHaveBeenCalledTimes(1);
    expect(globalThis.localStorage.getItem('seguro_app_user')).toBeNull();
  });
});

describe('storageService - getHistory', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('calls /history without userId query param', async () => {
    vi.mocked(apiClient.fetch).mockResolvedValue({
      json: vi.fn().mockResolvedValue([]),
    } as unknown as Response);

    await storageService.getHistory();

    expect(apiClient.fetch).toHaveBeenCalledWith('/history');
  });

  it('calls /history without userId query param even for a logged-in user (AUTH-2)', async () => {
    globalThis.localStorage.setItem(
      'seguro_app_user',
      JSON.stringify({ id: 'user-1', email: 'u@example.com', name: 'U' })
    );
    vi.mocked(apiClient.fetch).mockResolvedValue({
      json: vi.fn().mockResolvedValue([]),
    } as unknown as Response);

    await storageService.getHistory();

    expect(apiClient.fetch).toHaveBeenCalledWith('/history');
    globalThis.localStorage.clear();
  });

  it('transforms backend history to frontend format', async () => {
    vi.mocked(apiClient.fetch).mockResolvedValue({
      json: vi.fn().mockResolvedValue([
        {
          id: 'hist-1',
          user_id: 'user-1',
          created_at: '2026-07-01T10:00:00Z',
          client_name: 'Cliente A',
          analysis_result: {
            quotes: [
              {
                insurerName: 'MAPFRE',
                score: 85,
                priceAnnual: 1000000,
              },
              {
                insurerName: 'BBVA',
                score: 75,
                priceAnnual: 1200000,
              },
            ],
          },
        },
      ]),
    } as unknown as Response);

    const history = await storageService.getHistory();

    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({
      id: 'hist-1',
      userId: 'user-1',
      date: '2026-07-01',
      clientName: 'Cliente A',
      insurers: ['MAPFRE', 'BBVA'],
      bestOption: 'MAPFRE',
      premiumValue: 1000000,
      status: 'SENT',
    });
  });

  it('falls back to local IndexedDB when backend fails', async () => {
    vi.mocked(apiClient.fetch).mockRejectedValue(new Error('Backend unavailable'));
    vi.mocked(dbService.getAll).mockResolvedValue([]);

    const history = await storageService.getHistory();

    expect(history).toEqual([]);
    expect(dbService.getAll).toHaveBeenCalledWith('history');
  });
});
