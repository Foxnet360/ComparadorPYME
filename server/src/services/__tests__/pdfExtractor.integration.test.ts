import { describe, it, expect } from 'vitest';
import { pdfExtractor } from '../pdfExtractor';
import path from 'path';

describe('pdfExtractor E2E', () => {
  it('should extract text from sample clause PDF', async () => {
    const clausePath = path.resolve(__dirname, '../../../test_mocks/test_clause.pdf');
    const result = await pdfExtractor.extractTextFromPdf(clausePath);
    
    expect(result.text.length).toBeGreaterThan(0);
    expect(result.metadata.pageCount).toBeGreaterThan(0);
  }, 30000);

  it('should extract text from sample quote PDF', async () => {
    const quotePath = path.resolve(__dirname, '../../../test_mocks/test_quote.pdf');
    const result = await pdfExtractor.extractTextFromPdf(quotePath);
    
    expect(result.text.length).toBeGreaterThan(0);
    expect(result.metadata.pageCount).toBeGreaterThan(0);
  }, 30000);
});
