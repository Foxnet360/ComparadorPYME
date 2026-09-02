import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Response } from 'express';

// config/env.ts validates taxonomy constants at module load.
process.env.SMMLV_VALUE = process.env.SMMLV_VALUE || '1300000';
process.env.UVT_VALUE = process.env.UVT_VALUE || '42412';

const getAnalysisHistoryByUser = vi.fn(async (_userId: string): Promise<unknown[]> => []);

vi.mock('../../server/src/repositories/analysisRepository', () => ({
  saveAnalysisHistory: vi.fn(async () => null),
  getAnalysisHistoryByUser: (userId: string) => getAnalysisHistoryByUser(userId),
}));

vi.mock('../../server/src/services/unifiedComparison/comparisonEngineAdapter', () => ({
  comparisonEngineAdapter: { generateComparison: vi.fn() },
}));

const { analysisController, resolveAnalysisUserId } =
  await import('../../server/src/controllers/analysisController');

import type { AuthenticatedRequest as Req } from '../../server/src/middleware/auth';

function createMockRes() {
  const jsonMock = vi.fn();
  const statusMock = vi.fn().mockReturnValue({ json: jsonMock });
  return {
    res: { status: statusMock, json: jsonMock } as unknown as Response,
    jsonMock,
    statusMock,
  };
}

describe('analysisController ownership (AUTH-2)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('resolveAnalysisUserId', () => {
    it('trusts only the authenticated session user', () => {
      const req = { user: { id: 'user-a' }, body: {} } as Req;
      expect(resolveAnalysisUserId(req)).toBe('user-a');
    });

    it('ignores a body userId for anonymous traffic (anti-spoofing)', () => {
      const req = { body: { userId: 'user-b' } } as Req;
      expect(resolveAnalysisUserId(req)).toBe('anonymous');
    });
  });

  describe('uploadAndAnalyze', () => {
    it('rejects a client-supplied userId with 400', async () => {
      const { res, statusMock, jsonMock } = createMockRes();
      const req = { user: { id: 'user-a' }, body: { userId: 'user-b' } } as Req;

      await analysisController.uploadAndAnalyze(req, res);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({ error: expect.stringMatching(/userId/i) })
      );
    });
  });

  describe('getHistory', () => {
    it('rejects a client-supplied userId query param with 400', async () => {
      const { res, statusMock } = createMockRes();
      const req = { user: { id: 'user-a' }, query: { userId: 'user-b' } } as unknown as Req;

      await analysisController.getHistory(req, res);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(getAnalysisHistoryByUser).not.toHaveBeenCalled();
    });

    it('scopes history to the authenticated user id', async () => {
      const { res, jsonMock } = createMockRes();
      const req = { user: { id: 'user-a' }, query: {} } as unknown as Req;

      await analysisController.getHistory(req, res);

      expect(getAnalysisHistoryByUser).toHaveBeenCalledWith('user-a');
      expect(jsonMock).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });

    it('keeps the anonymous bucket for unauthenticated requests (allowlisted route)', async () => {
      const { res } = createMockRes();
      const req = { query: {} } as unknown as Req;

      await analysisController.getHistory(req, res);

      expect(getAnalysisHistoryByUser).toHaveBeenCalledWith('anonymous');
    });
  });
});
