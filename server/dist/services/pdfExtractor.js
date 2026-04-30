"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.pdfExtractor = exports.PDFExtractionError = void 0;
const fs_1 = __importDefault(require("fs"));
const pdf_js_1 = require("pdfjs-dist/legacy/build/pdf.js");
class PDFExtractionError extends Error {
    constructor(message, code) {
        super(message);
        this.code = code;
        this.name = 'PDFExtractionError';
    }
}
exports.PDFExtractionError = PDFExtractionError;
exports.pdfExtractor = {
    /**
     * Extrae texto y metadata de un archivo PDF con información por página
     */
    extractTextFromPdf: (filePath) => __awaiter(void 0, void 0, void 0, function* () {
        console.log(`📄 [pdfExtractor] Extracting from: ${filePath}`);
        const warnings = [];
        let pdfDoc = null;
        try {
            // Validar archivo existe
            if (!fs_1.default.existsSync(filePath)) {
                throw new PDFExtractionError(`File not found: ${filePath}`, 'FILE_NOT_FOUND');
            }
            // Validar que es un PDF
            const validation = exports.pdfExtractor.validatePdf(filePath);
            if (!validation.valid) {
                throw new PDFExtractionError(validation.error || 'Invalid PDF', 'INVALID_PDF');
            }
            const dataBuffer = yield fs_1.default.promises.readFile(filePath);
            const pdfBytes = new Uint8Array(dataBuffer);
            console.log(`   File size: ${dataBuffer.length} bytes`);
            // Cargar documento
            const loadingTask = (0, pdf_js_1.getDocument)({ data: pdfBytes });
            pdfDoc = yield loadingTask.promise;
            const pageCount = pdfDoc.numPages;
            console.log(`   Pages: ${pageCount}`);
            // Extraer metadata del documento
            const metadata = yield exports.pdfExtractor.extractMetadata(pdfDoc, pageCount);
            console.log(`   Title: ${metadata.title || 'N/A'}`);
            console.log(`   Author: ${metadata.author || 'N/A'}`);
            // Extraer texto página por página
            const pages = [];
            let totalTextLength = 0;
            let pagesWithContent = 0;
            for (let i = 1; i <= pageCount; i++) {
                try {
                    const page = yield pdfDoc.getPage(i);
                    const textContent = yield page.getTextContent();
                    // Extraer texto de la página
                    const pageText = textContent.items
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        .map((item) => item.str || '')
                        .join(' ')
                        .trim();
                    const wordCount = pageText.split(/\s+/).filter((word) => word.length > 0).length;
                    const hasContent = pageText.length > 0 && wordCount > 5; // Mínimo 5 palabras
                    if (!hasContent) {
                        warnings.push(`Page ${i} has minimal or no extractable text`);
                    }
                    else {
                        pagesWithContent++;
                    }
                    pages.push({
                        pageNumber: i,
                        text: pageText,
                        wordCount,
                        hasContent,
                    });
                    totalTextLength += pageText.length;
                }
                catch (pageError) {
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
            const isScanned = exports.pdfExtractor.detectScannedDocument(pages, totalTextLength, pageCount);
            if (isScanned) {
                warnings.push('PDF appears to be scanned (limited text extraction possible)');
            }
            if (totalTextLength === 0) {
                warnings.push('PDF contains no extractable text');
            }
            const cleanedText = exports.pdfExtractor.cleanText(fullText);
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
        }
        catch (error) {
            if (error instanceof PDFExtractionError) {
                throw error;
            }
            console.error(`❌ [pdfExtractor] Error: ${error.message}`);
            throw new PDFExtractionError(`Failed to extract PDF: ${error.message}`, 'EXTRACTION_FAILED');
        }
        finally {
            if (pdfDoc) {
                try {
                    yield pdfDoc.destroy();
                }
                catch (destroyError) {
                    console.warn('⚠️ Error destroying PDF document:', destroyError);
                }
            }
        }
    }),
    /**
     * Extrae metadata del documento PDF
     */
    extractMetadata: (pdfDoc, pageCount) => __awaiter(void 0, void 0, void 0, function* () {
        try {
            const metadata = yield pdfDoc.getMetadata();
            const info = (metadata === null || metadata === void 0 ? void 0 : metadata.info) || {};
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
        }
        catch (error) {
            // Si no se puede extraer metadata, retornar solo pageCount
            return { pageCount };
        }
    }),
    /**
     * Detecta si un PDF es escaneado basado en la cantidad de texto
     */
    detectScannedDocument: (pages, totalTextLength, pageCount) => {
        if (pageCount === 0)
            return true;
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
    cleanText: (text) => {
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
    extractTextByPage: (filePath) => __awaiter(void 0, void 0, void 0, function* () {
        const result = yield exports.pdfExtractor.extractTextFromPdf(filePath);
        return result.pages;
    }),
    /**
     * Formatea el texto extraído con marcadores para el modelo
     */
    formatExtractedText: (text, filename, type) => {
        const cleanFilename = filename.replace(/\.[^/.]+$/, '');
        return `=== INICIO ${type}: ${cleanFilename} ===\n${text}\n=== FIN ${type} ===`;
    },
    /**
     * Procesa múltiples archivos PDF y devuelve texto formateado
     */
    processMultiplePdfs: (files, type) => __awaiter(void 0, void 0, void 0, function* () {
        const results = [];
        for (const file of files) {
            try {
                console.log(`📄 Processing: ${file.originalname}`);
                const result = yield exports.pdfExtractor.extractTextFromPdf(file.path);
                if (result.text && result.text.length > 0) {
                    const formattedText = exports.pdfExtractor.formatExtractedText(result.text, file.originalname, type);
                    results.push({
                        filename: file.originalname,
                        type,
                        text: formattedText,
                        pages: result.pages,
                        metadata: result.metadata,
                    });
                    console.log(`✅ Added ${file.originalname} (${result.text.length} chars, ${result.metadata.pageCount} pages)`);
                }
                else {
                    console.warn(`⚠️ Empty text from ${file.originalname}`);
                }
            }
            catch (error) {
                console.error(`❌ Skipping ${file.originalname}: ${error.message}`);
            }
        }
        return results;
    }),
    /**
     * Combina todos los documentos extraídos en un solo string para el prompt
     */
    combineExtractedTexts: (documents) => {
        return documents.map(doc => doc.text).join('\n\n');
    },
    /**
     * Valida que el archivo sea un PDF válido
     */
    validatePdf: (filePath) => {
        try {
            // Verificar que existe
            if (!fs_1.default.existsSync(filePath)) {
                return { valid: false, error: 'File does not exist' };
            }
            const stats = fs_1.default.statSync(filePath);
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
            const buffer = fs_1.default.readFileSync(filePath);
            if (buffer.length < 5) {
                return { valid: false, error: 'File too small' };
            }
            const header = buffer.slice(0, 5).toString();
            if (header !== '%PDF-') {
                return { valid: false, error: 'File is not a valid PDF' };
            }
            return { valid: true };
        }
        catch (error) {
            return { valid: false, error: error.message };
        }
    },
};
