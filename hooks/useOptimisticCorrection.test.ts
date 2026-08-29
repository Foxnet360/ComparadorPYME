import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useOptimisticCorrection } from './useOptimisticCorrection';
import { CorrectionQueue } from '../services/correctionQueue';
import { apiClient } from '../services/apiClient';

vi.mock('../services/apiClient', () => ({
  apiClient: {
    fetch: vi.fn(),
  },
}));

vi.mock('../services/correctionQueue', () => ({
  CorrectionQueue: {
    add: vi.fn().mockReturnValue('queue-id-1'),
  },
}));

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

const correction = {
  rawName: 'Incendio',
  insurerName: 'MAPFRE',
  systemMapping: 'fire',
  userCorrection: 'fire_and_explosion',
};

describe('useOptimisticCorrection (AUTH-1: correction POST goes through apiClient)', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(CorrectionQueue.add).mockReturnValue('queue-id-1');
  });

  it('submits online corrections through apiClient with default correctionType', async () => {
    vi.mocked(apiClient.fetch).mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ id: 'server-id-1', success: true }),
    } as unknown as Response);

    const { result } = renderHook(() => useOptimisticCorrection());

    let outcome;
    await act(async () => {
      outcome = await result.current.submitCorrection(correction);
    });

    expect(apiClient.fetch).toHaveBeenCalledWith(
      '/analysis/correction',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ ...correction, correctionType: 'coverage_mapping' }),
      })
    );
    expect(mockFetch).not.toHaveBeenCalled();
    expect(outcome).toEqual({ success: true, id: 'server-id-1' });
  });

  it('returns a failure when the API rejects the correction (e.g. 401 session expired)', async () => {
    vi.mocked(apiClient.fetch).mockRejectedValue(new Error('Sesión expirada.'));

    const { result } = renderHook(() => useOptimisticCorrection());

    let outcome;
    await act(async () => {
      outcome = await result.current.submitCorrection(correction);
    });

    expect(outcome).toEqual({ success: false, error: 'Sesión expirada.' });
  });
});
