import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response } from 'express';

// Mock modules
vi.mock('../../services/documentIndexingService', () => ({
  documentIndexingService: {
    indexDocument: vi.fn(),
    getOrCreateInsurer: vi.fn().mockResolvedValue('insurer-123'),
  },
  DocumentIndexingService: vi.fn()
}));

vi.mock('../../services/clauseIndexer', () => ({
  clauseIndexer: {
    startIndexing: vi.fn().mockResolvedValue('job-123'),
  }
}));

const createMockChain = (finalValue: any = { data: null, error: null }) => {
  const chain: any = vi.fn().mockReturnValue(chain);
  chain.mockResolvedValue(finalValue);
  return chain;
};

vi.mock('../../config/database', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => createMockChain({ data: null, error: null })),
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({ data: { id: 'doc-123' }, error: null })
        }))
      })),
      update: vi.fn(() => ({
        eq: vi.fn().mockResolvedValue({ error: null })
      })),
      delete: vi.fn(() => ({
        eq: vi.fn().mockResolvedValue({ error: null })
      })),
    })),
    storage: {
      from: vi.fn(() => ({
        remove: vi.fn().mockResolvedValue({ error: null })
      }))
    },
    rpc: vi.fn().mockResolvedValue({ data: 'doc-123', error: null })
  },
  handleSupabaseError: vi.fn((error) => error)
}));

import { documentController } from '../documentController';
import { documentIndexingService } from '../../services/documentIndexingService';
import { clauseIndexer } from '../../services/clauseIndexer';

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

  const createMockRequest = (documentType: string, file?: any): Partial<Request> => ({
    file: file || {
      path: '/tmp/test.pdf',
      originalname: 'test.pdf',
      size: 1024,
    },
    body: {
      insurerName: 'Test Insurer',
      documentName: 'Test Document',
      documentType,
      userId: 'user-123',
    },
  });

  it('should trigger clauseIndexer for CLAUSULADO_GENERAL', async () => {
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

    expect(clauseIndexer.startIndexing).toHaveBeenCalledWith('/tmp/test.pdf', {
      insurerName: 'Test Insurer',
      documentType: 'CLAUSULADO_GENERAL',
      documentName: 'Test Document',
      documentId: 'doc-123',
    });
    expect(statusMock).toHaveBeenCalledWith(201);
  });

  it('should trigger clauseIndexer for CLAUSULADO_PARTICULAR', async () => {
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

    expect(clauseIndexer.startIndexing).toHaveBeenCalledWith('/tmp/test.pdf', {
      insurerName: 'Test Insurer',
      documentType: 'CLAUSULADO_PARTICULAR',
      documentName: 'Test Document',
      documentId: 'doc-456',
    });
    expect(statusMock).toHaveBeenCalledWith(201);
  });

  it('should NOT trigger clauseIndexer for COTIZACION', async () => {
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

    expect(clauseIndexer.startIndexing).not.toHaveBeenCalled();
    expect(statusMock).toHaveBeenCalledWith(201);
  });

  it('should NOT trigger clauseIndexer for ANEXO', async () => {
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

    expect(clauseIndexer.startIndexing).not.toHaveBeenCalled();
    expect(statusMock).toHaveBeenCalledWith(201);
  });

  it('should return 200 even if clauseIndexer fails', async () => {
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

    vi.mocked(clauseIndexer.startIndexing).mockRejectedValue(new Error('Indexing failed'));

    await documentController.createDocument(mockReq as Request, mockRes as Response);

    expect(statusMock).toHaveBeenCalledWith(201);
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        documentId: 'doc-123',
      })
    );
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

    expect(clauseIndexer.startIndexing).not.toHaveBeenCalled();
    expect(statusMock).toHaveBeenCalledWith(500);
  });
});
