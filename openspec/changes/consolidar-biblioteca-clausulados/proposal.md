## Why

El sistema actual tiene una arquitectura fragmentada para manejar clausulados: tres paths paralelos (ragClauseController in-memory, clauseController async, y documentController persistente) con inconsistencias en tablas (chunks 3072d vs clause_chunks 768d) y pérdida de datos en reinicios. Los brokers deben subir clausulados repetidamente para cada auditoría, generando costos innecesarios en embeddings y tiempo. Se necesita una biblioteca centralizada, versionada y persistente que permita pre-cargar clausulados de 24 aseguradoras y reutilizarlos sin costo adicional.

## What Changes

- **Consolidar backend**: Eliminar ragClauseController (in-memory) y clauseController (legacy async), quedando solo documentController + documentIndexingService como path único para indexación de clausulados
- **Migrar frontend**: ClauseAdmin.tsx y ClauseSelector.tsx dejarán de usar `/api/rag/*` y usarán `/api/documents` con persistencia en Supabase
- **Versionado automático**: Al subir un nuevo clausulado para una aseguradora, el sistema archiva automáticamente la versión anterior (is_active = false) y activa la nueva
- **Múltiples clausulados por aseguradora**: Permitir que una aseguradora tenga varios clausulados activos simultáneamente (General, Particular, Anexos) asociados a un mismo producto
- **CLI interactivo de pre-carga**: Script `npm run seed:clauses` que escanea PDFs, pregunta interactivamente nombre de producto, versión y tipo, e indexa en Supabase
- **Mejorar UX**: ClauseAdmin mostrará versiones, estado (activo/archivado), y conteo de chunks; ClauseSelector permitirá seleccionar múltiples clausulados por aseguradora con visualización de versión
- **Breaking**: Eliminar endpoints `/api/rag/clauses/*` (serán reemplazados por `/api/documents`)

## Capabilities

### New Capabilities
- `clause-versioning`: Gestión automática de versiones de clausulados (archivar anterior al subir nueva)
- `clause-seed-cli`: Script CLI interactivo para carga masiva inicial de clausulados de 24 aseguradoras
- `multi-clause-per-insurer`: Soporte para múltiples clausulados activos por aseguradora (General + Particular + Anexos)
- `documents-api-frontend`: Migración de componentes frontend a API persistente de documentos

### Modified Capabilities
- `clause-library-management`: Agregar requisitos de versionado, auto-archivado, y soporte para múltiples documentos por aseguradora
- `clause-selector`: Modificar para soportar selección de múltiples clausulados por aseguradora y mostrar versiones
- `clause-storage`: Actualizar para usar tabla `documents` como única fuente de verdad en lugar de sistema dual
- `document-upload`: Agregar soporte para campo `version` y lógica de reemplazo de versiones anteriores

## Impact

**Archivos afectados:**
- Backend: `server/src/controllers/ragClauseController.ts` (eliminar), `server/src/controllers/clauseController.ts` (eliminar), `server/src/controllers/documentController.ts` (modificar)
- Backend: `server/src/services/documentIndexingService.ts` (modificar para versionado)
- Backend: `server/src/scripts/seedClauses.ts` (nuevo)
- Frontend: `components/ClauseAdmin.tsx` (rediseñar), `components/ClauseSelector.tsx` (rediseñar)
- Frontend: `services/clauseService.ts` (migrar endpoints)
- Database: Agregar índices en `documents` para consultas por `is_active` + `insurer_id`

**APIs:**
- **Eliminar**: `POST /api/rag/clauses`, `GET /api/rag/clauses`, `DELETE /api/rag/clauses`
- **Modificar**: `POST /api/documents` (agregar auto-archivado), `GET /api/documents` (agregar filtro `latest`)

**Costo:** Setup único de ~$0.01 USD para indexar 24 clausulados. Reducción de ~55% en costo por auditoría posterior (no se regeneran embeddings).

**Dependencias:**
- Supabase con pgvector (ya configurado)
- Tablas existentes: insurers, documents, chunks, page_images
- Embedding service con Gemini Embedding 2 (migrar de gemini-embedding-001)
