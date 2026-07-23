import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Response } from 'express';
import fs from 'fs';
import path from 'path';
import {
  analysisController,
  resolveAnalysisDomain,
} from '../analysisController';
import type { AuthenticatedRequest } from '../../middleware/auth';

vi.mock('../../services/unifiedComparison/comparisonEngineAdapter', () => ({
  comparisonEngineAdapter: {
    generateComparison: vi.fn(),
  },
}));

vi.mock('../../repositories/analysisRepository', () => ({
  saveAnalysisHistory: vi.fn().mockResolvedValue('hist-123'),
  getAnalysisHistoryByUser: vi.fn().mockResolvedValue([]),
}));

import { comparisonEngineAdapter } from '../../services/unifiedComparison/comparisonEngineAdapter';
import { saveAnalysisHistory } from '../../repositories/analysisRepository';

function makeReq(
  overrides: Partial<AuthenticatedRequest> & { files?: Record<string, Express.Multer.File[]> } = {}
): AuthenticatedRequest {
  return {
    user: undefined,
    body: {},
    files: {},
    ...overrides,
  } as AuthenticatedRequest;
}

function makeRes(): Response {
  const res = {} as Response;
  res.status = vi.fn(() => res) as unknown as Response['status'];
  res.json = vi.fn(() => res) as unknown as Response['json'];
  return res;
}

describe('resolveAnalysisDomain', () => {
  it('defaults missing/empty values to pyme', () => {
    expect(resolveAnalysisDomain(undefined).domain).toBe('pyme');
    expect(resolveAnalysisDomain(undefined).error).toBeUndefined();
    expect(resolveAnalysisDomain('').domain).toBe('pyme');
  });

  it('accepts pyme and autos', () => {
    expect(resolveAnalysisDomain('pyme').domain).toBe('pyme');
    expect(resolveAnalysisDomain('autos').domain).toBe('autos');
  });

  it('returns an error for invalid domains', () => {
    const result = resolveAnalysisDomain('salud');
    expect(result.domain).toBe('pyme');
    expect(result.error).toContain('Invalid domain');
  });
});

describe('analysisController.uploadAndAnalyze - domain contract', () => {
  const tmpFile = path.join('/tmp', `test-quote-${Date.now()}.pdf`);

  beforeEach(() => {
    fs.writeFileSync(tmpFile, 'fake pdf content');
    vi.mocked(comparisonEngineAdapter.generateComparison).mockResolvedValue({
      matrix: [],
      engine: 'unified',
      schemaVersion: 1,
      correlationId: 'corr-domain-test',
      graphEnabled: false,
      templateHintsEnabled: false,
      domain: 'autos',
    });
    vi.mocked(saveAnalysisHistory).mockResolvedValue('hist-123');
  });

  afterEach(() => {
    vi.restoreAllMocks();
    try {
      fs.unlinkSync(tmpFile);
    } catch {
      // ignore
    }
  });

  it('returns 400 for an invalid domain before running the engine', async () => {
    const req = makeReq({
      body: { domain: 'salud' },
      files: {
        quotes: [{ path: tmpFile, originalname: 'COTIZACION-TEST.pdf' }],
      },
    });
    const res = makeRes();

    await analysisController.uploadAndAnalyze(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.stringContaining('Invalid domain'),
      })
    );
    expect(comparisonEngineAdapter.generateComparison).not.toHaveBeenCalled();
  });

  it('defaults to pyme when domain is omitted and echoes it in the response', async () => {
    const req = makeReq({
      files: {
        quotes: [{ path: tmpFile, originalname: 'COTIZACION-TEST.pdf' }],
      },
    });
    const res = makeRes();

    await analysisController.uploadAndAnalyze(req, res);

    expect(comparisonEngineAdapter.generateComparison).toHaveBeenCalledWith(
      [tmpFile],
      expect.objectContaining({ domain: 'pyme' })
    );
    const responseBody = vi.mocked(res.json).mock.calls[0][0];
    expect(responseBody.domain).toBe('pyme');
  });

  it('accepts autos, passes it to the adapter, and echoes it in the response', async () => {
    const req = makeReq({
      body: { domain: 'autos' },
      files: {
        quotes: [{ path: tmpFile, originalname: 'COTIZACION-TEST.pdf' }],
      },
    });
    const res = makeRes();

    await analysisController.uploadAndAnalyze(req, res);

    expect(comparisonEngineAdapter.generateComparison).toHaveBeenCalledWith(
      [tmpFile],
      expect.objectContaining({ domain: 'autos' })
    );
    const responseBody = vi.mocked(res.json).mock.calls[0][0];
    expect(responseBody.domain).toBe('autos');
  });
});
