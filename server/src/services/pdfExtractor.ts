import fs from 'fs';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

export type DocumentType = 'COTIZACIÓN' | 'CLAUSULADO';

export interface ExtractedDocument {
    filename: string;
    type: DocumentType;
    text: string;
    metadata: {
        pageCount: number;
        title?: string;
        author?: string;
    };
}

export interface PDFExtractionResult {
    text: string;
    metadata: {
        pageCount: number;
        title?: string;
        author?: string;
    };
    warnings: string[];
}

export const pdfExtractor = {
    /**
     * Extrae texto plano de un archivo PDF usando pdfjs-dist
     */
    extractTextFromPdf: async (filePath: string): Promise<PDFExtractionResult> => {
        console.log(`📄 [pdfExtractor] Extracting from: ${filePath}`);

        const warnings: string[] = [];

        try {
            if (!fs.existsSync(filePath)) {
                throw new Error(`File not found: ${filePath}`);
            }

            const dataBuffer = fs.readFileSync(filePath);
            const pdfBytes = new Uint8Array(dataBuffer);
            console.log(`   File size: ${dataBuffer.length} bytes`);

            const loadingTask = getDocument({ data: pdfBytes });
            const pdfDoc = await loadingTask.promise;

            const pageCount = pdfDoc.numPages;
            console.log(`   Pages: ${pageCount}`);

            const textByPage: string[] = [];

            for (let i = 1; i <= pageCount; i++) {
                const page = await pdfDoc.getPage(i);
                const textContent = await page.getTextContent();
                
                if (!textContent.items || textContent.items.length === 0) {
                    warnings.push(`Page ${i} has no extractable text`);
                    textByPage.push('');
                    continue;
                }

                const pageText = textContent.items
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    .map((item: any) => item.str || '')
                    .join(' ')
                    .trim();

                textByPage.push(pageText);
            }

            const fullText = textByPage.join('\n\n');

            if (fullText.length === 0) {
                warnings.push('PDF contains no extractable text');
            }

            const cleanedText = pdfExtractor.cleanText(fullText);

            console.log(`✅ [pdfExtractor] Extracted ${cleanedText.length} chars (${pageCount} pages)`);

            return {
                text: cleanedText,
                metadata: {
                    pageCount,
                },
                warnings,
            };

        } catch (error: any) {
            console.error(`❌ [pdfExtractor] Error: ${error.message}`);
            throw new Error(`Invalid PDF file: ${error.message}`);
        }
    },

    /**
     * Limpia el texto extraído removiendo artefactos comunes de PDF
     */
    cleanText: (text: string): string => {
        let cleaned = text;

        cleaned = cleaned.replace(/[ \t]+/g, ' ');

        cleaned = cleaned.replace(/^\s*\d+\s*$/gm, '');

        cleaned = cleaned.replace(/\n{3,}/g, '\n\n');

        cleaned = cleaned.trim();

        return cleaned;
    },

    /**
     * Extrae texto por página para mantener referencias
     */
    extractTextByPage: async (filePath: string): Promise<{ pageNumber: number; text: string }[]> => {
        const result = await pdfExtractor.extractTextFromPdf(filePath);
        const pages = result.text.split('\n\n');
        
        return pages.map((text, index) => ({
            pageNumber: index + 1,
            text: text.trim(),
        }));
    },

    /**
     * Formatea el texto extraído con marcadores para el modelo
     */
    formatExtractedText: (text: string, filename: string, type: DocumentType): string => {
        const cleanFilename = filename.replace(/\.[^/.]+$/, '');
        return `=== INICIO ${type}: ${cleanFilename} ===\n${text}\n=== FIN ${type} ===`;
    },

    /**
     * Procesa múltiples archivos PDF y devuelve texto formateado
     */
    processMultiplePdfs: async (
        files: { path: string; originalname: string }[],
        type: DocumentType
    ): Promise<ExtractedDocument[]> => {
        const results: ExtractedDocument[] = [];

        for (const file of files) {
            try {
                console.log(`📄 Processing: ${file.originalname}`);
                const result = await pdfExtractor.extractTextFromPdf(file.path);
                
                if (result.text && result.text.length > 0) {
                    const formattedText = pdfExtractor.formatExtractedText(result.text, file.originalname, type);
                    results.push({
                        filename: file.originalname,
                        type,
                        text: formattedText,
                        metadata: result.metadata,
                    });
                    console.log(`✅ Added ${file.originalname} (${result.text.length} chars, ${result.metadata.pageCount} pages)`);
                } else {
                    console.warn(`⚠️ Empty text from ${file.originalname}`);
                }
            } catch (error: any) {
                console.error(`❌ Skipping ${file.originalname}: ${error.message}`);
            }
        }

        return results;
    },

    /**
     * Combina todos los documentos extraídos en un solo string para el prompt
     */
    combineExtractedTexts: (documents: ExtractedDocument[]): string => {
        return documents.map(doc => doc.text).join('\n\n');
    },

    /**
     * Valida que el archivo sea un PDF válido
     */
    validatePdf: (filePath: string): { valid: boolean; error?: string } => {
        try {
            const buffer = fs.readFileSync(filePath);
            const header = buffer.slice(0, 5).toString();
            
            if (header !== '%PDF-') {
                return { valid: false, error: 'File is not a valid PDF' };
            }
            
            return { valid: true };
        } catch (error: any) {
            return { valid: false, error: error.message };
        }
    },
};
