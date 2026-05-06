## Context

El sistema ComparadorPYME tiene dos flujos de indexación de documentos desconectados:

1. **DocumentIndexingService** (flujo principal de upload): Indexa PDFs en las tablas `documents` + `chunks` usando embeddings de 3072 dimensiones (modelo Gemini)
2. **clauseIndexer** (flujo de análisis avanzado): Indexa en `clause_chunks` + `clause_coverages` usando embeddings de 768 dimensiones

Cuando un usuario sube un clausulado PDF por la plataforma, el flujo #1 se ejecuta correctamente, pero el flujo #2 nunca se dispara. Resultado: los servicios de análisis avanzado no encuentran datos y el chatbot no tiene contexto para responder.

**Estado actual de tablas:**
- `documents`: Tiene 2 clausulados (SBS, HDI)
- `chunks`: Tiene datos de esos 2 documentos
- `clause_chunks`: VACÍA
- `clause_coverages`: VACÍA
- `clause_documents`: No existe (tabla referenciada erróneamente)

## Goals / Non-Goals

**Goals:**
- Conectar el flujo de upload con el sistema de análisis avanzado
- Re-indexar los 2 clausulados existentes sin re-upload
- Corregir referencias a tablas inexistentes
- Validar compatibilidad de embeddings entre sistemas

**Non-Goals:**
- No modificar la arquitectura de embeddings existente
- No cambiar el modelo de datos de `documents` o `chunks`
- No crear nuevos servicios de indexación
- No modificar la UI de upload

## Decisions

### 1. Modificar Controller vs Crear Hook Post-Upload

**Decisión:** Modificar `documentController.createDocument` para llamar `clauseIndexer` después del indexado principal.

**Rationale:**
- Más simple que crear un sistema de eventos/hooks
- Garantiza que ambos sistemas se ejecuten en la misma transacción lógica
- Fácil de entender y mantener

**Alternativas consideradas:**
- Hook/evento post-upload: Más flexible pero overkill para 2 sistemas
- Cron job periódico: No resuelve el problema inmediatamente

### 2. Re-indexar vs Re-upload

**Decisión:** Crear script de re-indexación que lea de `documents` y ejecute `clauseIndexer`.

**Rationale:**
- Preserva los documentos existentes y sus metadatos
- No requiere intervención del usuario
- Puede ejecutarse una sola vez

### 3. Tabla Correcta para Audit

**Decisión:** Cambiar `auditEnrichmentService` para usar `documents` en vez de `clause_documents`.

**Rationale:**
- `clause_documents` no existe en el schema
- `documents` tiene todos los campos necesarios (insurer_id, document_type, etc.)
- `document_insurer_view` ya une documents con insurers

## Risks / Trade-offs

### [Riesgo] Embeddings incompatibles (3072 vs 768 dims)

**Problema:** `DocumentIndexingService` usa `gemini-embedding-001` (3072 dims) pero `ragRetrievalService` espera 768 dims.

**Mitigación:**
- Verificar qué modelo usa `clauseIndexer` actualmente
- Si es diferente, ajustar `clauseIndexer` para usar el mismo modelo que `DocumentIndexingService`
- O crear columna adicional para embeddings de 768 dims

### [Riesgo] Procesamiento duplicado de embeddings

**Problema:** Se generarán embeddings dos veces para cada clausulado (una para `chunks`, otra para `clause_chunks`).

**Mitigación:**
- Aceptable para <100 documentos
- No afecta la funcionalidad existente
- Optimización futura: compartir embeddings entre tablas

### [Riesgo] Función RPC no existe

**Problema:** `ragRetrievalService` llama a `match_clauses` RPC que podría no existir en Supabase.

**Mitigación:**
- Verificar existencia antes de implementar
- Si no existe, documentar como requisito de migración DB

## Migration Plan

### Fase 1: Verificación (0 riesgo)
1. Verificar que función `match_clauses` RPC existe en Supabase
2. Verificar dimensiones de embeddings en ambas tablas
3. Verificar que `clauseIndexer` funciona con documentos en storage

### Fase 2: Corrección de Tabla (bajo riesgo)
1. Corregir `auditEnrichmentService.ts` para usar `documents`
2. Deploy rápido (sin cambios funcionales visibles)

### Fase 3: Re-indexación (bajo riesgo)
1. Ejecutar script de re-indexación para SBS y HDI
2. Verificar que `clause_chunks` tiene datos

### Fase 4: Modificación de Upload (medio riesgo)
1. Modificar `documentController.createDocument`
2. Agregar llamada condicional a `clauseIndexer`
3. Probar upload de nuevo clausulado
4. Verificar que ambas tablas se poblan

### Rollback
- Revertir cambios en controller
- Los datos en `clause_chunks` permanecen pero no se actualizan
- El flujo principal sigue funcionando

## Open Questions

1. ¿Qué modelo de embeddings usa `clauseIndexer` actualmente?
2. ¿La función `match_clauses` RPC existe en producción?
3. ¿Es necesario modificar el schema de `clause_chunks` para soportar embeddings de 3072 dims?
