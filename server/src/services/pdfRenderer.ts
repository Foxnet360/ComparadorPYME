import { fromPath } from 'pdf2pic';
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { supabase } from '../config/database';

const BUCKET_NAME = process.env.CLAUSE_PAGES_BUCKET || 'clause-pages';

export interface RenderedPage {
  pageNumber: number;
  buffer: Buffer;
  width: number;
  height: number;
  storagePath: string;
  storageUrl: string;
}

export interface PdfRenderOptions {
  density?: number;      // DPI (calidad)
  width?: number;        // Ancho en px
  height?: number;       // Alto en px
  format?: 'png' | 'jpg';
  quality?: number;      // Para JPG (0-100)
}

const defaultOptions: PdfRenderOptions = {
  density: 150,          // Buena calidad para lectura
  width: 1200,           // Ancho razonable
  format: 'png',
};

// Directorio temporal para renderizado
const TEMP_DIR = '/tmp/pdf-render';

// Asegurar que existe el directorio temporal
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

export const pdfRenderer = {
  /**
   * Renderiza un PDF completo a imágenes PNG
   */
  renderDocumentPages: async (
    pdfPath: string,
    insurerId: string,
    documentId: string,
    options: PdfRenderOptions = {}
  ): Promise<RenderedPage[]> => {
    const opts = { ...defaultOptions, ...options };
    const pages: RenderedPage[] = [];
    
    try {
      // Verificar que el archivo existe
      if (!fs.existsSync(pdfPath)) {
        throw new Error(`PDF file not found: ${pdfPath}`);
      }

      // Obtener número de páginas
      const pageCount = await pdfRenderer.getPageCount(pdfPath);
      console.log(`📄 [PDF Renderer] Rendering ${pageCount} pages for document ${documentId}`);

      // Renderizar cada página
      for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
        try {
          const tempFilePath = path.join(TEMP_DIR, `page-${pageNum}.png`);
          
          // Configurar pdf2pic para guardar archivo
          const convert = fromPath(pdfPath, {
            density: opts.density,
            width: opts.width,
            height: opts.height,
            format: 'png',
            quality: opts.quality,
            saveFilename: `page-${pageNum}`,
            savePath: TEMP_DIR,
          });

          const result = await convert(pageNum);
          
          if (!result || !result.name) {
            console.warn(`⚠️ [PDF Renderer] Failed to render page ${pageNum}`);
            continue;
          }

          // Leer el archivo generado
          if (!fs.existsSync(tempFilePath)) {
            console.warn(`⚠️ [PDF Renderer] Rendered file not found: ${tempFilePath}`);
            continue;
          }

          const imageBuffer = fs.readFileSync(tempFilePath);

          // Optimizar imagen con sharp
          const optimizedBuffer = await sharp(imageBuffer)
            .png({ quality: 90, compressionLevel: 8 })
            .toBuffer();

          // Generar path en storage
          const storagePath = `${insurerId}/${documentId}/page-${pageNum}.png`;

          // Subir a Supabase Storage
          const { error: uploadError } = await supabase
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
          const { data: publicUrl } = supabase
            .storage
            .from(BUCKET_NAME)
            .getPublicUrl(storagePath);

          // Obtener dimensiones
          const metadata = await sharp(optimizedBuffer).metadata();

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
            fs.unlinkSync(tempFilePath);
          } catch (e) {
            // Ignorar errores de limpieza
          }

          console.log(`✅ [PDF Renderer] Page ${pageNum} rendered and uploaded`);

        } catch (pageError) {
          console.error(`❌ [PDF Renderer] Error rendering page ${pageNum}:`, pageError);
        }
      }

      console.log(`✅ [PDF Renderer] Completed: ${pages.length}/${pageCount} pages rendered`);
      return pages;

    } catch (error) {
      console.error('❌ [PDF Renderer] Fatal error:', error);
      throw error;
    }
  },

  /**
   * Renderiza una sola página específica
   */
  renderSinglePage: async (
    pdfPath: string,
    pageNumber: number,
    options: PdfRenderOptions = {}
  ): Promise<Buffer | null> => {
    try {
      const opts = { ...defaultOptions, ...options };
      const tempFilePath = path.join(TEMP_DIR, `single-page-${pageNumber}.png`);
      
      const convert = fromPath(pdfPath, {
        density: opts.density,
        width: opts.width,
        height: opts.height,
        format: 'png',
        quality: opts.quality,
        saveFilename: `single-page-${pageNumber}`,
        savePath: TEMP_DIR,
      });

      const result = await convert(pageNumber);
      
      if (!result || !result.name) {
        return null;
      }

      if (!fs.existsSync(tempFilePath)) {
        return null;
      }

      const imageBuffer = fs.readFileSync(tempFilePath);

      // Optimizar
      const optimizedBuffer = await sharp(imageBuffer)
        .png({ quality: 90 })
        .toBuffer();

      // Limpiar temporal
      try {
        fs.unlinkSync(tempFilePath);
      } catch (e) {
        // Ignorar
      }

      return optimizedBuffer;

    } catch (error) {
      console.error(`❌ [PDF Renderer] Error rendering page ${pageNumber}:`, error);
      return null;
    }
  },

  /**
   * Obtiene el número de páginas de un PDF
   */
  getPageCount: async (pdfPath: string): Promise<number> => {
    try {
      // Usar pdf-lib para obtener metadata sin cargar todo el contenido
      const { PDFDocument } = await import('pdf-lib');
      const pdfBuffer = fs.readFileSync(pdfPath);
      const pdf = await PDFDocument.load(pdfBuffer, { updateMetadata: false });
      return pdf.getPageCount();
    } catch (error) {
      console.error('❌ [PDF Renderer] Error getting page count:', error);
      throw error;
    }
  },

  /**
   * Elimina las imágenes de un documento del storage
   */
  deleteDocumentImages: async (insurerId: string, documentId: string): Promise<void> => {
    try {
      const folderPath = `${insurerId}/${documentId}`;
      
      // Listar archivos en el folder
      const { data: files, error: listError } = await supabase
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
      const filePaths = files.map((f: { name: string }) => `${folderPath}/${f.name}`);
      const { error: deleteError } = await supabase
        .storage
        .from(BUCKET_NAME)
        .remove(filePaths);

      if (deleteError) {
        console.error('❌ [PDF Renderer] Error deleting files:', deleteError);
      } else {
        console.log(`✅ [PDF Renderer] Deleted ${filePaths.length} images for document ${documentId}`);
      }

    } catch (error) {
      console.error('❌ [PDF Renderer] Error deleting document images:', error);
    }
  },

  /**
   * Obtiene la URL pública de una página
   */
  getPageImageUrl: (insurerId: string, documentId: string, pageNumber: number): string => {
    const storagePath = `${insurerId}/${documentId}/page-${pageNumber}.png`;
    const { data } = supabase
      .storage
      .from(BUCKET_NAME)
      .getPublicUrl(storagePath);
    return data.publicUrl;
  },
};

console.log('🖼️ [PDF Renderer] Initialized with bucket:', BUCKET_NAME);
