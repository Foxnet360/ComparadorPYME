## Why

El sistema de upload de documentos (`DocumentIndexingService`) almacena los clausulados PDF en las tablas `documents` + `chunks`, pero los servicios de análisis avanzado (`clauseCoverageValidator`, `ragRetrievalService`, etc.) buscan los datos en `clause_chunks` + `clause_coverages`. Estos son dos sistemas completamente desconectados: cuando se sube un clausulado por la plataforma, se indexa en un sistema pero nunca en el otro. Como resultado, el análisis avanzado no encuentra datos y el chatbot responde "no tengo suficiente información" incluso cuando los clausulados están subidos.

## What Changes

- Modificar `documentController.createDocument` para detectar cuando se sube un clausulado (`CLAUSULADO_GENERAL` o `CLAUSULADO_PARTICULAR`) y ejecutar automáticamente `clauseIndexer.startIndexing()` después del indexado principal
- Crear script de re-indexación para los clausulados ya subidos (SBS y HDI) sin necesidad de volver a subirlos
- Corregir referencia a tabla inexistente `clause_documents` en `auditEnrichmentService` (debe usar `documents` o `clause_chunks`)
- Verificar que la función `match_clauses` RPC existe en Supabase y funciona correctamente
- Validar que los embeddings generados por `DocumentIndexingService` sean compatibles con los esperados por `ragRetrievalService` (dimensiones 768 vs 3072)

## Capabilities

### New Capabilities
- `clause-auto-indexing`: Indexación automática de clausulados en el sistema de análisis avanzado al subir documentos
- `clause-reindex-script`: Script para re-indexar clausulados existentes sin re-upload

### Modified Capabilities
- `document-upload`: Modificar el flujo de upload para incluir indexación en `clause_chunks` y `clause_coverages` cuando el tipo es clausulado
- `clause-coverage-validation`: Los servicios ahora encontrarán datos reales en vez de tablas vacías
- `rag-audit-enrichment`: Corregir referencia a tabla `clause_documents` que no existe

## Impact

**Backend:**
- `server/src/controllers/documentController.ts` - Agregar llamada a `clauseIndexer` después de indexar
- `server/src/services/documentIndexingService.ts` - Verificar compatibilidad de embeddings
- `server/src/services/auditEnrichmentService.ts` - Corregir nombre de tabla
- `server/src/services/clauseIndexer.ts` - Verificar que funciona con documentos ya en storage

**Base de Datos:**
- Verificar existencia de función `match_clauses` RPC
- Verificar dimensiones de embeddings en `clause_chunks` (768) vs `chunks` (3072)

**Proceso:**
- Los 2 clausulados existentes (SBS, HDI) necesitan re-indexación
- Los futuros clausulados se indexarán automáticamente

## Notas

- No es un breaking change: el flujo actual sigue funcionando, solo se agrega indexación adicional
- Los documentos tipo `COTIZACION` y `ANEXO` no necesitan indexación en `clause_chunks`
- Se debe mantener la retrocompatibilidad con el sistema actual de `documents` + `chunks`
