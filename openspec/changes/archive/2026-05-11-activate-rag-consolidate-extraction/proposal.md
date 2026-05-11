## Why

El sistema Comparador PYME tiene 1,647 líneas de código de análisis avanzado que son invisibles para los usuarios. La tabla `clause_chunks` está vacía (0 registros) a pesar de tener 2 clausulados indexados en `documents` + `chunks`, lo que hace que el RAG, validación de coberturas, análisis de riesgo y chatbot respondan "no tengo información" o generen datos erróneos. Además, la extracción de cotizaciones tiene ~80% de error porque usa un prompt genérico para formatos variables de 10+ aseguradoras.

## What Changes

### Fase 1: Activar RAG (Reindexación de Clausulados)
- Ejecutar script `scripts/reindex-clauses.ts` para reindexar SBS y HDI en `clause_chunks`
- Subir e indexar clausulados de ejemplo adicionales: MAPFRE, BBVA, AXA Colpatria, CHUBB, Bolívar
- Verificar que `match_clauses` RPC retorna resultados

### Fase 2: Consolidar Arquitectura Vectorial
- **BREAKING**: Migrar funciones RAG (`match_clauses`, `match_clauses_vector`, `get_clauses_by_coverage`) para usar tabla `chunks` (3072 dims) con filtro `document_type = 'CLAUSULADO_*'`
- Deprecar tabla `clause_chunks` (768 dims) y eliminar duplicación de embeddings
- Agregar campo `insurer_name` a `chunks` o usar JOIN con `documents`
- Actualizar `ragRetrievalService` para usar nueva función unificada

### Fase 3: Mejorar Extracción de Cotizaciones
- Implementar sistema de perfiles por aseguradora (`InsurerExtractionProfile`)
- Migrar extracción a `gemini-2.5-pro` para mayor precisión en tablas complejas
- Agregar few-shot examples reales por aseguradora al prompt
- Implementar validación estricta con Zod/Joi del JSON extraído
- Crear pipeline de extracción: pre-procesar → detectar aseguradora → perfil específico → extraer → validar → cross-reference

### Fase 4: Chat con Memoria
- Crear tablas `chat_threads` y `chat_messages` en Supabase
- Modificar `chatService.ts` para incluir historial en el prompt
- Persistir conversaciones y contexto del reporte actual

## Capabilities

### New Capabilities
- `rag-activation`: Indexación y activación del sistema RAG para clausulados existentes
- `vector-store-consolidation`: Consolidación de almacenamiento vectorial en tabla única `chunks`
- `insurer-extraction-profiles`: Sistema de perfiles de extracción específicos por aseguradora
- `chat-memory-persistence`: Persistencia de conversaciones del chat con contexto de reportes

### Modified Capabilities
- `clause-rag-indexing`: Cambiar de `clause_chunks` a tabla `chunks` unificada
- `rag-retrieval`: Actualizar para usar `chunks` con filtro por `document_type`
- `chat-with-rag`: Agregar memoria de conversación y contexto persistente
- `pdf-text-extraction`: Agregar detección de aseguradora y perfil de extracción específico
- `document-upload`: Indexar clausulados solo en tabla `chunks` unificada (eliminar dualidad)
- `clause-coverage-validation`: Usar tabla `chunks` para búsqueda de clausulados

## Impact

### Backend
- `server/src/services/ragRetrievalService.ts` - Actualizar para usar tabla `chunks`
- `server/src/services/clauseIndexer.ts` - Deprecar o migrar a `DocumentIndexingService`
- `server/src/services/gemini.ts` - Cambiar modelo a `gemini-2.5-pro` para extracción
- `server/src/services/pdfExtractor.ts` - Agregar detección de aseguradora
- `server/src/services/chatService.ts` - Implementar memoria y persistencia
- `server/src/controllers/analysisController.ts` - Integrar perfiles de extracción
- Nuevo: `server/src/services/insurerProfileService.ts` - Perfiles por aseguradora

### Base de Datos
- Migrar funciones SQL de `clause_chunks` a `chunks`
- Crear tablas `chat_threads` y `chat_messages`
- Agregar índices en `chunks` para `document_type` y `insurer_name`
- **BREAKING**: Eliminar o deprecar tabla `clause_chunks`

### Frontend
- Ningún cambio de UI requerido (cambios solo en backend)
- Mejorarán los datos mostrados en `AuditDashboard` y `ComparisonReport`
- Chat mantendrá contexto entre mensajes

### Dependencias
- Requiere acceso a Supabase para migraciones SQL
- Requiere API key de Gemini válida con quota para `gemini-2.5-pro`
- Script de reindexación requiere Node.js + ts-node
