import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockEmbedContent = vi.fn();

vi.mock('@google/genai', () => ({
  GoogleGenAI: class MockGoogleGenAI {
    models = {
      embedContent: (...args: unknown[]) => mockEmbedContent(...args),
    };
  },
}));

vi.mock('../../config/env', () => ({
  env: {
    GEMINI_API_KEY: 'test-key',
    GEMINI_EMBEDDING_MODEL: 'gemini-embedding-2',
  },
}));

import {
  embeddingService,
  clearEmbeddingCache,
  getEmbeddingCacheStats,
} from '../vector/embeddingService';

describe('embeddingService - LRU Cache & In-Flight Deduplication', () => {
  beforeEach(() => {
    process.env.GEMINI_API_KEY = 'test-key';
    clearEmbeddingCache();
    mockEmbedContent.mockReset();
  });

  it('caches embeddings in LRU cache and avoids duplicate embedContent API calls', async () => {
    mockEmbedContent.mockResolvedValue({
      embeddings: [{ values: [0.1, 0.2, 0.3] }],
    });

    const first = await embeddingService.generateEmbedding('Incendio y/o Rayo');
    const second = await embeddingService.generateEmbedding('Incendio y/o Rayo');

    expect(first).toEqual([0.1, 0.2, 0.3]);
    expect(second).toEqual([0.1, 0.2, 0.3]);
    expect(mockEmbedContent).toHaveBeenCalledTimes(1);

    const stats = getEmbeddingCacheStats();
    expect(stats.size).toBe(1);
    expect(stats.hits).toBe(1);
    expect(stats.misses).toBe(1);
  });

  it('deduplicates concurrent in-flight generateEmbedding calls for identical text', async () => {
    let resolveApiCall!: (value: unknown) => void;
    mockEmbedContent.mockReturnValue(
      new Promise((resolve) => {
        resolveApiCall = resolve;
      })
    );

    const p1 = embeddingService.generateEmbedding(' ¿Cuál es el deducible de terremoto? ');
    const p2 = embeddingService.generateEmbedding(' ¿Cuál es el deducible de terremoto? ');
    const p3 = embeddingService.generateEmbedding(' ¿Cuál es el deducible de terremoto? ');

    expect( getEmbeddingCacheStats().inFlight ).toBe(1);
    expect(mockEmbedContent).toHaveBeenCalledTimes(1);

    resolveApiCall({
      embeddings: [{ values: [0.4, 0.5, 0.6] }],
    });

    const [r1, r2, r3] = await Promise.all([p1, p2, p3]);
    expect(r1).toEqual([0.4, 0.5, 0.6]);
    expect(r2).toEqual([0.4, 0.5, 0.6]);
    expect(r3).toEqual([0.4, 0.5, 0.6]);
    expect(mockEmbedContent).toHaveBeenCalledTimes(1);
    expect(getEmbeddingCacheStats().inFlight).toBe(0);
    expect(getEmbeddingCacheStats().size).toBe(1);
  });

  it('reuses cached embeddings in generateEmbeddingsBatch and only requests uncached items', async () => {
    mockEmbedContent
      .mockResolvedValueOnce({
        embeddings: [{ values: [0.11, 0.22] }],
      })
      .mockResolvedValueOnce({
        embeddings: [{ values: [0.33, 0.44] }, { values: [0.55, 0.66] }],
      });

    // Pre-cache 'Cobertura A'
    await embeddingService.generateEmbedding('Cobertura A');
    expect(mockEmbedContent).toHaveBeenCalledTimes(1);

    // Batch with 1 cached and 2 uncached items
    const batchResults = await embeddingService.generateEmbeddingsBatch([
      'Cobertura A',
      'Cobertura B',
      'Cobertura C',
    ]);

    expect(batchResults).toHaveLength(3);
    expect(batchResults[0]!.text).toBe('Cobertura A');
    expect(batchResults[0]!.embedding).toEqual([0.11, 0.22]);
    expect(batchResults[1]!.text).toBe('Cobertura B');
    expect(batchResults[1]!.embedding).toEqual([0.33, 0.44]);
    expect(batchResults[2]!.text).toBe('Cobertura C');
    expect(batchResults[2]!.embedding).toEqual([0.55, 0.66]);

    // Second embedContent call should only have received the 2 uncached items
    expect(mockEmbedContent).toHaveBeenCalledTimes(2);
    const secondCallArg = mockEmbedContent.mock.calls[1]![0] as { contents: unknown[] };
    expect(secondCallArg.contents).toHaveLength(2);
  });
});
