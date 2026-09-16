import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Response } from 'express';
import fs from 'fs';

// config/env.ts validates taxonomy constants at module load.
process.env.SMMLV_VALUE = process.env.SMMLV_VALUE || '1423500';
process.env.UVT_VALUE = process.env.UVT_VALUE || '42412';

const getAnalysisHistoryByUser = vi.fn(async (_userId: string): Promise<unknown[]> => []);
const saveAnalysisHistory = vi.fn(async (_insertData: unknown): Promise<string | null> => null);
const loggerError = vi.fn();

vi.mock('../../server/src/config/logger', () => ({
  __esModule: true,
  default: { error: loggerError, warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
  createLogger: vi.fn(() => ({ error: loggerError })),
}));

vi.mock('../../server/src/repositories/analysisRepository', () => ({
  saveAnalysisHistory: (insertData: unknown) => saveAnalysisHistory(insertData),
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

      await analysisController.uploadAndAnalyze(req, res, vi.fn());

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({ error: expect.stringMatching(/userId/i) })
      );
    });

    it('logs and forwards to next(error) when saving the analysis fails (ERR-1)', async () => {
      const { comparisonEngineAdapter } =
        await import('../../server/src/services/unifiedComparison/comparisonEngineAdapter');
      vi.mocked(comparisonEngineAdapter.generateComparison).mockResolvedValue({
        matrix: [],
        quoteMetadata: [],
        engine: 'test-engine',
        correlationId: 'corr-1',
      } as unknown as Awaited<ReturnType<typeof comparisonEngineAdapter.generateComparison>>);
      saveAnalysisHistory.mockRejectedValue(new Error('db connection lost'));

      const tmpFile = `/tmp/err1-quote-${Date.now()}.pdf`;
      fs.writeFileSync(tmpFile, 'fake pdf');
      const { res, jsonMock } = createMockRes();
      const next = vi.fn();
      const req = {
        user: { id: 'user-a' },
        body: {},
        files: { quotes: [{ path: tmpFile, originalname: 'COTIZACION-A.pdf' }] },
      } as unknown as Req;

      await analysisController.uploadAndAnalyze(req, res, next);

      expect(loggerError).toHaveBeenCalled();
      expect(next).toHaveBeenCalledWith(expect.any(Error));
      expect(jsonMock).not.toHaveBeenCalled();
      expect(fs.existsSync(tmpFile)).toBe(false);
    });
  });

  describe('getHistory', () => {
    it('rejects a client-supplied userId query param with 400', async () => {
      const { res, statusMock } = createMockRes();
      const req = { user: { id: 'user-a' }, query: { userId: 'user-b' } } as unknown as Req;

      await analysisController.getHistory(req, res, vi.fn());

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(getAnalysisHistoryByUser).not.toHaveBeenCalled();
    });

    it('scopes history to the authenticated user id', async () => {
      const { res, jsonMock } = createMockRes();
      const req = { user: { id: 'user-a' }, query: {} } as unknown as Req;

      await analysisController.getHistory(req, res, vi.fn());

      expect(getAnalysisHistoryByUser).toHaveBeenCalledWith('user-a');
      expect(jsonMock).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });

    it('keeps the anonymous bucket for unauthenticated requests (allowlisted route)', async () => {
      const { res } = createMockRes();
      const req = { query: {} } as unknown as Req;

      await analysisController.getHistory(req, res, vi.fn());

      expect(getAnalysisHistoryByUser).toHaveBeenCalledWith('anonymous');
    });
  });
});
