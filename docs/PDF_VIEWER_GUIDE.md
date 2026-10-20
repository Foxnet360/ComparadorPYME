# Visor PDF Interactivo - Guía de Uso

## Descripción

El visor PDF interactivo permite validar visualmente las evidencias RAG directamente desde la matriz de coberturas, sin necesidad de abrir archivos externos.

## Cómo Usar

### 1. Acceder a la Evidencia

En la matriz de coberturas (modo técnico), las celdas que tienen evidencia RAG muestran un botón "Ver Evidencia" con el número de página:

```
┌─────────────────────────────────────────────┐
│ Incendio          │ $1.000M      │ Pág. 3  │
│                   │ [Ver Evidencia]          │
└─────────────────────────────────────────────┘
```

### 2. Abrir el Visor

Haz clic en el botón "Ver Evidencia" o en el número de página para abrir el visor PDF.

### 3. Modos de Visualización

El visor se adapta automáticamente al tamaño de pantalla:

#### Desktop (>1024px)
- **Modo Drawer**: Panel lateral deslizable desde la derecha (40% del ancho)
- La matriz permanece visible a la izquierda
- Ideal para comparar evidencia con los datos de la matriz

```
┌─────────────────────┬────────────────────────┐
│                     │  VISOR PDF             │
│   MATRIZ            │  ┌────────────────┐    │
│                     │  │ Cotización.pdf │    │
│   [Celdas de        │  │ Página 3 de 15 │    │
│    coberturas]      │  │                │    │
│                     │  │ [Texto         │    │
│                     │  │  resaltado]    │    │
│                     │  │                │    │
│                     │  └────────────────┘    │
└─────────────────────┴────────────────────────┘
```

#### Tablet (768-1024px)
- **Modo Modal**: Ventana centrada (80% ancho, 90% alto)
- Fondo oscurecido
- Foco en la evidencia específica

#### Mobile (<768px)
- **Modo Fullscreen**: Pantalla completa
- Controles optimizados para touch
- Swipe para navegar entre páginas

### 4. Navegación

El visor carga automáticamente la página donde se encontró la evidencia (según `pageNumber` o `calculatedPage`).

**Controles disponibles:**
- **Anterior/Siguiente**: Botones de navegación de página
- **Zoom**: +/- para acercar/alejar (escala por defecto: 150%)
- **Input de página**: Ir directamente a una página específica
- **Cerrar**: X en la esquina superior derecha

### 5. Resaltado de Texto

El sistema intenta resaltar automáticamente el `rawTextSnippet` en la página actual usando un fondo amarillo semitransparente.

```
Página 3:
"...El asegurador se compromete a [indemnizar los daños
materiales ocasionados por incendio]..."
                          ^
                          └── Texto resaltado en amarillo
```

### 6. Cerrar el Visor

- Haz clic en el botón **X** en la esquina superior derecha
- Haz clic fuera del panel (en modo drawer/modal)
- Presiona la tecla **Escape**

## Integración Técnica

### Props del Componente

```typescript
interface PdfViewerProps {
  pdfUrl: string;           // URL del PDF (blob o ruta)
  targetPage: number;       // Página a mostrar
  searchText?: string;      // Texto a resaltar
  title: string;            // Título mostrado en header
  isOpen: boolean;          // Estado abierto/cerrado
  onClose: () => void;      // Callback al cerrar
}
```

### Ejemplo de Implementación

```tsx
import { lazy, Suspense } from 'react';

const PdfViewer = lazy(() => import('./components/PdfViewer'));

function MyComponent() {
  const [pdfViewer, setPdfViewer] = useState(null);

  const openEvidence = (cell, quote) => {
    setPdfViewer({
      pdfUrl: `/api/quotes/${quote.insurerName}/pdf`,
      targetPage: cell.calculatedPage || 1,
      searchText: cell.rawTextSnippet,
      title: `Evidencia - ${quote.insurerName}`,
    });
  };

  return (
    <div>
      <button onClick={openEvidence}>Ver Evidencia</button>
      
      <Suspense fallback={null}>
        {pdfViewer && (
          <PdfViewer
            {...pdfViewer}
            isOpen={!!pdfViewer}
            onClose={() => setPdfViewer(null)}
          />
        )}
      </Suspense>
    </div>
  );
}
```

## Dependencias

- `pdfjs-dist`: Renderizado de PDF
- `lucide-react`: Iconos de UI

## Configuración

El worker de PDF.js se configura automáticamente:

```typescript
import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = 
  '/node_modules/pdfjs-dist/build/pdf.worker.mjs';
```

## Notas

- El visor utiliza `react.lazy` para carga diferida, reduciendo el bundle inicial
- En producción, el worker se sirve desde el directorio `public/`
- El resaltado de texto requiere que el PDF tenga texto seleccionable (no imágenes escaneadas)
