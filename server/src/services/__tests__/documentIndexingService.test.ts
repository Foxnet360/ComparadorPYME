import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DocumentIndexingService, DocumentMetadata } from '../documentIndexingService';



// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockExtractTextFromPdf = vi.fn();
const mockRenderDocumentPages = vi.fn();
const mockCreateChunksFromPages = vi.fn();
const mockGenerateEmbedding = vi.fn();
const mockRpc = vi.fn();
const mockExtractFromText = vi.fn();
const mockStoreStructuredClause = vi.fn();
const mockIsEnabled = vi.fn();

vi.mock('../../config/database', () => ({
  supabase: {
    rpc: (...args: any[]) => mockRpc(...args),
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({ data: { id: 'insurer-123' }, error: null }))
        })),
        single: vi.fn(() => Promise.resolve({ data: { id: 'insurer-123' }, error: null }))
      })),
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({ data: { id: 'insurer-123' }, error: null }))
        }))
      })),
      delete: vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ error: null }))
      })),
    })),
    storage: {
      from: vi.fn(() => ({
        remove: vi.fn(() => Promise.resolve({ error: null }))
      }))
    }
  },
  handleSupabaseError: (err: any) => err
}));

vi.mock('../../config/featureFlags', () => ({
  featureFlags: {
    isEnabled: (key: string) => mockIsEnabled(key)
  }
}));

vi.mock('../structuredClauseExtractor', () => ({
  structuredClauseExtractor: {
    extractFromText: (...args: any[]) => mockExtractFromText(...args),
    storeStructuredClause: (...args: any[]) => mockStoreStructuredClause(...args)
  }
}));

vi.mock('../pdfExtractor', () => ({
  pdfExtractor: {
    extractTextFromPdf: (path: string) => mockExtractTextFromPdf(path)
  }
}));

vi.mock('../pdfRenderer', () => ({
  pdfRenderer: {
    renderDocumentPages: (...args: any[]) => mockRenderDocumentPages(...args)
  }
}));

vi.mock('../semanticChunker', () => ({
  semanticChunker: {
    createChunksFromPages: (...args: any[]) => mockCreateChunksFromPages(...args)
  }
}));

vi.mock('../vector/embeddingService', () => ({
  embeddingService: {
    generateEmbedding: (text: string) => mockGenerateEmbedding(text)
  }
}));

vi.mock('../gemini', () => ({
  geminiService: {
    performOcrOnImage: vi.fn(() => Promise.resolve('OCR text'))
  }
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeExtractionResult(overrides: any = {}) {
  return {
    text: 'Sample clause text for testing',
    isScanned: false,
    warnings: [],
    pages: [
      { pageNumber: 1, text: 'Page 1 text', wordCount: 10, hasContent: true }
    ],
    metadata: { pageCount: 1, title: 'Test', author: '' },
    ...overrides
  };
}

function makeRenderedPages() {
  return [
    { pageNumber: 1, storageUrl: 'url', storagePath: 'path', width: 800, height: 600, buffer: null }
  ];
}

function makeChunks() {
  return [
    {
      content: 'chunk content',
      contentNormalized: 'chunk normalized',
      metadata: { pageStart: 1 },
      coverageTags: [],
      sectionType: 'coverage'
    }
  ];
}

function makeMetadata(): DocumentMetadata {
  return {
    insurerName: 'SBS',
    documentName: 'Test Clausulado',
    documentType: 'CLAUSULADO_GENERAL',
    productName: 'PYME BASICA'
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('DocumentIndexingService — auto-extraction hook', () => {
  let service: DocumentIndexingService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new DocumentIndexingService();

    mockExtractTextFromPdf.mockResolvedValue(makeExtractionResult());
    mockRenderDocumentPages.mockResolvedValue(makeRenderedPages());
    mockCreateChunksFromPages.mockReturnValue(makeChunks());
    mockGenerateEmbedding.mockResolvedValue([0.1, 0.2, 0.3]);
    mockRpc.mockResolvedValue({ data: 'doc-uuid-123', error: null });
  });

  describe('feature flag disabled', () => {
    it('should NOT call extractFromText when autoExtractStructuredClauses is disabled', async () => {
      mockIsEnabled.mockReturnValue(false);

      const result = await service.indexDocument('/fake/path.pdf', makeMetadata());

      expect(result.success).toBe(true);
      expect(mockIsEnabled).toHaveBeenCalledWith('autoExtractStructuredClauses');
      expect(mockExtractFromText).not.toHaveBeenCalled();
      expect(mockStoreStructuredClause).not.toHaveBeenCalled();
    });
  });

  describe('feature flag enabled', () => {
    it('should call extractFromText and storeStructuredClause when flag is enabled', async () => {
      mockIsEnabled.mockReturnValue(true);
      mockExtractFromText.mockResolvedValue({
        insurer: 'SBS',
        product: 'PYME BASICA',
        documentType: 'CLAUSULADO_GENERAL',
        coverages: [],
        generalExclusions: [],
        generalConditions: [],
        definitions: {}
      });
      mockStoreStructuredClause.mockResolvedValue('clause-id-456');

      const result = await service.indexDocument('/fake/path.pdf', makeMetadata());

      expect(result.success).toBe(true);
      expect(mockExtractFromText).toHaveBeenCalledTimes(1);
      expect(mockExtractFromText).toHaveBeenCalledWith(
        'Sample clause text for testing',
        'SBS',
        'PYME BASICA',
        'CLAUSULADO_GENERAL'
      );
      expect(mockStoreStructuredClause).toHaveBeenCalledTimes(1);
      expect(mockStoreStructuredClause).toHaveBeenCalledWith(
        expect.objectContaining({ insurer: 'SBS' }),
        'doc-uuid-123',
        'pyme'
      );
    });

    it('should swallow extraction failure gracefully and still return success', async () => {
      mockIsEnabled.mockReturnValue(true);
      mockExtractFromText.mockRejectedValue(new Error('Gemini API error'));

      const result = await service.indexDocument('/fake/path.pdf', makeMetadata());

      expect(result.success).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0]).toContain('Gemini API error');
      expect(mockStoreStructuredClause).not.toHaveBeenCalled();
    });

    it('should swallow storage failure gracefully and still return success', async () => {
      mockIsEnabled.mockReturnValue(true);
      mockExtractFromText.mockResolvedValue({
        insurer: 'SBS',
        product: 'PYME BASICA',
        documentType: 'CLAUSULADO_GENERAL',
        coverages: [],
        generalExclusions: [],
        generalConditions: [],
        definitions: {}
      });
      mockStoreStructuredClause.mockRejectedValue(new Error('DB write failed'));

      const result = await service.indexDocument('/fake/path.pdf', makeMetadata());

      expect(result.success).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0]).toContain('DB write failed');
    });

    it('should enforce 30-second timeout on extraction', async () => {
      mockIsEnabled.mockReturnValue(true);
      mockExtractFromText.mockImplementation(() =>
        new Promise(resolve => setTimeout(() => resolve({ coverages: [] }), 60_000))
      );

      const result = await service.indexDocument('/fake/path.pdf', makeMetadata());

      expect(result.success).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0]).toContain('timed out');
      expect(mockExtractFromText).toHaveBeenCalledTimes(1);
      expect(mockStoreStructuredClause).not.toHaveBeenCalled();
    }, 35_000);
  });
});
