import { describe, it, expect, vi, beforeEach } from 'vitest';
import { disambiguateCoverage } from '../analysisValidationController';
import { learningEngine } from '../../services/learningEngine';

// Mock learningEngine
vi.mock('../../services/learningEngine', () => ({
  learningEngine: {
    saveCorrection: vi.fn().mockResolvedValue('correction-123'),
  },
}));

// Mock supabase
vi.mock('../../config/database', () => ({
  supabase: {
    from: vi.fn().mockReturnValue({
      upsert: vi.fn().mockResolvedValue({ error: null }),
    }),
  },
}));

describe('disambiguateCoverage Controller', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects requests without rawName or action', async () => {
    const req = {
      body: {},
    } as any;
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as any;

    await disambiguateCoverage(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: expect.any(String) }));
  });

  it('successfully confirms a suggested canonical mapping and notifies learningEngine', async () => {
    const req = {
      body: {
        rawName: 'Gastos de Preservación',
        insurerName: 'Chubb',
        canonicalGroupId: 'gastos_extincion',
        action: 'confirm',
      },
    } as any;
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as any;

    await disambiguateCoverage(req, res);

    expect(learningEngine.saveCorrection).toHaveBeenCalledWith(
      expect.objectContaining({
        rawName: 'Gastos de Preservación',
        insurerName: 'Chubb',
        userCorrection: 'gastos_extincion',
      })
    );
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        action: 'confirm',
        resolvedGroupId: 'gastos_extincion',
      })
    );
  });

  it('successfully marks an ambiguous coverage as autonomous/exclusive', async () => {
    const req = {
      body: {
        rawName: 'Amparo Ultra Raro Ciber-Maquinaria',
        insurerName: 'Allianz',
        action: 'keep_autonomous',
      },
    } as any;
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as any;

    await disambiguateCoverage(req, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        action: 'keep_autonomous',
        resolvedGroupId: 'EXCLUSIVE',
      })
    );
  });
});
