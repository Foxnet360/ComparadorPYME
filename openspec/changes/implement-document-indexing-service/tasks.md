# Tasks: Document Indexing Service

## Phase 1: Core Infrastructure

### Task 1.1: Refactor PDF Extractor
**Status**: ✅ Complete
**File**: `server/src/services/pdfExtractor.ts`

- [x] Agregar extracción de metadata (autor, título, páginas)
- [x] Preservar información de página en estructura de retorno
- [x] Validar que el PDF tiene texto seleccionable
- [x] Agregar manejo de errores específicos
- [ ] Tests unitarios

**Acceptance Criteria**:
- Extrae texto manteniendo referencia a página
- Detecta PDFs escaneados (sin texto)
- Retorna estructura: `{ text: string, pages: PageData[], metadata: object }`

---

### Task 1.2: Enhance Semantic Chunker
**Status**: ✅ Complete
**File**: `server/src/services/semanticChunker.ts`

- [x] Integrar con thesaurusService para detectar coberturas
- [x] Agregar campo `coverage_tags` a los chunks
- [x] Detectar tipo de sección (COBERTURA, EXCLUSION, DEDUCIBLE, CONDICION)
- [x] Preservar page_number en cada chunk
- [x] Normalizar texto (sin tildes, minúsculas)

**Acceptance Criteria**:
- Cada chunk tiene array de coverage_tags detectados
- Chunks marcados con section_type apropiado
- Tamaño óptimo de chunks (500-1000 caracteres)

---

### Task 1.3: Update Embedding Service
**Status**: ✅ Complete
**File**: `server/src/services/vector/embeddingService.ts`

- [x] Configurar modelo embedding-001 (768 dims)
- [x] Implementar batch processing
- [x] Manejo de rate limits
- [x] Agregar retry logic para fallos de API

**Acceptance Criteria**:
- Genera embeddings de 768 dimensiones
- Procesa batches de 5 chunks sin errores
- Retorna error claro si API falla

---

## Phase 2: Document Service

### Task 2.1: Create Document Indexing Service
**Status**: ✅ Complete
**File**: `server/src/services/documentIndexingService.ts`

- [x] Coordinar flujo completo de indexación
- [x] Función `indexDocument(pdfPath, metadata)`
- [x] Manejo de transacciones con Supabase
- [x] Rollback en caso de error
- [x] Logging detallado del proceso

**Acceptance Criteria**:
- Coordina extractor → chunker → embeddings → storage
- Usa transacción para document + chunks
- Si falla, elimina datos parciales
- Retorna stats del proceso

---

### Task 2.2: Integrate PDF Renderer
**Status**: 🔄 Already exists
**File**: `server/src/services/pdfRenderer.ts`

- [ ] Verificar integración con Storage
- [ ] Agregar tracking de progreso
- [ ] Manejar errores de renderizado individuales
- [ ] Cleanup de archivos temporales

**Acceptance Criteria**:
- Renderiza todas las páginas de un PDF de 50 páginas
- Sube a Supabase Storage correctamente
- Retorna array de URLs públicas

---

## Phase 3: API Controllers

### Task 3.1: Create Document Controller
**Status**: ✅ Complete
**File**: `server/src/controllers/documentController.ts`

- [x] Endpoint POST /api/documents (upload + index)
- [x] Endpoint GET /api/documents (list)
- [x] Endpoint GET /api/documents/:id (get one)
- [x] Endpoint DELETE /api/documents/:id (delete)
- [x] Endpoint GET /api/documents/:id/chunks
- [x] Middleware de validación (multer)
- [ ] Rate limiting (Phase 4)

**Acceptance Criteria**:
- Acepta multipart/form-data con PDF
- Valida campos requeridos
- Retorna JSON con documentId y stats
- Maneja errores con status codes apropiados

---

### Task 3.2: Create Search Controller
**Status**: ✅ Complete
**File**: `server/src/controllers/searchController.ts`

- [x] Endpoint POST /api/search (búsqueda semántica)
- [x] Query por cobertura específica
- [x] Filtros por aseguradora, tipo de documento
- [x] Retornar chunks con imágenes de página
- [x] Comparación cotización vs clausulado

**Acceptance Criteria**:
- Búsqueda por texto query
- Filtra por coverage_tag
- Retorna chunks ordenados por similitud
- Incluye URLs de imágenes de páginas

---

## Phase 4: Integration & Routes

### Task 4.1: Update Main Router
**Status**: ✅ Complete
**File**: `server/src/index.ts`

- [x] Importar documentController
- [x] Importar searchController
- [x] Registrar rutas /api/documents
- [x] Registrar rutas /api/search
- [x] Configurar multer para upload de archivos

**Acceptance Criteria**:
- Rutas accesibles en localhost:8080
- Upload de archivos funcionando
- Endpoints responden correctamente

---

### Task 4.2: Environment Configuration
**Status**: 🔄 Partial
**File**: `server/.env`

- [ ] Verificar todas las variables necesarias
- [ ] Agregar MAX_FILE_SIZE
- [ ] Agregar MAX_PAGES_LIMIT
- [ ] Agregar UPLOAD_TIMEOUT

**Acceptance Criteria**:
- .env.example actualizado
- Variables documentadas
- Valores por defecto razonables

---

## Phase 5: Testing

### Task 5.1: Unit Tests
**Status**: ❌ New
**Files**: `server/src/services/__tests__/*.test.ts`

- [ ] Tests para pdfExtractor
- [ ] Tests para semanticChunker
- [ ] Tests para documentIndexingService
- [ ] Tests para embeddingService

**Acceptance Criteria**:
- Cobertura > 80%
- Tests pasan con `npm test`
- Mocks para llamadas externas

---

### Task 5.2: Integration Tests
**Status**: ❌ New
**Files**: `server/src/__tests__/integration/*.test.ts`

- [ ] Test de flujo completo de indexación
- [ ] Test de búsqueda semántica
- [ ] Test de eliminación de documento
- [ ] Setup/teardown de base de datos de prueba

**Acceptance Criteria**:
- Usa base de datos de test
- Limpia datos después de cada test
- Tests independientes entre sí

---

### Task 5.3: E2E Tests
**Status**: ❌ New

- [ ] Script de prueba con PDF real
- [ ] Verificar chunks creados correctamente
- [ ] Verificar imágenes renderizadas
- [ ] Verificar búsqueda funciona

**Acceptance Criteria**:
- Script ejecutable manualmente
- Documentación de cómo correr
- Resultados verificables

---

## Phase 6: Documentation

### Task 6.1: API Documentation
**Status**: ❌ New
**File**: `server/API.md`

- [ ] Documentar todos los endpoints
- [ ] Ejemplos de request/response
- [ ] Códigos de error
- [ ] Postman collection o curl examples

---

### Task 6.2: Update Setup Guide
**Status**: 🔄 Update
**File**: `server/supabase-setup.md`

- [ ] Agregar sección de cómo indexar documentos
- [ ] Ejemplos de uso del API
- [ ] Troubleshooting común

---

## Task Status Summary

| Phase | Tasks | Status |
|-------|-------|--------|
| 1 - Infrastructure | 3 | 1/3 complete |
| 2 - Document Service | 2 | 0/2 complete |
| 3 - API Controllers | 2 | 0/2 complete |
| 4 - Integration | 2 | 0/2 complete |
| 5 - Testing | 3 | 0/3 complete |
| 6 - Documentation | 2 | 0/2 complete |

**Total**: 14 tasks | **Completed**: 1 | **Remaining**: 13
