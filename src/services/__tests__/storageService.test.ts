import { describe, it, expect, vi, beforeEach } from 'vitest';
import { storageService } from '../../../services/storageService';
import { apiClient } from '../../../services/apiClient';
import { dbService } from '../../../services/db';

vi.mock('../../../services/apiClient', () => ({
  apiClient: {
    fetch: vi.fn(),
  },
}));

vi.mock('../../../services/db', () => ({
  dbService: {
    getAll: vi.fn(),
  },
}));

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
