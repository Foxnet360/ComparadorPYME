import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response } from 'express';

const createMockChain = (finalValue: any = { data: [], error: null, count: 0 }) => {
  const chain: any = vi.fn().mockReturnThis();
  chain.eq = vi.fn().mockReturnThis();
  chain.ilike = vi.fn().mockReturnThis();
  chain.gte = vi.fn().mockReturnThis();
  chain.lte = vi.fn().mockReturnThis();
  chain.order = vi.fn().mockReturnThis();
  chain.range = vi.fn().mockResolvedValue(finalValue);
  return chain;
};

vi.mock('../../config/database', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => createMockChain()),
    })),
  },
}));

import { getReviewQueueCoverages } from '../reviewQueueController';
import { supabase } from '../../config/database';

describe('reviewQueueController.getReviewQueueCoverages', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let jsonMock: ReturnType<typeof vi.fn>;
  let statusMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    jsonMock = vi.fn();
    statusMock = vi.fn().mockReturnValue({ json: jsonMock });
    mockRes = {
      json: jsonMock,
      status: statusMock,
    };
  });

  function setupSupabaseReturn(value: any) {
    const chain = createMockChain(value);
    (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
      select: vi.fn(() => chain),
    });
    return chain;
  }

  it('should return paginated coverages awaiting review', async () => {
    const records = [
      {
        id: 'uuid-1',
        raw_name: 'Cobertura rara A',
        insurer_name: 'SBS',
        domain: 'pyme',
        confidence: 0,
        created_at: '2026-06-10T12:00:00Z',
      },
      {
        id: 'uuid-2',
        raw_name: 'Cobertura rara B',
        insurer_name: 'Bolívar',
        domain: 'pyme',
        confidence: 0.2,
        created_at: '2026-06-09T12:00:00Z',
      },
    ];
    const chain = setupSupabaseReturn({ data: records, error: null, count: 2 });

    mockReq = { query: { page: '1', limit: '20' } };

    await getReviewQueueCoverages(mockReq as Request, mockRes as Response);

    expect(supabase.from).toHaveBeenCalledWith('coverage_mappings');
    expect(chain.eq).toHaveBeenCalledWith('needs_human_review', true);
    expect(chain.range).toHaveBeenCalledWith(0, 19);
    expect(jsonMock).toHaveBeenCalledWith({
      success: true,
      data: [
        {
          id: 'uuid-1',
          rawName: 'Cobertura rara A',
          insurerName: 'SBS',
          domain: 'pyme',
          confidence: 0,
          createdAt: '2026-06-10T12:00:00Z',
        },
        {
          id: 'uuid-2',
          rawName: 'Cobertura rara B',
          insurerName: 'Bolívar',
          domain: 'pyme',
          confidence: 0.2,
          createdAt: '2026-06-09T12:00:00Z',
        },
      ],
      pagination: { page: 1, limit: 20, total: 2 },
    });
  });

  it('should apply insurer, date range and domain filters', async () => {
    const chain = setupSupabaseReturn({ data: [], error: null, count: 0 });

    mockReq = {
      query: {
        insurer: 'SBS',
        from: '2026-06-01',
        to: '2026-06-10',
        domain: 'pyme',
      },
    };

    await getReviewQueueCoverages(mockReq as Request, mockRes as Response);

    expect(chain.ilike).toHaveBeenCalledWith('insurer_name', '%SBS%');
    expect(chain.gte).toHaveBeenCalledWith('created_at', '2026-06-01');
    expect(chain.lte).toHaveBeenCalledWith('created_at', '2026-06-10');
    expect(chain.eq).toHaveBeenCalledWith('domain', 'pyme');
  });

  it('should return empty array and zero total when no entries match', async () => {
    setupSupabaseReturn({ data: [], error: null, count: 0 });

    mockReq = { query: {} };
    await getReviewQueueCoverages(mockReq as Request, mockRes as Response);

    expect(jsonMock).toHaveBeenCalledWith({
      success: true,
      data: [],
      pagination: { page: 1, limit: 20, total: 0 },
    });
  });

  it('should return 500 when the database query fails', async () => {
    setupSupabaseReturn({ data: null, error: { message: 'connection lost' }, count: 0 });

    mockReq = { query: {} };
    await getReviewQueueCoverages(mockReq as Request, mockRes as Response);

    expect(statusMock).toHaveBeenCalledWith(500);
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: 'Failed to query review queue',
      })
    );
  });
});
