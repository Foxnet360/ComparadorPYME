import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { X, ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from 'lucide-react';
import { useBreakpoint } from '../hooks/useBreakpoint';

pdfjsLib.GlobalWorkerOptions.workerSrc = '/node_modules/pdfjs-dist/build/pdf.worker.mjs';

interface PdfViewerProps {
  pdfUrl: string;
  targetPage: number;
  searchText?: string;
  title: string;
  isOpen: boolean;
  onClose: () => void;
}

const PdfViewer: React.FC<PdfViewerProps> = ({ 
  pdfUrl, 
  targetPage, 
  searchText, 
  title, 
  isOpen, 
  onClose 
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [currentPage, setCurrentPage] = useState(targetPage);
  const [numPages, setNumPages] = useState(0);
  const [scale, setScale] = useState(1.5);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { isMobile, isTablet } = useBreakpoint();
  
  // Determinar modo basado en breakpoint
  const getMode = () => {
    if (isMobile) return 'fullscreen';
    if (isTablet) return 'modal';
    return 'drawer';
  };
  
  const mode = getMode();

  // Cargar PDF
  useEffect(() => {
    if (!isOpen || !pdfUrl) return;
    
    const loadPdf = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const loadingTask = pdfjsLib.getDocument({ url: pdfUrl });
        const pdf = await loadingTask.promise;
        setPdfDoc(pdf);
        setNumPages(pdf.numPages);
        setCurrentPage(Math.min(targetPage, pdf.numPages));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error cargando PDF');
      } finally {
        setLoading(false);
      }
    };
    
    loadPdf();
  }, [pdfUrl, isOpen, targetPage]);

  // Renderizar página
  const renderPage = useCallback(async (pageNum: number) => {
    if (!pdfDoc || !canvasRef.current) return;
    
    try {
      const page = await pdfDoc.getPage(pageNum);
      const viewport = page.getViewport({ scale });
      
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d')!;
      
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      
      await page.render({ canvasContext: context, viewport }).promise;
      
      // Resaltar texto si existe
      if (searchText) {
        await highlightText(page, searchText, viewport, context);
      }
    } catch (err) {
      console.error('Error renderizando página:', err);
    }
  }, [pdfDoc, scale, searchText]);

  // Efecto para renderizar cuando cambia página o escala
  useEffect(() => {
    if (pdfDoc) {
      renderPage(currentPage);
    }
  }, [pdfDoc, currentPage, scale, renderPage]);

  // Resaltar texto
  const highlightText = async (
    page: pdfjsLib.PDFPageProxy, 
    text: string, 
    viewport: pdfjsLib.PageViewport,
    context: CanvasRenderingContext2D
  ) => {
    try {
      const textContent = await page.getTextContent();
      const lowerSearchText = text.toLowerCase();
      
      textContent.items.forEach((item: any) => {
        if ('str' in item && item.str.toLowerCase().includes(lowerSearchText)) {
          // Calcular posición en canvas
          const tx = pdfjsLib.Util.transform(
            viewport.transform,
            item.transform
          );
          
          const fontHeight = Math.hypot(tx[0], tx[1]);
          const fontWidth = Math.hypot(tx[2], tx[3]);
          
          context.save();
          context.fillStyle = 'rgba(255, 255, 0, 0.4)';
          context.fillRect(
            item.transform[4],
            item.transform[5] - fontHeight,
            item.width * fontWidth,
            fontHeight * 1.2
          );
          context.restore();
        }
      });
    } catch (err) {
      console.warn('No se pudo resaltar texto:', err);
    }
  };

  const goToPage = (page: number) => {
    if (page >= 1 && page <= numPages) {
      setCurrentPage(page);
    }
  };

  const zoomIn = () => setScale(prev => Math.min(prev + 0.25, 3));
  const zoomOut = () => setScale(prev => Math.max(prev - 0.25, 0.5));

  if (!isOpen) return null;

  const containerClasses = {
    drawer: 'fixed inset-y-0 right-0 w-[40%] bg-white shadow-2xl z-50 flex flex-col',
    modal: 'fixed inset-0 z-50 flex items-center justify-center bg-black/50',
    fullscreen: 'fixed inset-0 z-50 bg-white flex flex-col',
  };

  const contentClasses = {
    drawer: 'h-full flex flex-col',
    modal: 'w-[80%] h-[90%] bg-white rounded-lg shadow-2xl flex flex-col',
    fullscreen: 'h-full flex flex-col',
  };

  return (
    <div className={containerClasses[mode]}>
      <div className={contentClasses[mode]}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b bg-slate-50">
          <div className="flex items-center gap-2">
            <span className="font-medium text-slate-700 truncate max-w-[200px]">
              {title}
            </span>
            <span className="text-sm text-slate-500">
              Página {currentPage} de {numPages}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {/* Zoom controls */}
            <button
              onClick={zoomOut}
              className="p-1.5 hover:bg-slate-200 rounded-lg transition-colors"
              aria-label="Alejar"
            >
              <ZoomOut size={18} />
            </button>
            <span className="text-sm text-slate-600 min-w-[3rem] text-center">
              {Math.round(scale * 100)}%
            </span>
            <button
              onClick={zoomIn}
              className="p-1.5 hover:bg-slate-200 rounded-lg transition-colors"
              aria-label="Acercar"
            >
              <ZoomIn size={18} />
            </button>
            
            {/* Close button */}
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-slate-200 rounded-lg transition-colors ml-2"
              aria-label="Cerrar visor PDF"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Navigation bar */}
        <div className="flex items-center justify-center gap-4 px-4 py-2 border-b bg-slate-50">
          <button
            onClick={() => goToPage(currentPage - 1)}
            disabled={currentPage <= 1}
            className="p-1.5 hover:bg-slate-200 rounded-lg transition-colors disabled:opacity-30"
            aria-label="Página anterior"
          >
            <ChevronLeft size={18} />
          </button>
          
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={currentPage}
              onChange={(e) => goToPage(parseInt(e.target.value) || 1)}
              min={1}
              max={numPages}
              className="w-16 px-2 py-1 text-center border rounded-md text-sm"
              aria-label="Número de página"
            />
            <span className="text-sm text-slate-500">
              / {numPages}
            </span>
          </div>
          
          <button
            onClick={() => goToPage(currentPage + 1)}
            disabled={currentPage >= numPages}
            className="p-1.5 hover:bg-slate-200 rounded-lg transition-colors disabled:opacity-30"
            aria-label="Página siguiente"
          >
            <ChevronRight size={18} />
          </button>
        </div>

        {/* PDF Canvas */}
        <div className="flex-1 overflow-auto flex items-center justify-center bg-slate-100 p-4">
          {loading && (
            <div className="text-slate-500">Cargando PDF...</div>
          )}
          
          {error && (
            <div className="text-red-500 p-4 text-center">
              <p className="font-medium">Error cargando PDF</p>
              <p className="text-sm mt-1">{error}</p>
            </div>
          )}
          
          {!loading && !error && (
            <canvas
              ref={canvasRef}
              className="shadow-lg bg-white"
              style={{ maxWidth: '100%', height: 'auto' }}
            />
          )}
        </div>

        {/* Footer con info de búsqueda */}
        {searchText && (
          <div className="px-4 py-2 border-t bg-yellow-50 text-sm text-yellow-800">
            Buscando: "{searchText}"
          </div>
        )}
      </div>
      
      {/* Overlay para modal */}
      {mode === 'modal' && (
        <div 
          className="fixed inset-0 bg-black/50 -z-10" 
          onClick={onClose}
        />
      )}
    </div>
  );
};

export default PdfViewer;
