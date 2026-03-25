import fs from 'fs';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.js';

export type DocumentType = 'COTIZACIÓN' | 'CLAUSULADO_GENERAL' | 'CLAUSULADO_PARTICULAR';

export interface PageData {
    pageNumber: number;
    text: string;
    wordCount: number;
    hasContent: boolean;
}

export interface PDFMetadata {
    pageCount: number;
    title?: string;
    author?: string;
    subject?: string;
    keywords?: string;
    creator?: string;
    producer?: string;
    creationDate?: Date;
    modificationDate?: Date;
}

export interface PDFExtractionResult {
    text: string;
    pages: PageData[];
    metadata: PDFMetadata;
    warnings: string[];
    isScanned: boolean;
}

export interface ExtractedDocument {
    filename: string;
    type: DocumentType;
    text: string;
    pages: PageData[];
    metadata: PDFMetadata;
}

export class PDFExtractionError extends Error {
    constructor(message: string, public code: string) {
        super(message);
        this.name = 'PDFExtractionError';
    }
}

export const pdfExtractor = {
    /**
     * Extrae texto y metadata de un archivo PDF con información por página
     */
    extractTextFromPdf: async (filePath: string): Promise<PDFExtractionResult> => {
        console.log(`📄 [pdfExtractor] Extracting from: ${filePath}`);

        const warnings: string[] = [];

        try {
            // Validar archivo existe
            if (!fs.existsSync(filePath)) {
                throw new PDFExtractionError(`File not found: ${filePath}`, 'FILE_NOT_FOUND');
            }

            // Validar que es un PDF
            const validation = pdfExtractor.validatePdf(filePath);
            if (!validation.valid) {
                throw new PDFExtractionError(validation.error || 'Invalid PDF', 'INVALID_PDF');
            }

            const dataBuffer = fs.readFileSync(filePath);
            const pdfBytes = new Uint8Array(dataBuffer);
            console.log(`   File size: ${dataBuffer.length} bytes`);

            // Cargar documento
            const loadingTask = getDocument({ data: pdfBytes });
            const pdfDoc = await loadingTask.promise;

            const pageCount = pdfDoc.numPages;
            console.log(`   Pages: ${pageCount}`);

            // Extraer metadata del documento
            const metadata = await pdfExtractor.extractMetadata(pdfDoc, pageCount);
            console.log(`   Title: ${metadata.title || 'N/A'}`);
            console.log(`   Author: ${metadata.author || 'N/A'}`);

            // Extraer texto página por página
            const pages: PageData[] = [];
            let totalTextLength = 0;
            let pagesWithContent = 0;

            for (let i = 1; i <= pageCount; i++) {
                try {
                    const page = await pdfDoc.getPage(i);
                    const textContent = await page.getTextContent();
                    
                    // Extraer texto de la página
                    const pageText = textContent.items
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        .map((item: any) => item.str || '')
                        .join(' ')
                        .trim();

                    const wordCount = pageText.split(/\s+/).filter(word => word.length > 0).length;
                    const hasContent = pageText.length > 0 && wordCount > 5; // Mínimo 5 palabras

                    if (!hasContent) {
                        warnings.push(`Page ${i} has minimal or no extractable text`);
                    } else {
                        pagesWithContent++;
                    }

                    pages.push({
                        pageNumber: i,
                        text: pageText,
                        wordCount,
                        hasContent,
                    });

                    totalTextLength += pageText.length;

                } catch (pageError: any) {
                    warnings.push(`Error extracting page ${i}: ${pageError.message}`);
                    pages.push({
                        pageNumber: i,
                        text: '',
                        wordCount: 0,
                        hasContent: false,
                    });
                }
            }

            // Unir todo el texto
            const fullText = pages.map(p => p.text).join('\n\n');

            // Detectar si es un PDF escaneado
            const isScanned = pdfExtractor.detectScannedDocument(pages, totalTextLength, pageCount);
            
            if (isScanned) {
                warnings.push('PDF appears to be scanned (limited text extraction possible)');
            }

            if (totalTextLength === 0) {
                warnings.push('PDF contains no extractable text');
            }

            const cleanedText = pdfExtractor.cleanText(fullText);

            console.log(`✅ [pdfExtractor] Extracted ${cleanedText.length} chars from ${pagesWithContent}/${pageCount} pages`);
            if (warnings.length > 0) {
                console.log(`⚠️  Warnings: ${warnings.length}`);
            }

            return {
                text: cleanedText,
                pages,
                metadata,
                warnings,
                isScanned,
            };

        } catch (error: any) {
            if (error instanceof PDFExtractionError) {
                throw error;
            }
            console.error(`❌ [pdfExtractor] Error: ${error.message}`);
            throw new PDFExtractionError(`Failed to extract PDF: ${error.message}`, 'EXTRACTION_FAILED');
        }
    },

    /**
     * Extrae metadata del documento PDF
     */
    extractMetadata: async (pdfDoc: any, pageCount: number): Promise<PDFMetadata> => {
        try {
            const metadata = await pdfDoc.getMetadata();
            const info = metadata?.info || {};

            return {
                pageCount,
                title: info.Title || undefined,
                author: info.Author || undefined,
                subject: info.Subject || undefined,
                keywords: info.Keywords || undefined,
                creator: info.Creator || undefined,
                producer: info.Producer || undefined,
                creationDate: info.CreationDate ? new Date(info.CreationDate) : undefined,
                modificationDate: info.ModDate ? new Date(info.ModDate) : undefined,
            };
        } catch (error) {
            // Si no se puede extraer metadata, retornar solo pageCount
            return { pageCount };
        }
    },

    /**
     * Detecta si un PDF es escaneado basado en la cantidad de texto
     */
    detectScannedDocument: (pages: PageData[], totalTextLength: number, pageCount: number): boolean => {
        if (pageCount === 0) return true;
        
        // Calcular promedio de texto por página
        const avgTextPerPage = totalTextLength / pageCount;
        
        // Calcular porcentaje de páginas con contenido significativo
        const pagesWithContent = pages.filter(p => p.hasContent).length;
        const contentPercentage = (pagesWithContent / pageCount) * 100;
        
        // Considerar escaneado si:
        // - Promedio de texto muy bajo (< 200 caracteres por página)
        // - Menos del 30% de páginas tienen contenido significativo
        return avgTextPerPage < 200 || contentPercentage < 30;
    },

    /**
     * Limpia el texto extraído removiendo artefactos comunes de PDF
     */
    cleanText: (text: string): string => {
        let cleaned = text;

        // Normalizar espacios
        cleaned = cleaned.replace(/[ \t]+/g, ' ');

        // Remover números de página sueltos
        cleaned = cleaned.replace(/^\s*\d+\s*$/gm, '');

        // Normalizar saltos de línea
        cleaned = cleaned.replace(/\n{3,}/g, '\n\n');

        // Remover espacios al inicio y final
        cleaned = cleaned.trim();

        return cleaned;
    },

    /**
     * Extrae texto por página para mantener referencias
     * @deprecated Use extractTextFromPdf which now returns pages array
     */
    extractTextByPage: async (filePath: string): Promise<PageData[]> => {
        const result = await pdfExtractor.extractTextFromPdf(filePath);
        return result.pages;
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
                        pages: result.pages,
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
            // Verificar que existe
            if (!fs.existsSync(filePath)) {
                return { valid: false, error: 'File does not exist' };
            }

            const stats = fs.statSync(filePath);
            
            // Verificar que es un archivo
            if (!stats.isFile()) {
                return { valid: false, error: 'Path is not a file' };
            }

            // Verificar tamaño (máximo 50MB)
            const maxSize = 50 * 1024 * 1024; // 50MB
            if (stats.size > maxSize) {
                return { valid: false, error: 'File too large (max 50MB)' };
            }

            // Verificar header de PDF
            const buffer = fs.readFileSync(filePath);
            if (buffer.length < 5) {
                return { valid: false, error: 'File too small' };
            }

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
