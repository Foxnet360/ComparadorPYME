"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
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
exports.pdfRenderer = void 0;
const pdf2pic_1 = require("pdf2pic");
const sharp_1 = __importDefault(require("sharp"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const database_1 = require("../config/database");
const BUCKET_NAME = process.env.CLAUSE_PAGES_BUCKET || 'clause-pages';
const defaultOptions = {
    density: 150, // Buena calidad para lectura
    width: 1200, // Ancho razonable
    format: 'png',
};
// Directorio temporal para renderizado
const TEMP_DIR = '/tmp/pdf-render';
// Asegurar que existe el directorio temporal
if (!fs_1.default.existsSync(TEMP_DIR)) {
    fs_1.default.mkdirSync(TEMP_DIR, { recursive: true });
}
exports.pdfRenderer = {
    /**
     * Renderiza un PDF completo a imágenes PNG
     */
    renderDocumentPages: (pdfPath_1, insurerId_1, documentId_1, ...args_1) => __awaiter(void 0, [pdfPath_1, insurerId_1, documentId_1, ...args_1], void 0, function* (pdfPath, insurerId, documentId, options = {}) {
        const opts = Object.assign(Object.assign({}, defaultOptions), options);
        const pages = [];
        try {
            // Verificar que el archivo existe
            if (!fs_1.default.existsSync(pdfPath)) {
                throw new Error(`PDF file not found: ${pdfPath}`);
            }
            // Obtener número de páginas
            const pageCount = yield exports.pdfRenderer.getPageCount(pdfPath);
            console.log(`📄 [PDF Renderer] Rendering ${pageCount} pages for document ${documentId}`);
            // Renderizar cada página
            for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
                try {
                    const tempFilePath = path_1.default.join(TEMP_DIR, `page-${pageNum}.png`);
                    // Configurar pdf2pic para guardar archivo
                    const convert = (0, pdf2pic_1.fromPath)(pdfPath, {
                        density: opts.density,
                        width: opts.width,
                        height: opts.height,
                        format: 'png',
                        quality: opts.quality,
                        saveFilename: `page-${pageNum}`,
                        savePath: TEMP_DIR,
                    });
                    const result = yield convert(pageNum);
                    if (!result || !result.name) {
                        console.warn(`⚠️ [PDF Renderer] Failed to render page ${pageNum}`);
                        continue;
                    }
                    // Leer el archivo generado
                    if (!fs_1.default.existsSync(tempFilePath)) {
                        console.warn(`⚠️ [PDF Renderer] Rendered file not found: ${tempFilePath}`);
                        continue;
                    }
                    const imageBuffer = fs_1.default.readFileSync(tempFilePath);
                    // Optimizar imagen con sharp
                    const optimizedBuffer = yield (0, sharp_1.default)(imageBuffer)
                        .png({ quality: 90, compressionLevel: 8 })
                        .toBuffer();
                    // Generar path en storage
                    const storagePath = `${insurerId}/${documentId}/page-${pageNum}.png`;
                    // Subir a Supabase Storage
                    const { error: uploadError } = yield database_1.supabase
                        .storage
                        .from(BUCKET_NAME)
                        .upload(storagePath, optimizedBuffer, {
                        contentType: 'image/png',
                        upsert: true,
                    });
                    if (uploadError) {
                        console.error(`❌ [PDF Renderer] Failed to upload page ${pageNum}:`, uploadError);
                        continue;
                    }
                    // Obtener URL pública
                    const { data: publicUrl } = database_1.supabase
                        .storage
                        .from(BUCKET_NAME)
                        .getPublicUrl(storagePath);
                    // Obtener dimensiones
                    const metadata = yield (0, sharp_1.default)(optimizedBuffer).metadata();
                    pages.push({
                        pageNumber: pageNum,
                        buffer: optimizedBuffer,
                        width: metadata.width || 0,
                        height: metadata.height || 0,
                        storagePath,
                        storageUrl: publicUrl.publicUrl,
                    });
                    // Limpiar archivo temporal
                    try {
                        fs_1.default.unlinkSync(tempFilePath);
                    }
                    catch (e) {
                        // Ignorar errores de limpieza
                    }
                    console.log(`✅ [PDF Renderer] Page ${pageNum} rendered and uploaded`);
                }
                catch (pageError) {
                    console.error(`❌ [PDF Renderer] Error rendering page ${pageNum}:`, pageError);
                }
            }
            console.log(`✅ [PDF Renderer] Completed: ${pages.length}/${pageCount} pages rendered`);
            return pages;
        }
        catch (error) {
            console.error('❌ [PDF Renderer] Fatal error:', error);
            throw error;
        }
    }),
    /**
     * Renderiza una sola página específica
     */
    renderSinglePage: (pdfPath_1, pageNumber_1, ...args_1) => __awaiter(void 0, [pdfPath_1, pageNumber_1, ...args_1], void 0, function* (pdfPath, pageNumber, options = {}) {
        try {
            const opts = Object.assign(Object.assign({}, defaultOptions), options);
            const tempFilePath = path_1.default.join(TEMP_DIR, `single-page-${pageNumber}.png`);
            const convert = (0, pdf2pic_1.fromPath)(pdfPath, {
                density: opts.density,
                width: opts.width,
                height: opts.height,
                format: 'png',
                quality: opts.quality,
                saveFilename: `single-page-${pageNumber}`,
                savePath: TEMP_DIR,
            });
            const result = yield convert(pageNumber);
            if (!result || !result.name) {
                return null;
            }
            if (!fs_1.default.existsSync(tempFilePath)) {
                return null;
            }
            const imageBuffer = fs_1.default.readFileSync(tempFilePath);
            // Optimizar
            const optimizedBuffer = yield (0, sharp_1.default)(imageBuffer)
                .png({ quality: 90 })
                .toBuffer();
            // Limpiar temporal
            try {
                fs_1.default.unlinkSync(tempFilePath);
            }
            catch (e) {
                // Ignorar
            }
            return optimizedBuffer;
        }
        catch (error) {
            console.error(`❌ [PDF Renderer] Error rendering page ${pageNumber}:`, error);
            return null;
        }
    }),
    /**
     * Obtiene el número de páginas de un PDF
     */
    getPageCount: (pdfPath) => __awaiter(void 0, void 0, void 0, function* () {
        try {
            // Usar pdf-lib para obtener metadata sin cargar todo el contenido
            const { PDFDocument } = yield Promise.resolve().then(() => __importStar(require('pdf-lib')));
            const pdfBuffer = fs_1.default.readFileSync(pdfPath);
            const pdf = yield PDFDocument.load(pdfBuffer, { updateMetadata: false });
            return pdf.getPageCount();
        }
        catch (error) {
            console.error('❌ [PDF Renderer] Error getting page count:', error);
            throw error;
        }
    }),
    /**
     * Elimina las imágenes de un documento del storage
     */
    deleteDocumentImages: (insurerId, documentId) => __awaiter(void 0, void 0, void 0, function* () {
        try {
            const folderPath = `${insurerId}/${documentId}`;
            // Listar archivos en el folder
            const { data: files, error: listError } = yield database_1.supabase
                .storage
                .from(BUCKET_NAME)
                .list(folderPath);
            if (listError) {
                console.error('❌ [PDF Renderer] Error listing files:', listError);
                return;
            }
            if (!files || files.length === 0) {
                return;
            }
            // Eliminar todos los archivos
            const filePaths = files.map((f) => `${folderPath}/${f.name}`);
            const { error: deleteError } = yield database_1.supabase
                .storage
                .from(BUCKET_NAME)
                .remove(filePaths);
            if (deleteError) {
                console.error('❌ [PDF Renderer] Error deleting files:', deleteError);
            }
            else {
                console.log(`✅ [PDF Renderer] Deleted ${filePaths.length} images for document ${documentId}`);
            }
        }
        catch (error) {
            console.error('❌ [PDF Renderer] Error deleting document images:', error);
        }
    }),
    /**
     * Obtiene la URL pública de una página
     */
    getPageImageUrl: (insurerId, documentId, pageNumber) => {
        const storagePath = `${insurerId}/${documentId}/page-${pageNumber}.png`;
        const { data } = database_1.supabase
            .storage
            .from(BUCKET_NAME)
            .getPublicUrl(storagePath);
        return data.publicUrl;
    },
};
console.log('🖼️ [PDF Renderer] Initialized with bucket:', BUCKET_NAME);
