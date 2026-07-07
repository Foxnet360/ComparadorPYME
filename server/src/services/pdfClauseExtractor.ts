/**
 * PDF Clause Extractor
 * Extracts clause text from pages beyond the coverage table in quote PDFs
 */

import { pdfExtractor } from './pdfExtractor';

export interface ExtractedClause {
  pageNumber: number;
  content: string;
  source: 'pdf-extracted';
}

/**
 * Extract clauses from the latter pages of a quote PDF
 * Typically, clauses appear after the coverage table
 */
export async function extractClausesFromPdf(
  pdfPath: string,
  options: {
    startPage?: number; // Page to start extraction (default: middle of document)
    minClauseLength?: number; // Minimum length to consider as clause text
  } = {}
): Promise<ExtractedClause[]> {
  try {
    const { startPage = 0, minClauseLength = 100 } = options;

    // Extract full text from PDF
    const { text, pages } = await pdfExtractor.extractTextFromPdf(pdfPath);
    const pageCount = pages.length;

    if (!text || pageCount <= 1) {
      return [];
    }

    // Split by common clause separators
    const sections = text.split(/(?:Cláusula|Condición|Artículo|ANEXO|SECCIÓN)\s+\d+/i);

    const clauses: ExtractedClause[] = [];
    let pageNum = startPage > 0 ? startPage : Math.ceil(pageCount / 2);

    for (let i = 1; i < sections.length; i++) {
      const content = sections[i].trim();

      // Only keep substantial sections
      if (content.length >= minClauseLength) {
        clauses.push({
          pageNumber: pageNum + i - 1,
          content: content.substring(0, 2000), // Limit length
          source: 'pdf-extracted',
        });
      }
    }

    console.log(`📄 [PDF Clause Extractor] Extracted ${clauses.length} clauses from ${pdfPath}`);
    return clauses;
  } catch (error) {
    console.error('❌ [PDF Clause Extractor] Error:', error);
    return [];
  }
}
