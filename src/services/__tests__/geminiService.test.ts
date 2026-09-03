import { describe, it, expect, vi, beforeEach } from 'vitest';
import { analyzeQuotesWithGemini } from '../../../services/geminiService';
import { apiClient } from '../../../services/apiClient';

vi.mock('../../../services/apiClient', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../services/apiClient')>();
  return {
    ...actual,
    apiClient: {
      fetch: vi.fn(),
    },
  };
});

describe('analyzeQuotesWithGemini', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  const createFile = (name: string, type = 'application/pdf') =>
    new File(['content'], name, { type });

  it('sends FormData without userId or userEmail', async () => {
    const quoteFiles = [createFile('quote1.pdf')];
    const clauseFiles = [createFile('clause1.pdf')];

    vi.mocked(apiClient.fetch).mockResolvedValue({
      json: vi.fn().mockResolvedValue({ quotes: [] }),
    } as unknown as Response);

    await analyzeQuotesWithGemini(quoteFiles, clauseFiles, 'Cliente A');

    const callArgs = vi.mocked(apiClient.fetch).mock.calls[0];
    const body = callArgs[1].body as FormData;

    expect(callArgs[0]).toBe('/analyze');
    expect(callArgs[1].method).toBe('POST');
    expect(body.get('clientName')).toBe('Cliente A');
    expect(body.get('domain')).toBe('pyme');
    expect(body.get('userId')).toBeNull();
    expect(body.get('userEmail')).toBeNull();
    expect(body.get('quotes')).toBeTruthy();
    expect(body.get('clauses')).toBeTruthy();
  });

  it('sends custom domain in FormData when provided', async () => {
    const quoteFiles = [createFile('quote1.pdf')];

    vi.mocked(apiClient.fetch).mockResolvedValue({
      json: vi.fn().mockResolvedValue({ quotes: [] }),
    } as unknown as Response);

    await analyzeQuotesWithGemini(quoteFiles, [], 'Cliente Domain', undefined, undefined, 'autos');

    const callArgs = vi.mocked(apiClient.fetch).mock.calls[0];
    const body = callArgs[1].body as FormData;

    expect(body.get('domain')).toBe('autos');
  });

  it('sends clauseIds when provided instead of clause files', async () => {
    const quoteFiles = [createFile('quote1.pdf')];

    vi.mocked(apiClient.fetch).mockResolvedValue({
      json: vi.fn().mockResolvedValue({ quotes: [] }),
    } as unknown as Response);

    await analyzeQuotesWithGemini(quoteFiles, [], 'Cliente B', undefined, ['clause-1', 'clause-2']);

    const callArgs = vi.mocked(apiClient.fetch).mock.calls[0];
    const body = callArgs[1].body as FormData;

    expect(body.get('clauseIds')).toBe(JSON.stringify(['clause-1', 'clause-2']));
    expect(body.get('clauses')).toBeNull();
  });

  it('returns parsed ComparisonReport', async () => {
    const report = { quotes: [{ insurerName: 'MAPFRE' }] };
    vi.mocked(apiClient.fetch).mockResolvedValue({
      json: vi.fn().mockResolvedValue(report),
    } as unknown as Response);

    const result = await analyzeQuotesWithGemini([createFile('q.pdf')], [], 'Cliente C');

    expect(result).toEqual(report);
  });

  it('throws friendly session expired message on 401', async () => {
    vi.mocked(apiClient.fetch).mockRejectedValue(
      new Error('Sesión expirada. Por favor inicia sesión nuevamente.')
    );

    await expect(analyzeQuotesWithGemini([createFile('q.pdf')], [], 'Cliente D')).rejects.toThrow(
      'Sesión expirada. Por favor inicia sesión nuevamente.'
    );
  });

  it('throws friendly generic message on other errors', async () => {
    vi.mocked(apiClient.fetch).mockRejectedValue(new Error('Network error'));

    await expect(analyzeQuotesWithGemini([createFile('q.pdf')], [], 'Cliente E')).rejects.toThrow(
      'Network error'
    );
  });

  it('bounds the /analyze call with the 120s timeout (ERR-3)', async () => {
    vi.mocked(apiClient.fetch).mockResolvedValue({
      json: vi.fn().mockResolvedValue({ quotes: [] }),
    } as unknown as Response);

    await analyzeQuotesWithGemini([createFile('q.pdf')], [], 'Cliente F');

    expect(vi.mocked(apiClient.fetch).mock.calls[0][1].timeoutMs).toBe(120_000);
  });

  it('maps an ApiTimeoutError to a friendly timeout message (ERR-3)', async () => {
    const { ApiTimeoutError } = await vi.importActual<typeof import('../../../services/apiClient')>(
      '../../../services/apiClient'
    );
    vi.mocked(apiClient.fetch).mockRejectedValue(new ApiTimeoutError(120_000));

    await expect(analyzeQuotesWithGemini([createFile('q.pdf')], [], 'Cliente G')).rejects.toThrow(
      'El análisis excedió el tiempo máximo permitido'
    );
  });
});
