import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response } from 'express';

// Mock modules
vi.mock('../../services/documentIndexingService', () => ({
  documentIndexingService: {
    indexDocument: vi.fn(),
    getOrCreateInsurer: vi.fn().mockResolvedValue('insurer-123'),
  },
  DocumentIndexingService: vi.fn(),
}));

interface MockChain {
  (...args: unknown[]): unknown;
  eq: ReturnType<typeof vi.fn>;
  is: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
  limit: ReturnType<typeof vi.fn>;
  single: ReturnType<typeof vi.fn>;
}

const createMockChain = (finalValue: Record<string, unknown> = { data: null, error: null }) => {
  const chain: MockChain = vi.fn().mockReturnThis() as unknown as MockChain;
  chain.eq = vi.fn().mockReturnThis();
  chain.is = vi.fn().mockReturnThis();
  chain.order = vi.fn().mockReturnThis();
  chain.limit = vi.fn().mockReturnThis();
  chain.single = vi.fn().mockResolvedValue(finalValue);
  return chain;
};

vi.mock('../../config/database', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => createMockChain({ data: null, error: null })),
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({ data: { id: 'doc-123' }, error: null }),
        })),
      })),
      update: vi.fn(() => ({
        eq: vi.fn().mockResolvedValue({ error: null }),
      })),
      delete: vi.fn(() => ({
        eq: vi.fn().mockResolvedValue({ error: null }),
      })),
    })),
    storage: {
      from: vi.fn(() => ({
        remove: vi.fn().mockResolvedValue({ error: null }),
      })),
    },
    rpc: vi.fn().mockResolvedValue({ data: 'doc-123', error: null }),
  },
  handleSupabaseError: vi.fn((error) => error),
}));

import { documentController } from '../documentController';
import { documentIndexingService } from '../../services/documentIndexingService';

describe('documentController.createDocument', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let jsonMock: ReturnType<typeof vi.fn>;
  let statusMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();

    jsonMock = vi.fn();
    statusMock = vi.fn().mockReturnValue({ json: jsonMock });

    mockRes = {
      status: statusMock,
      json: jsonMock,
    };
  });

  const createMockRequest = (documentType: string, file?: Express.Multer.File): Partial<Request> =>
    ({
      file:
        file ||
        ({ path: '/tmp/test.pdf', originalname: 'test.pdf', size: 1024 } as Express.Multer.File),
      // AUTH-2: ownership comes from the authenticated session, never the body
      user: { id: 'user-123' },
      body: {
        insurerName: 'Test Insurer',
        documentName: 'Test Document',
        documentType,
      },
    }) as Partial<Request>;

  it('rejects a client-supplied userId in the body with 400 (AUTH-2)', async () => {
    mockReq = {
      file: { path: '/tmp/test.pdf', originalname: 'test.pdf', size: 1024 } as Express.Multer.File,
      user: { id: 'user-123' },
      body: {
        insurerName: 'Test Insurer',
        documentName: 'Test Document',
        documentType: 'CLAUSULADO_GENERAL',
        userId: 'someone-else',
      },
    } as Partial<Request>;

    await documentController.createDocument(mockReq as Request, mockRes as Response);

    expect(statusMock).toHaveBeenCalledWith(400);
    expect(documentIndexingService.indexDocument).not.toHaveBeenCalled();
  });

  it('stamps uploadedBy from the authenticated session, not the body (AUTH-2)', async () => {
    mockReq = createMockRequest('CLAUSULADO_GENERAL');

    vi.mocked(documentIndexingService.indexDocument).mockResolvedValue({
      success: true,
      documentId: 'doc-123',
      insurerId: 'insurer-123',
      stats: { totalPages: 1, chunksCreated: 1, imagesUploaded: 1, processingTimeMs: 1 },
      errors: [],
      warnings: [],
    });

    await documentController.createDocument(mockReq as Request, mockRes as Response);

    expect(vi.mocked(documentIndexingService.indexDocument).mock.calls[0][1].uploadedBy).toBe(
      'user-123'
    );
  });

  it('should create document for CLAUSULADO_GENERAL', async () => {
    mockReq = createMockRequest('CLAUSULADO_GENERAL');

    vi.mocked(documentIndexingService.indexDocument).mockResolvedValue({
      success: true,
      documentId: 'doc-123',
      insurerId: 'insurer-123',
      stats: {
        totalPages: 10,
        chunksCreated: 50,
        imagesUploaded: 10,
        processingTimeMs: 1000,
      },
      errors: [],
      warnings: [],
    });

    await documentController.createDocument(mockReq as Request, mockRes as Response);

    expect(statusMock).toHaveBeenCalledWith(201);
  });

  it('should create document for CLAUSULADO_PARTICULAR', async () => {
    mockReq = createMockRequest('CLAUSULADO_PARTICULAR');

    vi.mocked(documentIndexingService.indexDocument).mockResolvedValue({
      success: true,
      documentId: 'doc-456',
      insurerId: 'insurer-123',
      stats: {
        totalPages: 5,
        chunksCreated: 25,
        imagesUploaded: 5,
        processingTimeMs: 500,
      },
      errors: [],
      warnings: [],
    });

    await documentController.createDocument(mockReq as Request, mockRes as Response);

    expect(statusMock).toHaveBeenCalledWith(201);
  });

  it('should create document for COTIZACION', async () => {
    mockReq = createMockRequest('COTIZACION');

    vi.mocked(documentIndexingService.indexDocument).mockResolvedValue({
      success: true,
      documentId: 'doc-789',
      insurerId: 'insurer-123',
      stats: {
        totalPages: 2,
        chunksCreated: 10,
        imagesUploaded: 2,
        processingTimeMs: 200,
      },
      errors: [],
      warnings: [],
    });

    await documentController.createDocument(mockReq as Request, mockRes as Response);

    expect(statusMock).toHaveBeenCalledWith(201);
  });

  it('should create document for ANEXO', async () => {
    mockReq = createMockRequest('ANEXO');

    vi.mocked(documentIndexingService.indexDocument).mockResolvedValue({
      success: true,
      documentId: 'doc-abc',
      insurerId: 'insurer-123',
      stats: {
        totalPages: 1,
        chunksCreated: 5,
        imagesUploaded: 1,
        processingTimeMs: 100,
      },
      errors: [],
      warnings: [],
    });

    await documentController.createDocument(mockReq as Request, mockRes as Response);

    expect(statusMock).toHaveBeenCalledWith(201);
  });

  it('should handle main indexing failure', async () => {
    mockReq = createMockRequest('CLAUSULADO_GENERAL');

    vi.mocked(documentIndexingService.indexDocument).mockResolvedValue({
      success: false,
      stats: {
        totalPages: 0,
        chunksCreated: 0,
        imagesUploaded: 0,
        processingTimeMs: 100,
      },
      errors: ['PDF extraction failed'],
      warnings: [],
    });

    await documentController.createDocument(mockReq as Request, mockRes as Response);

    expect(statusMock).toHaveBeenCalledWith(500);
  });
});
