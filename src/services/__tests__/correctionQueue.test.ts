import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CorrectionQueue } from '../../../services/correctionQueue';
import { apiClient } from '../../../services/apiClient';

vi.mock('../../../services/apiClient', () => ({
  apiClient: {
    fetch: vi.fn(),
  },
}));

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

const correction = {
  rawName: 'Incendio',
  insurerName: 'MAPFRE',
  systemMapping: 'fire',
  userCorrection: 'fire_and_explosion',
  correctionType: 'coverage_mapping' as const,
};

describe('CorrectionQueue.sync (AUTH-1: corrections go through apiClient with Bearer token)', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    globalThis.localStorage.clear();
  });

  it('sends pending corrections through apiClient and removes them on success', async () => {
    vi.mocked(apiClient.fetch).mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ id: 'c1', success: true }),
    } as unknown as Response);
    const id = CorrectionQueue.add(correction);

    const result = await CorrectionQueue.sync();

    expect(apiClient.fetch).toHaveBeenCalledWith(
      '/analysis/correction',
      expect.objectContaining({ method: 'POST' })
    );
    expect(mockFetch).not.toHaveBeenCalled();
    expect(result.success).toEqual([id]);
    expect(CorrectionQueue.getPending()).toHaveLength(0);
  });

  it('marks corrections as error when the API rejects them', async () => {
    vi.mocked(apiClient.fetch).mockRejectedValue(
      new Error('Sesión expirada. Por favor inicia sesión nuevamente.')
    );
    const id = CorrectionQueue.add(correction);

    const result = await CorrectionQueue.sync();

    expect(result.failed).toEqual([id]);
    expect(CorrectionQueue.getAll()[0].status).toBe('error');
    expect(CorrectionQueue.getAll()[0].error).toContain('Sesión expirada');
  });
});
