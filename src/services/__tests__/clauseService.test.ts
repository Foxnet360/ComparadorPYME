import { describe, it, expect, vi, beforeEach } from 'vitest';
import { clauseService } from '../../../services/clauseService';
import { apiClient } from '../../../services/apiClient';

vi.mock('../../../services/apiClient', () => ({
  apiClient: {
    fetch: vi.fn(),
  },
}));

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

const jsonResponse = (payload: unknown): Response =>
  ({ ok: true, json: vi.fn().mockResolvedValue(payload) }) as unknown as Response;

describe('clauseService (AUTH-1: all calls go through apiClient with Bearer token)', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('getDocuments queries /documents through apiClient', async () => {
    vi.mocked(apiClient.fetch).mockResolvedValue(jsonResponse({ documents: [{ id: 'd1' }] }));

    const docs = await clauseService.getDocuments({ insurerId: 'ins-1', latest: true });

    expect(apiClient.fetch).toHaveBeenCalledWith('/documents?insurerId=ins-1&latest=true');
    expect(mockFetch).not.toHaveBeenCalled();
    expect(docs).toEqual([{ id: 'd1' }]);
  });

  it('createDocument posts FormData through apiClient without manual Content-Type', async () => {
    const created = { id: 'd2' };
    vi.mocked(apiClient.fetch).mockResolvedValue(jsonResponse(created));
    const file = new File(['pdf'], 'clause.pdf', { type: 'application/pdf' });

    const result = await clauseService.createDocument(file, {
      insurerName: 'MAPFRE',
      documentName: 'General',
      documentType: 'CLAUSULADO_GENERAL',
    });

    expect(apiClient.fetch).toHaveBeenCalledWith(
      '/documents',
      expect.objectContaining({ method: 'POST', body: expect.any(FormData) })
    );
    expect(mockFetch).not.toHaveBeenCalled();
    expect(result).toEqual(created);
  });

  it('deleteDocument issues DELETE through apiClient', async () => {
    vi.mocked(apiClient.fetch).mockResolvedValue(jsonResponse({}));

    await clauseService.deleteDocument('d9');

    expect(apiClient.fetch).toHaveBeenCalledWith('/documents/d9', { method: 'DELETE' });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('getDocumentVersions queries versions through apiClient', async () => {
    vi.mocked(apiClient.fetch).mockResolvedValue(jsonResponse({ documents: [] }));

    await clauseService.getDocumentVersions('ins 1');

    expect(apiClient.fetch).toHaveBeenCalledWith(
      `/documents?insurerId=${encodeURIComponent('ins 1')}`
    );
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
