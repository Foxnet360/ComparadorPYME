import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { vectorStore, ChunkMetadata } from '../vectorStore';

// Note: This integration test requires a running ChromaDB or uses the embedded one.
// The test ensures the full flow: initialize -> add chunks -> search -> delete.

describe.skip('vectorStore Integration', () => {
  const insurerName = 'TEST_INSURER_VDB';
  const documentName = 'TEST_DOC_VDB.pdf';
  
  beforeAll(async () => {
    // Force embedded locally if possible, or use the dev server
    process.env.USE_EMBEDDED = 'true';
    await vectorStore.initialize();
  });

  afterAll(async () => {
    try {
      await vectorStore.deleteDocument(insurerName, documentName);
    } catch (e) {
      // ignore
    }
  });

  it('should add, search, and delete chunks', async () => {
    const chunkId = `chunk-${Date.now()}`;
    const mockEmbedding = Array(384).fill(0.1); // mock 384-dimensional vector
    const metadata: ChunkMetadata = {
      insurerName,
      documentName,
      documentType: 'CLAUSULADO_GENERAL',
      pageStart: 1,
      pageEnd: 1,
      chapter: 'CAPÍTULO I',
    };

    // 1. Add chunk
    await vectorStore.addChunks(insurerName, [{
      id: chunkId,
      content: 'This is a test chunk containing some specific insurance clause.',
      metadata,
      embedding: mockEmbedding,
    }]);

    // 2. Search chunk
    const searchEmbedding = Array(384).fill(0.1); 
    const results = await vectorStore.search(insurerName, searchEmbedding, undefined, 1);

    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0].content).toContain('insurance clause');
    expect(results[0].metadata.documentName).toBe(documentName);

    // 3. Delete document
    await vectorStore.deleteDocument(insurerName, documentName);

    // 4. Verify deletion
    const finalResults = await vectorStore.search(insurerName, searchEmbedding, undefined, 1);
    // Might still return other test chunks, but hopefully not the deleted one
    const found = finalResults.find(r => r.metadata.documentName === documentName);
    expect(found).toBeUndefined();
  }, 30000);
});
