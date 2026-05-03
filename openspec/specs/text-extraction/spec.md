# Spec: Text Extraction

## Capability
Extracción de texto de PDFs preservando estructura por página, y extracción estructurada de datos de cotizaciones con enriquecimiento semántico.

## User Story
**Como** sistema de análisis
**Quiero** extraer texto de PDFs y estructurar datos de cotizaciones
**Para** analizar cotizaciones y comparar coberturas

## Functional Requirements

### FR-1: Extracción básica de texto de PDF
- Usar pdfjs-dist para extraer texto
- Preservar texto por página (no solo texto concatenado)
- Limpiar artefactos comunes de PDF (números de página sueltos, espacios múltiples)

### FR-2: Detección de PDFs escaneados
- Calcular promedio de texto por página
- Detectar si < 30% de páginas tienen contenido significativo
- Reportar warning si el PDF parece ser escaneado
- Criterio: < 200 caracteres promedio por página = posible escaneado

### FR-3: Extracción de metadata del PDF
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

### FR-4: Estructura de retorno del PDF
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

### FR-5: Extracción de datos estructurados de cotización
El sistema SHALL extraer coberturas de cotizaciones de seguros y enriquecer cada cobertura con metadatos de categorización canónica.

#### Scenario: Extracción con categorización
- **WHEN** el sistema extrae coberturas de una cotización
- **THEN** para cada cobertura se determina: nombre original, nombre canónico (de las 14 categorías), categoryId (1-14 o null), confianza del match (0-1), y método usado (thesaurus/fuzzy/embedding/llm)

#### Scenario: Validación de salida
- **WHEN** el sistema completa la extracción
- **THEN** el objeto CoverageItem incluye los campos: name, value, description, isPositive, canonicalName, categoryId, matchConfidence, matchMethod

### FR-6: Campos de mapeo semántico en extracción
La extracción de texto de cotizaciones SHALL enriquecer cada cobertura con campos de categorización canónica.

#### Scenario: Respuesta de API enriquecida
- **WHEN** el endpoint `/api/analyze` procesa cotizaciones
- **THEN** cada objeto `coverage` en la respuesta incluye: `canonicalName`, `categoryId`, `matchConfidence`, `matchMethod`

#### Scenario: Compatibilidad hacia atrás
- **WHEN** un cliente legacy consume la API
- **THEN** los campos nuevos son adicionales y no requieren cambios en el cliente

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
- **semanticMatcher**: Para enriquecimiento semántico de coberturas

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
- [ ] Enriquece coberturas con campos semánticos
- [ ] Mantiene compatibilidad hacia atrás en API
