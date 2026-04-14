# Spec: Semantic Chunking

## Capability
Dividir el texto en chunks semánticos, detectar coberturas usando el tesauro, clasificar el tipo de sección, y preservar metadata de página.

## User Story
**Como** sistema de indexación  
**Quiero** crear chunks semánticos con metadata enriquecida  
**Para** permitir búsquedas focales por cobertura y tipo de sección

## Functional Requirements

### FR-1: Creación de chunks
- Tamaño objetivo: 500-1000 caracteres por chunk
- Combinar páginas consecutivas si no exceden el límite
- Preservar límite máximo de 3000 caracteres por chunk
- Crear IDs únicos para cada chunk

### FR-2: Detección de coberturas
- Usar thesaurusService para detectar coberturas de Plantilla PYME
- Verificar sinónimos y términos de búsqueda
- Asignar array de coverage_tags a cada chunk
- Soportar múltiples coberturas por chunk

### FR-3: Clasificación de secciones
Detectar tipo de sección:
- `COBERTURA` - Garantías, amparos
- `EXCLUSION` - Lo que no cubre
- `DEDUCIBLE` - Franquicias, participaciones
- `CONDICION` - Requisitos, obligaciones
- `GENERAL` - Definiciones, vigencia, prima

Patrones de detección basados en keywords.

### FR-4: Estructura de chunks
```typescript
interface Chunk {
  id: string;                    // Identificador único
  content: string;               // Texto original (max 3000)
  contentNormalized: string;     // Sin tildes, minúsculas
  metadata: {
    pageStart: number;
    pageEnd: number;
    clauseId?: string;          // Ej: "3.2"
    documentName?: string;
    insurerName?: string;
  };
  coverageTags: string[];        // Coberturas detectadas
  sectionType: SectionType;      // COBERTURA | EXCLUSION | etc
}
```

## Interface Specification

### Main Function
```typescript
createChunksFromPages(
  pages: PageData[],
  metadata: { documentName?: string; insurerName?: string }
): Chunk[]
```

### Helper Functions
```typescript
// Detectar coberturas
detectCoverages(text: string): string[]

// Detectar tipo de sección
detectSectionType(text: string): SectionType

// Normalizar texto
normalizeText(text: string): string
```

## Dependencies
- **thesaurusService**: Para detección de coberturas
- **pdfExtractor**: Para tipo PageData

## Acceptance Criteria
- [ ] Crea chunks de tamaño apropiado
- [ ] Detecta coberturas usando el tesauro
- [ ] Clasifica correctamente el tipo de sección
- [ ] Normaliza texto (sin tildes, minúsculas)
- [ ] Preserva referencias de página
