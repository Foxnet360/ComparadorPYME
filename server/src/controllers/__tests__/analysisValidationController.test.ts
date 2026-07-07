import { describe, it, expect, vi } from 'vitest';
import { exportAnalysisExcel } from '../analysisValidationController';
import { getAnalysisById } from '../../repositories/analysisRepository';
import { generateExcelBuffer } from '../../services/excelGenerator';

vi.mock('../../repositories/analysisRepository', () => ({
  getAnalysisById: vi.fn(),
}));

vi.mock('../../services/excelGenerator', () => ({
  generateExcelBuffer: vi.fn(async () => Buffer.from('mock-excel')),
}));

function createMockRes() {
  const res: any = {};
  res.status = vi.fn(() => res);
  res.json = vi.fn(() => res);
  res.setHeader = vi.fn(() => res);
  res.send = vi.fn(() => res);
  return res as {
    status: ReturnType<typeof vi.fn>;
    json: ReturnType<typeof vi.fn>;
    setHeader: ReturnType<typeof vi.fn>;
    send: ReturnType<typeof vi.fn>;
  };
}

describe('analysisValidationController - exportAnalysisExcel', () => {
  it('should allow export when user is not authenticated and analysis has no owner', async () => {
    getAnalysisById.mockResolvedValueOnce({
      id: 'test-id',
      user_id: null,
      client_name: 'Test Client',
      analysis_result: {
        quotes: [
          {
            insurerName: 'MAPFRE',
            policyName: 'PYME',
            priceAnnual: 8500000,
            currency: 'COP',
            coverages: [{ name: 'Incendio', value: '500M', deductible: '10%' }],
            alerts: [],
          },
        ],
      },
    } as any);

    const req = { params: { id: 'test-id' } } as any;
    const res = createMockRes();

    await exportAnalysisExcel(req, res);

    expect(generateExcelBuffer).toHaveBeenCalled();
    expect(res.setHeader).toHaveBeenCalledWith(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    expect(res.send).toHaveBeenCalledWith(Buffer.from('mock-excel'));
  });

  it('should return 404 when analysis is not found', async () => {
    getAnalysisById.mockResolvedValueOnce(null);

    const req = { params: { id: 'missing-id' }, user: { id: 'test-user-123' } } as any;
    const res = createMockRes();

    await exportAnalysisExcel(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('should return 403 when analysis belongs to another user', async () => {
    getAnalysisById.mockResolvedValueOnce({
      id: 'test-id',
      user_id: 'other-user-456',
      client_name: 'Test Client',
      analysis_result: { quotes: [] },
    } as any);

    const req = { params: { id: 'test-id' }, user: { id: 'test-user-123' } } as any;
    const res = createMockRes();

    await exportAnalysisExcel(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.stringContaining('Forbidden') })
    );
  });

  it('should export Excel for the owner', async () => {
    getAnalysisById.mockResolvedValueOnce({
      id: 'test-id',
      user_id: 'test-user-123',
      client_name: 'Test Client',
      analysis_result: {
        quotes: [
          {
            insurerName: 'MAPFRE',
            policyName: 'PYME',
            priceAnnual: 8500000,
            currency: 'COP',
            coverages: [{ name: 'Incendio', value: '500M', deductible: '10%' }],
            alerts: [],
          },
        ],
      },
    } as any);

    const req = { params: { id: 'test-id' }, user: { id: 'test-user-123' } } as any;
    const res = createMockRes();

    await exportAnalysisExcel(req, res);

    expect(generateExcelBuffer).toHaveBeenCalled();
    expect(res.setHeader).toHaveBeenCalledWith(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    expect(res.send).toHaveBeenCalledWith(Buffer.from('mock-excel'));
  });
});
