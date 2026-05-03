# Spec: Text Extraction from PDF

## Capability
Extraer texto preservando la estructura por página, detectar PDFs escaneados, y extraer metadata del documento.

## User Story
**Como** sistema de indexación  
**Quiero** extraer texto de PDFs nativos manteniendo referencias de página  
**Para** poder crear chunks semánticos precisos

## Functional Requirements

### FR-1: Extracción básica de texto
- Usar pdfjs-dist para extraer texto
- Preservar texto por página (no solo texto concatenado)
- Limpiar artefactos comunes de PDF (números de página sueltos, espacios múltiples)

### FR-2: Detección de PDFs escaneados
- Calcular promedio de texto por página
- Detectar si < 30% de páginas tienen contenido significativo
- Reportar warning si el PDF parece ser escaneado
- Criterio: < 200 caracteres promedio por página = posible escaneado

### FR-3: Extracción de metadata
Extraer del PDF:
- Título (`Title`)
- Autor (`Author`)
- Asunto (`Subject`)
- Palabras clave (`Keywords`)
- Creador (`Creator`)
- Productor (`Producer`)
- Fecha de creación (`CreationDate`)
- Fecha de modificación (`ModDate`)
- Número de páginas

### FR-4: Estructura de retorno
```typescript
interface PDFExtractionResult {
  text: string;                    // Texto completo concatenado
  pages: PageData[];              // Array con texto por página
  metadata: PDFMetadata;          // Metadata del documento
  warnings: string[];             // Advertencias detectadas
  isScanned: boolean;             // Flag de PDF escaneado
}

interface PageData {
  pageNumber: number;
  text: string;
  wordCount: number;
  hasContent: boolean;            // true si > 5 palabras
}
```

## Non-Functional Requirements

### NFR-1: Performance
- Procesar 50 páginas en < 5 segundos
- Uso de memoria: < 100MB por documento

### NFR-2: Robustez
- Manejar errores por página (no fallar todo si una página falla)
- Validar que el archivo existe antes de procesar
- Validar header de PDF (%PDF-)

### NFR-3: Calidad de texto
- Normalizar espacios múltiples
- Eliminar números de página sueltos
- Preservar saltos de párrafo

## Error Handling

### Error Types
1. **FILE_NOT_FOUND** - Archivo no existe
2. **INVALID_PDF** - No es un PDF válido
3. **EMPTY_PDF** - PDF sin texto extraíble
4. **SCANNED_PDF** - PDF escaneado (warning, no error)
5. **EXTRACTION_FAILED** - Error genérico de extracción

### Error Response
```typescript
class PDFExtractionError extends Error {
  code: string;  // FILE_NOT_FOUND | INVALID_PDF | etc
}
```

## Interface Specification

### Main Function
```typescript
extractTextFromPdf(filePath: string): Promise<PDFExtractionResult>
```

### Helper Functions
```typescript
// Extraer por página (legacy)
extractTextByPage(filePath: string): Promise<PageData[]>

// Validar PDF
validatePdf(filePath: string): { valid: boolean; error?: string }

// Limpiar texto
cleanText(text: string): string
```

## Dependencies
- **pdfjs-dist**: Para extracción de texto
- **fs**: Para lectura de archivos

## Edge Cases
1. PDF con páginas vacías
2. PDF con solo imágenes
3. PDF corrupto
4. PDF protegido con contraseña (no soportado)
5. PDF muy grande (> 50MB - rechazar)

## Testing Strategy
- Unit tests con PDFs de prueba
- Mock de pdfjs-dist
- Test de edge cases (vacío, corrupto, escaneado)

## Acceptance Criteria
- [ ] Extrae texto manteniendo referencia a página
- [ ] Detecta PDFs escaneados correctamente
- [ ] Extrae metadata cuando está disponible
- [ ] Limpia artefactos del PDF
- [ ] Maneja errores con excepciones específicas
- [ ] Procesa PDF de 50 páginas en < 5 segundos
