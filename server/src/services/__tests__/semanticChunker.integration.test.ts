import { describe, it, expect } from 'vitest';
import { semanticChunker } from '../semanticChunker';
import { pdfExtractor } from '../pdfExtractor';
import path from 'path';

describe('semanticChunker E2E', () => {
  it('should chunk the sample clause PDF', async () => {
    const clausePath = path.resolve(__dirname, '../../../test_mocks/test_clause.pdf');
    const result = await pdfExtractor.extractTextFromPdf(clausePath);
    
    // Simulate boundaries for a single test chunk
    const pageBoundaries = [{ pageNumber: 1, charIndex: 0 }];

    const chunks = semanticChunker.createChunks(result.text, {
      documentName: 'AXA COLPATRIA',
      insurerName: 'AXA',
    }, pageBoundaries);

    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks[0].content).toBeDefined();
    
    // Some basic expectation if it has chapters/sections
    if (chunks.length > 1) {
        // Assert there are chunks created out of structure
        const structuredChunk = chunks.find(c => c.metadata.clauseId || c.metadata.section);
        expect(structuredChunk).toBeDefined();
    }
  }, 30000);
});
