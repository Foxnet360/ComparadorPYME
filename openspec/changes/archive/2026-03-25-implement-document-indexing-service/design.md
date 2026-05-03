# Design: Document Indexing Service

## Overview
Servicio de backend para indexar documentos PDF de seguros (clausulados y cotizaciones) en Supabase con recuperación semántica.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    DOCUMENT INDEXING SERVICE                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  POST /api/documents/index                                      │
│       │                                                         │
│       ▼                                                         │
│  ┌─────────────────┐                                            │
│  │ Upload PDF      │                                            │
│  │ (Multer)        │                                            │
│  └────────┬────────┘                                            │
│           │                                                     │
│           ▼                                                     │
│  ┌─────────────────┐     ┌─────────────────┐                    │
│  │ PDF Extractor   │────▶│ Text chunks     │                    │
│  │ (pdf-parse)     │     │ (semantic)      │                    │
│  └─────────────────┘     └────────┬────────┘                    │
│                                   │                             │
│                    ┌──────────────┼──────────────┐              │
│                    ▼              ▼              ▼              │
│            ┌──────────┐  ┌──────────┐  ┌──────────┐            │
│            │ Gemini   │  │ PDF2Pic  │  │ Tesauro  │            │
│            │ Embeddings│  │ Renderer │  │ Matcher  │            │
│            └────┬─────┘  └────┬─────┘  └──────────┘            │
│                 │             │                                │
│                 ▼             ▼                                │
│            ┌──────────┐  ┌──────────┐                         │
│            │ Supabase │  │ Supabase │                         │
│            │ Chunks   │  │ Storage  │                         │
│            │ (vectors)│  │ (images) │                         │
│            └──────────┘  └──────────┘                         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Components

### 1. Document Controller
**File**: `server/src/controllers/documentController.ts`

Endpoints:
- `POST /api/documents` - Indexar nuevo documento
- `GET /api/documents` - Listar documentos por aseguradora
- `GET /api/documents/:id` - Obtener documento específico
- `DELETE /api/documents/:id` - Eliminar documento
- `GET /api/documents/:id/chunks` - Obtener chunks de un documento

### 2. Document Service
**File**: `server/src/services/documentIndexingService.ts`

Responsabilidades:
- Coordinar extracción, chunking y almacenamiento
- Validar metadata del documento
- Gestionar transacciones con Supabase
- Manejar errores y rollback

### 3. PDF Extractor
**File**: `server/src/services/pdfExtractor.ts` (ya existe)

Mejoras necesarias:
- Extraer metadata (autor, título, páginas)
- Preservar estructura de páginas
- Detectar tipo de contenido (tablas, texto)

### 4. Semantic Chunker
**File**: `server/src/services/semanticChunker.ts` (ya existe)

Mejoras:
- Integrar con tesauro para tags de cobertura
- Detectar secciones (COBERTURA, EXCLUSION, etc.)
- Preservar metadata de página

### 5. Embedding Service
**File**: `server/src/services/vector/embeddingService.ts` (ya existe)

Configurado para:
- Modelo: `embedding-001`
- Dimensión: 768
- Batch processing

### 6. PDF Renderer
**File**: `server/src/services/pdfRenderer.ts` (ya existe)

Funcionalidad:
- Renderizar cada página a PNG
- Subir a Supabase Storage
- Retornar URLs públicas

## Data Flow

### Indexación de Documento

```
1. Cliente sube PDF + metadata
   ↓
2. Guardar archivo temporal
   ↓
3. Extraer texto con pdf-parse
   ↓
4. Para cada página:
   a. Renderizar a PNG
   b. Subir a Storage
   c. Guardar referencia
   ↓
5. Crear chunks semánticos:
   a. Dividir texto
   b. Detectar coberturas (tesauro)
   c. Clasificar sección
   ↓
6. Generar embeddings para cada chunk
   ↓
7. Guardar en Supabase:
   - Tabla documents (metadata)
   - Tabla page_images (URLs)
   - Tabla chunks (vectores)
   ↓
8. Retornar documentId + stats
```

## Database Schema

Ya implementado en Fase 1:
- `insurers` - Catálogo de aseguradoras
- `documents` - Metadata de documentos
- `page_images` - Referencias a imágenes
- `chunks` - Vectores y contenido

## API Endpoints

### POST /api/documents
Request:
```multipart/form-data
file: PDF
insurerName: string
documentName: string
documentType: 'CLAUSULADO_GENERAL' | 'CLAUSULADO_PARTICULAR' | 'COTIZACION'
```

Response:
```json
{
  "documentId": "uuid",
  "insurerId": "uuid",
  "documentName": "string",
  "totalPages": 50,
  "chunksCreated": 150,
  "imagesUploaded": 50,
  "status": "completed"
}
```

### GET /api/documents
Query params:
- `insurerId` (optional)
- `documentType` (optional)

Response:
```json
{
  "documents": [
    {
      "id": "uuid",
      "documentName": "string",
      "documentType": "string",
      "totalPages": 50,
      "chunkCount": 150,
      "createdAt": "timestamp"
    }
  ]
}
```

## Error Handling

### Errores esperados:
1. **PDF corrupto** → 400 Bad Request
2. **PDF sin texto** → 400 Bad Request + warning
3. **Error de extracción** → 500 Internal Error
4. **Error de Storage** → 500 + rollback parcial
5. **Límite de tamaño** → 413 Payload Too Large

### Estrategia:
- Usar transacciones donde sea posible
- Rollback manual si algo falla mid-process
- Logging detallado para debugging
- Retornar errores específicos al cliente

## Performance Considerations

1. **Chunking asíncrono**: Procesar embeddings en paralelo (batch size: 5)
2. **Renderizado**: Una página a la vez para no saturar memoria
3. **Timeouts**: 5 minutos máximo para documentos grandes
4. **Límites**: Max 50MB por archivo, max 200 páginas

## Security

1. **Validación**: Solo PDFs, verificar mime-type
2. **Sanitización**: Nombres de archivo limpios
3. **Acceso**: Service role key solo en backend
4. **Storage**: URLs públicas solo para imágenes (no documentos originales)

## Testing Strategy

1. **Unit tests**: Servicios individuales
2. **Integration tests**: Flujo completo con mocks
3. **E2E tests**: Subir PDF real, verificar indexación
4. **Load tests**: Múltiples documentos concurrentes

## Future Improvements

1. Cola de procesamiento (Redis/Bull)
2. OCR para PDFs escaneados
3. Procesamiento paralelo de páginas
4. WebSockets para progreso en tiempo real
5. Cache de embeddings frecuentes
