import { useState, useEffect, useCallback, useRef } from 'react';
import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = '/node_modules/pdfjs-dist/build/pdf.worker.mjs';

export interface PdfDocument {
  pdf: pdfjsLib.PDFDocumentProxy;
  numPages: number;
}

export function usePdfDocument(pdfUrl: string) {
  const [document, setDocument] = useState<PdfDocument | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const loadDocument = useCallback(async (url: string) => {
    // Cancelar carga anterior si existe
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    
    setLoading(true);
    setError(null);
    
    try {
      const loadingTask = pdfjsLib.getDocument({ url });
      const pdf = await loadingTask.promise;
      
      if (!abortController.signal.aborted) {
        setDocument({ pdf, numPages: pdf.numPages });
      }
    } catch (err) {
      if (!abortController.signal.aborted) {
        setError(err instanceof Error ? err.message : 'Error cargando PDF');
      }
    } finally {
      if (!abortController.signal.aborted) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    if (pdfUrl) {
      loadDocument(pdfUrl);
    }
    
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [pdfUrl, loadDocument]);

  const getPage = useCallback(async (pageNumber: number) => {
    if (!document) return null;
    
    try {
      return await document.pdf.getPage(pageNumber);
    } catch (err) {
      console.error('Error obteniendo página:', err);
      return null;
    }
  }, [document]);

  const searchText = useCallback(async (pageNumber: number, searchText: string) => {
    if (!document) return null;
    
    try {
      const page = await document.pdf.getPage(pageNumber);
      const textContent = await page.getTextContent();
      
      // Buscar el texto en los items
      const matches = textContent.items.filter((item) => {
        if ('str' in item) {
          return item.str.toLowerCase().includes(searchText.toLowerCase());
        }
        return false;
      });
      
      return matches;
    } catch (err) {
      console.error('Error buscando texto:', err);
      return null;
    }
  }, [document]);

  return {
    document,
    loading,
    error,
    numPages: document?.numPages || 0,
    getPage,
    searchText,
  };
}
